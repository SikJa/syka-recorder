import type { RecordingWebcamLayout, ScreenRect } from "../types";

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

export function sanitizeScreenRect(value: unknown): ScreenRect | null {
	if (!value || typeof value !== "object") return null;
	const { x, y, width, height } = value as Partial<ScreenRect>;
	if (
		!isFiniteNumber(x) ||
		!isFiniteNumber(y) ||
		!isFiniteNumber(width) ||
		!isFiniteNumber(height)
	)
		return null;
	if (width <= 0 || height <= 0) return null;
	return { x, y, width, height };
}

/**
 * Where the floating webcam preview sat when recording stopped, as fractions of
 * the recorded region, so the editor can place the camera where the user saw it.
 */
export function normalizeWebcamPreviewRect(
	rect: ScreenRect,
	region: ScreenRect,
): RecordingWebcamLayout | null {
	if (region.width <= 0 || region.height <= 0) return null;
	const layout = {
		left: (rect.x - region.x) / region.width,
		top: (rect.y - region.y) / region.height,
		width: rect.width / region.width,
		height: rect.height / region.height,
		regionAspect: region.width / region.height,
	};
	return sanitizeRecordingWebcamLayout(layout);
}

export function sanitizeRecordingWebcamLayout(value: unknown): RecordingWebcamLayout | null {
	if (!value || typeof value !== "object") return null;
	const { left, top, width, height, regionAspect } = value as Partial<RecordingWebcamLayout>;
	if (
		![left, top, width, height, regionAspect].every(isFiniteNumber) ||
		(width as number) <= 0 ||
		(height as number) <= 0 ||
		(regionAspect as number) <= 0
	)
		return null;
	return {
		left: left as number,
		top: top as number,
		width: width as number,
		height: height as number,
		regionAspect: regionAspect as number,
	};
}
