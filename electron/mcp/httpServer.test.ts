import { request } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { McpHttpServer } from "./httpServer";

const port = 42_000 + Math.floor(Math.random() * 2_000);
const initialize = JSON.stringify({
	jsonrpc: "2.0",
	id: 1,
	method: "initialize",
	params: {
		protocolVersion: "2025-06-18",
		capabilities: {},
		clientInfo: { name: "test", version: "1.0.0" },
	},
});

function post(headers: Record<string, string>, body = initialize) {
	return new Promise<{ status: number; body: string; headers: Record<string, unknown> }>(
		(resolve, reject) => {
			const req = request(
				{
					host: "127.0.0.1",
					port,
					path: "/mcp",
					method: "POST",
					headers: {
						"content-type": "application/json",
						accept: "application/json, text/event-stream",
						...headers,
					},
				},
				(res) => {
					let data = "";
					res.on("data", (chunk) => {
						data += chunk;
					});
					res.on("end", () =>
						resolve({ status: res.statusCode ?? 0, body: data, headers: res.headers }),
					);
				},
			);
			req.on("error", reject);
			req.end(body);
		},
	);
}

describe("McpHttpServer", () => {
	const server = new McpHttpServer({
		host: "127.0.0.1",
		port,
		path: "/mcp",
		createSession: () => new McpServer({ name: "test", version: "1.0.0" }),
	});
	beforeAll(() => server.start());
	afterAll(() => server.stop());

	it("initializes a session for a local client", async () => {
		const response = await post({ host: `127.0.0.1:${port}` });
		expect(response.status).toBe(200);
		expect(response.headers["mcp-session-id"]).toBeTypeOf("string");
		expect(response.headers["access-control-allow-origin"]).toBeUndefined();
	});

	it("refuses browser requests that carry an Origin", async () => {
		const response = await post({ host: `127.0.0.1:${port}`, origin: "https://evil.example" });
		expect(response.status).toBe(403);
		expect(response.headers["access-control-allow-origin"]).toBeUndefined();
	});

	it("refuses a rebound Host", async () => {
		const response = await post({ host: `evil.example:${port}` });
		expect(response.status).toBe(403);
	});

	it("answers 404 off the endpoint path and for unknown sessions", async () => {
		const unknown = await post({ host: `localhost:${port}`, "mcp-session-id": "nope" });
		expect(unknown.status).toBe(404);
	});

	it("reports a busy port instead of crashing", async () => {
		const twin = new McpHttpServer({
			host: "127.0.0.1",
			port,
			path: "/mcp",
			createSession: () => new McpServer({ name: "test", version: "1.0.0" }),
		});
		await expect(twin.start()).rejects.toMatchObject({ code: "EADDRINUSE" });
		expect(twin.listening).toBe(false);
	});
});
