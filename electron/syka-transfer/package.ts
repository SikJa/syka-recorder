import { createHash } from "node:crypto";
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
import {
	PACKAGE_FOLDERS,
	packageFileName,
	packageFolderName,
	packageReadme,
	uniquePath,
} from "./packageLayout";
import { alignWebcamToPixels, screenAppearance } from "./webcamAppearance";
import { needsPreparedWebcam, prepareWebcamFootage } from "./webcamFootage";

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
	/** Folder name timestamp; replaceable in tests. */
	now?: Date;
	/** Replaceable in tests; defaults to FFmpeg. */
	prepareWebcam?: (inputPath: string, outputPath: string, signal?: AbortSignal) => Promise<void>;
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
	const createdAt = input.now ?? new Date();
	const staging = await mkdtemp(path.join(parent, ".syka-transfer-"));
	const assets: TransferAsset[] = [];
	const plan = structuredClone(input.plan);
	const taken = new Set<string>();
	const preparedWebcam = plan.webcam ? needsPreparedWebcam(plan.webcam) : false;
	const place = (asset: { id: string; role: string }, extension: string) =>
		uniquePath(packageFileName(asset, extension, { preparedWebcam }), taken);
	try {
		for (const folder of Object.values(PACKAGE_FOLDERS))
			await mkdir(path.join(staging, folder));
		for (const asset of input.assets) {
			input.signal?.throwIfAborted();
			await regularFile(asset.sourcePath);
			const before = await stat(asset.sourcePath);
			const extension = path.extname(asset.sourcePath).toLowerCase();
			if (!/^\.[a-z0-9]{1,8}$/.test(extension)) throw new Error("Invalid media extension");
			const relative = place(asset, extension);
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
				{
					id: "screen-mask",
					path: place({ id: "screen-mask", role: "screen-appearance" }, ".mask"),
					bytes: appearance.mask,
				},
				...(shadow
					? [
							{
								id: "screen-shadow",
								path: place(
									{ id: "screen-shadow", role: "screen-appearance" },
									".svg",
								),
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
			const webcam = alignWebcamToPixels(plan.webcam);
			plan.webcam = webcam;
			const recording = assets.find((asset) => asset.id === webcam.assetId);
			if (!recording) throw new Error("Missing webcam footage");
			if (needsPreparedWebcam(webcam)) {
				input.signal?.throwIfAborted();
				const prepared = {
					id: "webcam-studio",
					path: place({ id: "webcam-studio", role: "webcam-studio" }, ".mp4"),
				};
				const prepare =
					input.prepareWebcam ??
					(async (inputPath: string, outputPath: string, signal?: AbortSignal) => {
						const { getFfmpegBinaryPath } = await import("../ipc/ffmpeg/binary");
						await prepareWebcamFootage({
							ffmpegPath: getFfmpegBinaryPath(),
							inputPath,
							outputPath,
							webcam,
							signal,
						});
					});
				const target = path.join(staging, prepared.path);
				await prepare(path.join(staging, recording.path), target, input.signal);
				assets.push({
					...prepared,
					role: "webcam-studio",
					size: (await stat(target)).size,
					sha256: await hashFile(target),
				});
				webcam.sourceAssetId = recording.id;
				webcam.assetId = prepared.id;
			}
		}
		const metadata = [
			{
				id: "project-snapshot",
				path: `${PACKAGE_FOLDERS.technical}/proyecto.recordly`,
				text: JSON.stringify(input.project, null, 2),
			},
			{
				id: "cursor-telemetry",
				path: `${PACKAGE_FOLDERS.technical}/cursor.json`,
				text: JSON.stringify(input.cursorTelemetry),
			},
		];
		if (input.originalProjectPath) {
			await regularFile(input.originalProjectPath);
			if ((await stat(input.originalProjectPath)).size > 32 * 1024 * 1024)
				throw new Error("Project JSON is too large");
			metadata.push({
				id: "original-project",
				path: `${PACKAGE_FOLDERS.technical}/proyecto original.recordly`,
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
			createdAt: createdAt.toISOString(),
			plan,
			assets,
		};
		await writeFile(path.join(staging, "manifest.json"), JSON.stringify(manifest, null, 2), {
			flag: "wx",
		});
		await writeStudioProject(staging, manifest);
		await writeFile(path.join(staging, "LEEME.txt"), packageReadme(input.plan.warnings), {
			flag: "wx",
		});
		// Same name and minute as an earlier package: number it, like Studio does.
		for (let attempt = 1; ; attempt++) {
			const destination = path.join(parent, packageFolderName(safeName, createdAt, attempt));
			try {
				await rename(staging, destination);
				return path.join(destination, "manifest.json");
			} catch (error) {
				const code = (error as NodeJS.ErrnoException).code ?? "";
				const exists = await stat(destination).then(
					() => true,
					() => false,
				);
				if (!exists || attempt >= 99 || !["EEXIST", "ENOTEMPTY", "EPERM"].includes(code))
					throw error;
			}
		}
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
