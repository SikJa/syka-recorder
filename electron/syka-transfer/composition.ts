/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */
import type {
	TransferClip as RecorderClip,
	TransferManifest as RecorderManifest,
} from "../../src/lib/sykaExport/contract";
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
		const videoWidth = w.videoRect?.width ?? w.width / w.crop.width,
			videoHeight = w.videoRect?.height ?? w.height / w.crop.height;
		const videoX = w.videoRect?.x ?? -w.crop.x * videoWidth,
			videoY = w.videoRect?.y ?? -w.crop.y * videoHeight;
		const padding = w.shadowPadding ?? 0;
		const matte = w.maskPadding ?? 0;
		const shadow = w.shadowAssetId
			? `          <image name="Sombra de webcam" src=${source(w.shadowAssetId)} x={${n(-padding)}} y={${n(-padding)}} width={${n(w.width + padding * 2)}} height={${n(w.height + padding * 2)}} />\n`
			: "";
		const mask = w.maskAssetId
			? `            <effect type="opacity" value={1}><mask src=${source(w.maskAssetId)} smoothing={0} /></effect>`
			: `            <rect clipPath width={${n(w.width)}} height={${n(w.height)}} cornerRadius={${n(w.cornerRadius)}} />`;
		webcam =
			'      <sequence id="webcam-track" name="Webcam">\n' +
			sourceTrackSlices(p.clips, w.delayMs, w.visibleRanges)
				.map(
					(s, i) =>
						`        <rect id="webcam-${i}" name="Webcam ${i + 1}" x={${n(w.x)}} y={${n(w.y)}} width={${n(w.width)}} height={${n(w.height)}} start={${sec(s.startMs)}} end={${sec(s.endMs)}}${w.mirror ? " scaleX={-1}" : ""}>\n` +
						shadow +
						`          <rect name="Cámara" x={${-matte}} y={${-matte}} width={${n(w.width + matte * 2)}} height={${n(w.height + matte * 2)}}>\n` +
						`            <rect x={${matte}} y={${matte}} width={${n(w.width)}} height={${n(w.height)}}>\n` +
						`              <rect clipPath width={${n(w.width)}} height={${n(w.height)}} />\n` +
						`            <video src=${source(w.assetId)} x={${n(videoX)}} y={${n(videoY)}} width={${n(videoWidth)}} height={${n(videoHeight)}} start={0} end={${sec(s.endMs - s.startMs)}} sourceIn={${sec(s.sourceStartMs)}} playbackRate={${n(s.speed)}} muted />\n` +
						`            </rect>\n${mask}\n          </rect>\n        </rect>`,
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
