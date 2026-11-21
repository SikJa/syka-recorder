import { randomUUID } from "node:crypto";
import {
	type ExportProgressUpdate,
	MCP_BRIDGE_REQUEST,
	type McpBridgeCommand,
	type McpBridgeCommands,
	type McpBridgeReply,
	type McpBridgeRequest,
} from "../../src/lib/mcpBridge/contract";

/** The part of a WebContents the bridge uses, so tests can stand one in. */
export type BridgeTarget = {
	id: number;
	isDestroyed(): boolean;
	send(channel: string, payload: McpBridgeRequest): void;
};

export type BridgeRequestOptions = {
	/** Fails when the window has not answered for this long; progress restarts the clock. */
	timeoutMs?: number;
	/** How long to wait for the window to announce the command after it loads. */
	readyTimeoutMs?: number;
	signal?: AbortSignal;
	onProgress?: (progress: ExportProgressUpdate) => void;
};

type InFlight = {
	contentsId: number;
	resolve(result: unknown): void;
	reject(error: Error): void;
	progress(update: ExportProgressUpdate): void;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_READY_TIMEOUT_MS = 20_000;

export class McpBridgeError extends Error {}

/**
 * Main's half of the MCP bridge: sends one request per command to a renderer
 * and settles it with that renderer's reply. A window that reloads or closes
 * fails the requests it had; a window that never answers times out.
 */
export class RendererBridge {
	private readonly inFlight = new Map<string, InFlight>();
	private readonly ready = new Map<number, Set<string>>();
	private readonly readyWaiters = new Set<() => void>();

	/** A renderer listed the commands it answers; an empty list means it stopped. */
	announce(contentsId: number, commands: unknown): void {
		const list = Array.isArray(commands)
			? commands.filter((command): command is string => typeof command === "string")
			: [];
		if (list.length === 0) this.ready.delete(contentsId);
		else this.ready.set(contentsId, new Set(list));
		for (const wake of [...this.readyWaiters]) wake();
	}

	supports(contentsId: number, command: McpBridgeCommand): boolean {
		return this.ready.get(contentsId)?.has(command) ?? false;
	}

	/** The window reloaded, crashed or closed. */
	forget(contentsId: number, reason: string): void {
		this.ready.delete(contentsId);
		for (const [id, call] of this.inFlight) {
			if (call.contentsId !== contentsId) continue;
			this.inFlight.delete(id);
			call.reject(new McpBridgeError(reason));
		}
	}

	/** Replies are accepted only from the window the request went to. */
	reply(contentsId: number, message: unknown): void {
		const reply = message as McpBridgeReply | null;
		if (!reply || typeof reply !== "object" || typeof reply.id !== "string") return;
		const call = this.inFlight.get(reply.id);
		if (!call || call.contentsId !== contentsId) return;
		if (reply.kind === "progress") {
			call.progress(reply.progress);
			return;
		}
		if (reply.kind !== "result") return;
		this.inFlight.delete(reply.id);
		if (reply.ok) call.resolve(reply.result);
		else call.reject(new McpBridgeError(String(reply.error || "The window refused the command.")));
	}

	async request<K extends McpBridgeCommand>(
		target: BridgeTarget,
		command: K,
		args: McpBridgeCommands[K]["args"],
		options: BridgeRequestOptions = {},
	): Promise<McpBridgeCommands[K]["result"]> {
		await this.waitUntilReady(target, command, options);
		const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		const id = randomUUID();
		return new Promise((resolve, reject) => {
			let timer: ReturnType<typeof setTimeout> | undefined;
			const armTimer = () => {
				if (timer) clearTimeout(timer);
				timer = setTimeout(() => {
					this.inFlight.delete(id);
					cleanup();
					reject(
						new McpBridgeError(
							`The app did not answer ${command} within ${Math.round(timeoutMs / 1000)} s.`,
						),
					);
				}, timeoutMs);
			};
			const onAbort = () => {
				this.inFlight.delete(id);
				cleanup();
				reject(new McpBridgeError("The request was canceled."));
			};
			const cleanup = () => {
				if (timer) clearTimeout(timer);
				options.signal?.removeEventListener("abort", onAbort);
			};
			if (options.signal?.aborted) {
				reject(new McpBridgeError("The request was canceled."));
				return;
			}
			options.signal?.addEventListener("abort", onAbort, { once: true });
			this.inFlight.set(id, {
				contentsId: target.id,
				resolve: (result) => {
					cleanup();
					resolve(result as McpBridgeCommands[K]["result"]);
				},
				reject: (error) => {
					cleanup();
					reject(error);
				},
				progress: (update) => {
					armTimer();
					options.onProgress?.(update);
				},
			});
			armTimer();
			try {
				if (target.isDestroyed()) throw new McpBridgeError("The window is closed.");
				target.send(MCP_BRIDGE_REQUEST, { id, command, args });
			} catch (error) {
				this.inFlight.get(id)?.reject(
					error instanceof Error ? error : new McpBridgeError(String(error)),
				);
				this.inFlight.delete(id);
			}
		});
	}

	/** Fails everything still waiting; used when the server stops. */
	stop(): void {
		for (const call of this.inFlight.values()) call.reject(new McpBridgeError("The app stopped."));
		this.inFlight.clear();
	}

	private waitUntilReady(
		target: BridgeTarget,
		command: McpBridgeCommand,
		options: BridgeRequestOptions,
	): Promise<void> {
		if (this.supports(target.id, command)) return Promise.resolve();
		const timeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
		return new Promise((resolve, reject) => {
			const finish = (error?: Error) => {
				clearTimeout(timer);
				this.readyWaiters.delete(check);
				options.signal?.removeEventListener("abort", onAbort);
				if (error) reject(error);
				else resolve();
			};
			const check = () => {
				if (target.isDestroyed()) finish(new McpBridgeError("The window is closed."));
				else if (this.supports(target.id, command)) finish();
			};
			const onAbort = () => finish(new McpBridgeError("The request was canceled."));
			const timer = setTimeout(
				() =>
					finish(
						new McpBridgeError(
							`The window did not become ready for ${command} within ${Math.round(timeoutMs / 1000)} s.`,
						),
					),
				timeoutMs,
			);
			this.readyWaiters.add(check);
			options.signal?.addEventListener("abort", onAbort, { once: true });
			check();
		});
	}
}
