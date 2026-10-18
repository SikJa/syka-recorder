import { describe, expect, it } from "vitest";
import {
	getWebcamOverlayDimensionsPx,
	getWebcamOverlayPosition,
	scaleWebcamOverlayPixels,
} from "@/components/video-editor/webcamOverlay";
import {
	readRecordingWebcamPreviewRect,
	recordedWebcamPlacement,
	webcamSettingsFromRecordingLayout,
} from "./recordingWebcamPlacement";

/** Where the editor draws the webcam for these settings, in output pixels. */
function placeInEditor(
	settings: NonNullable<ReturnType<typeof webcamSettingsFromRecordingLayout>>,
	frame: { width: number; height: number },
	marginReference: number,
) {
	const margin = scaleWebcamOverlayPixels(marginReference, frame.width);
	const size = getWebcamOverlayDimensionsPx({
		containerWidth: frame.width,
		containerHeight: frame.height,
		widthPercent: settings.width,
		heightPercent: settings.height,
		margin,
		zoomScale: 1,
		reactToZoom: false,
	});
	const position = getWebcamOverlayPosition({
		containerWidth: frame.width,
		containerHeight: frame.height,
		...size,
		margin,
		positionPreset: settings.positionPreset ?? "bottom-right",
		positionX: settings.positionX ?? 1,
		positionY: settings.positionY ?? 1,
		legacyCorner: "bottom-right",
	});
	return { ...position, ...size };
}

describe("recorded webcam placement", () => {
	it("puts the camera where the floating preview sat, at the size it had", () => {
		// A 1366x720 screen recording; preview moved to the left and shrunk to 160px.
		const region = { width: 1366, height: 720 };
		const preview = { x: 120, y: 300, width: 160, height: 160 };
		const settings = webcamSettingsFromRecordingLayout(
			{
				left: preview.x / region.width,
				top: preview.y / region.height,
				width: preview.width / region.width,
				height: preview.height / region.height,
				regionAspect: region.width / region.height,
			},
			24,
		);
		expect(settings?.positionPreset).toBe("custom");

		// Same proportions at a different output size (the prepared video may be scaled).
		for (const frame of [region, { width: 2732, height: 1440 }, { width: 683, height: 360 }]) {
			const scale = frame.width / region.width;
			const placed = placeInEditor(settings!, frame, 24);
			expect(placed.x).toBeCloseTo(preview.x * scale, 6);
			expect(placed.y).toBeCloseTo(preview.y * scale, 6);
			expect(placed.width).toBeCloseTo(preview.width * scale, 6);
			expect(placed.height).toBeCloseTo(preview.height * scale, 6);
		}
	});

	it("keeps only the size when the preview was outside the recorded area", () => {
		const settings = webcamSettingsFromRecordingLayout(
			{ left: 1.2, top: 0.4, width: 0.1, height: 0.2, regionAspect: 16 / 9 },
			24,
		);
		// 10% of a 16:9 width is 17.8% of the shorter side; 20% of the height is 20%.
		expect(settings?.positionPreset).toBeUndefined();
		expect(settings?.width).toBeCloseTo(160 / 9, 10);
		expect(settings?.height).toBeCloseTo(20, 10);
	});

	it("leaves the editor defaults alone without a recorded layout", () => {
		expect(recordedWebcamPlacement(null, 24)).toEqual({});
		expect(recordedWebcamPlacement(undefined, 24)).toEqual({});
	});

	it("reads the preview rectangle in screen coordinates", () => {
		const element = {
			getBoundingClientRect: () => ({ left: 40, top: 60, width: 224, height: 224 }),
		};
		const rect = readRecordingWebcamPreviewRect(
			{ querySelector: () => element } as unknown as Document,
			{ screenX: 1920, screenY: 0 },
		);
		expect(rect).toEqual({ x: 1960, y: 60, width: 224, height: 224 });
		expect(
			readRecordingWebcamPreviewRect({ querySelector: () => null } as unknown as Document, {
				screenX: 0,
				screenY: 0,
			}),
		).toBeNull();
	});
});
