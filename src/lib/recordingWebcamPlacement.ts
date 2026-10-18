import type { WebcamOverlaySettings } from "@/components/video-editor/types";

export const RECORDING_WEBCAM_PREVIEW_ATTRIBUTE = "data-recording-webcam-preview";

export type ScreenRect = { x: number; y: number; width: number; height: number };

/** The floating webcam preview at the end of a recording, as fractions of the recorded region. */
export type RecordingWebcamLayout = {
	left: number;
	top: number;
	width: number;
	height: number;
	regionAspect: number;
};

/** Screen rectangle of the visible floating webcam preview, in the HUD's screen coordinates. */
export function readRecordingWebcamPreviewRect(
	doc: Pick<Document, "querySelector"> = document,
	view: Pick<Window, "screenX" | "screenY"> = window,
): ScreenRect | null {
	const element = doc.querySelector(`[${RECORDING_WEBCAM_PREVIEW_ATTRIBUTE}]`);
	if (!element) return null;
	const rect = element.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) return null;
	return {
		x: view.screenX + rect.left,
		y: view.screenY + rect.top,
		width: rect.width,
		height: rect.height,
	};
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

/**
 * Editor webcam settings that reproduce where the preview sat while recording.
 * Size follows `getWebcamOverlaySizePx` (percent of the frame's shorter side) and
 * position follows `getWebcamOverlayPosition` with the custom preset (a fraction of
 * the free space inside the margin). Works in units of the frame height, so it
 * holds at any output size with the recording's aspect ratio.
 */
export function webcamSettingsFromRecordingLayout(
	layout: RecordingWebcamLayout,
	marginReferencePx: number,
):
	| (Pick<WebcamOverlaySettings, "size" | "width" | "height"> &
			Partial<Pick<WebcamOverlaySettings, "positionPreset" | "positionX" | "positionY">>)
	| null {
	const aspect = layout.regionAspect;
	if (!(aspect > 0) || !(layout.width > 0) || !(layout.height > 0)) return null;

	const frameWidth = aspect;
	const frameHeight = 1;
	const shortSide = Math.min(frameWidth, frameHeight);
	const overlayWidth = layout.width * frameWidth;
	const overlayHeight = layout.height * frameHeight;
	const widthPercent = clamp((overlayWidth / shortSide) * 100, 10, 100);
	const heightPercent = clamp((overlayHeight / shortSide) * 100, 10, 100);

	const centerX = layout.left + layout.width / 2;
	const centerY = layout.top + layout.height / 2;
	const size = { size: widthPercent, width: widthPercent, height: heightPercent };
	// A preview that sat outside the recorded area only tells us its size.
	if (centerX < 0 || centerX > 1 || centerY < 0 || centerY > 1) return size;

	// Same scaling as `scaleWebcamOverlayPixels`: margin is relative to a 1920px-wide frame.
	const margin = Math.max(0, marginReferencePx) * (frameWidth / 1920);
	const placedWidth = (shortSide * widthPercent) / 100;
	const placedHeight = (shortSide * heightPercent) / 100;
	const freeX = frameWidth - placedWidth - margin * 2;
	const freeY = frameHeight - placedHeight - margin * 2;
	const left = layout.left * frameWidth;
	const top = layout.top * frameHeight;

	return {
		positionPreset: "custom",
		positionX: freeX > 0 ? clamp((left - margin) / freeX, 0, 1) : 0.5,
		positionY: freeY > 0 ? clamp((top - margin) / freeY, 0, 1) : 0.5,
		...size,
	};
}

/** Settings to merge into the editor's webcam for a fresh recording; empty when unknown. */
export function recordedWebcamPlacement(
	layout: RecordingWebcamLayout | null | undefined,
	marginReferencePx: number,
) {
	return (layout && webcamSettingsFromRecordingLayout(layout, marginReferencePx)) ?? {};
}
