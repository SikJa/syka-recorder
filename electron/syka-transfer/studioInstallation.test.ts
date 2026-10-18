import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { installedStudioCandidates, studioInstallation } from "./studioInstallation";
const temporary: string[] = [];
afterEach(async () => { for (const dir of temporary.splice(0)) await rm(dir, { recursive: true, force: true }); });

it("discovers Squirrel versions numerically and validates the bundled CLI", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "studio-install-")); temporary.push(root);
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
