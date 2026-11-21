import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import {
	installedStudioCandidates,
	newestStudioInstallation,
	studioInstallation,
} from "./studioInstallation";
const temporary: string[] = [];
afterEach(async () => {
	for (const dir of temporary.splice(0)) await rm(dir, { recursive: true, force: true });
});

it("discovers Squirrel versions numerically and validates the bundled CLI", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "studio-install-"));
	temporary.push(root);
	for (const version of ["app-0.9.0", "app-0.209.0"]) {
		const dir = path.join(root, "SykaStudio", version);
		await mkdir(path.join(dir, "resources", "cli"), { recursive: true });
		await writeFile(path.join(dir, "Syka Studio.exe"), "fixture");
		await writeFile(path.join(dir, "resources", "cli", "dapi.js"), "fixture");
	}
	const candidates = await installedStudioCandidates({ LOCALAPPDATA: root });
	expect(candidates[0]).toBe(path.join(root, "SykaStudio", "app-0.209.0", "Syka Studio.exe"));
	expect(await studioInstallation(candidates[0])).not.toBeNull();
	expect(candidates).toContain(path.join(root, "Programs", "Syka Studio", "Syka Studio.exe"));
	expect(await studioInstallation(path.join(root, "other.exe"))).toBeNull();
	await rm(path.join(root, "SykaStudio", "app-0.209.0", "resources", "cli", "dapi.js"));
	expect(await studioInstallation(candidates[0])).toBeNull();
});

async function fakeStudio(directory: string, version?: string) {
	await mkdir(path.join(directory, "resources", "cli"), { recursive: true });
	await mkdir(path.join(directory, "resources", "app"), { recursive: true });
	await writeFile(path.join(directory, "Syka Studio.exe"), "fixture");
	await writeFile(path.join(directory, "resources", "cli", "dapi.js"), "fixture");
	if (version)
		await writeFile(
			path.join(directory, "resources", "app", "package.json"),
			JSON.stringify({ version }),
		);
	return path.join(directory, "Syka Studio.exe");
}

it("opens the newest copy, not an older installer copy in a standard folder", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "studio-newest-"));
	temporary.push(root);
	const installer = await fakeStudio(path.join(root, "SykaStudio", "app-0.212.2"), "0.212.2");
	const portable = await fakeStudio(
		path.join(root, "Programas", "Syka Studio", "Aplicacion"),
		"0.212.10",
	);
	expect((await newestStudioInstallation([installer, portable]))?.executable).toBe(portable);
	expect((await newestStudioInstallation([portable, installer]))?.version).toBe("0.212.10");
	// Same version: the earlier candidate (the user's previous choice) wins.
	const twin = await fakeStudio(path.join(root, "Twin"), "0.212.10");
	expect((await newestStudioInstallation([twin, portable]))?.executable).toBe(twin);
	// Unknown versions rank last but still work alone.
	const unknown = await fakeStudio(path.join(root, "Unknown"));
	expect((await newestStudioInstallation([unknown, installer]))?.executable).toBe(installer);
	expect((await newestStudioInstallation([unknown, "relative.exe", null]))?.version).toBeNull();
	expect(await newestStudioInstallation([])).toBeNull();
});
