import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { TransferPlan } from "../../src/lib/sykaExport/contract";
import { hashFile, writeTransferPackage } from "./package";
import { validateStudioProject } from "./validateStudioProject";

const temporary: string[] = [];
afterEach(async () => {
	for (const dir of temporary.splice(0)) await rm(dir, { recursive: true, force: true });
});
const plan: TransferPlan = {
	name: "Prueba ñ",
	canvas: { width: 1280, height: 720, frameRate: 30, durationMs: 2000 },
	clips: [],
	zooms: [],
	audio: [],
	warnings: [],
};
async function fixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), "syka-transfer-test-"));
	temporary.push(root);
	const source = path.join(root, "pantalla con espacio.mp4");
	await writeFile(source, "synthetic-test-bytes");
	return { root, source };
}
describe("portable package writer", () => {
	it("opens after relocation with the original sources and package removed", async () => {
		const { root, source } = await fixture();
		const file = await writeTransferPackage({
			parent: root,
			plan,
			assets: [{ id: "screen", role: "screen", sourcePath: source }],
			project: {},
			cursorTelemetry: [],
		});
		const relocated = await mkdtemp(path.join(os.tmpdir(), "syka-other-computer-"));
		temporary.push(relocated);
		await cp(path.dirname(file), relocated, { recursive: true });
		await rm(source);
		await rm(path.dirname(file), { recursive: true });
		await expect(validateStudioProject(relocated)).resolves.toBeUndefined();
		for (const name of ["index.tsx", "assets.yml", "manifest.json"]) {
			const text = await readFile(path.join(relocated, name), "utf8");
			expect(text).not.toContain(root);
			expect(text).not.toContain(JSON.stringify(root).slice(1, -1));
		}
	});
	it("reports missing media instead of opening an incomplete project", async () => {
		const { root, source } = await fixture();
		const manifestPath = await writeTransferPackage({
			parent: root,
			plan,
			assets: [{ id: "screen", role: "screen", sourcePath: source }],
			project: {},
			cursorTelemetry: [],
		});
		const directory = path.dirname(manifestPath);
		await rm(path.join(directory, "01 Grabación/Pantalla.mp4"));
		await expect(validateStudioProject(directory)).rejects.toThrow(
			"Falta 01 Grabación/Pantalla.mp4",
		);
	});
	it("opens natively with the camera as one editable video, omitting header-only audio", async () => {
		const { root, source } = await fixture();
		const prepared: string[] = [];
		const emptyWav = Buffer.alloc(44);
		emptyWav.write("RIFF");
		emptyWav.writeUInt32LE(36, 4);
		emptyWav.write("WAVE", 8);
		emptyWav.write("data", 36);
		const mic = path.join(root, "empty.wav");
		await writeFile(mic, emptyWav);
		const file = await writeTransferPackage({
			parent: root,
			plan: {
				...plan,
				clips: [{ id: "c", startMs: 0, endMs: 2000, sourceStartMs: 0, speed: 1 }],
				audio: [{ assetId: "mic", role: "mic", delayMs: 0, gains: { c: 1 } }],
				webcam: {
					assetId: "webcam",
					delayMs: 0,
					mirror: true,
					x: 900,
					y: 400,
					width: 240.5,
					height: 180.5,
					cornerRadius: 70,
					crop: { x: 0, y: 0, width: 1, height: 1 },
					shadow: 0.3,
				},
			},
			assets: [
				{ id: "screen", sourcePath: source, role: "screen" },
				{ id: "webcam", sourcePath: source, role: "webcam" },
				{ id: "mic", sourcePath: mic, role: "mic" },
			],
			project: {},
			cursorTelemetry: [],
			prepareWebcam: async (inputPath, outputPath) => {
				prepared.push(inputPath);
				await writeFile(outputPath, "mirrored-camera");
			},
		});
		const directory = path.dirname(file),
			manifest = JSON.parse(await readFile(file, "utf8"));
		await expect(validateStudioProject(directory)).resolves.toBeUndefined();
		const code = await readFile(path.join(directory, "index.tsx"), "utf8");
		// The mirror is baked into a copy; the recording itself stays untouched.
		expect(prepared.map((file) => path.basename(file))).toEqual(["Cámara original.mp4"]);
		expect(manifest.plan.webcam).toMatchObject({
			assetId: "webcam-studio",
			sourceAssetId: "webcam",
			width: 241,
			height: 181,
		});
		expect(code).toMatch(
			/<video id="webcam-0" name="Webcam 1" src=\{"01 Grabación\/Cámara.mp4"\} x=\{900\} y=\{400\} width=\{241\} height=\{181\} objectFit="cover" cornerRadius=/,
		);
		expect(code.match(/<shadow /g)).toHaveLength(2);
		expect(code).not.toMatch(/webcam-mask|webcam-shadow|scaleX/);
		expect(
			await readFile(
				path.join(directory, "03 Originales sin editar/Cámara original.mp4"),
				"utf8",
			),
		).toBe("synthetic-test-bytes");
		expect(code).not.toContain("<audio");
		expect(JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")).main).toBe(
			"index.tsx",
		);
		for (const asset of manifest.assets)
			expect(await hashFile(path.join(directory, asset.path))).toBe(asset.sha256);
		expect(await readFile(path.join(directory, "01 Grabación/Micrófono.wav"))).toEqual(
			emptyWav,
		);
	});
	it("copies verified bytes, preserves unknown JSON and never changes originals", async () => {
		const { root, source } = await fixture(),
			before = await hashFile(source);
		const file = await writeTransferPackage({
			parent: root,
			plan,
			assets: [{ id: "screen", sourcePath: source, role: "screen" }],
			project: { vendorUnknown: { future: [1, 2, 3] } },
			cursorTelemetry: [{ t: 1 }],
		});
		const manifest = JSON.parse(await readFile(file, "utf8"));
		expect(manifest.assets[0].sha256).toBe(before);
		expect(await hashFile(source)).toBe(before);
		expect(
			JSON.parse(
				await readFile(
					path.join(
						path.dirname(file),
						"99 Archivos técnicos (no tocar)/proyecto.recordly",
					),
					"utf8",
				),
			),
		).toEqual({ vendorUnknown: { future: [1, 2, 3] } });
		expect(manifest.assets[0]).not.toHaveProperty("sourcePath");
	});
	it("cleans only its own staging after a missing source or cancellation", async () => {
		const { root, source } = await fixture();
		for (const cancel of [false, true]) {
			const abort = new AbortController();
			if (cancel) abort.abort();
			await expect(
				writeTransferPackage({
					parent: root,
					plan,
					assets: [
						{
							id: "screen",
							role: "screen",
							sourcePath: cancel ? source : source + "-missing",
						},
					],
					project: {},
					cursorTelemetry: [],
					signal: abort.signal,
				}),
			).rejects.toThrow();
			expect(await readdir(root)).toEqual(["pantalla con espacio.mp4"]);
		}
	});
	it("rejects traversal in asset IDs", async () => {
		const { root, source } = await fixture();
		await expect(
			writeTransferPackage({
				parent: root,
				plan,
				assets: [{ id: "../screen", sourcePath: source, role: "screen" }],
				project: {},
				cursorTelemetry: [],
			}),
		).rejects.toThrow("IDs");
	});
	it("names the folder by date and keeps what a person needs in plain folders", async () => {
		const { root, source } = await fixture();
		const now = new Date(2026, 10, 21, 9, 5);
		const write = () =>
			writeTransferPackage({
				parent: root,
				plan: { ...plan, warnings: ["Aviso de prueba."] },
				assets: [
					{ id: "screen", role: "screen-with-cursor", sourcePath: source },
					{ id: "original-screen", role: "original-screen", sourcePath: source },
					{ id: "audio-1", role: "system", sourcePath: source },
					{ id: "extra-audio-1", role: "added-audio", sourcePath: source },
				],
				project: {},
				cursorTelemetry: [],
				now,
			});
		const first = path.dirname(await write());
		const second = path.dirname(await write());
		expect(path.basename(first)).toBe("Prueba ñ - 2026-11-21 09-05");
		expect(path.basename(second)).toBe("Prueba ñ - 2026-11-21 09-05 (2)");
		expect((await readdir(first)).sort()).toEqual([
			"01 Grabación",
			"02 Finales",
			"03 Originales sin editar",
			"99 Archivos técnicos (no tocar)",
			"LEEME.txt",
			"assets.yml",
			"index.tsx",
			"manifest.json",
			"package.json",
		]);
		expect((await readdir(path.join(first, "01 Grabación"))).sort()).toEqual([
			"Audio agregado 1.mp4",
			"Audio del sistema.mp4",
			"Pantalla.mp4",
		]);
		expect(await readdir(path.join(first, "03 Originales sin editar"))).toEqual([
			"Pantalla original.mp4",
		]);
		expect(await readdir(path.join(first, "02 Finales"))).toEqual([]);
		const readme = await readFile(path.join(first, "LEEME.txt"), "utf8");
		expect(readme).toContain("02 Finales: el video terminado, con fondo, cámara y zooms");
		expect(readme).toContain("- Aviso de prueba.");
		await expect(validateStudioProject(first)).resolves.toBeUndefined();
	});
});
