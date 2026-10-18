import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TransferManifest } from "../../src/lib/sykaExport/contract";
import { recorderComposition } from "./composition";

/** Native project alongside the portable manifest; media is stored only once. */
export async function writeStudioProject(directory: string, manifest: TransferManifest) {
	const webcam = manifest.plan.webcam;
	const emptyAudio = new Set<string>();
	for (const asset of manifest.assets) {
		if (asset.size !== 44 || !asset.path.endsWith(".wav")) continue;
		const header = await readFile(path.join(directory, asset.path));
		if (
			header.toString("ascii", 0, 4) === "RIFF" &&
			header.toString("ascii", 8, 12) === "WAVE" &&
			header.toString("ascii", 36, 40) === "data" &&
			header.readUInt32LE(40) === 0
		)
			emptyAudio.add(asset.id);
	}
	// Older Windows captures can contain a header-only WAV. Archive it, but do not
	// turn it into an unplayable clip (the Studio manifest importer does the same).
	const playable = {
		...manifest,
		plan: {
			...manifest.plan,
			audio: manifest.plan.audio.filter((audio) => !emptyAudio.has(audio.assetId)),
		},
	};
	const assets = manifest.assets
		.filter((asset) => asset.role !== "metadata" && !emptyAudio.has(asset.id))
		.map((asset) => {
			const ext = path.extname(asset.path).slice(1);
			const type =
				ext === "mask"
					? "MASK"
					: /^(svg|png|jpg|jpeg|webp|gif|avif|bmp)$/.test(ext)
						? "IMAGE"
						: /^(wav|mp3|m4a|ogg|flac|aac)$/.test(ext)
							? "AUDIO"
							: "VIDEO";
			const mimeType =
				(
					{
						mp4: "video/mp4",
						webm: "video/webm",
						mov: "video/quicktime",
						mkv: "video/x-matroska",
						wav: "audio/wav",
						mp3: "audio/mpeg",
						m4a: "audio/mp4",
						ogg: "audio/ogg",
						flac: "audio/flac",
						aac: "audio/aac",
						svg: "image/svg+xml",
						png: "image/png",
						jpg: "image/jpeg",
						jpeg: "image/jpeg",
						webp: "image/webp",
						gif: "image/gif",
						avif: "image/avif",
						bmp: "image/bmp",
						mask: "application/x-diffusionstudio-mask",
					} as Record<string, string>
				)[ext] ?? "application/octet-stream";
			const matte = asset.id === "screen-mask" ? manifest.plan.screen : webcam;
			return {
				id: `recorder-${asset.id}`,
				path: asset.path,
				source: asset.path,
				type,
				mimeType,
				createdAt: manifest.createdAt,
				stat: { size: asset.size },
				...(type === "MASK" && matte
					? {
							width: Math.round(matte.width) + (matte.maskPadding ?? 0) * 2,
							height: Math.round(matte.height) + (matte.maskPadding ?? 0) * 2,
							frameRate: 1,
							duration: 1,
						}
					: {}),
				...(asset.id === "screen"
					? {
							width: manifest.plan.screen?.sourceWidth ?? manifest.plan.canvas.width,
							height:
								manifest.plan.screen?.sourceHeight ?? manifest.plan.canvas.height,
							frameRate: manifest.plan.canvas.frameRate,
						}
					: {}),
			};
		});
	await writeFile(path.join(directory, "index.tsx"), recorderComposition(playable), {
		flag: "wx",
	});
	await writeFile(
		path.join(directory, "assets.yml"),
		JSON.stringify({ version: 1, folders: ["media"], assets }, null, 2),
		{ flag: "wx" },
	);
	await writeFile(
		path.join(directory, "package.json"),
		JSON.stringify(
			{
				name: "syka-recorder-project",
				projectId: randomUUID(),
				displayName: manifest.plan.name,
				private: true,
				type: "module",
				main: "index.tsx",
			},
			null,
			2,
		),
		{ flag: "wx" },
	);
}
