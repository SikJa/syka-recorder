import { describe, expect, it } from "vitest";
import {
	calculateMp4ExportDimensions,
	calculateMp4SourceDimensions,
	capMp4ShareDimensions,
	fitMp4DimensionsToH264Level,
	shouldDebounceMp4SupportProbe,
} from "./exportDimensions";

describe("capMp4ShareDimensions", () => {
	it("caps landscape shares at 1080p without upscaling", () => {
		expect(capMp4ShareDimensions(3840, 2160)).toEqual({ width: 1920, height: 1080 });
		expect(capMp4ShareDimensions(1280, 720)).toEqual({ width: 1280, height: 720 });
	});

	it("caps portrait and square shares within equivalent 1080p bounds", () => {
		expect(capMp4ShareDimensions(2160, 3840)).toEqual({ width: 1080, height: 1920 });
		expect(capMp4ShareDimensions(2160, 2160)).toEqual({ width: 1080, height: 1080 });
	});

	it("keeps unusual aspect ratios and even dimensions", () => {
		expect(capMp4ShareDimensions(3441, 1441)).toEqual({ width: 1920, height: 802 });
	});
});

describe("calculateMp4SourceDimensions", () => {
	it("keeps native exports at the source dimensions", () => {
		expect(calculateMp4SourceDimensions(1920, 1080, "native")).toEqual({
			width: 1920,
			height: 1080,
		});
	});

	it("uses the cropped source bounds for native exports", () => {
		expect(
			calculateMp4SourceDimensions(320, 180, "native", {
				width: 1,
				height: 0.8,
			}),
		).toEqual({
			width: 320,
			height: 144,
		});
	});

	it("uses the rotated source bounds for 9:16 original exports", () => {
		expect(calculateMp4SourceDimensions(1920, 1080, "9:16")).toEqual({
			width: 1080,
			height: 1920,
		});
	});

	it("ignores crop bounds for fixed-aspect exports", () => {
		expect(
			calculateMp4SourceDimensions(1920, 1080, "9:16", {
				width: 0.5,
				height: 0.5,
			}),
		).toEqual({
			width: 1080,
			height: 1920,
		});
	});

	it("uses the rotated source bounds for portrait social ratios", () => {
		expect(calculateMp4SourceDimensions(1920, 1080, "4:5")).toEqual({
			width: 1080,
			height: 1350,
		});
	});

	it("keeps landscape aspect-ratio exports inside the source bounds", () => {
		expect(calculateMp4SourceDimensions(1920, 1080, "4:3")).toEqual({
			width: 1440,
			height: 1080,
		});
	});
});

describe("calculateMp4ExportDimensions", () => {
	it("normalizes odd source dimensions to even export dimensions", () => {
		const sourceDimensions = calculateMp4SourceDimensions(1919, 1079, "native");

		expect(sourceDimensions).toEqual({
			width: 1918,
			height: 1078,
		});
		expect(
			calculateMp4ExportDimensions(sourceDimensions.width, sourceDimensions.height, "source"),
		).toEqual({
			width: 1918,
			height: 1078,
		});
		expect(
			calculateMp4ExportDimensions(sourceDimensions.width, sourceDimensions.height, "high"),
		).toEqual({
			width: 1726,
			height: 970,
		});
	});

	it("scales portrait output dimensions from the aspect target", () => {
		const sourceDimensions = calculateMp4SourceDimensions(1920, 1080, "9:16");

		expect(
			calculateMp4ExportDimensions(sourceDimensions.width, sourceDimensions.height, "source"),
		).toEqual({
			width: 1080,
			height: 1920,
		});
		expect(
			calculateMp4ExportDimensions(sourceDimensions.width, sourceDimensions.height, "high"),
		).toEqual({
			width: 972,
			height: 1728,
		});
	});
});

describe("shouldDebounceMp4SupportProbe", () => {
	const baseSnapshot = {
		sourceWidth: 1920,
		sourceHeight: 1080,
		targetWidth: 1920,
		targetHeight: 1080,
		aspectRatio: "native" as const,
		frameRate: 30 as const,
	};

	it("debounces only native crop-driven target changes", () => {
		expect(
			shouldDebounceMp4SupportProbe(baseSnapshot, {
				...baseSnapshot,
				targetHeight: 864,
			}),
		).toBe(true);
	});

	it("keeps non-crop probe changes immediate", () => {
		expect(shouldDebounceMp4SupportProbe(null, baseSnapshot)).toBe(false);
		expect(
			shouldDebounceMp4SupportProbe(baseSnapshot, {
				...baseSnapshot,
				frameRate: 60,
			}),
		).toBe(false);
		expect(
			shouldDebounceMp4SupportProbe(baseSnapshot, {
				...baseSnapshot,
				sourceWidth: 1280,
				sourceHeight: 720,
				targetWidth: 1280,
				targetHeight: 720,
			}),
		).toBe(false);
		expect(
			shouldDebounceMp4SupportProbe(baseSnapshot, {
				...baseSnapshot,
				aspectRatio: "16:9",
			}),
		).toBe(false);
	});
});

describe("double MP4 export tier", () => {
	const macroblocks = (size: { width: number; height: number }) =>
		Math.ceil(size.width / 16) * Math.ceil(size.height / 16);

	it("composes at twice the source size when the H.264 level allows it", () => {
		expect(calculateMp4ExportDimensions(1366, 768, "double")).toEqual({
			width: 2732,
			height: 1536,
		});
		expect(calculateMp4ExportDimensions(1920, 1080, "double", 30)).toEqual({
			width: 3840,
			height: 2160,
		});
	});

	it("stays within level 5.1 frame and rate limits, even and in shape", () => {
		for (const [width, height, frameRate] of [
			[1366, 768, 60],
			[1920, 1080, 60],
			[2560, 1440, 30],
			[3840, 2160, 24],
			[1080, 1920, 30],
		] as const) {
			const size = calculateMp4ExportDimensions(width, height, "double", frameRate);
			expect(size.width % 2).toBe(0);
			expect(size.height % 2).toBe(0);
			expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(4096);
			expect(macroblocks(size)).toBeLessThanOrEqual(Math.min(36_864, 983_040 / frameRate));
			expect(size.width / size.height).toBeCloseTo(width / height, 2);
		}
		expect(calculateMp4ExportDimensions(1366, 768, "double", 60).width).toBeGreaterThan(2700);
	});

	it("never grows past a source that already sits at the limit", () => {
		expect(fitMp4DimensionsToH264Level(4096, 2304, 24)).toEqual({ width: 4096, height: 2304 });
		// 30 fps caps level 5.1 at 32,768 macroblocks, just under a 4K frame.
		const doubled4k = calculateMp4ExportDimensions(3840, 2160, "double", 30);
		expect(doubled4k.width * doubled4k.height).toBeLessThanOrEqual(3840 * 2160);
	});
});
