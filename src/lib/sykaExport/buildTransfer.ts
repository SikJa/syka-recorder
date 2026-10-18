import type { ProjectEditorState } from "@/components/video-editor/projectPersistence";
import {
	type CursorTelemetryPoint,
	getClipSourceStartMs,
	type ZoomRegion,
} from "@/components/video-editor/types";
import {
	getCropMatchedWebcamHeightPercent,
	getWebcamCornerRadiusPx,
	getWebcamOverlayDimensionsPx,
	getWebcamOverlayPosition,
	scaleWebcamOverlayPixels,
} from "@/components/video-editor/webcamOverlay";
import {
	getSourceTrackIdFromPath,
	resolveSourceTrackGain,
} from "@/lib/exporter/audioProcessorShared";
import { resolveSourceTrackRoutingPolicy } from "@/lib/exporter/sourceTrackRoutingPolicy";
import type { TransferAssetInput, TransferPlan } from "./contract";
import { buildZoomBlocks } from "./zoomBlocks";
import { sampleZoomCamera } from "./zoomCamera";
import {
	computePaddedLayout,
	scalePreviewBorderRadius,
} from "@/components/video-editor/videoPlayback/layoutUtils";
import { getLocalFilePath } from "@/lib/exporter/localMediaSource";
import { isVideoWallpaperSource } from "@/lib/wallpapers";

export interface BuildTransferInput {
	name: string;
	sourcePath: string;
	sourceDurationMs: number;
	width: number;
	height: number;
	frameRate: number;
	editor: ProjectEditorState;
	zoomRegions: ZoomRegion[];
	cursorTelemetry: CursorTelemetryPoint[];
	audioPaths: string[];
	audioDelays: Record<string, number>;
	webcamDimensions?: { width: number; height: number };
	canvasSize?: { width: number; height: number };
	backgroundDurationMs?: number;
}

