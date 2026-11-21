import type { IncomingHttpHeaders } from "node:http";

export type GuardVerdict = { ok: true } | { ok: false; status: number; message: string };

function single(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

/**
 * The endpoint can start screen recordings, so only local programs that talk
 * to it directly get through. Browsers always send `Origin` on cross-origin
 * requests and a DNS-rebound page still sends its own host name, so either
 * one is refused. No CORS headers are ever sent.
 */
export function checkMcpRequest(headers: IncomingHttpHeaders, port: number): GuardVerdict {
	if (headers.origin !== undefined) {
		return { ok: false, status: 403, message: "Requests from web pages are not allowed." };
	}
	const host = single(headers.host)?.trim().toLowerCase();
	const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
	if (!host || !allowed.includes(host)) {
		return { ok: false, status: 403, message: "Invalid Host header." };
	}
	return { ok: true };
}
