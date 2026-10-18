/** Syka Recorder transfer v1: JSON data only; no executable project source. */
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
		assetId: string;
		delayMs: number;
		mirror: boolean;
		x: number;
		y: number;
		width: number;
		height: number;
		cornerRadius: number;
		/** Same cover layout, silhouette and shadow used by Recorder's preview. */
		videoRect?: { x: number; y: number; width: number; height: number };
		shadow?: number;
		maskAssetId?: string;
		maskPadding?: number;
		shadowAssetId?: string;
		shadowPadding?: number;
		crop: { x: number; y: number; width: number; height: number };
		visibleRanges?: { startMs: number; endMs: number }[];
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
