import { describe, expect, it } from "vitest";
import {
	BUILT_IN_WALLPAPERS,
	DEFAULT_WALLPAPER_PATH,
	getAvailableWallpapers,
	isRemovedBundledWallpaper,
	isVideoWallpaperSource,
	normalizeWallpaperValue,
	resolveAvailableWallpaperPath,
} from "./wallpapers";

describe("wallpapers", () => {
	it("ships no bundled wallpaper images and defaults to a flat color", async () => {
		expect(BUILT_IN_WALLPAPERS).toEqual([]);
		expect(DEFAULT_WALLPAPER_PATH).toMatch(/^#[0-9a-f]{6}$/i);
		await expect(getAvailableWallpapers()).resolves.toEqual([]);
	});

	it("maps wallpapers removed from the bundle to the default background", async () => {
		expect(isRemovedBundledWallpaper("/wallpapers/tahoe-light.jpg")).toBe(true);
		expect(normalizeWallpaperValue("/wallpapers/tahoe-light.jpg")).toBe(DEFAULT_WALLPAPER_PATH);
		await expect(resolveAvailableWallpaperPath("/wallpapers/wispysky.mp4")).resolves.toBe(
			DEFAULT_WALLPAPER_PATH,
		);
	});

	it("keeps colors, gradients, uploads and local files the user chose", async () => {
		for (const value of [
			"#1d4ed8",
			"linear-gradient(90deg, #000 0%, #fff 100%)",
			"data:image/png;base64,AAAA",
			"C:\\Users\\me\\Pictures\\bg.png",
			"/Users/me/Pictures/bg.png",
		]) {
			expect(normalizeWallpaperValue(value)).toBe(value);
			await expect(resolveAvailableWallpaperPath(value)).resolves.toBe(value);
		}
	});

	it("falls back to the default for missing or invalid values", () => {
		expect(normalizeWallpaperValue(undefined)).toBe(DEFAULT_WALLPAPER_PATH);
		expect(normalizeWallpaperValue("")).toBe(DEFAULT_WALLPAPER_PATH);
		expect(normalizeWallpaperValue(42)).toBe(DEFAULT_WALLPAPER_PATH);
	});

	it("recognizes video backgrounds", () => {
		expect(isVideoWallpaperSource("C:\\clips\\loop.mp4")).toBe(true);
		expect(isVideoWallpaperSource("C:\\images\\bg.png?v=1")).toBe(false);
	});
});
