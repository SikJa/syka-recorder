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
		const file = await writeTransferPackage({ parent: root, plan, assets: [{ id: "screen", role: "screen", sourcePath: source }], project: {}, cursorTelemetry: [] });
		const relocated = await mkdtemp(path.join(os.tmpdir(), "syka-other-computer-")); temporary.push(relocated);
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
		await rm(path.join(directory, "media/screen.mp4"));
		await expect(validateStudioProject(directory)).rejects.toThrow("Falta media/screen.mp4");
	});
	it("opens natively with a separate camera matte and shadow, omitting header-only audio", async () => {
		const { root, source } = await fixture();
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
					videoRect: { x: -40, y: 0, width: 320.5, height: 180.5 },
				},
			},
			assets: [
				{ id: "screen", sourcePath: source, role: "screen" },
				{ id: "webcam", sourcePath: source, role: "webcam" },
				{ id: "mic", sourcePath: mic, role: "mic" },
			],
			project: {},
			cursorTelemetry: [],
		});
		const directory = path.dirname(file),
			manifest = JSON.parse(await readFile(file, "utf8"));
		await expect(validateStudioProject(directory)).resolves.toBeUndefined();
		const code = await readFile(path.join(directory, "index.tsx"), "utf8");
		expect(code).toContain('src={"media/webcam-mask.mask"}');
		expect(code).toContain('src={"media/webcam-shadow.svg"}');
		expect(manifest.plan.webcam.width).toBe(241);
		expect(manifest.plan.webcam.height).toBe(181);
		expect(
			manifest.plan.webcam.videoRect.width / manifest.plan.webcam.videoRect.height,
		).toBeCloseTo(320.5 / 180.5);
		expect(code).not.toContain("<audio");
		expect(JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")).main).toBe(
			"index.tsx",
		);
		for (const asset of manifest.assets)
			expect(await hashFile(path.join(directory, asset.path))).toBe(asset.sha256);
		expect(await readFile(path.join(directory, "media/mic.wav"))).toEqual(emptyWav);
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
				await readFile(path.join(path.dirname(file), "recordly/current.recordly"), "utf8"),
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
});
