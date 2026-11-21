/** Syka Recorder transfer v1: JSON data only; no executable project source. */

/** Folders a person browses in a Studio package. Studio itself only needs
 * index.tsx, package.json and assets.yml at the root; the rest is ours. */
export const SYKA_PACKAGE_FOLDERS = {
	recording: "01 Grabación",
	finals: "02 Finales",
	originals: "03 Originales sin editar",
	technical: "99 Archivos técnicos (no tocar)",
} as const;
export interface TransferKeyframe {
	frame: number;
	value: number;
	easing: string | null;
}
export interface TransferZoom {
	id: string;
	name: string;
	startMs: number;
	endMs: number;
	channels: Record<"scale" | "x" | "y", TransferKeyframe[]>;
}
export interface TransferClip {
	id: string;
	startMs: number;
	endMs: number;
	sourceStartMs: number;
	speed: number;
	muted?: boolean;
}
export interface TransferAudio {
	assetId: string;
	role: string;
	/** Positive delay: asset time 0 occurs this many ms after screen source time 0. */
	delayMs: number;
	gains: Record<string, number>;
	/** Added audio has its own timeline; source stems follow the screen clips. */
	placement?: { startMs: number; endMs: number; sourceStartMs: number; gain: number };
}
export interface TransferPlan {
	name: string;
	canvas: { width: number; height: number; frameRate: number; durationMs: number };
	/** Optional for backwards compatibility with the first portable packages. */
	screen?: {
		x: number;
		y: number;
		width: number;
		height: number;
		cornerRadius: number;
		sourceWidth: number;
		sourceHeight: number;
		shadow: number;
		maskAssetId?: string;
		maskPadding?: number;
		shadowAssetId?: string;
		shadowPadding?: number;
	};
	background?: {
		kind: "color" | "gradient" | "image" | "video";
		value?: string;
		assetId?: string;
		durationMs?: number;
		blur: number;
	};
	clips: TransferClip[];
	zooms: TransferZoom[];
	audio: TransferAudio[];
	webcam?: {
		/**
		 * Footage placed in Studio. The package writer replaces it with a copy that
		 * already has `crop` and `mirror` applied, so the camera can be one plain,
		 * resizable video there; the recording stays as `sourceAssetId`.
		 */
		assetId: string;
		sourceAssetId?: string;
		delayMs: number;
		mirror: boolean;
		x: number;
		y: number;
		width: number;
		height: number;
		/** Recorder's squircle radius; Studio draws circular corners. */
		cornerRadius: number;
		shadow?: number;
		crop: { x: number; y: number; width: number; height: number };
		visibleRanges?: { startMs: number; endMs: number }[];
		/** Where the camera sits in its free area (0-1), the point it shrinks toward. */
		anchor?: { x: number; y: number };
		/**
		 * Size factor while the screen zooms (1 = unzoomed), at timeline frames of
		 * `canvas.frameRate`. Absent when the camera keeps its size.
		 */
		zoomScale?: TransferKeyframe[];
	};
	warnings: string[];
}
export interface TransferAssetInput {
	id: string;
	sourcePath: string;
	role: string;
}
export interface TransferAsset {
	id: string;
	path: string;
	role: string;
	size: number;
	sha256: string;
}
export interface TransferManifest {
	format: "syka-recorder-transfer";
	version: 1;
	createdAt: string;
	plan: TransferPlan;
	assets: TransferAsset[];
}
export interface SaveTransferRequest {
	operationId: string;
	plan: TransferPlan;
	assets: TransferAssetInput[];
	project: unknown;
	cursorTelemetry: unknown;
}
export type TransferResult = {
	success: boolean;
	canceled?: boolean;
	path?: string;
	error?: string;
};
