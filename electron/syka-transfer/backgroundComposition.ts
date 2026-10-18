import type { TransferPlan } from "../../src/lib/sykaExport/contract";
const n = (v: number) => Number(v.toFixed(9));
const q = (v: string) => `{${JSON.stringify(v)}}`;

/** Parse the CSS gradients offered by Recorder, preserving direction and stops. */
export function gradientPaint(value: string): string {
	const match = value.match(/^(linear|radial)-gradient\((.*)\)$/);
	if (!match) throw new Error("Fondo degradado no válido");
	const parts = match[2].split(/,(?![^()]*\))/).map((s) => s.trim());
	let rotation = 90;
	if (/deg$|^to /i.test(parts[0])) {
		const direction = parts.shift()!;
		const angles: Record<string, number> = {
			"to top": -90,
			"to bottom": 90,
			"to left": 180,
			"to right": 0,
			"to top right": -45,
			"to bottom right": 45,
			"to bottom left": 135,
			"to top left": -135,
		};
		rotation = direction.endsWith("deg") ? parseFloat(direction) - 90 : angles[direction];
	}
	const stops = parts.map((part) => {
		const stop = part.match(/^(#[\da-f]{3,8}|rgba?\([^)]*\)|[a-z]+)(?:\s+([\d.]+)%)?$/i);
		if (!stop) throw new Error("No se pudo transferir un color del degradado");
		return {
			color: stop[1],
			offset:
				stop[2] === undefined ? undefined : Math.min(1, Math.max(0, Number(stop[2]) / 100)),
		};
	});
	if (stops.length < 2 || !Number.isFinite(rotation))
		throw new Error("Fondo degradado no válido");
	stops[0].offset ??= 0;
	stops[stops.length - 1].offset ??= 1;
	let anchor = 0;
	for (let i = 1; i < stops.length; i++) {
		if (stops[i].offset === undefined) continue;
		stops[i].offset = Math.max(stops[anchor].offset!, stops[i].offset!);
		for (let j = anchor + 1; j < i; j++)
			stops[j].offset =
				stops[anchor].offset! +
				((stops[i].offset! - stops[anchor].offset!) * (j - anchor)) / (i - anchor);
		anchor = i;
	}
	const tag = match[1] === "linear" ? "linearGradientPaint" : "radialGradientPaint";
	return `<${tag} rotation={${n(rotation)}}>${stops.map((s) => `<colorStop color=${q(s.color)} offset={${n(s.offset!)}} />`).join("")}</${tag}>`;
}

export function backgroundComposition(plan: TransferPlan, source: (id: string) => string): string {
	const bg = plan.background;
	if (!bg) return "";
	const { width, height, durationMs } = plan.canvas;
	const blur = (Math.max(0, bg.blur) * width) / 640,
		overscan = Math.ceil(blur * 2);
	const box = `x={${-overscan}} y={${-overscan}} width={${width + overscan * 2}} height={${height + overscan * 2}}`;
	const effect = blur > 0 ? `<effect type="blur" value={${n(blur)}} />` : "";
	let content: string;
	if (bg.kind === "video") {
		const duration = bg.durationMs!;
		if (!Number.isFinite(duration) || duration <= 0 || Math.ceil(durationMs / duration) > 10000)
			throw new Error("Duración de fondo no válida");
		content = Array.from(
			{ length: Math.ceil(durationMs / duration) },
			(_, i) =>
				`<video name="Fondo animado" src=${source(bg.assetId!)} ${box} start={${n((i * duration) / 1000)}} end={${n(Math.min(durationMs, (i + 1) * duration) / 1000)}} sourceIn={0} objectFit="cover" muted>${effect}</video>`,
		).join("\n");
	} else if (bg.kind === "image") {
		content = `<image name="Fondo" src=${source(bg.assetId!)} ${box} end={${n(durationMs / 1000)}} objectFit="cover">${effect}</image>`;
	} else {
		content = `<rect name="Fondo" ${box} end={${n(durationMs / 1000)}}${bg.kind === "color" ? ` fill=${q(bg.value!)}` : ""}>${bg.kind === "gradient" ? gradientPaint(bg.value!) : ""}${effect}</rect>`;
	}
	return `      <sequence id="background-track" name="Fondo">\n${content}\n      </sequence>\n`;
}
