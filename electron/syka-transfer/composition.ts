/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */
import type {
	TransferClip as RecorderClip,
	TransferManifest as RecorderManifest,
} from "../../src/lib/sykaExport/contract";
import {
	getWebcamShadowStrength,
	WEBCAM_SHADOW_LAYER_PROFILES,
} from "../../src/lib/exporter/shadowProfile";
import { SQUIRCLE_EXPONENT } from "../../src/lib/geometry/squircle";
import { evaluateKeyframes, fitChannel } from "../../src/lib/sykaExport/keyframeFit";
import { backgroundComposition } from "./backgroundComposition";

const n = (v: number) => Number(v.toFixed(9));
const sec = (ms: number) => n(ms / 1000);
const quoted = (text: string) => `{${JSON.stringify(text)}}`;

/** Clip a source-clock track against cuts, speed, start delay and visibility ranges. */
export function sourceTrackSlices(
	clips: RecorderClip[],
	delayMs: number,
	ranges?: { startMs: number; endMs: number }[],
) {
	return clips.flatMap((clip) => {
		const sourceEnd = clip.sourceStartMs + (clip.endMs - clip.startMs) * clip.speed;
		const intervals = ranges ?? [{ startMs: 0, endMs: sourceEnd }];
		return intervals.flatMap((range) => {
			const first = Math.max(clip.sourceStartMs, delayMs, range.startMs),
				last = Math.min(sourceEnd, range.endMs);
			if (last <= first) return [];
			return [
				{
					id: clip.id,
					startMs: clip.startMs + (first - clip.sourceStartMs) / clip.speed,
					endMs: clip.startMs + (last - clip.sourceStartMs) / clip.speed,
					sourceStartMs: first - delayMs,
					speed: clip.speed,
				},
			];
		});
	});
}

type TransferWebcam = NonNullable<RecorderManifest["plan"]["webcam"]>;

/**
 * Studio rounds corners with circular arcs; Recorder draws a superellipse.
 * This arc radius cuts the corner at the same depth along the diagonal.
 */
const SQUIRCLE_TO_ARC_RADIUS =
	((1 - 2 ** (-1 / SQUIRCLE_EXPONENT)) * Math.SQRT2) / (Math.SQRT2 - 1);

/** Recorder's drop-shadow chain as native Studio shadows (canvas and CSS blur match). */
export function webcamShadows(w: TransferWebcam) {
	const strength = getWebcamShadowStrength(w.shadow ?? 0);
	const size = Math.min(w.width, w.height);
	if (strength <= 0) return [];
	return WEBCAM_SHADOW_LAYER_PROFILES.map((layer) => ({
		blur: size * layer.blurScale * strength,
		offsetY: size * layer.offsetScale * strength,
		opacity: Math.min(1, layer.alphaScale * strength),
	}));
}

/**
 * Shrink the camera with the screen zoom. Studio scales about the box centre and
 * Recorder keeps the camera at its anchor, so offsets move it back there.
 * Keyframe times are on the video's source clock.
 */
export function webcamZoomTracks(
	w: TransferWebcam,
	slice: { startMs: number; endMs: number; sourceStartMs: number; speed: number },
	frameRate: number,
): string {
	if (!w.zoomScale?.length) return "";
	const first = Math.ceil((slice.startMs * frameRate) / 1000 - 1e-6);
	const last = Math.floor((slice.endMs * frameRate) / 1000 + 1e-6);
	if (last <= first) return "";
	const points = [];
	for (let frame = first; frame <= last; frame++)
		points.push({ frame: frame - first, value: evaluateKeyframes(w.zoomScale, frame) });
	if (points.every((point) => Math.abs(point.value - 1) < 0.0001)) return "";
	const keyframes = fitChannel(points, 0.25 / Math.max(w.width, w.height));
	const time = (frame: number) =>
		n(
			(slice.sourceStartMs +
				(((frame + first) * 1000) / frameRate - slice.startMs) * slice.speed) /
				1000,
		);
	const anchor = w.anchor ?? { x: 1, y: 1 };
	const track = (property: string, value: (scale: number) => number) =>
		`          <keyframeTrack property="${property}">\n` +
		keyframes
			.map(
				(k) =>
					`            <keyframe time={${time(k.frame)}} value={${n(value(k.value))}}${k.easing ? ` easing=${quoted(k.easing)}` : ""} />`,
			)
			.join("\n") +
		"\n          </keyframeTrack>\n";
	return (
		track("scale", (scale) => scale) +
		(Math.abs(anchor.x - 0.5) > 1e-6
			? track("offsetX", (scale) => w.width * (1 - scale) * (anchor.x - 0.5))
			: "") +
		(Math.abs(anchor.y - 0.5) > 1e-6
			? track("offsetY", (scale) => w.height * (1 - scale) * (anchor.y - 0.5))
			: "")
	);
}

