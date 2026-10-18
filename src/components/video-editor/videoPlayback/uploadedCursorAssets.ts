import minimalCursorUrl from "../../../assets/cursors/custom/minimal-cursor.svg";
import type { CursorStyle, CursorTelemetryPoint } from "../types";

type CursorAssetKey = NonNullable<CursorTelemetryPoint["cursorType"]>;
type CursorSetStyle = Extract<CursorStyle, "macos" | "tahoe" | "tahoe-inverted" | "windows11">;

// Hotspot of the arrow tip inside minimal-cursor.svg (396 x 433 canvas).
const MINIMAL_CURSOR_HOTSPOT_X = (40 / 396) * 100;
const MINIMAL_CURSOR_HOTSPOT_Y = (22 / 433) * 100;

export type UploadedCursorAsset = {
	url: string;
	fallbackAnchor: {
		x: number;
		y: number;
	};
	preserveCanvas?: boolean;
};

function asset(
	url: string,
	hotspotX: number,
	hotspotY: number,
	options: Pick<UploadedCursorAsset, "preserveCanvas"> = {},
): UploadedCursorAsset {
	return {
		url,
		fallbackAnchor: {
			x: hotspotX / 100,
			y: hotspotY / 100,
		},
		...options,
	};
}

const minimalArrow = asset(minimalCursorUrl, MINIMAL_CURSOR_HOTSPOT_X, MINIMAL_CURSOR_HOTSPOT_Y);

/**
 * Syka Recorder bundles no operating-system cursor artwork: the macOS, Tahoe and
 * Windows 11 sets inherited from Recordly were copies of Apple and Microsoft
 * system cursors. The style IDs stay valid for older projects and render
 * Recordly's own minimal arrow for every cursor state.
 */
const minimalCursorSet: Record<CursorAssetKey, UploadedCursorAsset> = {
	arrow: minimalArrow,
	text: minimalArrow,
	pointer: minimalArrow,
	crosshair: minimalArrow,
	"open-hand": minimalArrow,
	"closed-hand": minimalArrow,
	"resize-ew": minimalArrow,
	"resize-ns": minimalArrow,
	"not-allowed": minimalArrow,
};

export const cursorSetAssets: Record<
	Exclude<CursorSetStyle, "tahoe-inverted">,
	Record<CursorAssetKey, UploadedCursorAsset>
> = {
	macos: minimalCursorSet,
	tahoe: minimalCursorSet,
	windows11: minimalCursorSet,
};

export function getCursorStyleSizeMultiplier(_style: CursorStyle) {
	return 1;
}

export const uploadedCursorAssets = cursorSetAssets.tahoe;
