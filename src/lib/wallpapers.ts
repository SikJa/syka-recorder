export interface BuiltInWallpaper {
	id: string;
	label: string;
	relativePath: string;
	publicPath: string;
}

const VIDEO_FILE_PATTERN = /\.(avi|m4v|mkv|mov|mp4|webm)$/i;

/**
 * Syka Recorder ships no bundled wallpaper images: the ones inherited from
 * Recordly had no documented license. Backgrounds are flat colors, gradients
 * defined in code, or files the user picks.
 */
export const BUILT_IN_WALLPAPERS: BuiltInWallpaper[] = [];

/** Default background: Syka's dark canvas color. */
export const DEFAULT_WALLPAPER_PATH = "#121212";

const REMOVED_BUNDLED_WALLPAPER_PREFIX = "/wallpapers/";

/** Projects and preferences saved by Recordly may still name a removed bundled wallpaper. */
export function isRemovedBundledWallpaper(value: unknown): boolean {
	return typeof value === "string" && value.startsWith(REMOVED_BUNDLED_WALLPAPER_PREFIX);
}

export function normalizeWallpaperValue(value: unknown): string {
	if (typeof value !== "string" || !value || isRemovedBundledWallpaper(value)) {
		return DEFAULT_WALLPAPER_PATH;
	}
	return value;
}

export async function resolveAvailableWallpaperPath(wallpaper: string): Promise<string> {
	return isRemovedBundledWallpaper(wallpaper) ? DEFAULT_WALLPAPER_PATH : wallpaper;
}

export function isVideoWallpaperSource(value: string): boolean {
	if (!value) {
		return false;
	}

	const normalizedValue = value.split("?")[0]?.toLowerCase() ?? value.toLowerCase();
	return VIDEO_FILE_PATTERN.test(normalizedValue);
}

export async function getAvailableWallpapers(): Promise<BuiltInWallpaper[]> {
	return BUILT_IN_WALLPAPERS;
}
