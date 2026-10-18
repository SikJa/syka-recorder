import { access, readdir } from "node:fs/promises";
import path from "node:path";

export async function studioInstallation(executable: unknown) {
	if (typeof executable !== "string" || !path.isAbsolute(executable)) return null;
	if (path.basename(executable).toLowerCase() !== "syka studio.exe") return null;
	const cli = path.join(path.dirname(executable), "resources", "cli", "dapi.js");
	try {
		await access(executable);
		await access(cli);
		return { executable, cli };
	} catch {
		return null;
	}
}

/** Standard Windows and Squirrel installs. Never depend on a developer's drive. */
export async function installedStudioCandidates(env = process.env): Promise<string[]> {
	const roots = [env.LOCALAPPDATA, env.ProgramFiles, env["ProgramFiles(x86)"]]
		.filter((root): root is string => Boolean(root));
	const candidates: string[] = [];
	for (const root of roots) {
		for (const name of ["SykaStudio", "Syka Studio", "syka-studio"]) {
			for (const directory of [path.join(root, name), path.join(root, "Programs", name)]) {
				const versions = (await readdir(directory, { withFileTypes: true }).catch(() => []))
					.filter(entry => entry.isDirectory() && /^app-\d+(?:\.\d+)*(?:[-+][\w.-]+)?$/.test(entry.name))
					.map(entry => entry.name)
					.sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
				// Squirrel's newest version must win over an obsolete root executable.
				for (const version of versions) candidates.push(path.join(directory, version, "Syka Studio.exe"));
				candidates.push(path.join(directory, "Syka Studio.exe"));
			}
		}
	}
	return [...new Set(candidates)];
}
