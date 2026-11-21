import type { ExportMp4FrameRate, ExportQuality } from "@/lib/exporter";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";

export type Mp4SupportProbeSnapshot = {
	sourceWidth: number;
	sourceHeight: number;
	targetWidth: number;
	targetHeight: number;
	aspectRatio: AspectRatio;
	frameRate: ExportMp4FrameRate;
};

export function shouldDebounceMp4SupportProbe(
	previous: Mp4SupportProbeSnapshot | null,
	current: Mp4SupportProbeSnapshot,
): boolean {
	if (
		!previous ||
		current.aspectRatio !== "native" ||
		previous.aspectRatio !== current.aspectRatio ||
		previous.frameRate !== current.frameRate ||
		previous.sourceWidth !== current.sourceWidth ||
		previous.sourceHeight !== current.sourceHeight
	) {
		return false;
	}

	return (
		previous.targetWidth !== current.targetWidth ||
		previous.targetHeight !== current.targetHeight
	);
}

function normalizeEvenDimension(value: number): number {
	return Math.max(2, Math.floor(value / 2) * 2);
}

function fitAspectRatioWithinBounds(
	maxWidth: number,
	maxHeight: number,
	aspectRatioValue: number,
): { width: number; height: number } {
	const safeMaxWidth = normalizeEvenDimension(maxWidth);
	const safeMaxHeight = normalizeEvenDimension(maxHeight);
	const safeAspectRatio =
		Number.isFinite(aspectRatioValue) && aspectRatioValue > 0 ? aspectRatioValue : 16 / 9;

	if (safeMaxWidth / safeMaxHeight > safeAspectRatio) {
		const height = safeMaxHeight;
		const width = normalizeEvenDimension(height * safeAspectRatio);
		return { width: Math.min(width, safeMaxWidth), height };
	}

	const width = safeMaxWidth;
	const height = normalizeEvenDimension(width / safeAspectRatio);
	return { width, height: Math.min(height, safeMaxHeight) };
}

export function calculateMp4SourceDimensions(
	sourceWidth: number,
	sourceHeight: number,
	aspectRatio: AspectRatio,
	cropRegion?: { width: number; height: number },
): { width: number; height: number } {
	const useCroppedBounds = aspectRatio === "native";
	const safeSourceWidth = normalizeEvenDimension(
		sourceWidth * (useCroppedBounds ? (cropRegion?.width ?? 1) : 1),
	);
	const safeSourceHeight = normalizeEvenDimension(
		sourceHeight * (useCroppedBounds ? (cropRegion?.height ?? 1) : 1),
	);
	const sourceAspectRatio = safeSourceHeight > 0 ? safeSourceWidth / safeSourceHeight : 16 / 9;
	const aspectRatioValue = getAspectRatioValue(aspectRatio, sourceAspectRatio);

	if (aspectRatio === "native") {
		return { width: safeSourceWidth, height: safeSourceHeight };
	}

	const longSide = Math.max(safeSourceWidth, safeSourceHeight);
	const shortSide = Math.min(safeSourceWidth, safeSourceHeight);
	const maxWidth = aspectRatioValue >= 1 ? longSide : shortSide;
	const maxHeight = aspectRatioValue >= 1 ? shortSide : longSide;

	return fitAspectRatioWithinBounds(maxWidth, maxHeight, aspectRatioValue);
}

// H.264 High level 5.1, the level of the codec string every MP4 path probes
// and encodes with (avc1.640033): at most 36,864 macroblocks per frame and
// 983,040 per second. Hardware encoders also stop at 4096 px on a side.
const H264_MAX_FRAME_MACROBLOCKS = 36_864;
const H264_MAX_MACROBLOCK_RATE = 983_040;
const H264_MAX_SIDE = 4096;

function countMacroblocks(width: number, height: number): number {
	return Math.ceil(width / 16) * Math.ceil(height / 16);
}

/** Largest even size of the same shape that the H.264 level and encoders accept. */
export function fitMp4DimensionsToH264Level(
	width: number,
	height: number,
	frameRate: ExportMp4FrameRate,
): { width: number; height: number } {
	const maxMacroblocks = Math.min(
		H264_MAX_FRAME_MACROBLOCKS,
		Math.floor(H264_MAX_MACROBLOCK_RATE / frameRate),
	);
	let scale = Math.min(
		1,
		H264_MAX_SIDE / Math.max(width, height),
		Math.sqrt((maxMacroblocks * 256) / (width * height)),
	);
	let fitted = {
		width: normalizeEvenDimension(width * scale),
		height: normalizeEvenDimension(height * scale),
	};
	// Macroblocks round up, so the area bound can still land a row or column over.
	while (countMacroblocks(fitted.width, fitted.height) > maxMacroblocks && scale > 0) {
		scale -= 0.002;
		fitted = {
			width: normalizeEvenDimension(width * scale),
			height: normalizeEvenDimension(height * scale),
		};
	}
	return fitted;
}

/**
 * "double" composes the frame at twice the source size. The recording is drawn
 * smaller than the frame (padding) and zoom regions magnify it, so the extra
 * pixels keep detail the source-sized canvas resamples away.
 */
export function calculateMp4ExportDimensions(
	baseWidth: number,
	baseHeight: number,
	quality: ExportQuality,
	frameRate: ExportMp4FrameRate = 30,
): { width: number; height: number } {
	if (quality === "double") {
		return fitMp4DimensionsToH264Level(baseWidth * 2, baseHeight * 2, frameRate);
	}

	if (quality === "source") {
		return {
			width: normalizeEvenDimension(baseWidth),
			height: normalizeEvenDimension(baseHeight),
		};
	}

	const qualityScale = quality === "medium" ? 0.6 : quality === "good" ? 0.75 : 0.9;
	return {
		width: normalizeEvenDimension(baseWidth * qualityScale),
		height: normalizeEvenDimension(baseHeight * qualityScale),
	};
}

const SHARED_VIDEO_LONG_SIDE_MAX = 1920;
const SHARED_VIDEO_SHORT_SIDE_MAX = 1080;

export function capMp4ShareDimensions(
	width: number,
	height: number,
): { width: number; height: number } {
	const normalizedWidth = normalizeEvenDimension(width);
	const normalizedHeight = normalizeEvenDimension(height);
	const landscape = normalizedWidth >= normalizedHeight;
	const maxWidth = landscape ? SHARED_VIDEO_LONG_SIDE_MAX : SHARED_VIDEO_SHORT_SIDE_MAX;
	const maxHeight = landscape ? SHARED_VIDEO_SHORT_SIDE_MAX : SHARED_VIDEO_LONG_SIDE_MAX;
	const scale = Math.min(1, maxWidth / normalizedWidth, maxHeight / normalizedHeight);

	return {
		width: normalizeEvenDimension(normalizedWidth * scale),
		height: normalizeEvenDimension(normalizedHeight * scale),
	};
}
