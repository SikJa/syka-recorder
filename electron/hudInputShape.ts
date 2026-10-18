import type { Rectangle } from "electron";

export function getHudInputShape(input: unknown, width: number, height: number): Rectangle[] {
	const rects: Rectangle[] = [];
	if (Array.isArray(input)) {
		for (const value of input.slice(0, 64)) {
			if (!value || ![value.x, value.y, value.width, value.height].every(Number.isFinite))
				continue;
			if (value.width <= 0 || value.height <= 0) continue;
			const x = Math.max(0, Math.floor(value.x));
			const y = Math.max(0, Math.floor(value.y));
			const right = Math.min(width, Math.ceil(value.x + value.width));
			const bottom = Math.min(height, Math.ceil(value.y + value.height));
			if (right > x && bottom > y) rects.push({ x, y, width: right - x, height: bottom - y });
		}
	}
	// An empty array removes the native shape and would block the whole desktop.
	return rects.length ? rects : [{ x: 0, y: 0, width: 1, height: 1 }];
}
