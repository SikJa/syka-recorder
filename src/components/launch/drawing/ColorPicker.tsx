import { useEffect, useRef, useState, type PointerEvent } from "react";
import styles from "./DrawingTools.module.css";

type Hsv = { h: number; s: number; v: number };

const clamp = (value: number, max = 1) => Math.min(max, Math.max(0, value));

function hexToHsv(hex: string): Hsv | null {
	const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!match) return null;
	const n = Number.parseInt(match[1], 16);
	const r = ((n >> 16) & 255) / 255,
		g = ((n >> 8) & 255) / 255,
		b = (n & 255) / 255;
	const max = Math.max(r, g, b),
		d = max - Math.min(r, g, b);
	let h = 0;
	if (d) {
		if (max === r) h = ((g - b) / d) % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
	}
	return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
	const f = (n: number) => {
		const k = (n + h / 60) % 6;
		return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
	};
	return `#${[f(5), f(3), f(1)]
		.map((c) => Math.round(c * 255).toString(16).padStart(2, "0"))
		.join("")}`.toUpperCase();
}

/** Drag surface that reports 0..1 coordinates inside its own box. */
function useDrag(onMove: (x: number, y: number) => void) {
	const dragging = useRef(false);
	const report = (event: PointerEvent<HTMLDivElement>) => {
		const box = event.currentTarget.getBoundingClientRect();
		onMove(clamp((event.clientX - box.left) / box.width), clamp((event.clientY - box.top) / box.height));
	};
	return {
		onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
			dragging.current = true;
			event.currentTarget.setPointerCapture(event.pointerId);
			report(event);
		},
		onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
			if (dragging.current) report(event);
		},
		onPointerUp: () => {
			dragging.current = false;
		},
		onPointerCancel: () => {
			dragging.current = false;
		},
	};
}

/**
 * Inline colour picker (saturation/brightness area, hue slider, hex field).
 * It lives inside the drawing panel, so it can never open off-centre the way
 * the system colour dialog did.
 */
export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
	const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value) ?? { h: 210, s: 1, v: 1 });
	const [text, setText] = useState(value.toUpperCase());
	// Keep the hue when the colour is grey and follow outside changes (presets).
	useEffect(() => {
		const next = hexToHsv(value);
		if (!next) return;
		setHsv((current) =>
			hsvToHex(current) === value.toUpperCase()
				? current
				: { h: next.s && next.v ? next.h : current.h, s: next.s, v: next.v },
		);
		setText(value.toUpperCase());
	}, [value]);
	const update = (next: Hsv) => {
		setHsv(next);
		const hex = hsvToHex(next);
		setText(hex);
		onChange(hex);
	};
	const area = useDrag((x, y) => update({ ...hsv, s: x, v: 1 - y }));
	const hue = useDrag((x) => update({ ...hsv, h: x * 360 }));
	return (
		<div className={styles.colorPicker}>
			<div
				{...area}
				role="slider"
				aria-label="Saturación y brillo"
				aria-valuetext={hsvToHex(hsv)}
				tabIndex={0}
				className={styles.colorArea}
				style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
			>
				<i style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
			</div>
			<div
				{...hue}
				role="slider"
				aria-label="Matiz"
				aria-valuemin={0}
				aria-valuemax={360}
				aria-valuenow={Math.round(hsv.h)}
				tabIndex={0}
				className={styles.colorHue}
			>
				<i style={{ left: `${(hsv.h / 360) * 100}%` }} />
			</div>
			<label className={styles.colorHex}>
				<span style={{ background: value }} />
				<input
					aria-label="Color en hexadecimal"
					value={text}
					maxLength={7}
					spellCheck={false}
					onChange={(event) => {
						setText(event.target.value);
						const parsed = hexToHsv(event.target.value);
						if (parsed) update(parsed);
					}}
				/>
			</label>
		</div>
	);
}
