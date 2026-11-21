import { describe, expect, it } from "vitest";
import { checkMcpRequest } from "./httpGuard";

describe("checkMcpRequest", () => {
	it("accepts loopback hosts on the server's port", () => {
		expect(checkMcpRequest({ host: "127.0.0.1:4171" }, 4171)).toEqual({ ok: true });
		expect(checkMcpRequest({ host: "localhost:4171" }, 4171)).toEqual({ ok: true });
		expect(checkMcpRequest({ host: "LOCALHOST:4171" }, 4171)).toEqual({ ok: true });
	});

	it("rejects any request with an Origin header, even a loopback one", () => {
		for (const origin of ["http://127.0.0.1:4171", "https://evil.example", "null", ""]) {
			const verdict = checkMcpRequest({ host: "127.0.0.1:4171", origin }, 4171);
			expect(verdict).toMatchObject({ ok: false, status: 403 });
		}
	});

	it("rejects rebound, foreign or missing hosts", () => {
		for (const host of [
			"evil.example:4171",
			"127.0.0.1",
			"localhost",
			"127.0.0.1:4172",
			"0.0.0.0:4171",
			"[::1]:4171",
			"127.0.0.1.evil.example:4171",
		]) {
			expect(checkMcpRequest({ host }, 4171)).toMatchObject({ ok: false, status: 403 });
		}
		expect(checkMcpRequest({}, 4171)).toMatchObject({ ok: false, status: 403 });
	});

	it("checks the port it was started on", () => {
		expect(checkMcpRequest({ host: "127.0.0.1:5000" }, 5000)).toEqual({ ok: true });
		expect(checkMcpRequest({ host: "127.0.0.1:4171" }, 5000)).toMatchObject({ ok: false });
	});
});
