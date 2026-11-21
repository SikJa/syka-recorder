import { describe, expect, it } from "vitest";
import { normalizeProjectEditor } from "../projectPersistence";
import { type CursorTelemetryPoint, ZOOM_DEPTH_SCALES, type ZoomRegion } from "../types";
import { createCursorFollowCameraState } from "./cursorFollowCamera";
import { computePaddedLayout } from "./layoutUtils";
import { resolveSceneZoomTarget } from "./sceneMotion";
import {
	getFramingVisibleHalfSpan,
	getZoomScaleRelativeToFraming,
	resolveSceneBaseFraming,
	type SceneBaseFraming,
} from "./verticalFraming";
import { computeZoomTransform } from "./zoomTransform";

const stageSize = { width: 1080, height: 1920 };
const layout = computePaddedLayout({
	width: stageSize.width,
	height: stageSize.height,
	padding: 10,
	cropRegion: { x: 0, y: 0, width: 1, height: 1 },
	videoWidth: 1920,
	videoHeight: 1080,
});
const baseMask = {
	x: layout.centerOffsetX,
	y: layout.centerOffsetY,
	width: layout.croppedDisplayWidth,
	height: layout.croppedDisplayHeight,
};

function followFraming(borderRadius = 0): SceneBaseFraming {
	const framing = resolveSceneBaseFraming({
		mode: "follow",
		stageSize,
		maskRect: baseMask,
		borderRadius,
	});
	if (!framing) throw new Error("expected follow framing");
	return framing;
}

/** Screen rectangle in output pixels after the camera transform. */
function projectedScreen(target: ReturnType<typeof resolveSceneZoomTarget>) {
	const transform = computeZoomTransform({
		stageSize,
		baseMask,
		zoomScale: target.scale,
		zoomProgress: target.progress,
		focusX: target.focus.cx,
		focusY: target.focus.cy,
	});
	return {
		left: baseMask.x * transform.scale + transform.x,
		top: baseMask.y * transform.scale + transform.y,
		right: (baseMask.x + baseMask.width) * transform.scale + transform.x,
		bottom: (baseMask.y + baseMask.height) * transform.scale + transform.y,
	};
}

function expectFrameCovered(target: ReturnType<typeof resolveSceneZoomTarget>) {
	const screen = projectedScreen(target);
	expect(screen.left).toBeLessThanOrEqual(0.001);
	expect(screen.top).toBeLessThanOrEqual(0.001);
	expect(screen.right).toBeGreaterThanOrEqual(stageSize.width - 0.001);
	expect(screen.bottom).toBeGreaterThanOrEqual(stageSize.height - 0.001);
}

function telemetryAt(cx: number, cy: number): CursorTelemetryPoint[] {
	return [
		{ timeMs: 0, cx, cy },
		{ timeMs: 10_000, cx, cy },
	];
}

describe("resolveSceneBaseFraming", () => {
	it("fills the frame height with the padded screen mask", () => {
		const framing = followFraming();
		expect(framing.fillScale).toBeCloseTo((stageSize.height + 2) / baseMask.height, 6);
		// The screen is the only thing in frame, so padding no longer matters.
		expect(framing.fillScale * baseMask.width).toBeGreaterThan(stageSize.width);
	});

	it("does not apply to fit mode, landscape frames or portrait screens", () => {
		expect(resolveSceneBaseFraming({ mode: "fit", stageSize, maskRect: baseMask })).toBeNull();
		expect(
			resolveSceneBaseFraming({
				mode: "follow",
				stageSize: { width: 1920, height: 1080 },
				maskRect: baseMask,
			}),
		).toBeNull();
		expect(
			resolveSceneBaseFraming({
				mode: "follow",
				stageSize,
				maskRect: { width: 400, height: 800 },
			}),
		).toBeNull();
	});

	it("keeps the webcam zoom reaction relative to the base fill", () => {
		const framing = followFraming();
		expect(getZoomScaleRelativeToFraming(framing.fillScale, framing)).toBeCloseTo(1);
		expect(getZoomScaleRelativeToFraming(framing.fillScale * 1.5, framing)).toBeCloseTo(1.5);
		expect(getZoomScaleRelativeToFraming(1.5, null)).toBe(1.5);
	});
});

