import { describe, expect, it } from "vitest";
import type { TransferPlan } from "../../src/lib/sykaExport/contract";
import { webcamShadows, webcamZoomTracks } from "./composition";

const webcam: NonNullable<TransferPlan["webcam"]> = {
	assetId: "webcam-studio",
	delayMs: 0,
	mirror: true,
	x: 100,
	y: 500,
	width: 200,
	height: 160,
	cornerRadius: 80,
	crop: { x: 0, y: 0, width: 1, height: 1 },
	shadow: 0.3,
	anchor: { x: 0, y: 1 },
	// Timeline frames at 30 fps: full size, half size from 1 s, back by 2 s.
	zoomScale: [
		{ frame: 0, value: 1, easing: null },
		{ frame: 30, value: 0.5, easing: null },
		{ frame: 60, value: 1, easing: null },
	],
};

function keyframes(code: string, property: string) {
	const track = code.split(`property="${property}"`)[1]?.split("</keyframeTrack>")[0] ?? "";
	return [...track.matchAll(/time=\{([\d.-]+)\} value=\{([\d.-]+)\}/g)].map((match) => ({
		time: Number(match[1]),
		value: Number(match[2]),
	}));
}

describe("Studio webcam layer", () => {
	it("keeps Recorder's two shadow layers, scaled to the camera", () => {
		const layers = webcamShadows(webcam);
		expect(layers).toHaveLength(2);
		expect(layers[0].blur).toBeCloseTo(160 * 0.22 * 0.6);
		expect(layers[0].offsetY).toBeCloseTo(160 * 0.06 * 0.6);
		expect(webcamShadows({ ...webcam, shadow: 0 })).toEqual([]);
	});
	it("shrinks toward its anchor on the video's own source clock", () => {
		// A clip 3 s into the timeline that plays source from 10 s at 2x.
		const code = webcamZoomTracks(
			webcam,
			{ startMs: 500, endMs: 2000, sourceStartMs: 10000, speed: 2 },
			30,
		);
		const scale = keyframes(code, "scale");
		expect(scale[0]).toEqual({ time: 10, value: 0.75 });
		expect(
			scale.some((k) => Math.abs(k.time - 11) < 1e-6 && Math.abs(k.value - 0.5) < 1e-6),
		).toBe(true);
		expect(scale.at(-1)).toEqual({ time: 13, value: 1 });
		// Bottom-left anchor: half size moves the centre left and down by a quarter.
		const x = keyframes(code, "offsetX").find((k) => Math.abs(k.time - 11) < 1e-6);
		const y = keyframes(code, "offsetY").find((k) => Math.abs(k.time - 11) < 1e-6);
		expect(x?.value).toBeCloseTo(-50);
		expect(y?.value).toBeCloseTo(40);
	});
	it("adds no tracks when the slice never zooms", () => {
		expect(
			webcamZoomTracks(
				webcam,
				{ startMs: 2500, endMs: 4000, sourceStartMs: 0, speed: 1 },
				30,
			),
		).toBe("");
		expect(
			webcamZoomTracks(
				{ ...webcam, zoomScale: undefined },
				{ startMs: 0, endMs: 2000, sourceStartMs: 0, speed: 1 },
				30,
			),
		).toBe("");
	});
});
