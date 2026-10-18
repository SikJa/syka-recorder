import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	realpath,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
	TransferAsset,
	TransferAssetInput,
	TransferManifest,
	TransferPlan,
} from "../../src/lib/sykaExport/contract";
import { writeStudioProject } from "./studioProject";
import { alignWebcamToPixels, webcamAppearance, screenAppearance } from "./webcamAppearance";

const safeId = /^[a-z][a-z0-9-]{0,63}$/;
export async function hashFile(file: string): Promise<string> {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(file)) hash.update(chunk);
	return hash.digest("hex");
}

async function regularFile(file: string): Promise<void> {
	let current = path.resolve(file);
	while (current !== path.dirname(current)) {
		const info = await lstat(current);
		if (info.isSymbolicLink()) throw new Error(`Links are not supported: ${current}`);
		current = path.dirname(current);
	}
	if (!(await stat(file)).isFile()) throw new Error(`Not a regular file: ${file}`);
}

/** Only creates a new package. Inputs and existing output packages are never modified. */
export async function writeTransferPackage(input: {
	parent: string;
	plan: TransferPlan;
	assets: TransferAssetInput[];
	project: unknown;
	cursorTelemetry: unknown;
	originalProjectPath?: string | null;
	signal?: AbortSignal;
}): Promise<string> {
	const parent = await realpath(input.parent);
	if (!(await stat(parent)).isDirectory()) throw new Error("Invalid destination folder");
	if (
		input.assets.length > 512 ||
		new Set(input.assets.map((a) => a.id)).size !== input.assets.length ||
		input.assets.some((asset) => !safeId.test(asset.id))
	)
		throw new Error("Invalid asset IDs");
	if (!input.assets.some((asset) => asset.id === "screen"))
		throw new Error("Missing rendered screen");
	if (typeof input.plan?.name !== "string") throw new Error("Invalid project name");
	const safeName =
		input.plan.name
			// biome-ignore lint/suspicious/noControlCharactersInRegex: Strip control characters forbidden in filenames.
			.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
			.replace(/[. ]+$/g, "")
			.slice(0, 65) || "Captura";
	const destination = path.join(parent, `${safeName}-${randomUUID()}.syka-recorder`);
	const staging = await mkdtemp(path.join(parent, ".syka-transfer-"));
	const assets: TransferAsset[] = [];
	const plan = structuredClone(input.plan);
	try {
		await mkdir(path.join(staging, "media"));
		await mkdir(path.join(staging, "recordly"));
		for (const asset of input.assets) {
			input.signal?.throwIfAborted();
			await regularFile(asset.sourcePath);
			const before = await stat(asset.sourcePath);
			const extension = path.extname(asset.sourcePath).toLowerCase();
			if (!/^\.[a-z0-9]{1,8}$/.test(extension)) throw new Error("Invalid media extension");
			const relative = `media/${asset.id}${extension}`;
			const target = path.join(staging, relative);
			const sourceHash = createHash("sha256");
			await pipeline(
				createReadStream(asset.sourcePath),
				new Transform({
					transform(chunk, _encoding, done) {
						sourceHash.update(chunk);
						done(null, chunk);
					},
				}),
				createWriteStream(target, { flags: "wx" }),
				{ signal: input.signal },
			);
			const [after, copied, sha256] = await Promise.all([
				stat(asset.sourcePath),
				stat(target),
				hashFile(target),
			]);
			if (
				before.size !== after.size ||
				before.mtimeMs !== after.mtimeMs ||
				before.size !== copied.size ||
				sha256 !== sourceHash.digest("hex")
			)
				throw new Error(`File changed or copy verification failed: ${asset.id}`);
			assets.push({
				id: asset.id,
				role: asset.role,
				path: relative,
				size: copied.size,
				sha256,
			});
		}
		if (plan.screen) {
			const appearance = await screenAppearance(plan.screen, plan.canvas.width);
			const shadow = appearance.shadow ? Buffer.from(appearance.shadow) : undefined;
			const generated = [
				{ id: "screen-mask", path: "media/screen-mask.mask", bytes: appearance.mask },
				...(shadow
					? [
							{
								id: "screen-shadow",
								path: "media/screen-shadow.svg",
								bytes: shadow,
							},
						]
					: []),
			];
			for (const asset of generated) {
				input.signal?.throwIfAborted();
				await writeFile(path.join(staging, asset.path), asset.bytes, { flag: "wx" });
				assets.push({
					id: asset.id,
					path: asset.path,
					role: "screen-appearance",
					size: asset.bytes.length,
					sha256: createHash("sha256").update(asset.bytes).digest("hex"),
				});
			}
			plan.screen.maskAssetId = "screen-mask";
			plan.screen.maskPadding = appearance.maskPadding;
			if (appearance.shadow) {
				plan.screen.shadowAssetId = "screen-shadow";
				plan.screen.shadowPadding = appearance.padding;
			}
		}
		if (plan.webcam) {
			plan.webcam = alignWebcamToPixels(plan.webcam);
			const appearance = await webcamAppearance(plan.webcam);
			const shadow = appearance.shadow ? Buffer.from(appearance.shadow) : undefined;
			const generated = [
				{ id: "webcam-mask", path: "media/webcam-mask.mask", bytes: appearance.mask },
				...(shadow
					? [
							{
								id: "webcam-shadow",
								path: "media/webcam-shadow.svg",
								bytes: shadow,
							},
						]
					: []),
			];
			for (const asset of generated) {
				input.signal?.throwIfAborted();
				await writeFile(path.join(staging, asset.path), asset.bytes, { flag: "wx" });
				assets.push({
					id: asset.id,
					path: asset.path,
					role: "webcam-appearance",
					size: asset.bytes.length,
					sha256: createHash("sha256").update(asset.bytes).digest("hex"),
				});
			}
			plan.webcam.maskAssetId = "webcam-mask";
			plan.webcam.maskPadding = appearance.maskPadding;
			if (appearance.shadow) {
				plan.webcam.shadowAssetId = "webcam-shadow";
				plan.webcam.shadowPadding = appearance.padding;
			}
		}
		const metadata = [
			{
				id: "project-snapshot",
				path: "recordly/current.recordly",
				text: JSON.stringify(input.project, null, 2),
			},
			{
				id: "cursor-telemetry",
				path: "recordly/cursor.json",
				text: JSON.stringify(input.cursorTelemetry),
			},
		];
		if (input.originalProjectPath) {
			await regularFile(input.originalProjectPath);
			if ((await stat(input.originalProjectPath)).size > 32 * 1024 * 1024)
				throw new Error("Project JSON is too large");
			metadata.push({
				id: "original-project",
				path: "recordly/original.recordly",
				text: await readFile(input.originalProjectPath, "utf8"),
			});
		}
		for (const item of metadata) {
			if (!item.text || Buffer.byteLength(item.text) > 32 * 1024 * 1024)
				throw new Error("Invalid project metadata size");
			const file = path.join(staging, item.path);
			await writeFile(file, item.text, { flag: "wx" });
			assets.push({
				id: item.id,
				path: item.path,
				role: "metadata",
				size: Buffer.byteLength(item.text),
				sha256: await hashFile(file),
			});
		}
		input.signal?.throwIfAborted();
		const manifest: TransferManifest = {
			format: "syka-recorder-transfer",
			version: 1,
			createdAt: new Date().toISOString(),
			plan,
			assets,
		};
		await writeFile(path.join(staging, "manifest.json"), JSON.stringify(manifest, null, 2), {
			flag: "wx",
		});
		await writeStudioProject(staging, manifest);
		await writeFile(
			path.join(staging, "README.txt"),
			"Abrí esta carpeta como proyecto en Syka Studio, o usá Abrir en Syka Studio desde Recorder.\n\n" +
				"Conservá la carpeta completa, incluidos index.tsx, assets.yml y media. Adjuntar manifest.json al chat sólo adjunta la descripción; no importa los videos.\n\n" +
				input.plan.warnings.join("\n") +
				"\n\nLos archivos .recordly conservan referencias al equipo original. No se publican automáticamente.\n",
			{ flag: "wx" },
		);
		await rename(staging, destination);
		return path.join(destination, "manifest.json");
	} catch (error) {
		// This operation alone created this random staging directory under the chosen parent.
		if (
			path.dirname(staging) === parent &&
			path.basename(staging).startsWith(".syka-transfer-")
		)
			await rm(staging, { recursive: true, force: true });
		throw error;
	}
}
