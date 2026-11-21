export const MCP_ENABLED_SETTING = "syka.mcp.enabled";
export const MCP_HOST = "127.0.0.1";
export const MCP_PATH = "/mcp";
export const DEFAULT_MCP_PORT = 4171;
export const MCP_PORT_ENV = "SYKA_RECORDER_MCP_PORT";

/** On unless the person turned it off: only `false` disables it. */
export function isMcpEnabled(readSetting: (key: string) => unknown): boolean {
	return readSetting(MCP_ENABLED_SETTING) !== false;
}

/** The env override isolates a second copy of the app; anything invalid keeps the default. */
export function resolveMcpPort(env: Record<string, string | undefined>): {
	port: number;
	warning: string | null;
} {
	const raw = env[MCP_PORT_ENV]?.trim();
	if (!raw) return { port: DEFAULT_MCP_PORT, warning: null };
	const port = Number(raw);
	if (!Number.isInteger(port) || port < 1024 || port > 65535) {
		return {
			port: DEFAULT_MCP_PORT,
			warning: `${MCP_PORT_ENV}=${raw} is not a port between 1024 and 65535; using ${DEFAULT_MCP_PORT}.`,
		};
	}
	return { port, warning: null };
}

export function mcpEndpointUrl(port: number): string {
	return `http://${MCP_HOST}:${port}${MCP_PATH}`;
}
