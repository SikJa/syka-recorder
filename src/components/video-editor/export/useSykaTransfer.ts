import { useEffect, useRef, useState } from "react";
import type { ExportProgress, ExportQuality } from "@/lib/exporter";
import { getMp4ExportBitrate } from "@/lib/exporter/exportBitrate";
import { DEFAULT_MP4_CODEC, probeSupportedMp4Dimensions } from "@/lib/exporter/mp4Support";
import { SYKA_PACKAGE_FOLDERS } from "@/lib/sykaExport/contract";
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
import type { ExportOutcome } from "./useExportRunner";

type TransferJob = { canceled: boolean; operationId?: string; cancelRenderer?: () => void };

/** The editor's own MP4 export, written to a given path (same output as Exportar). */
export type FinalVideoExport = {
	run: (
		outputPath: string,
		onProgress: (progress: ExportProgress) => void,
	) => Promise<ExportOutcome>;
	cancel: () => void;
};

const INCLUDE_FINAL_KEY = "syka.transfer.includeFinalVideo";

function readIncludeFinal() {
	try {
		return localStorage.getItem(INCLUDE_FINAL_KEY) !== "false";
	} catch {
		return true;
	}
}

/** "Mi grabación.mp4", safe on Windows. */
export function finalVideoFileName(name: string) {
	const safe = name
		// biome-ignore lint/suspicious/noControlCharactersInRegex: Strip control characters forbidden in filenames.
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
		.replace(/[. ]+$/g, "")
		.slice(0, 80);
	return `${safe || "Video final"}.mp4`;
}

export function useSykaTransfer(
	input: ExportRunnerInput,
	projectData: EditorProjectData,
	name: string,
	finalVideo?: FinalVideoExport,
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
	const [includeFinal, setIncludeFinalState] = useState(readIncludeFinal);
	const [finalVideoPath, setFinalVideoPath] = useState<string | null>(null);
	const finalRunning = useRef(false);
	const setIncludeFinal = (value: boolean) => {
		setIncludeFinalState(value);
		try {
			localStorage.setItem(INCLUDE_FINAL_KEY, String(value));
		} catch {
			/* The choice still applies to this session. */
		}
	};
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
		if (finalRunning.current) {
			finalVideo?.cancel();
			return;
		}
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
		setFinalVideoPath(null);
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
				// The clean screen keeps its own framing; Studio applies the camera.
				verticalFraming: "fit",
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
		if (completedPath && includeFinal && finalVideo) {
			// The full export (background, camera, zooms) next to the editable
			// project, so the package has a video to play right away.
			const folder = completedPath.replace(/[\\/]manifest\.json$/i, "");
			const outputPath = `${folder}\\${SYKA_PACKAGE_FOLDERS.finals}\\${finalVideoFileName(name)}`;
			finalRunning.current = true;
			setBusy(true);
			setPhase("Exportando el video final…");
			setProgress(0);
			try {
				const outcome = await finalVideo.run(outputPath, (progress) =>
					setProgress(Math.round(progress.percentage)),
				);
				if (outcome.success) setFinalVideoPath(outcome.path);
				else
					setError(
						`El proyecto quedó guardado, pero el video final no se exportó: ${outcome.error}`,
					);
			} catch (err) {
				setError(
					`El proyecto quedó guardado, pero el video final no se exportó: ${String(err)}`,
				);
			} finally {
				finalRunning.current = false;
				setBusy(false);
				setPhase("Listo para abrir en Syka Studio");
				setProgress(100);
			}
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
		includeFinal: Boolean(finalVideo) && includeFinal,
		canIncludeFinal: Boolean(finalVideo),
		setIncludeFinal,
		finalVideoPath,
		warnings,
		start,
		cancel,
		openingStudio,
		openInStudio,
	};
}
