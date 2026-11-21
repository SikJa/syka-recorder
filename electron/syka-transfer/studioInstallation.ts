import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface StudioInstallation {
	executable: string;
	cli: string;
	/** From the bundled app's package.json; null when it cannot be read. */
	version: string | null;
}

export async function studioInstallation(executable: unknown): Promise<StudioInstallation | null> {
	if (typeof executable !== "string" || !path.isAbsolute(executable)) return null;
	if (path.basename(executable).toLowerCase() !== "syka studio.exe") return null;
	const resources = path.join(path.dirname(executable), "resources");
	const cli = path.join(resources, "cli", "dapi.js");
	try {
		await access(executable);
		await access(cli);
	} catch {
		return null;
	}
	let version: string | null = null;
	try {
		const manifest = JSON.parse(
			await readFile(path.join(resources, "app", "package.json"), "utf8"),
		);
		if (typeof manifest?.version === "string") version = manifest.version;
	} catch {
		/* Older or packed builds: still usable, ranked below known versions. */
	}
	return { executable, cli, version };
}

function compareVersions(a: string | null, b: string | null): number {
	if (a === b) return 0;
	if (a === null) return -1;
	if (b === null) return 1;
	return a.localeCompare(b, "en", { numeric: true });
}

/**
 * The newest valid installation among `candidates`; on a tie the earlier one
 * wins, so callers list the user's own choice first. Several copies can live
 * side by side (an installer copy and a portable one), and an older copy must
 * not take over just because it sits in a standard folder.
 */
export async function newestStudioInstallation(
	candidates: unknown[],
): Promise<StudioInstallation | null> {
	let best: StudioInstallation | null = null;
	const seen = new Set<string>();
	for (const candidate of candidates) {
		const found = await studioInstallation(candidate);
		if (!found || seen.has(found.executable.toLowerCase())) continue;
		seen.add(found.executable.toLowerCase());
		if (!best || compareVersions(found.version, best.version) > 0) best = found;
	}
	return best;
}

/** Standard Windows and Squirrel installs. Never depend on a developer's drive. */
export async function installedStudioCandidates(env = process.env): Promise<string[]> {
	const roots = [env.LOCALAPPDATA, env.ProgramFiles, env["ProgramFiles(x86)"]].filter(
		(root): root is string => Boolean(root),
	);
	const candidates: string[] = [];
	for (const root of roots) {
		for (const name of ["SykaStudio", "Syka Studio", "syka-studio"]) {
			for (const directory of [path.join(root, name), path.join(root, "Programs", name)]) {
				const versions = (await readdir(directory, { withFileTypes: true }).catch(() => []))
					.filter(
						(entry) =>
							entry.isDirectory() &&
							/^app-\d+(?:\.\d+)*(?:[-+][\w.-]+)?$/.test(entry.name),
					)
					.map((entry) => entry.name)
					.sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
				// Squirrel's newest version must win over an obsolete root executable.
				for (const version of versions)
					candidates.push(path.join(directory, version, "Syka Studio.exe"));
				candidates.push(path.join(directory, "Syka Studio.exe"));
			}
		}
	}
	return [...new Set(candidates)];
}
