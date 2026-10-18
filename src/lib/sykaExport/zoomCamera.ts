import {
	type ClipRegion,
	type CursorTelemetryPoint,
	mapTimelineTimeToSourceTime,
	type ZoomRegion,
} from "@/components/video-editor/types";
import { createCursorFollowCameraState } from "@/components/video-editor/videoPlayback/cursorFollowCamera";
import {
	createSpringState,
	getZoomSpringConfig,
	resetSpringState,
	stepSpringValue,
} from "@/components/video-editor/videoPlayback/motionSmoothing";
import { resolveSceneZoomTarget } from "@/components/video-editor/videoPlayback/sceneMotion";
import { computeZoomTransform } from "@/components/video-editor/videoPlayback/zoomTransform";

/** Camera settings the export renderer reads from the editor. */
export interface ZoomCameraSettings {
	connectZooms: boolean;
	zoomInDurationMs: number;
	zoomOutDurationMs: number;
	zoomClassicMode: boolean;
	zoomSmoothness: number;
	cameraSpringStiffnessMultiplier: number;
	cameraSpringDampingMultiplier: number;
	cameraSpringMassMultiplier: number;
}

/**
 * Recordly's camera at one timeline instant: `scale` about the frame's top-left
 * corner, then a translation of (`x`, `y`) pixels, so a frame point p lands at
 * `p * scale + (x, y)`.
 */
export interface CameraSample {
	timeMs: number;
	scale: number;
	x: number;
	y: number;
}

export interface SampleZoomCameraInput {
	zoomRegions: ZoomRegion[];
	clipRegions: ClipRegion[];
	cursorTelemetry: CursorTelemetryPoint[];
	settings: ZoomCameraSettings;
	frameWidth: number;
	frameHeight: number;
	durationMs: number;
	frameRate: number;
	baseMask?: { x: number; y: number; width: number; height: number };
}

/**
 * Replays the export renderer's camera (`FrameRenderer.updateAnimationState`)
 * frame by frame over a frame with no padding, so the samples are the zoom
 * Recordly itself would render on the clean screen video.
 */
export function sampleZoomCamera({
	zoomRegions,
	clipRegions,
	cursorTelemetry,
	settings,
	frameWidth,
	frameHeight,
	durationMs,
	frameRate,
	baseMask = { x: 0, y: 0, width: frameWidth, height: frameHeight },
}: SampleZoomCameraInput): CameraSample[] {
	if (
		![frameWidth, frameHeight, frameRate, durationMs].every(Number.isFinite) ||
		frameWidth <= 0 ||
		frameHeight <= 0 ||
		frameRate <= 0 ||
		frameRate > 120 ||
		durationMs <= 0 ||
		(durationMs * frameRate) / 1000 > 1_000_000
	) {
		throw new Error("Invalid or excessively long camera sampling request");
	}
	const stageSize = { width: frameWidth, height: frameHeight };
	const cursorFollowCamera = createCursorFollowCameraState();
	const springScale = createSpringState(1);
	const springX = createSpringState(0);
	const springY = createSpringState(0);
	const springConfig = getZoomSpringConfig(settings.zoomSmoothness, {
		stiffnessMultiplier: settings.cameraSpringStiffnessMultiplier,
		dampingMultiplier: settings.cameraSpringDampingMultiplier,
		massMultiplier: settings.cameraSpringMassMultiplier,
	});

	const frameCount = Math.max(1, Math.floor((durationMs * frameRate) / 1000) + 1);
	const samples: CameraSample[] = [];
	let lastTimeMs: number | null = null;

	for (let frame = 0; frame < frameCount; frame++) {
		const timeMs = (frame * 1000) / frameRate;
		const target = resolveSceneZoomTarget({
			zoomRegions,
			timeMs,
			cursorTimeMs: mapTimelineTimeToSourceTime(timeMs, clipRegions),
			connectZooms: settings.connectZooms,
			zoomInDurationMs: settings.zoomInDurationMs,
			zoomOutDurationMs: settings.zoomOutDurationMs,
			zoomClassicMode: settings.zoomClassicMode,
			cursorTelemetry,
			cursorFollowCamera,
		});
		const projected = computeZoomTransform({
			stageSize,
			baseMask,
			zoomScale: target.scale,
			zoomProgress: target.progress,
			focusX: target.focus.cx,
			focusY: target.focus.cy,
		});

		const deltaMs = lastTimeMs !== null ? timeMs - lastTimeMs : 1000 / 60;
		lastTimeMs = timeMs;

		if (settings.zoomClassicMode) {
			resetSpringState(springScale, projected.scale);
			resetSpringState(springX, projected.x);
			resetSpringState(springY, projected.y);
			samples.push({ timeMs, scale: projected.scale, x: projected.x, y: projected.y });
			continue;
		}

		samples.push({
			timeMs,
			scale: stepSpringValue(springScale, projected.scale, deltaMs, springConfig),
			x: stepSpringValue(springX, projected.x, deltaMs, springConfig),
			y: stepSpringValue(springY, projected.y, deltaMs, springConfig),
		});
	}

	return samples;
}
