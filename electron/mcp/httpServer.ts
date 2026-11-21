// MCP over Streamable HTTP on a fixed loopback port, the same shape Syka
// Studio serves: one MCP session per client, keyed by the session id the
// transport hands out on `initialize`. No token: the socket only listens on
// loopback and `checkMcpRequest` turns away browsers and rebound host names.

import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { checkMcpRequest } from "./httpGuard";

export type McpHttpServerOptions = {
	host: string;
	port: number;
	path: string;
	/** A fresh MCP server with every tool registered, one per session. */
	createSession(): McpServer;
};

type Session = { transport: StreamableHTTPServerTransport; server: McpServer };

const SESSION_HEADER = "mcp-session-id";

export class McpHttpServer {
	private readonly options: McpHttpServerOptions;
	private readonly sessions = new Map<string, Session>();
	private server: Server | null = null;

	constructor(options: McpHttpServerOptions) {
		this.options = options;
	}

	get url(): string {
		return `http://${this.options.host}:${this.options.port}${this.options.path}`;
	}

	get listening(): boolean {
		return this.server !== null;
	}

	/** Resolves once listening; rejects when the port is taken, so the caller can say so. */
	start(): Promise<void> {
		if (this.server) return Promise.resolve();
		return new Promise((resolve, reject) => {
			const server = createServer((req, res) => void this.handle(req, res));
			server.once("error", reject);
			server.listen(this.options.port, this.options.host, () => {
				server.off("error", reject);
				server.on("error", (error) => console.error("[mcp] HTTP server error:", error));
				this.server = server;
				resolve();
			});
		});
	}

	async stop(): Promise<void> {
		for (const { transport, server } of this.sessions.values()) {
			void transport.close().catch(() => undefined);
			void server.close().catch(() => undefined);
		}
		this.sessions.clear();
		const server = this.server;
		this.server = null;
		if (!server) return;
		await new Promise<void>((resolve) => {
			server.close(() => resolve());
			server.closeAllConnections?.();
		});
	}

	private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const verdict = checkMcpRequest(req.headers, this.options.port);
		if (!verdict.ok) {
			res.writeHead(verdict.status, { "content-type": "text/plain" }).end(verdict.message);
			return;
		}
		const url = new URL(req.url ?? "/", this.url);
		if (url.pathname !== this.options.path) {
			res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
			return;
		}
		try {
			const id = header(req, SESSION_HEADER);
			const existing = id === undefined ? undefined : this.sessions.get(id);
			if (existing) {
				await existing.transport.handleRequest(req, res);
				return;
			}
			if (id !== undefined) {
				res.writeHead(404, { "content-type": "application/json" }).end(
					JSON.stringify({
						jsonrpc: "2.0",
						error: { code: -32001, message: "Session not found" },
						id: null,
					}),
				);
				return;
			}
			// No session yet: an `initialize`, which the transport answers with a
			// new id, or a stray request it rejects with 400.
			await this.open().transport.handleRequest(req, res);
		} catch (error) {
			console.error("[mcp] Request failed:", error);
			if (!res.headersSent)
				res.writeHead(500, { "content-type": "text/plain" }).end("Internal error");
		}
	}

	private open(): Session {
		const server = this.options.createSession();
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: () => randomUUID(),
			onsessioninitialized: (id) => {
				this.sessions.set(id, session);
			},
			onsessionclosed: (id) => {
				this.sessions.delete(id);
			},
		});
		const session: Session = { transport, server };
		transport.onclose = () => {
			if (transport.sessionId !== undefined) this.sessions.delete(transport.sessionId);
		};
		void server.connect(transport);
		return session;
	}
}

function header(req: IncomingMessage, name: string): string | undefined {
	const value = req.headers[name];
	return Array.isArray(value) ? value[0] : value;
}
