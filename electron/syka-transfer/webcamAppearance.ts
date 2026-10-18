import {
	getWebcamShadowStrength,
	WEBCAM_SHADOW_LAYER_PROFILES,
	VIDEO_SHADOW_LAYER_PROFILES,
} from "../../src/lib/exporter/shadowProfile";
import { getSquirclePathPoints, getSquircleSvgPath } from "../../src/lib/geometry/squircle";
import type { TransferPlan } from "../../src/lib/sykaExport/contract";
import { encodeMaskFile, quantizeLogit } from "./studioMask";

/** Avoid translucent rectangular seams from subpixel mask-layer boundaries. */
export function alignWebcamToPixels(webcam: NonNullable<TransferPlan["webcam"]>) {
	const width = Math.max(1, Math.round(webcam.width));
	const height = Math.max(1, Math.round(webcam.height));
	const scale = Math.max(width / webcam.width, height / webcam.height);
	const video = webcam.videoRect;
	return {
		...webcam,
		x: Math.round(webcam.x),
		y: Math.round(webcam.y),
		width,
		height,
		cornerRadius: Math.min(Math.min(width, height) / 2, webcam.cornerRadius * scale),
		...(video
			? {
					videoRect: {
						x: (width - webcam.width * scale) / 2 + video.x * scale,
						y: (height - webcam.height * scale) / 2 + video.y * scale,
						width: video.width * scale,
						height: video.height * scale,
					},
				}
			: {}),
	};
}

/** One static native matte, held for the whole take by Studio's own mask decoder. */
export async function webcamAppearance(webcam: NonNullable<TransferPlan["webcam"]>) {
	const strength = getWebcamShadowStrength(webcam.shadow ?? 0);
	const size = Math.min(webcam.width, webcam.height);
	return shapeAppearance(
		webcam.width,
		webcam.height,
		webcam.cornerRadius,
		WEBCAM_SHADOW_LAYER_PROFILES.map((layer) => ({
			dy: size * layer.offsetScale * strength,
			blur: size * layer.blurScale * strength,
			alpha: layer.alphaScale * strength,
		})),
	);
}

export async function screenAppearance(
	screen: NonNullable<TransferPlan["screen"]>,
	canvasWidth: number,
) {
	const strength = Math.max(0, screen.shadow),
		scale = canvasWidth / 640;
	return shapeAppearance(
		screen.width,
		screen.height,
		screen.cornerRadius,
		VIDEO_SHADOW_LAYER_PROFILES.map((layer) => ({
			dy: layer.offsetScale * strength * scale,
			blur: layer.blurScale * strength * scale,
			alpha: layer.alphaScale * strength,
		})),
	);
}

async function shapeAppearance(
	widthPx: number,
	heightPx: number,
	cornerRadius: number,
	layers: { dy: number; blur: number; alpha: number }[],
) {
	const rect = {
		x: 0,
		y: 0,
		width: widthPx,
		height: heightPx,
		radius: cornerRadius,
	};
	// The matte's rectangular coverage must end in transparent pixels. Otherwise
	// coverage minus its antialiased removal leaves a faint rectangular seam when
	// Studio renders the node at fractional preview scales.
	const maskPadding = Math.max(4, Math.ceil(Math.max(widthPx, heightPx) / 128));
	const maskWidth = Math.round(widthPx) + maskPadding * 2;
	const maskHeight = Math.round(heightPx) + maskPadding * 2;
	const points = getSquirclePathPoints({ ...rect, x: maskPadding, y: maskPadding });
	const ratio = Math.min(1, 512 / Math.max(maskWidth, maskHeight));
	const gridWidth = Math.max(2, Math.ceil(maskWidth * ratio));
	const gridHeight = Math.max(2, Math.ceil(maskHeight * ratio));
	const field = new Int8Array(gridWidth * gridHeight);
	for (let y = 0; y < gridHeight; y++)
		for (let x = 0; x < gridWidth; x++) {
			const px = ((x + 0.5) * maskWidth) / gridWidth;
			const py = ((y + 0.5) * maskHeight) / gridHeight;
			let distance = Infinity;
			// The preview silhouette is convex. Signed distance to its supporting edges
			// preserves subpixel corners when Studio traces the matte at export resolution.
			for (let i = 0; i < points.length; i++) {
				const a = points[i],
					b = points[(i + 1) % points.length];
				const dx = b.x - a.x,
					dy = b.y - a.y;
				const length = Math.hypot(dx, dy);
				if (length > 0.00001)
					distance = Math.min(distance, (dx * (py - a.y) - dy * (px - a.x)) / length);
			}
			field[y * gridWidth + x] = quantizeLogit(distance * ratio * 4);
		}
	const mask = encodeMaskFile(
		{
			gridWidth,
			gridHeight,
			width: maskWidth,
			height: maskHeight,
			frameRate: 1,
		},
		[{ field, score: 1, iou: 1 }],
	);
	const padding = Math.ceil(layers.reduce((sum, layer) => sum + layer.blur * 3 + layer.dy, 2));
	const width = rect.width + padding * 2,
		height = rect.height + padding * 2;
	// Keep the exact CSS drop-shadow chain from Recorder. The opaque middle is
	// covered by the camera; the silhouette and its outside shadows stay portable.
	const shadow = layers.some((layer) => layer.alpha > 0)
		? `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-padding} ${-padding} ${width} ${height}"><defs><filter id="shadow" filterUnits="userSpaceOnUse" x="${-padding}" y="${-padding}" width="${width}" height="${height}">${layers.map((layer) => `<feDropShadow dx="0" dy="${layer.dy}" stdDeviation="${layer.blur}" flood-color="#000" flood-opacity="${layer.alpha}"/>`).join("")}</filter></defs><path d="${getSquircleSvgPath(rect)}" fill="#000" filter="url(#shadow)"/></svg>`
		: undefined;
	return { mask: Buffer.from(await mask.arrayBuffer()), shadow, padding, maskPadding };
}
