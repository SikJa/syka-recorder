import { SYKA_PACKAGE_FOLDERS } from "../../src/lib/sykaExport/contract";

export const PACKAGE_FOLDERS = SYKA_PACKAGE_FOLDERS;

const pad = (value: number) => String(value).padStart(2, "0");

/** "<name> - 2026-11-21 10-32": readable and sortable; Windows forbids ":". */
export function packageFolderName(safeName: string, date: Date, attempt = 1): string {
	const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}`;
	return `${safeName} - ${stamp}${attempt > 1 ? ` (${attempt})` : ""}`;
}

/** Plain file name for each package asset, by what it is to the person. */
export function packageFileName(
	asset: { id: string; role: string },
	extension: string,
	options: { preparedWebcam: boolean },
): string {
	const { recording, originals, technical } = PACKAGE_FOLDERS;
	const numbered = asset.id.match(/-(\d+)$/)?.[1];
	switch (asset.id) {
		case "screen":
			return `${recording}/Pantalla${extension}`;
		case "original-screen":
			return `${originals}/Pantalla original${extension}`;
		case "webcam":
			return options.preparedWebcam
				? `${originals}/Cámara original${extension}`
				: `${recording}/Cámara${extension}`;
		case "webcam-studio":
			return `${recording}/Cámara${extension}`;
		case "background":
			return `${recording}/Fondo${extension}`;
		case "screen-mask":
			return `${technical}/mascara-pantalla${extension}`;
		case "screen-shadow":
			return `${technical}/sombra-pantalla${extension}`;
	}
	if (asset.role === "mic") return `${recording}/Micrófono${extension}`;
	if (asset.role === "system") return `${recording}/Audio del sistema${extension}`;
	if (asset.role === "added-audio")
		return `${recording}/Audio agregado${numbered ? ` ${numbered}` : ""}${extension}`;
	if (asset.id.startsWith("audio-"))
		return `${recording}/Audio${numbered ? ` ${numbered}` : ""}${extension}`;
	return `${technical}/${asset.id}${extension}`;
}

/** Keeps every path distinct ("Micrófono.wav", "Micrófono 2.wav") without
 * relying on case-sensitive file systems. */
export function uniquePath(wanted: string, taken: Set<string>): string {
	const dot = wanted.lastIndexOf(".");
	const slash = wanted.lastIndexOf("/");
	const stem = dot > slash ? wanted.slice(0, dot) : wanted;
	const extension = dot > slash ? wanted.slice(dot) : "";
	let candidate = wanted;
	for (let index = 2; taken.has(candidate.toLowerCase()); index++)
		candidate = `${stem} ${index}${extension}`;
	taken.add(candidate.toLowerCase());
	return candidate;
}

export function packageReadme(warnings: string[]): string {
	const { recording, finals, originals, technical } = PACKAGE_FOLDERS;
	return [
		"Proyecto de Syka Recorder para seguir editando en Syka Studio.",
		"",
		"Para editar: abrí esta carpeta en Syka Studio, o tocá Abrir en Syka Studio desde Recorder.",
		"",
		`${recording}: lo que grabaste, listo para editar. Pantalla.mp4 es solo la pantalla, sin fondo, cámara ni zooms.`,
		`${finals}: el video terminado, con fondo, cámara y zooms, si lo exportaste desde Recorder. Lo que exportes desde Studio también queda acá.`,
		`${originals}: la captura tal como salió, por si querés rehacer algo.`,
		`${technical}: lo que Studio y Recorder necesitan por dentro.`,
		"",
		`No borres ni muevas index.tsx, package.json, assets.yml, manifest.json ni ${technical}: sin ellos Studio no abre el proyecto.`,
		"Los archivos .recordly guardan rutas de esta computadora y no se publican.",
		...(warnings.length
			? ["", "Para tener en cuenta:", ...warnings.map((warning) => `- ${warning}`)]
			: []),
		"",
	].join("\n");
}
