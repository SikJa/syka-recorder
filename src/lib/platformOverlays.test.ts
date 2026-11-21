import { describe, expect, it } from "vitest";
import {
	normalizePlatformOverlayPreference,
	PLATFORM_OVERLAYS,
	platformsForFrame,
} from "./platformOverlays";

describe("platform overlays", () => {
	it("keeps every element and safe area inside the frame", () => {
		for (const overlay of Object.values(PLATFORM_OVERLAYS)) {
			for (const box of [...overlay.elements, ...(overlay.safe ? [overlay.safe] : [])]) {
				expect(box.x).toBeGreaterThanOrEqual(0);
				expect(box.y).toBeGreaterThanOrEqual(0);
				expect(box.x + box.w).toBeLessThanOrEqual(1.0001);
				expect(box.y + box.h).toBeLessThanOrEqual(1.0001);
			}
		}
	});
	it("matches the published safe areas", () => {
		// Meta: 14% top, 35% bottom, 6% sides. TikTok: 240/660/120 px of 1080x1920.
		expect(PLATFORM_OVERLAYS.reels.safe).toEqual({ x: 0.06, y: 0.14, w: 0.88, h: 0.51 });
		const tiktok = PLATFORM_OVERLAYS.tiktok.safe!;
		expect(tiktok.y * 1920).toBeCloseTo(240, 0);
		expect((1 - tiktok.y - tiktok.h) * 1920).toBeCloseTo(660, -1);
	});
	it("offers only the apps that match the frame's shape", () => {
		expect(platformsForFrame(1080, 1920).map((overlay) => overlay.id)).toEqual([
			"tiktok",
			"reels",
			"stories",
			"shorts",
		]);
		expect(platformsForFrame(1920, 1080).map((overlay) => overlay.id)).toEqual(["youtube"]);
	});
	it("restores a saved choice and ignores unknown values", () => {
		expect(normalizePlatformOverlayPreference({ platform: "shorts", mode: "safe" })).toEqual({
			platform: "shorts",
			mode: "safe",
			showNavBar: false,
		});
		expect(normalizePlatformOverlayPreference({ platform: "myspace" }).platform).toBeNull();
		expect(normalizePlatformOverlayPreference("junk").mode).toBe("app");
	});
});