export function buildTransfer(input: BuildTransferInput): {
	plan: TransferPlan;
	assets: TransferAssetInput[];
} {
	const { editor, sourceDurationMs, frameRate } = input;
	const { width, height } = input.canvasSize ?? input;
	const layout = computePaddedLayout({
		width,
		height,
		padding: editor.padding,
		cropRegion: { x: 0, y: 0, width: 1, height: 1 },
		videoWidth: input.width,
		videoHeight: input.height,
	});
	const screen = {
		x: layout.centerOffsetX,
		y: layout.centerOffsetY,
		width: layout.croppedDisplayWidth,
		height: layout.croppedDisplayHeight,
		cornerRadius: scalePreviewBorderRadius(
			layout.croppedDisplayWidth,
			layout.croppedDisplayHeight,
			editor.borderRadius,
		),
		sourceWidth: input.width,
		sourceHeight: input.height,
		shadow: editor.shadowIntensity,
	};
	// Project normalization migrates legacy trims/speeds before this point. An
	// explicitly empty list means the user deleted all footage, not "use source".
	const clips = editor.clipRegions.map((clip) => ({
		...clip,
		sourceStartMs: getClipSourceStartMs(clip),
	}));
	if (!clips.length)
		throw new Error("La línea de tiempo no tiene clips de pantalla para transferir.");
	clips.sort((a, b) => a.startMs - b.startMs);
	if (
		!clips.length ||
		clips.some(
			(clip, index) =>
				![clip.startMs, clip.endMs, clip.sourceStartMs, clip.speed].every(
					Number.isFinite,
				) ||
				clip.startMs < 0 ||
				clip.endMs <= clip.startMs ||
				clip.speed <= 0 ||
				clip.sourceStartMs < 0 ||
				clip.sourceStartMs + (clip.endMs - clip.startMs) * clip.speed >
					sourceDurationMs + 2 ||
				(index > 0 && clip.startMs < clips[index - 1].endMs),
		)
	)
		throw new Error("Invalid screen clips");
	const durationMs = Math.max(...clips.map((clip) => clip.endMs));
	const assets: TransferAssetInput[] = [
		{ id: "original-screen", role: "original-screen", sourcePath: input.sourcePath },
	];
	const warnings = [
		"El cursor y el recorte de pantalla quedan dibujados en el video; se conserva el original.",
	];
	const plan: TransferPlan = {
		name: input.name,
		canvas: { width, height, frameRate, durationMs },
		screen,
		clips,
		zooms: buildZoomBlocks(
			sampleZoomCamera({
				zoomRegions: input.zoomRegions,
				clipRegions: clips,
				cursorTelemetry: input.cursorTelemetry,
				settings: editor,
				frameWidth: width,
				frameHeight: height,
				baseMask: screen,
				durationMs,
				frameRate,
			}),
			input.zoomRegions,
			width,
			height,
			frameRate,
			durationMs,
		),
		audio: [],
		warnings,
	};
	const wallpaper = editor.wallpaper;
	if (/^(linear|radial)-gradient\(/.test(wallpaper)) {
		plan.background = { kind: "gradient", value: wallpaper, blur: editor.backgroundBlur };
	} else if (getLocalFilePath(wallpaper)) {
		const video = isVideoWallpaperSource(wallpaper);
		if (
			video &&
			(!Number.isFinite(input.backgroundDurationMs) || input.backgroundDurationMs! <= 0)
		)
			throw new Error("No se pudo leer la duración del fondo animado.");
		assets.push({
			id: "background",
			role: "background",
			sourcePath: getLocalFilePath(wallpaper)!,
		});
		plan.background = {
			kind: video ? "video" : "image",
			assetId: "background",
			durationMs: input.backgroundDurationMs,
			blur: editor.backgroundBlur,
		};
	} else if (/^#[\da-f]{3,8}$/i.test(wallpaper)) {
		plan.background = { kind: "color", value: wallpaper, blur: editor.backgroundBlur };
	} else {
		throw new Error(
			"Para transferir este fondo, guardalo como imagen o video local y seleccionalo en el editor.",
		);
	}
	if (plan.zooms.length)
		warnings.push(
			"Zooms con curvas editables aproximadas al resorte de Recorder; sin desenfoque de zoom. Los zooms conectados comparten sus valores en el borde.",
		);
	const policy = resolveSourceTrackRoutingPolicy(input.sourcePath, input.audioPaths);
	const addSourceAudio = (assetId: string, role: string, delayMs: number) => {
		const settingsId = role === "mic" || role === "system" ? role : "mixed";
		plan.audio.push({
			assetId,
			role,
			delayMs,
			gains: Object.fromEntries(
				clips.map((clip) => {
					const settings =
						editor.sourceAudioTrackSettingsByClip?.[clip.id] ??
						editor.defaultSourceAudioTrackSettings;
					// Recorder previews source tracks through HTMLAudioElement (maximum 1).
					// Preserve what was heard there instead of adding hidden normalization gain in Studio.
					return [clip.id, clip.muted ? 0 : Math.min(1, resolveSourceTrackGain(settings, settingsId))];
				}),
			),
		});
	};
	for (const [index, sourcePath] of policy.playbackPaths.entries()) {
		const id = `audio-${index + 1}`;
		const role = getSourceTrackIdFromPath(sourcePath);
		assets.push({ id, sourcePath, role });
		addSourceAudio(id, role, input.audioDelays[sourcePath] ?? 0);
	}
	if (policy.hasEmbeddedSourceAudio && policy.includeEmbeddedInExport)
		addSourceAudio("original-screen", "embedded", 0);
	for (const [index, audio] of editor.audioRegions.entries()) {
		const assetId = `extra-audio-${index + 1}`;
		assets.push({ id: assetId, role: "added-audio", sourcePath: audio.audioPath });
		plan.audio.push({
			assetId,
			role: "added-audio",
			delayMs: 0,
			gains: {},
			placement: {
				startMs: audio.startMs,
				endMs: audio.endMs,
				sourceStartMs: 0,
				gain: Math.max(0, Math.min(1, audio.volume * (audio.normalize ? 1.35 : 1))),
			},
		});
	}
	if (editor.webcam.enabled && editor.webcam.sourcePath) {
		const webcam = editor.webcam;
		const margin = scaleWebcamOverlayPixels(webcam.margin, width);
		const size = getWebcamOverlayDimensionsPx({
			containerWidth: width,
			containerHeight: height,
			widthPercent: webcam.width,
			heightPercent: getCropMatchedWebcamHeightPercent(
				webcam.width,
				webcam.height,
				input.webcamDimensions?.width,
				input.webcamDimensions?.height,
				webcam.cropRegion,
			),
			margin,
			zoomScale: 1,
			reactToZoom: false,
		});
		const position = getWebcamOverlayPosition({
			containerWidth: width,
			containerHeight: height,
			...size,
			margin,
			positionPreset: webcam.positionPreset,
			positionX: webcam.positionX,
			positionY: webcam.positionY,
			legacyCorner: webcam.corner,
		});
		assets.push({ id: "webcam", role: "webcam", sourcePath: webcam.sourcePath! });
		plan.webcam = {
			assetId: "webcam",
			delayMs: webcam.timeOffsetMs,
			mirror: webcam.mirror,
			...size,
			...position,
			cornerRadius: getWebcamCornerRadiusPx(webcam.roundness, size.width, size.height),
			crop: webcam.cropRegion,
			visibleRanges: webcam.visibleRanges,
			shadow: webcam.shadow,
		};
		if (input.webcamDimensions) {
			const source = input.webcamDimensions;
			const crop = webcam.cropRegion;
			const scale = Math.max(
				size.width / (source.width * crop.width),
				size.height / (source.height * crop.height),
			);
			plan.webcam.videoRect = {
				x:
					(size.width - source.width * crop.width * scale) / 2 -
					crop.x * source.width * scale,
				y:
					(size.height - source.height * crop.height * scale) / 2 -
					crop.y * source.height * scale,
				width: source.width * scale,
				height: source.height * scale,
			};
		}
		if (webcam.reactToZoom)
			warnings.push("La webcam queda en una capa fija; no reacciona al zoom de pantalla.");
	}
	if (editor.annotationRegions.length || editor.autoCaptions.length)
		warnings.push(
			"Anotaciones y subtítulos permanecen en el proyecto original; agregalos en Syka.",
		);
	return { plan, assets };
}
