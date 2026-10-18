import { describe, expect, it } from "vitest";
import { getHudInputShape } from "./hudInputShape";

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
		).toHaveLength(2);
	});
	it("clips and rounds regions to the viewport", () => {
		expect(
			getHudInputShape([{ x: -5.2, y: 690.3, width: 100.4, height: 50 }], 1366, 720),
		).toEqual([{ x: 0, y: 690, width: 96, height: 30 }]);
	});
	it("never removes the shape while controls load or invalid regions arrive", () => {
		for (const input of [
			null,
			[],
			[{ x: NaN, y: 0, width: 100, height: 100 }],
			[{ x: 2000, y: 0, width: 20, height: 20 }],
		]) {
			expect(getHudInputShape(input, 1366, 720)).toEqual([
				{ x: 0, y: 0, width: 1, height: 1 },
			]);
		}
	});
});
