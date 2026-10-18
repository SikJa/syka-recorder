import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { launcherPaths, studioEnvironment } from "./studioEnvironment";

const temporary: string[] = [];
afterEach(async () => {
	for (const directory of temporary.splice(0))
		await rm(directory, { recursive: true, force: true });
});

it("reads profile and media paths without evaluating PowerShell or copying credentials", () => {
	expect(
		launcherPaths(
			"$env:SYKA_RUNTIME_ROOT='E:\\Syka Studio\\Datos'\n$env:SYKA_MEDIA_ROOT='E:\\Media'\n$env:API_KEY='secret'\nStart-Process anything",
		),
	).toEqual({
		SYKA_RUNTIME_ROOT: "E:\\Syka Studio\\Datos",
		SYKA_MEDIA_ROOT: "E:\\Media",
	});
	expect(() => launcherPaths('$env:SYKA_RUNTIME_ROOT="$env:HOME\\profile"')).toThrow();
});

it("uses the installation launcher profile rather than inherited QA state", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "studio-env-test-"));
	temporary.push(root);
	const profile = path.join(root, "real-profile");
	await mkdir(profile);
	await writeFile(
		path.join(root, "Abrir Syka Studio.ps1"),
		`$env:SYKA_RUNTIME_ROOT='${profile}'`,
	);
	const env = await studioEnvironment(path.join(root, "Aplicacion", "Syka Studio.exe"), {
		SYKA_RUNTIME_ROOT: path.join(root, "wrong-profile"),
		SYKA_PROJECT_MCP_URL: "wrong",
		SYKA_MCP_PORT: "4999",
		NODE_OPTIONS: "--inspect",
		PATH: "keep",
	});
	expect(env.SYKA_RUNTIME_ROOT).toBe(profile);
	expect(env.ELECTRON_RUN_AS_NODE).toBe("1");
	expect(env.PATH).toBe("keep");
	expect(env.SYKA_PROJECT_MCP_URL).toBeUndefined();
	expect(env.SYKA_MCP_PORT).toBeUndefined();
	expect(env.NODE_OPTIONS).toBeUndefined();
});

it("refuses to create a blank profile when a configured disk is absent", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "studio-missing-profile-"));
	temporary.push(root);
	await writeFile(path.join(root, "Abrir Syka Studio.ps1"), "$env:SYKA_RUNTIME_ROOT='Z:\\missing-syka-profile-test'");
	await expect(
		studioEnvironment(path.join(root, "Syka Studio.exe"), {}),
	).rejects.toThrow("perfil habitual");
});

it("uses Studio's default profile for a standard install without inheriting Recorder/QA overrides", async () => {
	const env = await studioEnvironment("C:\\Standard Studio\\Syka Studio.exe", {
		SYKA_RUNTIME_ROOT: "Z:\\unrelated", SYKA_MEDIA_ROOT: "Z:\\media",
		SYKA_RECORDER_USER_DATA: "Z:\\recorder", SYKA_DEV_URL: "http://localhost:9999", PATH: "keep",
	});
	expect(env.SYKA_RUNTIME_ROOT).toBeUndefined();
	expect(env.SYKA_MEDIA_ROOT).toBeUndefined();
	expect(env.SYKA_DEV_URL).toBeUndefined();
	expect(env.SYKA_RECORDER_USER_DATA).toBeUndefined();
	expect(env.PATH).toBe("keep");
});
