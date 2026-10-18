import { useEffect, useRef, useState } from "react";
import type { ExportQuality } from "@/lib/exporter";
import { getMp4ExportBitrate } from "@/lib/exporter/exportBitrate";
import { DEFAULT_MP4_CODEC, probeSupportedMp4Dimensions } from "@/lib/exporter/mp4Support";
import { renderTransfer } from "@/lib/sykaExport/renderTransfer";
import { calculateMp4ExportDimensions, calculateMp4SourceDimensions } from "../exportDimensions";
import { isVideoWallpaperSource } from "@/lib/wallpapers";
import {
	createProjectData,
	type EditorProjectData,
	normalizeProjectEditor,
} from "../projectPersistence";
import { buildExportRenderOptions } from "./buildExportRenderOptions";
import { streamExportBlobToTempFile } from "./exportPersistence";
import type { ExportRunnerInput } from "./exportRunnerSupport";

type TransferJob = { canceled: boolean; operationId?: string; cancelRenderer?: () => void };

export function useSykaTransfer(
	input: ExportRunnerInput,
	projectData: EditorProjectData,
	name: string,
) {
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState(0);
	const [phase, setPhase] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [path, setPath] = useState<string | null>(null);
	const [warnings, setWarnings] = useState<string[]>([]);
	const [openingStudio, setOpeningStudio] = useState(false);
	const [folderCopied, setFolderCopied] = useState(false);
	const projectFolder = path?.replace(/[\\/]manifest\.json$/i, "") ?? "";
	const copyProjectFolder = async () => {
		try {
			await navigator.clipboard.writeText(projectFolder);
			setFolderCopied(true);
		} catch {
			setError("No se pudo copiar la ruta. Podés seleccionarla en el campo de carpeta.");
		}
	};
	const active = useRef<TransferJob | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: A new project invalidates the previous export shortcut.
	useEffect(() => {
		setPath(null);
		setFolderCopied(false);
		setError(null);
	}, [projectData.projectId, projectData.videoPath]);
	const openInStudio = async (savedPath = path) => {
		if (!savedPath || openingStudio) return;
		setOpeningStudio(true);
		setError(null);
		try {
			if (!window.electronAPI.openSykaTransferInStudio)
				throw new Error(
					"Guardá tu proyecto y reiniciá Recorder para activar la apertura directa en Studio.",
				);
			const result = await window.electronAPI.openSykaTransferInStudio(savedPath);
			if (!result.success && !result.canceled)
				throw new Error(
					result.error || "No se pudo abrir Syka Studio. El proyecto quedó guardado.",
				);
		} catch (error) {
			setError(error instanceof Error ? error.message : String(error));
		} finally {
			setOpeningStudio(false);
		}
	};
	const cancel = () => {
		const job = active.current;
		if (!job) return;
		job.canceled = true;
		job.cancelRenderer?.();
		if (job.operationId) void window.electronAPI.cancelSykaTransfer(job.operationId);
	};
	const start = async (andOpen = false) => {
		const video = input.videoPlaybackRef.current?.video;
		if (active.current || input.exportSession.isExporting || !video || !input.videoPath) return;
		const job: TransferJob = { canceled: false };
		active.current = job;
		setBusy(true);
		setError(null);
		setPath(null);
		setFolderCopied(false);
		setProgress(0);
		let tempPath: string | undefined;
		let completedPath: string | undefined;
		let previewPaused = false;
		const checkCanceled = () => {
			if (job.canceled) throw new Error("Transferencia cancelada");
		};
		const sourceDurationMs = video.duration * 1000;
		const sourceWidth = video.videoWidth,
			sourceHeight = video.videoHeight;
		try {
			const snapshot = structuredClone(projectData);
			const editor = normalizeProjectEditor(snapshot.editor);
			if (!editor.clipRegions.length)
				throw new Error("La línea de tiempo no tiene clips de pantalla para transferir.");
			if (!window.electronAPI.beginSykaTransfer)
				throw new Error(
					"Esta versión necesita abrirse en Syka Recorder para guardar el paquete.",
				);
			const selected = await window.electronAPI.beginSykaTransfer();
			if (!selected.operationId) return;
			job.operationId = selected.operationId;
			checkCanceled();
			input.exportSession.setIsExporting(true);
			previewPaused = true;
			input.videoPlaybackRef.current?.pause();
			setPhase("Preparando cortes y zooms…");
			await new Promise((resolve) => setTimeout(resolve, 0));
			// The prepared screen video follows the same Quality / Encoding / FPS
			// choices as a normal MP4 export.
			const { exportQuality: quality, exportEncodingMode: encodingMode } =
				input.exportSettings;
			const frameRate = input.exportSettings.mp4FrameRate;
			const getBitrate = (width: number, height: number) =>
				getMp4ExportBitrate({ width, height, frameRate, quality, encodingMode });
			const requested = calculateMp4ExportDimensions(
				sourceWidth * editor.cropRegion.width,
				sourceHeight * editor.cropRegion.height,
				quality,
			);
			const dimensions = await probeSupportedMp4Dimensions({
				width: requested.width,
				height: requested.height,
				frameRate,
				getBitrate,
			});
			checkCanceled();
			const { planTransfer } = await import("@/lib/sykaExport/client");
			const canvasBase = calculateMp4SourceDimensions(
				sourceWidth,
				sourceHeight,
				editor.aspectRatio,
				editor.cropRegion,
			);
			const requestedCanvas = calculateMp4ExportDimensions(
				canvasBase.width,
				canvasBase.height,
				quality,
			);
			const encoderScale = Math.min(
				dimensions.width / requested.width,
				dimensions.height / requested.height,
			);
			const canvasSize = {
				width: Math.max(2, Math.floor((requestedCanvas.width * encoderScale) / 2) * 2),
				height: Math.max(2, Math.floor((requestedCanvas.height * encoderScale) / 2) * 2),
			};
			const backgroundMetadata = isVideoWallpaperSource(editor.wallpaper)
				? await window.electronAPI.probeNativeVideoMetadata(editor.wallpaper)
				: undefined;
			const webcamMetadata =
				editor.webcam.enabled && editor.webcam.sourcePath
					? await window.electronAPI.probeNativeVideoMetadata(editor.webcam.sourcePath)
					: undefined;
			if (editor.webcam.enabled && editor.webcam.sourcePath && !webcamMetadata?.metadata)
				throw new Error(
					"No se pudo leer el tamaño de la cámara. Volvé a cargar su video antes de transferirlo.",
				);
			const planner = planTransfer({
				name,
				sourcePath: snapshot.videoPath,
				sourceDurationMs,
				width: dimensions.width,
				height: dimensions.height,
				frameRate,
				editor,
				zoomRegions: structuredClone(input.effectiveZoomRegions),
				cursorTelemetry: structuredClone(input.effectiveCursorTelemetry),
				audioPaths: [...input.audio.sourceAudioFallbackPaths],
				audioDelays: { ...input.audio.sourceAudioFallbackStartDelayMsByPath },
				webcamDimensions: webcamMetadata?.metadata,
				canvasSize,
				backgroundDurationMs: backgroundMetadata?.metadata?.duration
					? backgroundMetadata.metadata.duration * 1000
					: undefined,
			});
			job.cancelRenderer = planner.cancel;
			const transfer = await planner.result;
			checkCanceled();
			setWarnings(transfer.plan.warnings);
			setPhase("Preparando el video con el cursor…");
			const { VideoExporter } = await import("@/lib/exporter/videoExporter");
			checkCanceled();
			const exporter = new VideoExporter({
				...buildExportRenderOptions({
					appearance: input.appearance,
					timeline: input.timeline,
					effectiveSpeedRegions: [],
					effectiveZoomRegions: [],
					effectiveCursorTelemetry: input.effectiveCursorTelemetry,
					effectiveShowCursor: input.effectiveShowCursor,
					previewWidth: dimensions.width,
					previewHeight: dimensions.height,
					shadowIntensity: 0,
					onProgress: (p) => {
						if (!job.canceled) setProgress(Math.round(p.percentage * 0.9));
					},
				}),
				videoUrl: input.videoPath,
				width: dimensions.width,
				height: dimensions.height,
				frameRate,
				bitrate: getBitrate(dimensions.width, dimensions.height),
				codec: DEFAULT_MP4_CODEC,
				preferredEncoderPath: dimensions.encoderPath,
				encodingMode,
				wallpaper: "#000000",
				padding: 0,
				borderRadius: 0,
				backgroundBlur: 0,
				zoomMotionBlur: 0,
				// Undefined selects the whole source. An empty clip list renders gaps only.
				zoomRegions: [],
				trimRegions: [],
				clipRegions: undefined,
				speedRegions: [],
				annotationRegions: [],
				autoCaptions: [],
				webcam: { ...editor.webcam, enabled: false },
				webcamUrl: null,
				audioRegions: [],
				sourceAudioFallbackPaths: [],
				maxEncodeQueue: 16,
				maxDecodeQueue: 4,
				maxPendingFrames: 4,
			});
			const render = renderTransfer(exporter, (path) =>
				window.electronAPI.discardExportedTemp(path),
			);
			job.cancelRenderer = render.cancel;
			const result = await render.result;
			tempPath = result.tempFilePath;
			checkCanceled();
			if (!result.success) throw new Error(result.error || "No se pudo preparar el video");
			if (!tempPath && result.blob)
				tempPath = (await streamExportBlobToTempFile(result.blob, "mp4")) ?? undefined;
			if (!tempPath) throw new Error("El exportador no devolvió un video");
			checkCanceled();
			setPhase("Copiando y verificando los medios…");
			setProgress(92);
			const saved = await window.electronAPI.saveSykaTransfer({
				operationId: job.operationId,
				plan: transfer.plan,
				assets: [
					{ id: "screen", role: "screen-with-cursor", sourcePath: tempPath },
					...transfer.assets,
				],
				project: createProjectData(snapshot.videoPath, snapshot.editor, snapshot.projectId),
				cursorTelemetry: input.effectiveCursorTelemetry,
			});
			if (!saved.success)
				throw new Error(
					saved.canceled
						? "Transferencia cancelada"
						: saved.error || "No se pudo guardar el paquete",
				);
			setPath(saved.path!);
			completedPath = saved.path;
			setPhase("Listo para abrir en Syka Studio");
			setProgress(100);
		} catch (err) {
			setError(
				job.canceled
					? "Transferencia cancelada. Tus archivos originales siguen intactos."
					: String(err),
			);
		} finally {
			if (job.operationId)
				await window.electronAPI.cancelSykaTransfer(job.operationId).catch(() => undefined);
			if (tempPath)
				await window.electronAPI.discardExportedTemp?.(tempPath).catch(() => undefined);
			active.current = null;
			setBusy(false);
			input.exportSession.setIsExporting(false);
			if (previewPaused) input.remountPreview();
		}
		if (andOpen && completedPath) await openInStudio(completedPath);
	};
	/** Final Studio canvas size, including the selected aspect ratio. */
	const getOutputDimensions = () => {
		const video = input.videoPlaybackRef.current?.video;
		if (!video?.videoWidth || !video.videoHeight) return undefined;
		const editor = normalizeProjectEditor(projectData.editor);
		const { width, height } = calculateMp4SourceDimensions(
			video.videoWidth,
			video.videoHeight,
			editor.aspectRatio,
			editor.cropRegion,
		);
		return Object.fromEntries(
			(["medium", "good", "high", "source"] as const).map((quality) => [
				quality,
				calculateMp4ExportDimensions(width, height, quality),
			]),
		) as Record<ExportQuality, { width: number; height: number }>;
	};
	return {
		open,
		setOpen,
		exportSettings: input.exportSettings,
		getOutputDimensions,
		busy,
		progress,
		phase,
		error,
		path,
		projectFolder,
		folderCopied,
		copyProjectFolder,
		warnings,
		start,
		cancel,
		openingStudio,
		openInStudio,
	};
}
