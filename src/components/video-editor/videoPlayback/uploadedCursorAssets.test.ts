import { describe, expect, it } from "vitest";
import { cursorSetAssets, getCursorStyleSizeMultiplier } from "./uploadedCursorAssets";

describe("bundled cursor assets", () => {
	it("renders saved macOS, Tahoe and Windows 11 styles with Recordly's own minimal arrow", () => {
		const arrow = cursorSetAssets.tahoe.arrow;
		expect(arrow.url).toMatch(/minimal-cursor/);
		for (const set of [
			cursorSetAssets.macos,
			cursorSetAssets.tahoe,
			cursorSetAssets.windows11,
		]) {
			for (const asset of Object.values(set)) expect(asset).toBe(arrow);
		}
		expect(arrow.fallbackAnchor.x).toBeCloseTo(40 / 396, 10);
		expect(arrow.fallbackAnchor.y).toBeCloseTo(22 / 433, 10);
	});

	it("keeps every legacy style at its natural size", () => {
		for (const style of ["macos", "tahoe", "tahoe-inverted", "windows11"]) {
			expect(getCursorStyleSizeMultiplier(style)).toBe(1);
		}
	});
});
