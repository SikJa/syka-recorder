import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/** A transfer is a complete native project, not a manifest attachment. */
export async function validateStudioProject(directory: string) {
	const root = path.resolve(directory);
	const requireFile = async (relative: string) => {
		const target = path.resolve(root, relative);
		const inside = path.relative(root, target);
		if (!inside || inside.startsWith("..") || path.isAbsolute(inside))
			throw new Error("El paquete contiene una ruta de archivo inválida.");
		const file = await stat(target).catch(() => null);
		if (!file?.isFile() || file.size === 0)
			throw new Error(
				`Falta ${relative} en el proyecto. Conservá la carpeta completa o volvé a guardarlo desde Recorder.`,
			);
	};
	for (const name of ["manifest.json", "index.tsx", "assets.yml", "package.json"])
		await requireFile(name);
	const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
	if (
		manifest.format !== "syka-recorder-transfer" ||
		!Array.isArray(manifest.assets) ||
		!manifest.assets.some((asset: { id?: string }) => asset.id === "screen")
	)
		throw new Error("Esta carpeta no contiene un proyecto completo de Syka Recorder.");
	for (const asset of manifest.assets) {
		if (typeof asset.path !== "string")
			throw new Error("El paquete contiene un medio sin ruta.");
		await requireFile(asset.path);
	}
}
