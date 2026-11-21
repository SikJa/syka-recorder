import type { CursorTelemetryPoint, ZoomFocus, ZoomRegion } from "../types";
import { ZOOM_DEPTH_SCALES } from "../types";
import { DEFAULT_FOCUS } from "./constants";
import { interpolateCursorPosition } from "./cursorPosition";
import {
	type CursorFollowCameraState,
	computeCursorFollowFocus,
	SNAP_TO_EDGES_RATIO_AUTO,
} from "./cursorFollowCamera";
import {
	clampFocusToHalfSpan,
	getFramingVisibleHalfSpan,
	type SceneBaseFraming,
} from "./verticalFraming";
import { findDominantRegion } from "./zoomRegionUtils";

export type SceneZoomTarget = {
	scale: number;
	focus: ZoomFocus;
	progress: number;
};

export type PreviewMotionMode = "spring" | "snap" | "preserve";

/**
 * Decide how the preview camera should react to the current transport state.
 * A plain pause must preserve the last composed frame; recomputing the projected
 * target there causes the image to jump as soon as the user presses Space.
 */
export function resolvePreviewMotionMode({
	isPlaying,
	isSeeking,
	shouldSnapPausedFrame,
	zoomClassicMode,
}: {
	isPlaying: boolean;
	isSeeking: boolean;
	shouldSnapPausedFrame: boolean;
	zoomClassicMode: boolean;
}): PreviewMotionMode {
	if (isSeeking || shouldSnapPausedFrame || (isPlaying && zoomClassicMode)) {
		return "snap";
	}

	return isPlaying ? "spring" : "preserve";
}

/** Match export's one-composition-per-media-frame behavior. */
export function shouldComposePreviewFrame({
	motionMode,
	isSeeking = false,
	contentTimeChanged,
	shouldSnapPausedFrame,
}: {
	motionMode: PreviewMotionMode;
	isSeeking?: boolean;
	contentTimeChanged: boolean;
	shouldSnapPausedFrame: boolean;
}): boolean {
	// Do not consume the pending composition against the old decoded image.
	if (isSeeking || motionMode === "preserve") {
		return false;
	}

	return contentTimeChanged || shouldSnapPausedFrame;
}

/** Resolve the camera target for a media timestamp, independent of renderer. */
export function resolveSceneZoomTarget({
	zoomRegions,
	timeMs,
	cursorTimeMs = timeMs,
	connectZooms,
	zoomInDurationMs,
	zoomOutDurationMs,
	zoomClassicMode,
	cursorTelemetry,
	cursorFollowCamera,
	baseFraming,
}: {
	zoomRegions: ZoomRegion[];
	timeMs: number;
	cursorTimeMs?: number;
	connectZooms?: boolean;
	zoomInDurationMs?: number;
	zoomOutDurationMs?: number;
	zoomClassicMode?: boolean;
	cursorTelemetry?: CursorTelemetryPoint[];
	cursorFollowCamera: CursorFollowCameraState;
	/**
	 * Vertical "follow" framing: a base zoom that fills the frame and a camera
	 * that follows the cursor for the whole timeline. Null keeps the plain zoom.
	 */
	baseFraming?: SceneBaseFraming | null;
}): SceneZoomTarget {
	const { region, strength, blendedScale } = findDominantRegion(zoomRegions, timeMs, {
		connectZooms,
		zoomInDurationMs,
		zoomOutDurationMs,
	});

	if (baseFraming) {
		return resolveFramedSceneZoomTarget({
			// The dominant region's focus is clamped for an unframed zoom; follow
			// framing clamps against its own (wider) visible window instead.
			region: region
				? {
						...region,
						focus:
							zoomRegions.find(({ id }) => id === region.id)?.focus ?? region.focus,
					}
				: null,
			strength,
			blendedScale,
			cursorTimeMs,
			zoomClassicMode,
			cursorTelemetry,
			cursorFollowCamera,
			baseFraming,
		});
	}

	if (!region || strength <= 0) {
		return { scale: 1, focus: DEFAULT_FOCUS, progress: 0 };
	}

	const scale = blendedScale ?? ZOOM_DEPTH_SCALES[region.depth];
	let focus = region.focus;
	if (
		!zoomClassicMode &&
		region.mode !== "manual" &&
		cursorTelemetry &&
		cursorTelemetry.length > 0
	) {
		focus = computeCursorFollowFocus(
			cursorFollowCamera,
			cursorTelemetry,
			cursorTimeMs,
			scale,
			strength,
			region.focus,
			{ snapToEdgesRatio: SNAP_TO_EDGES_RATIO_AUTO },
		);
	}

	return { scale, focus, progress: strength };
}

/**
 * Follow framing: the screen fills the frame (base scale) and zoom regions
 * multiply on top, always at full progress so the base never eases out.
 * Auto regions keep following the cursor; manual regions (and classic mode)
 * pull the focus toward the region focus by the region's strength.
 */
function resolveFramedSceneZoomTarget({
	region,
	strength,
	blendedScale,
	cursorTimeMs,
	zoomClassicMode,
	cursorTelemetry,
	cursorFollowCamera,
	baseFraming,
}: {
	region: ZoomRegion | null;
	strength: number;
	blendedScale: number | null;
	cursorTimeMs: number;
	zoomClassicMode?: boolean;
	cursorTelemetry?: CursorTelemetryPoint[];
	cursorFollowCamera: CursorFollowCameraState;
	baseFraming: SceneBaseFraming;
}): SceneZoomTarget {
	const regionStrength = region ? Math.min(1, Math.max(0, strength)) : 0;
	const regionScale =
		region && regionStrength > 0 ? (blendedScale ?? ZOOM_DEPTH_SCALES[region.depth]) : 1;
	const scale = baseFraming.fillScale * (1 + (regionScale - 1) * regionStrength);
	const halfSpan = getFramingVisibleHalfSpan(baseFraming, scale);
	const hasTelemetry = Boolean(cursorTelemetry && cursorTelemetry.length > 0);

	let focus: ZoomFocus = DEFAULT_FOCUS;
	if (hasTelemetry && cursorTelemetry) {
		focus = computeCursorFollowFocus(
			cursorFollowCamera,
			cursorTelemetry,
			cursorTimeMs,
			scale,
			1,
			interpolateCursorPosition(cursorTelemetry, cursorTimeMs) ?? DEFAULT_FOCUS,
			{ snapToEdgesRatio: SNAP_TO_EDGES_RATIO_AUTO, visibleHalfSpan: halfSpan },
		);
	}

	if (
		region &&
		regionStrength > 0 &&
		(region.mode === "manual" || zoomClassicMode || !hasTelemetry)
	) {
		focus = {
			cx: focus.cx + (region.focus.cx - focus.cx) * regionStrength,
			cy: focus.cy + (region.focus.cy - focus.cy) * regionStrength,
		};
	}

	return { scale, focus: clampFocusToHalfSpan(focus, halfSpan), progress: 1 };
}
