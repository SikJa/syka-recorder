import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	calculateOutputDimensions,
	DEFAULT_MP4_CODEC,
	type ExportMp4FrameRate,
	GIF_SIZE_PRESETS,
	type GifSizePreset,
	probeSupportedMp4Dimensions,
	type SupportedMp4Dimensions,
} from "@/lib/exporter";
import { getSourceQualityBitrate } from "@/lib/exporter/exportBitrate";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import {
	calculateMp4ExportDimensions,
	calculateMp4SourceDimensions,
	type Mp4SupportProbeSnapshot,
	shouldDebounceMp4SupportProbe,
} from "../exportDimensions";
import type { CropRegion } from "../types";
import type { VideoPlaybackRef } from "../VideoPlayback";

const MP4_CROP_PROBE_DEBOUNCE_MS = 200;

/**
 * The "double" tier for an encoder-supported source size, or null when no
 * encoder can go meaningfully beyond the source (already at the H.264 limit,
 * or larger sizes rejected), in which case exports use the source size.
 */
export async function probeDoubleMp4Dimensions(
	source: { width: number; height: number },
	frameRate: ExportMp4FrameRate,
): Promise<SupportedMp4Dimensions | null> {
	const requested = calculateMp4ExportDimensions(
		source.width,
		source.height,
		"double",
		frameRate,
	);
	const sourcePixels = source.width * source.height;
	if (requested.width * requested.height <= sourcePixels) return null;
	const result = await probeSupportedMp4Dimensions({
		width: requested.width,
		height: requested.height,
		frameRate,
		codec: DEFAULT_MP4_CODEC,
		getBitrate: getSourceQualityBitrate,
	});
	return result.encoderPath && result.width * result.height > sourcePixels ? result : null;
}

type Input = {
	videoPlaybackRef: RefObject<VideoPlaybackRef | null>;
	isPreviewReady: boolean;
	aspectRatio: AspectRatio;
	cropRegion: CropRegion;
	mp4FrameRate: ExportMp4FrameRate;
	gifSizePreset: GifSizePreset;
};

export function useExportDimensions({
	videoPlaybackRef,
	isPreviewReady,
	aspectRatio,
	cropRegion,
	mp4FrameRate,
	gifSizePreset,
}: Input) {
	const [supportedSourceDimensions, setSupportedSourceDimensions] =
		useState<SupportedMp4Dimensions>({
			width: 1920,
			height: 1080,
			capped: false,
			encoderPath: null,
		});
	const [supportedDoubleDimensions, setSupportedDoubleDimensions] =
		useState<SupportedMp4Dimensions | null>(null);
	const requestRef = useRef(0);
	const previousProbeRef = useRef<Mp4SupportProbeSnapshot | null>(null);
	const sourceDimensions = useMemo(() => {
		const video = isPreviewReady ? videoPlaybackRef.current?.video : null;
		return { width: video?.videoWidth || 1920, height: video?.videoHeight || 1080 };
	}, [isPreviewReady, videoPlaybackRef]);
	const gifOutputDimensions = useMemo(
		() =>
			calculateOutputDimensions(
				sourceDimensions.width,
				sourceDimensions.height,
				gifSizePreset,
				GIF_SIZE_PRESETS,
			),
		[gifSizePreset, sourceDimensions],
	);
	const desiredSourceDimensions = useMemo(
		() =>
			calculateMp4SourceDimensions(
				sourceDimensions.width,
				sourceDimensions.height,
				aspectRatio,
				cropRegion,
			),
		[sourceDimensions, aspectRatio, cropRegion],
	);
	const outputDimensions = useMemo(() => {
		const width = supportedSourceDimensions.encoderPath
			? supportedSourceDimensions.width
			: desiredSourceDimensions.width;
		const height = supportedSourceDimensions.encoderPath
			? supportedSourceDimensions.height
			: desiredSourceDimensions.height;
		return {
			medium: calculateMp4ExportDimensions(width, height, "medium"),
			good: calculateMp4ExportDimensions(width, height, "good"),
			high: calculateMp4ExportDimensions(width, height, "high"),
			source: calculateMp4ExportDimensions(width, height, "source"),
			// Only offered once an encoder has confirmed the larger size.
			...(supportedDoubleDimensions
				? {
						double: {
							width: supportedDoubleDimensions.width,
							height: supportedDoubleDimensions.height,
						},
					}
				: {}),
		};
	}, [supportedSourceDimensions, desiredSourceDimensions, supportedDoubleDimensions]);
	const ensureSupportedSourceDimensions = useCallback(
		async (frameRate: ExportMp4FrameRate) => {
			const result = await probeSupportedMp4Dimensions({
				width: desiredSourceDimensions.width,
				height: desiredSourceDimensions.height,
				frameRate,
				codec: DEFAULT_MP4_CODEC,
				getBitrate: getSourceQualityBitrate,
			});
			if (!result.encoderPath) {
				throw new Error(
					`Video encoding not supported on this system. Tried codec ${DEFAULT_MP4_CODEC} at ${frameRate} FPS up to ${desiredSourceDimensions.width}x${desiredSourceDimensions.height}.`,
				);
			}
			return result;
		},
		[desiredSourceDimensions],
	);

	useEffect(() => {
		let cancelled = false;
		const requestId = ++requestRef.current;
		const snapshot: Mp4SupportProbeSnapshot = {
			sourceWidth: sourceDimensions.width,
			sourceHeight: sourceDimensions.height,
			targetWidth: desiredSourceDimensions.width,
			targetHeight: desiredSourceDimensions.height,
			aspectRatio,
			frameRate: mp4FrameRate,
		};
		const shouldDebounce = shouldDebounceMp4SupportProbe(previousProbeRef.current, snapshot);
		previousProbeRef.current = snapshot;
		const fallback = { ...desiredSourceDimensions, capped: false, encoderPath: null };
		setSupportedSourceDimensions(fallback);
		setSupportedDoubleDimensions(null);
		const runProbe = () => {
			void ensureSupportedSourceDimensions(mp4FrameRate)
				.then(async (result) => {
					if (cancelled || requestId !== requestRef.current) return;
					setSupportedSourceDimensions(result);
					const double = await probeDoubleMp4Dimensions(result, mp4FrameRate).catch(
						() => null,
					);
					if (!cancelled && requestId === requestRef.current)
						setSupportedDoubleDimensions(double);
				})
				.catch(() => {
					if (!cancelled && requestId === requestRef.current)
						setSupportedSourceDimensions(fallback);
				});
		};
		const timeoutId = shouldDebounce
			? window.setTimeout(runProbe, MP4_CROP_PROBE_DEBOUNCE_MS)
			: null;
		if (timeoutId === null) runProbe();
		return () => {
			cancelled = true;
			if (timeoutId !== null) window.clearTimeout(timeoutId);
		};
	}, [
		sourceDimensions,
		desiredSourceDimensions,
		aspectRatio,
		mp4FrameRate,
		ensureSupportedSourceDimensions,
	]);

	return {
		gifOutputDimensions,
		mp4OutputDimensions: outputDimensions,
		supportedMp4SourceDimensions: supportedSourceDimensions,
		ensureSupportedMp4SourceDimensions: ensureSupportedSourceDimensions,
	};
}
