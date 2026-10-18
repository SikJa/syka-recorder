import { describe, expect, it } from "vitest";
import {
	normalizeWebcamPreviewRect,
	sanitizeRecordingWebcamLayout,
	sanitizeScreenRect,
} from "./webcamLayout";

describe("recording webcam layout", () => {
	it("expresses the preview as fractions of the recorded region", () => {
		expect(
			normalizeWebcamPreviewRect(
				{ x: 1920 + 120, y: 300, width: 160, height: 160 },
				{ x: 1920, y: 0, width: 1600, height: 900 },
			),
		).toEqual({ left: 0.075, top: 1 / 3, width: 0.1, height: 160 / 900, regionAspect: 16 / 9 });
	});

	it("rejects malformed rectangles and layouts", () => {
		expect(sanitizeScreenRect({ x: 0, y: 0, width: 0, height: 10 })).toBeNull();
		expect(sanitizeScreenRect({ x: "1", y: 0, width: 10, height: 10 })).toBeNull();
		expect(sanitizeScreenRect(null)).toBeNull();
		expect(
			sanitizeRecordingWebcamLayout({
				left: 0,
				top: 0,
				width: 0.1,
				height: 0.1,
				regionAspect: 0,
			}),
		).toBeNull();
		expect(sanitizeRecordingWebcamLayout({ left: Number.NaN })).toBeNull();
	});
});
