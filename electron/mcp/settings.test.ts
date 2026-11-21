import { describe, expect, it } from "vitest";
import {
	DEFAULT_MCP_PORT,
	isMcpEnabled,
	MCP_ENABLED_SETTING,
	mcpEndpointUrl,
	resolveMcpPort,
} from "./settings";

describe("isMcpEnabled", () => {
	it("is on when the setting was never saved", () => {
		expect(isMcpEnabled(() => null)).toBe(true);
		expect(isMcpEnabled(() => undefined)).toBe(true);
	});

	it("reads the syka.mcp.enabled key and only an explicit false turns it off", () => {
		const keys: string[] = [];
		const read = (value: unknown) => (key: string) => {
			keys.push(key);
			return value;
		};
		expect(isMcpEnabled(read(false))).toBe(false);
		expect(isMcpEnabled(read(true))).toBe(true);
		expect(isMcpEnabled(read("false"))).toBe(true);
		expect(keys.every((key) => key === MCP_ENABLED_SETTING)).toBe(true);
		expect(MCP_ENABLED_SETTING).toBe("syka.mcp.enabled");
	});
});

describe("resolveMcpPort", () => {
	it("defaults to 4171", () => {
		expect(DEFAULT_MCP_PORT).toBe(4171);
		expect(resolveMcpPort({})).toEqual({ port: 4171, warning: null });
		expect(resolveMcpPort({ SYKA_RECORDER_MCP_PORT: "  " })).toEqual({ port: 4171, warning: null });
	});

	it("takes SYKA_RECORDER_MCP_PORT when it is a valid port", () => {
		expect(resolveMcpPort({ SYKA_RECORDER_MCP_PORT: "4199" })).toEqual({ port: 4199, warning: null });
	});

	it("keeps the default and warns on invalid values", () => {
		for (const value of ["80", "70000", "abc", "4171.5"]) {
			const result = resolveMcpPort({ SYKA_RECORDER_MCP_PORT: value });
			expect(result.port).toBe(4171);
			expect(result.warning).toContain("SYKA_RECORDER_MCP_PORT");
		}
	});

	it("builds the loopback endpoint URL", () => {
		expect(mcpEndpointUrl(4171)).toBe("http://127.0.0.1:4171/mcp");
	});
});
