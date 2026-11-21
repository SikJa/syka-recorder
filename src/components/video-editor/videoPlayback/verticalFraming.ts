import type { ZoomFocus } from "../types";

/**
 * How a landscape screen sits in a portrait output frame.
 * - `fit`: the whole screen is visible (letterboxed inside the background).
 * - `follow`: the screen fills the frame height and the camera follows the cursor.
 */
export type VerticalFramingMode = "fit" | "follow";

/** Projects saved before the setting existed keep their original framing. */
export const LEGACY_VERTICAL_FRAMING: VerticalFramingMode = "fit";
/** New editor sessions fill portrait frames by default. */
export const DEFAULT_VERTICAL_FRAMING: VerticalFramingMode = "follow";

/** Extra output pixels covered on each edge so no background hairline shows. */
const FILL_OVERSCAN_PX = 1;

export function normalizeVerticalFraming(value: unknown): VerticalFramingMode {
	return value === "follow" || value === "fit" ? value : LEGACY_VERTICAL_FRAMING;
}

export function isPortraitFrame(width: number, height: number): boolean {
	return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > width;
}

/**
 * Base camera framing applied before any zoom region: the scale that makes the
 * screen cover the output frame, plus the geometry needed to keep the visible
 * window inside the screen.
 */
export interface SceneBaseFraming {
	fillScale: number;
	stageWidth: number;
	stageHeight: number;
	maskWidth: number;
	maskHeight: number;
	/** Rounded-corner radius of the screen mask, in stage pixels at scale 1. */
	cornerRadius: number;
}

/**
 * Resolve the follow framing for a frame, or null when it does not apply (fit
 * mode, a landscape/square frame, or a screen that is not wider than the frame).
 */
export function resolveSceneBaseFraming({
	mode,
	stageSize,
	maskRect,
	borderRadius = 0,
}: {
	mode: VerticalFramingMode | null | undefined;
	stageSize: { width: number; height: number };
	maskRect: { width: number; height: number };
	/** Screen corner radius as a percentage, as stored in the editor. */
	borderRadius?: number;
}): SceneBaseFraming | null {
	if (mode !== "follow") return null;
	const { width: stageWidth, height: stageHeight } = stageSize;
	const { width: maskWidth, height: maskHeight } = maskRect;
	if (
		!isPortraitFrame(stageWidth, stageHeight) ||
		!(maskWidth > 0) ||
		!(maskHeight > 0) ||
		!Number.isFinite(maskWidth) ||
		!Number.isFinite(maskHeight) ||
		maskWidth <= maskHeight ||
		maskWidth / maskHeight <= stageWidth / stageHeight
	) {
		return null;
	}

	const fillScale = Math.max(
		(stageHeight + FILL_OVERSCAN_PX * 2) / maskHeight,
		(stageWidth + FILL_OVERSCAN_PX * 2) / maskWidth,
	);

	return {
		fillScale,
		stageWidth,
		stageHeight,
		maskWidth,
		maskHeight,
		// Same radius the screen mask is drawn with (layoutUtils.scalePreviewBorderRadius).
		cornerRadius:
			(Math.min(maskWidth, maskHeight) *
				Math.min(50, Math.max(0, Number.isFinite(borderRadius) ? borderRadius : 0))) /
			100,
	};
}

/**
 * Half of the visible window, in mask-normalised units, at a total camera
 * scale. The horizontal half-span keeps a corner-radius margin so rounded
 * screen corners never enter the frame.
 */
export function getFramingVisibleHalfSpan(
	framing: SceneBaseFraming,
	scale: number,
): { x: number; y: number } {
	const safeScale = Math.max(framing.fillScale, scale);
	const halfX = framing.stageWidth / (2 * safeScale) / framing.maskWidth;
	const halfY = framing.stageHeight / (2 * safeScale) / framing.maskHeight;
	return {
		x: Math.min(0.5, halfX + framing.cornerRadius / framing.maskWidth),
		y: Math.min(0.5, halfY),
	};
}

/** Keep the camera centre so the visible window stays on the screen. */
export function clampFocusToHalfSpan(focus: ZoomFocus, halfSpan: { x: number; y: number }) {
	const clampAxis = (value: number, half: number) => {
		if (half >= 0.5) return 0.5;
		const safe = Number.isFinite(value) ? value : 0.5;
		return Math.min(1 - half, Math.max(half, safe));
	};
	return { cx: clampAxis(focus.cx, halfSpan.x), cy: clampAxis(focus.cy, halfSpan.y) };
}

/**
 * Camera scale relative to the base framing. Base fill is framing, not a zoom,
 * so overlays that react to zoom (the webcam) use this instead.
 */
export function getZoomScaleRelativeToFraming(
	appliedScale: number,
	framing: SceneBaseFraming | null | undefined,
): number {
	if (!framing || !(framing.fillScale > 0)) return appliedScale;
	return appliedScale / framing.fillScale;
}
