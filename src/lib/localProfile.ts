import { useSyncExternalStore } from "react";
import { loadAppSetting, saveAppSetting } from "./appSettings";

export type LocalProfile = { name: string; picture?: string };
const KEY = "syka.localProfile.v1";
const EMPTY: LocalProfile = { name: "Perfil local" };
let cached: LocalProfile | undefined;
const listeners = new Set<() => void>();

function read(): LocalProfile {
	if (!cached) {
		const stored = loadAppSetting<LocalProfile>(KEY);
		cached = stored && typeof stored.name === "string" ? stored : EMPTY;
	}
	return cached;
}
function refresh() {
	const before = JSON.stringify(cached);
	cached = undefined;
	if (JSON.stringify(read()) !== before) listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
	listeners.add(listener);
	if (listeners.size === 1) window.addEventListener("focus", refresh);
	return () => {
		listeners.delete(listener);
		if (!listeners.size) window.removeEventListener("focus", refresh);
	};
}
export function useLocalProfile() {
	return useSyncExternalStore(subscribe, read, () => EMPTY);
}
export function saveLocalProfile(profile: LocalProfile) {
	const next = { name: profile.name.trim().slice(0, 80) || EMPTY.name, picture: profile.picture };
	if (!saveAppSetting(KEY, next))
		throw new Error("No se pudo guardar el perfil. Volvé a intentar.");
	cached = next;
	listeners.forEach((listener) => listener());
}

/** Store a small, self-contained thumbnail; the original file stays untouched. */
export async function readProfilePicture(file: File): Promise<string> {
	if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type))
		throw new Error("Elegí una imagen PNG, JPG, WebP o GIF.");
	if (file.size > 10 * 1024 * 1024) throw new Error("La imagen debe pesar menos de 10 MB.");
	const bitmap = await createImageBitmap(file).catch(() => {
		throw new Error("No se pudo leer esa imagen. Probá con otra.");
	});
	try {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 256;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("No se pudo preparar la imagen.");
		const side = Math.min(bitmap.width, bitmap.height);
		context.drawImage(
			bitmap,
			(bitmap.width - side) / 2,
			(bitmap.height - side) / 2,
			side,
			side,
			0,
			0,
			256,
			256,
		);
		return canvas.toDataURL("image/webp", 0.9);
	} finally {
		bitmap.close();
	}
}