describe("resolveSceneZoomTarget with follow framing", () => {
	it("centers the filled screen when there is no cursor telemetry", () => {
		const framing = followFraming();
		const target = resolveSceneZoomTarget({
			zoomRegions: [],
			timeMs: 1000,
			cursorFollowCamera: createCursorFollowCameraState(),
			baseFraming: framing,
		});
		expect(target).toEqual({
			scale: framing.fillScale,
			focus: { cx: 0.5, cy: 0.5 },
			progress: 1,
		});
		expectFrameCovered(target);
	});

	it("follows the cursor and clamps at the screen edges", () => {
		const framing = followFraming();
		const halfSpan = getFramingVisibleHalfSpan(framing, framing.fillScale);
		const right = resolveSceneZoomTarget({
			zoomRegions: [],
			timeMs: 500,
			cursorTelemetry: telemetryAt(0.8, 0.2),
			cursorFollowCamera: createCursorFollowCameraState(),
			baseFraming: framing,
		});
		expect(right.focus.cx).toBeCloseTo(0.8);
		expectFrameCovered(right);

		const farLeft = resolveSceneZoomTarget({
			zoomRegions: [],
			timeMs: 500,
			cursorTelemetry: telemetryAt(0.01, 0.99),
			cursorFollowCamera: createCursorFollowCameraState(),
			baseFraming: framing,
		});
		expect(farLeft.focus.cx).toBeCloseTo(halfSpan.x);
		expectFrameCovered(farLeft);
		const screen = projectedScreen(farLeft);
		expect(screen.left).toBeCloseTo(0, 3);
	});

	it("keeps rounded screen corners out of the frame", () => {
		const framing = followFraming(12);
		const target = resolveSceneZoomTarget({
			zoomRegions: [],
			timeMs: 500,
			cursorTelemetry: telemetryAt(0, 0.5),
			cursorFollowCamera: createCursorFollowCameraState(),
			baseFraming: framing,
		});
		const screen = projectedScreen(target);
		expect(screen.left).toBeLessThanOrEqual(-framing.cornerRadius * target.scale + 0.001);
	});

	it("recenters only when the cursor leaves the safe zone", () => {
		const framing = followFraming();
		const camera = createCursorFollowCameraState();
		const telemetry: CursorTelemetryPoint[] = [
			{ timeMs: 0, cx: 0.5, cy: 0.5 },
			{ timeMs: 100, cx: 0.52, cy: 0.5 },
			{ timeMs: 200, cx: 0.75, cy: 0.5 },
		];
		const resolve = (timeMs: number) =>
			resolveSceneZoomTarget({
				zoomRegions: [],
				timeMs,
				cursorTelemetry: telemetry,
				cursorFollowCamera: camera,
				baseFraming: framing,
			});
		expect(resolve(0).focus.cx).toBeCloseTo(0.5);
		expect(resolve(100).focus.cx).toBeCloseTo(0.5);
		expect(resolve(200).focus.cx).toBeCloseTo(0.75);
	});

	it("multiplies zoom regions on top of the base fill", () => {
		const framing = followFraming();
		const region: ZoomRegion = {
			id: "z",
			startMs: 0,
			endMs: 4000,
			depth: 2,
			focus: { cx: 0.2, cy: 0.8 },
			mode: "auto",
		};
		const target = resolveSceneZoomTarget({
			zoomRegions: [region],
			timeMs: 2000,
			cursorTelemetry: telemetryAt(0.6, 0.4),
			cursorFollowCamera: createCursorFollowCameraState(),
			baseFraming: framing,
		});
		expect(target.progress).toBe(1);
		expect(target.scale).toBeCloseTo(framing.fillScale * ZOOM_DEPTH_SCALES[2]);
		// Auto regions keep following the cursor.
		expect(target.focus.cx).toBeCloseTo(0.6);
		expect(target.focus.cy).toBeCloseTo(0.4);
		expectFrameCovered(target);
	});

	it("eases region scale and manual focus in by the region strength", () => {
		const framing = followFraming();
		const region: ZoomRegion = {
			id: "z",
			startMs: 1000,
			endMs: 5000,
			depth: 3,
			focus: { cx: 0.25, cy: 0.5 },
			mode: "manual",
		};
		const at = (timeMs: number) =>
			resolveSceneZoomTarget({
				zoomRegions: [region],
				timeMs,
				cursorTelemetry: telemetryAt(0.75, 0.5),
				cursorFollowCamera: createCursorFollowCameraState(),
				baseFraming: framing,
				zoomInDurationMs: 1000,
			});
		const before = at(500);
		expect(before.scale).toBeCloseTo(framing.fillScale);
		expect(before.focus.cx).toBeCloseTo(0.75);

		const full = at(3000);
		expect(full.scale).toBeCloseTo(framing.fillScale * ZOOM_DEPTH_SCALES[3]);
		expect(full.focus.cx).toBeCloseTo(0.25);

		const easing = at(1300);
		expect(easing.scale).toBeGreaterThan(framing.fillScale);
		expect(easing.scale).toBeLessThan(full.scale);
		expect(easing.focus.cx).toBeGreaterThan(0.25);
		expect(easing.focus.cx).toBeLessThan(0.75);
		for (const target of [before, easing, full]) expectFrameCovered(target);
	});

	it("uses the region focus when there is no cursor telemetry", () => {
		const framing = followFraming();
		const target = resolveSceneZoomTarget({
			zoomRegions: [
				{
					id: "z",
					startMs: 0,
					endMs: 4000,
					depth: 2,
					focus: { cx: 0.7, cy: 0.5 },
					mode: "auto",
				},
			],
			timeMs: 2000,
			cursorFollowCamera: createCursorFollowCameraState(),
			baseFraming: framing,
		});
		expect(target.focus.cx).toBeCloseTo(0.7);
	});

	it("leaves the plain zoom camera untouched without framing", () => {
		expect(
			resolveSceneZoomTarget({
				zoomRegions: [],
				timeMs: 1000,
				cursorFollowCamera: createCursorFollowCameraState(),
				baseFraming: null,
			}),
		).toEqual({ scale: 1, focus: { cx: 0.5, cy: 0.5 }, progress: 0 });
	});
});

describe("vertical framing persistence", () => {
	it("loads projects saved before the setting as fit", () => {
		expect(normalizeProjectEditor({}).verticalFraming).toBe("fit");
		expect(
			normalizeProjectEditor({ verticalFraming: "bogus" as unknown as "fit" })
				.verticalFraming,
		).toBe("fit");
		expect(normalizeProjectEditor({ verticalFraming: "follow" }).verticalFraming).toBe(
			"follow",
		);
	});
});
