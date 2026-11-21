import { describe, expect, it } from "vitest";
import { normalizeProjectEditor } from "@/components/video-editor/projectPersistence";
import { type BuildTransferInput, buildTransfer } from "./buildTransfer";
import { evaluateKeyframes, fitChannel } from "./keyframeFit";
import { buildZoomBlocks } from "./zoomBlocks";
import { sampleZoomCamera } from "./zoomCamera";

function fixture(): BuildTransferInput {
	return {
		name: "Prueba",
		sourcePath: "B:/fixture/screen.mp4",
		sourceDurationMs: 12000,
		width: 1280,
		height: 720,
		frameRate: 30,
		editor: normalizeProjectEditor({
			clipRegions: [
				{ id: "a", startMs: 0, endMs: 4000, sourceStartMs: 0, speed: 1 },
				{ id: "b", startMs: 4000, endMs: 7000, sourceStartMs: 6000, speed: 2 },
			],
		}),
		zoomRegions: [
			{
				id: "z",
				startMs: 1500,
				endMs: 4500,
				depth: 2,
				focus: { cx: 0.7, cy: 0.35 },
				mode: "manual",
			},
		],
		cursorTelemetry: [],
		audioPaths: [
			"B:/fixture/screen.mp4",
			"B:/fixture/screen.system.wav",
			"B:/fixture/screen.mic.wav",
		],
		audioDelays: { "B:/fixture/screen.mic.wav": 150 },
	};
}
describe("Syka transfer", () => {
	it("matches the audible editor level and never doubles embedded audio with sidecars", () => {
		const input = fixture();
		input.editor.defaultSourceAudioTrackSettings = {
			mic: { volume: 1, normalize: true },
			system: { volume: 0.5, normalize: false },
		};
		const { plan } = buildTransfer(input);
		expect(plan.audio.map((a) => a.role)).toEqual(["system", "mic"]);
		expect(plan.audio.find((a) => a.role === "mic")?.gains.a).toBe(1);
		expect(plan.audio.find((a) => a.role === "system")?.gains.a).toBe(0.5);
	});
	it("transfers the actual padded frame, video background, and chosen canvas aspect ratio", () => {
		const input = fixture();
		input.canvasSize = { width: 720, height: 1280 };
		input.editor.wallpaper = "B:/fixture/background.mp4";
		input.backgroundDurationMs = 2000;
		input.editor.padding = { top: 20, bottom: 20, left: 20, right: 20, linked: true };
		input.editor.borderRadius = 10;
		const { plan, assets } = buildTransfer(input);
		expect(plan.canvas).toMatchObject({ width: 720, height: 1280 });
		expect(plan.screen!.width).toBeCloseTo(662.4);
		expect(plan.screen!.height).toBeCloseTo(372.6);
		expect(plan.screen!.cornerRadius).toBeCloseTo(37.26);
		expect(plan.background).toMatchObject({ kind: "video", durationMs: 2000 });
		expect(assets.find((a) => a.id === "background")?.sourcePath).toBe(
			"B:/fixture/background.mp4",
		);
		expect(plan.warnings.some((w) => w.includes("no se aplican"))).toBe(false);
	});
	it("hands Studio the camera crop, anchor and its shrink while the screen zooms", () => {
		const input = fixture();
		input.webcamDimensions = { width: 1920, height: 1080 };
		input.editor.webcam = {
			...input.editor.webcam,
			enabled: true,
			sourcePath: "B:/fixture/camera.mp4",
			width: 40,
			height: 40,
			shadow: 0.4,
			reactToZoom: true,
			positionPreset: "bottom-left",
			cropRegion: { x: 0.25, y: 0, width: 0.5, height: 1 },
		};
		const { plan } = buildTransfer(input),
			camera = plan.webcam!;
		expect(camera).toMatchObject({
			shadow: 0.4,
			crop: { x: 0.25, y: 0, width: 0.5, height: 1 },
			anchor: { x: 0, y: 1 },
		});
		// The 50% crop of a 16:9 camera is close to square.
		expect(camera.width / camera.height).toBeCloseTo(960 / 1080, 1);
		const samples = sampleZoomCamera({
			zoomRegions: input.zoomRegions,
			clipRegions: plan.clips,
			cursorTelemetry: [],
			settings: input.editor,
			frameWidth: plan.canvas.width,
			frameHeight: plan.canvas.height,
			baseMask: plan.screen,
			durationMs: plan.canvas.durationMs,
			frameRate: 30,
		});
		expect(evaluateKeyframes(camera.zoomScale!, 0)).toBeCloseTo(1, 3);
		for (const frame of [75, 90, 105]) {
			const expected = 1 / samples[frame].scale;
			expect(expected).toBeLessThan(0.99);
			expect(
				Math.abs(evaluateKeyframes(camera.zoomScale!, frame) - expected) * camera.width,
			).toBeLessThan(0.5);
		}
	});
	it("transfers vertical follow framing as camera keyframes over the whole timeline", () => {
		const input = fixture();
		input.canvasSize = { width: 720, height: 1280 };
		input.zoomRegions = [];
		input.cursorTelemetry = [
			{ timeMs: 0, cx: 0.2, cy: 0.5 },
			{ timeMs: 3000, cx: 0.85, cy: 0.4 },
		];
		input.editor.verticalFraming = "follow";
		input.editor.webcam = {
			...input.editor.webcam,
			enabled: true,
			sourcePath: "B:/fixture/camera.mp4",
			reactToZoom: true,
		};
		const { plan } = buildTransfer(input);
		expect(plan.zooms).toHaveLength(1);
		expect(plan.zooms[0]).toMatchObject({ startMs: 0, endMs: plan.canvas.durationMs });
		const fill = (1280 + 2) / plan.screen!.height;
		expect(evaluateKeyframes(plan.zooms[0].channels.scale, 0)).toBeCloseTo(fill, 2);
		// Filling the frame is framing, not a zoom: the camera keeps its size.
		expect(plan.webcam!.zoomScale).toBeUndefined();
		expect(plan.warnings.some((w) => w.includes("encuadre vertical"))).toBe(true);

		input.editor.verticalFraming = "fit";
		expect(buildTransfer(input).plan.zooms).toEqual([]);
	});
	it("keeps the camera size when it does not react to zoom", () => {
		const input = fixture();
		input.editor.webcam = {
			...input.editor.webcam,
			enabled: true,
			sourcePath: "B:/fixture/camera.mp4",
			reactToZoom: false,
		};
		expect(buildTransfer(input).plan.webcam!.zoomScale).toBeUndefined();
	});
	it("does not resurrect deleted footage from an explicitly empty timeline", () => {
		const input = fixture();
		input.editor.clipRegions = [];
		expect(() => buildTransfer(input)).toThrow("no tiene clips");
	});
	it("preserves cuts, speed, muted clips and separate audio without duplicating embedded mix", () => {
		const input = fixture();
		input.editor.clipRegions[1].muted = true;
		const { plan } = buildTransfer(input);
		expect(plan.clips[1]).toMatchObject({ startMs: 4000, sourceStartMs: 6000, speed: 2 });
		expect(plan.audio.map((a) => a.role)).toEqual(["system", "mic"]);
		expect(plan.audio[1]).toMatchObject({ delayMs: 150, gains: { a: 1, b: 0 } });
		expect(plan.canvas.durationMs).toBe(7000);
	});
	it("retains spring overshoot and keeps the serialized native camera within a pixel at sampled corners", () => {
		const input = fixture();
		const samples = sampleZoomCamera({
			zoomRegions: input.zoomRegions,
			clipRegions: input.editor.clipRegions,
			cursorTelemetry: [],
			settings: input.editor,
			frameWidth: input.width,
			frameHeight: input.height,
			durationMs: 7000,
			frameRate: 30,
		});
		const blocks = buildZoomBlocks(
			samples,
			input.zoomRegions,
			input.width,
			input.height,
			30,
			7000,
		);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].channels.scale.length).toBeLessThan(35);
		for (const sample of samples) {
			const block = blocks.find((b) => sample.timeMs >= b.startMs && sample.timeMs < b.endMs);
			const frame = block ? (sample.timeMs - block.startMs) * 0.03 : 0;
			const scale = block ? evaluateKeyframes(block.channels.scale, frame) : 1;
			const x =
				(block ? evaluateKeyframes(block.channels.x, frame) : 0) -
				((scale - 1) * input.width) / 2;
			const y =
				(block ? evaluateKeyframes(block.channels.y, frame) : 0) -
				((scale - 1) * input.height) / 2;
			for (const px of [0, input.width])
				expect(Math.abs(px * scale + x - (px * sample.scale + sample.x))).toBeLessThan(1);
			for (const py of [0, input.height])
				expect(Math.abs(py * scale + y - (py * sample.scale + sample.y))).toBeLessThan(1);
		}
	});
	it("checks fitted serialized curves and small holds against every input sample", () => {
		const points = Array.from({ length: 91 }, (_, frame) => ({
			frame,
			value:
				frame < 30
					? Math.sin(frame / 8) * 12
					: frame < 60
						? 0.1 * Math.sin(frame)
						: 10 - Math.exp(-(frame - 60) / 4) * 10,
		}));
		const fitted = fitChannel(points, 0.05);
		for (const point of points)
			expect(
				Math.abs(evaluateKeyframes(fitted, point.frame) - point.value),
			).toBeLessThanOrEqual(0.050001);
		expect(() =>
			fitChannel(
				[
					{ frame: 0, value: 1 },
					{ frame: 0, value: 2 },
				],
				0.1,
			),
		).toThrow();
	});
	it("refuses nonfinite or unbounded sampling", () => {
		const input = fixture();
		expect(() =>
			sampleZoomCamera({
				zoomRegions: [],
				clipRegions: [],
				cursorTelemetry: [],
				settings: input.editor,
				frameWidth: 1280,
				frameHeight: 720,
				durationMs: 1000,
				frameRate: NaN,
			}),
		).toThrow();
	});
});
