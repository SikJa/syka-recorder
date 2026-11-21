import { describe, expect, it } from "vitest";
import { getHudInputShape } from "./hudInputShape";

const GUARD = [
	{ x: 0, y: 0, width: 1, height: 1 },
	{ x: 2, y: 0, width: 1, height: 1 },
];

describe("HUD native input shape", () => {
	it("keeps disjoint controls separate so the desktop between them stays clickable", () => {
		expect(
			getHudInputShape(
				[
					{ x: 10, y: 100, width: 300, height: 44 },
					{ x: 800, y: 200, width: 240, height: 240 },
				],
				1366,
				720,
			),
		).toEqual([
			{ x: 10, y: 100, width: 300, height: 44 },
			{ x: 800, y: 200, width: 240, height: 240 },
			...GUARD,
		]);
	});
	it("clips and rounds regions to the viewport", () => {
		expect(
			getHudInputShape([{ x: -5.2, y: 690.3, width: 100.4, height: 50 }], 1366, 720)[0],
		).toEqual({ x: 0, y: 690, width: 96, height: 30 });
	});
	it("never removes the shape while controls load or invalid regions arrive", () => {
		for (const input of [
			null,
			[],
			[{ x: NaN, y: 0, width: 100, height: 100 }],
			[{ x: 2000, y: 0, width: 20, height: 20 }],
		]) {
			expect(getHudInputShape(input, 1366, 720)).toEqual(GUARD);
		}
	});
	it("never leaves one plain rectangle, which would occlude the apps underneath", () => {
		// The recording bar alone used to be the whole shape, and browsers under
		// the HUD stopped painting and scrolling for the rest of the recording.
		expect(getHudInputShape([{ x: 400, y: 640, width: 500, height: 44 }], 1366, 720)).toEqual(
			[{ x: 400, y: 640, width: 500, height: 44 }, ...GUARD],
		);
	});
	it("keeps the guard row free even for full-window drag and drawing shapes", () => {
		expect(getHudInputShape([{ x: 0, y: 0, width: 1366, height: 720 }], 1366, 720)).toEqual([
			{ x: 0, y: 1, width: 1366, height: 719 },
			...GUARD,
		]);
	});
});
