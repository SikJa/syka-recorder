import type { ZoomRegion } from "@/components/video-editor/types";
import type { TransferZoom } from "./contract";
import { fitChannel } from "./keyframeFit";
import type { CameraSample } from "./zoomCamera";

/** Partition the sampled camera into non-overlapping native zoom clips.
 * Adjacent/connected zooms retain the camera value at their shared boundary.
 * Syka scales about the centre; Recordly's camera scales about the origin.
 */
export function buildZoomBlocks(
	samples: CameraSample[],
	regions: ZoomRegion[],
	width: number,
	height: number,
	fps: number,
	durationMs: number,
): TransferZoom[] {
	if (!regions.length || samples.length < 2) return [];
	const sorted = [...regions].sort((a, b) => a.startMs - b.startMs);
	const moving = samples.map(
		(s) =>
			Math.max(
				Math.abs(s.scale - 1) * Math.max(width, height),
				Math.abs(s.x),
				Math.abs(s.y),
			) > 0.05,
	);
	const blocks: TransferZoom[] = [];
	for (let i = 0; i < sorted.length; i++) {
		const region = sorted[i];
		const left =
			i === 0
				? 0
				: Math.max(
						0,
						Math.round((((sorted[i - 1].endMs + region.startMs) / 2) * fps) / 1000),
					);
		const right =
			i === sorted.length - 1
				? samples.length - 1
				: Math.min(
						samples.length - 1,
						Math.round((((region.endMs + sorted[i + 1].startMs) / 2) * fps) / 1000),
					);
		let first = left;
		let last = right;
		while (first < last && !moving[first]) first++;
		while (last > first && !moving[last]) last--;
		if (!moving[first] || last <= first) continue;
		first = Math.max(left, first - 1);
		last = Math.min(right, last + 1);
		const local = samples.slice(first, last + 1).map((sample, index) => ({
			frame: index,
			scale: sample.scale,
			x: sample.x + ((sample.scale - 1) * width) / 2,
			y: sample.y + ((sample.scale - 1) * height) / 2,
		}));
		const fit = (property: "scale" | "x" | "y", tolerance: number) =>
			fitChannel(
				local.map((point) => ({ frame: point.frame, value: point[property] })),
				tolerance,
			);
		blocks.push({
			id: `zoom-${i + 1}`,
			name: `Zoom ${i + 1}`,
			startMs: samples[first].timeMs,
			endMs: last === samples.length - 1 ? durationMs : samples[last].timeMs,
			channels: {
				scale: fit("scale", 0.5 / Math.max(width, height)),
				x: fit("x", 0.25),
				y: fit("y", 0.25),
			},
		});
	}
	return blocks;
}
