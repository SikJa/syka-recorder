import { useEffect, useRef } from "react";
import type { McpBridgeCommand, McpBridgeHandlers, McpBridgeRequest } from "./contract";

type AnyHandler = (args: unknown, context: Parameters<NonNullable<McpBridgeHandlers["editor.state"]>>[1]) => Promise<unknown>;

/**
 * Answers the MCP server's commands for this window. Handlers may change on
 * every render; the latest ones answer. The window tells main which commands
 * it serves while mounted, so requests wait for a window that is still loading.
 */
export function useMcpBridge(handlers: McpBridgeHandlers) {
	const latest = useRef(handlers);
	latest.current = handlers;
	const commands = Object.keys(handlers).sort().join(",");

	useEffect(() => {
		const api = typeof window === "undefined" ? undefined : window.electronAPI;
		if (!api?.onMcpBridgeRequest || !api.replyMcpBridge || !api.announceMcpBridge) return;
		const unsubscribe = api.onMcpBridgeRequest(async (request: McpBridgeRequest) => {
			const handler = latest.current[request.command as McpBridgeCommand] as
				| AnyHandler
				| undefined;
			if (!handler) {
				api.replyMcpBridge({
					id: request.id,
					kind: "result",
					ok: false,
					error: `This window does not handle ${request.command}.`,
				});
				return;
			}
			try {
				const result = await handler(request.args, {
					progress: (progress) =>
						api.replyMcpBridge({ id: request.id, kind: "progress", progress }),
				});
				api.replyMcpBridge({ id: request.id, kind: "result", ok: true, result });
			} catch (error) {
				api.replyMcpBridge({
					id: request.id,
					kind: "result",
					ok: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		});
		api.announceMcpBridge(commands ? commands.split(",") : []);
		return () => {
			unsubscribe();
			api.announceMcpBridge([]);
		};
	}, [commands]);
}

/** Resolves once `ready()` holds, re-checking after renders; rejects after `timeoutMs`. */
export async function waitFor(
	ready: () => boolean,
	timeoutMs: number,
	message: string,
	intervalMs = 100,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!ready()) {
		if (Date.now() > deadline) throw new Error(message);
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}
