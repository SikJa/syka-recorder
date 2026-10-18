import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const keys = ["SYKA_RUNTIME_ROOT", "SYKA_MEDIA_ROOT", "npm_config_cache", "ELECTRON_CACHE"];

/** Read only literal path assignments from the installation's existing launcher.
 * Never execute the launcher or copy credentials from a profile. */
export function launcherPaths(source: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const key of keys) {
		const match = source.match(
			new RegExp(`^\\s*\\$env:${key}\\s*=\\s*(['"])([^\\r\\n]+)\\1\\s*$`, "mi"),
		);
		if (!match) continue;
		const value = match[2];
		if (!path.win32.isAbsolute(value) || /[$`]/.test(value))
			throw new Error(`El lanzador de Studio contiene una ruta no compatible: ${key}.`);
		result[key] = value;
	}
	return result;
}

export async function studioEnvironment(executable: string, inherited = process.env) {
	const env: NodeJS.ProcessEnv = { ...inherited, ELECTRON_RUN_AS_NODE: "1" };
	for (const key of [
		"NODE_OPTIONS",
		"SYKA_PROJECT_MCP_URL",
		"SYKA_MCP_PORT",
		"SYKA_DEV_RUN",
		"SYKA_UPDATE_DEMO",
		"SYKA_DEV_URL",
		"SYKA_RUNTIME_ROOT",
		"SYKA_MEDIA_ROOT",
		"SYKA_RECORDER_USER_DATA",
	])
		delete env[key];
	const directory = path.dirname(executable);
	for (const root of [directory, path.dirname(directory)]) {
		let source: string;
		try {
			source = await readFile(path.join(root, "Abrir Syka Studio.ps1"), "utf8");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
			throw error;
		}
		const configured = launcherPaths(source);
		if (!configured.SYKA_RUNTIME_ROOT) continue;
		Object.assign(env, configured);
		break;
	}
	if (env.SYKA_RUNTIME_ROOT) {
		if (
			!path.isAbsolute(env.SYKA_RUNTIME_ROOT) ||
			!(await stat(env.SYKA_RUNTIME_ROOT).catch(() => null))?.isDirectory()
		)
			throw new Error(
				"No se encuentra el perfil habitual de Studio. Abrilo desde tu acceso directo y reintentá.",
			);
	}
	return env;
}