export function recorderComposition(data: RecorderManifest, prefix = ""): string {
	const p = data.plan,
		c = p.canvas;
	const source = (id: string) => quoted(`${prefix}${data.assets.find((a) => a.id === id)!.path}`);
	const timing = (clip: Omit<RecorderClip, "id">) =>
		`start={${sec(clip.startMs)}} end={${sec(clip.endMs)}} sourceIn={${sec(clip.sourceStartMs)}} playbackRate={${n(clip.speed)}}`;
	const frame = p.screen;
	const screen = p.clips
		.map((clip, i) => {
			if (!frame)
				return `        <video id="screen-${i + 1}" name=${quoted(`Pantalla ${i + 1}`)} src=${source("screen")} width={${c.width}} height={${c.height}} ${timing(clip)} muted />`;
			const pad = frame.shadowPadding ?? 0;
			const matte = frame.maskPadding ?? 0;
			return (
				`        <rect id="screen-${i + 1}" name=${quoted(`Pantalla ${i + 1}`)} width={${c.width}} height={${c.height}} start={${sec(clip.startMs)}} end={${sec(clip.endMs)}}>\n` +
				(frame.shadowAssetId
					? `          <image name="Sombra de pantalla" src=${source(frame.shadowAssetId)} x={${n(frame.x - pad)}} y={${n(frame.y - pad)}} width={${n(frame.width + pad * 2)}} height={${n(frame.height + pad * 2)}} />\n`
					: "") +
				`          <rect name="Marco de pantalla" x={${n(frame.x - matte)}} y={${n(frame.y - matte)}} width={${n(frame.width + matte * 2)}} height={${n(frame.height + matte * 2)}}>\n` +
				`            <video src=${source("screen")} x={${matte}} y={${matte}} width={${n(frame.width)}} height={${n(frame.height)}} start={0} end={${sec(clip.endMs - clip.startMs)}} sourceIn={${sec(clip.sourceStartMs)}} playbackRate={${n(clip.speed)}} muted />\n` +
				(frame.maskAssetId
					? `            <effect type="opacity" value={1}><mask src=${source(frame.maskAssetId)} smoothing={0} /></effect>\n`
					: `            <rect clipPath width={${n(frame.width)}} height={${n(frame.height)}} cornerRadius={${n(frame.cornerRadius)}} />\n`) +
				"          </rect>\n        </rect>"
			);
		})
		.join("\n");
	const zooms = p.zooms
		.map((z) => {
			const channels = (["scale", "x", "y"] as const)
				.map(
					(property) =>
						`          <keyframeTrack property="${property}">\n` +
						z.channels[property]
							.map(
								(k, i) =>
									`            <keyframe id="${z.id}-${property}-${i}" time={${n(k.frame / c.frameRate)}} value={${n(k.value)}}${k.easing ? ` easing=${quoted(k.easing)}` : ""} />`,
							)
							.join("\n") +
						"\n          </keyframeTrack>",
				)
				.join("\n");
			return `        <adjustmentLayer id=${quoted(z.id)} name=${quoted(z.name)} width={${c.width}} height={${c.height}} start={${sec(z.startMs)}} end={${sec(z.endMs)}}>\n${channels}\n        </adjustmentLayer>`;
		})
		.join("\n");
	const audio = p.audio
		.map((a, index) => {
			const slices = a.placement
				? [{ ...a.placement, id: "extra", speed: 1 }]
				: sourceTrackSlices(p.clips, a.delayMs);
			return (
				`      <sequence name=${quoted(a.role === "mic" ? "Micrófono" : a.role === "system" ? "Sistema" : "Audio")} id="audio-track-${index}">\n` +
				slices
					.map((s, i) => {
						const gain = a.placement?.gain ?? a.gains[s.id] ?? 1;
						return `        <audio id="audio-${index}-${i}" src=${source(a.assetId)} ${timing(s)} ${gain === 0 ? "muted" : `volume={${n(20 * Math.log10(gain))}}`} />`;
					})
					.join("\n") +
				"\n      </sequence>"
			);
		})
		.join("\n");
	let webcam = "";
	if (p.webcam) {
		const w = p.webcam;
		const shadows = webcamShadows(w)
			.map(
				(layer) =>
					`          <shadow color="#000000" blur={${n(layer.blur)}} offsetY={${n(layer.offsetY)}} opacity={${n(layer.opacity)}} />\n`,
			)
			.join("");
		// One plain video per slice: Studio moves, resizes and restyles it directly.
		// The footage already carries Recorder's crop and mirror.
		webcam =
			'      <sequence id="webcam-track" name="Webcam">\n' +
			sourceTrackSlices(p.clips, w.delayMs, w.visibleRanges)
				.map(
					(s, i) =>
						`        <video id="webcam-${i}" name="Webcam ${i + 1}" src=${source(w.assetId)} x={${n(w.x)}} y={${n(w.y)}} width={${n(w.width)}} height={${n(w.height)}} objectFit="cover" cornerRadius={${n(w.cornerRadius * SQUIRCLE_TO_ARC_RADIUS)}} start={${sec(s.startMs)}} end={${sec(s.endMs)}} sourceIn={${sec(s.sourceStartMs)}} playbackRate={${n(s.speed)}} muted>\n` +
						shadows +
						webcamZoomTracks(w, s, c.frameRate) +
						"        </video>",
				)
				.join("\n") +
			"\n      </sequence>";
	}
	// All zoom blocks share a sequence targeting the preceding screen sequence.
	return (
		`// Imported data from Syka Recorder. Native clips and editable adjustment layers.\nexport default function Project() {\n  return (\n    <stage background="#111111">\n    <scene id="main" name=${quoted(p.name)} width={${c.width}} height={${c.height}} active workarea={[0, ${sec(c.durationMs)}]}>\n` +
		backgroundComposition(p, source) +
		`      <sequence id="screen-track" name="Pantalla">\n${screen}\n      </sequence>\n` +
		`      <sequence id="zoom-track" name="Zooms">\n${zooms}\n      </sequence>\n${webcam}\n${audio}\n` +
		`    </scene>\n    </stage>\n  );\n}\n`
	);
}
