import type { Mark, Tool } from "./screen-annotations";

export type InkMark = Omit<Mark, "bitmap"> & { bitmapUrl?: string };
export type InkScene = { marks: InkMark[]; draft: InkMark | null };
export type InkUpdate = { marks?: InkMark[]; draft: InkMark | null };
export type InkRect = { x: number; y: number; width: number; height: number };
export const EMPTY_INK_SCENE: InkScene = { marks: [], draft: null };
const tools = new Set<Tool>([
	"pointer",
	"pen",
	"line",
	"arrow",
	"rectangle",
	"ellipse",
	"triangle",
	"diamond",
	"hexagon",
	"star",
	"highlight",
	"text",
	"blur",
]);

export function isInkScene(value: unknown): value is InkScene {
	if (!value || typeof value !== "object") return false;
	const scene = value as InkScene;
	if (!Array.isArray(scene.marks) || scene.marks.length > 500) return false;
	let bitmapBytes = 0,
		points = 0;
	const valid = (m: InkMark): boolean => {
		if (
			!m ||
			typeof m !== "object" ||
			!tools.has(m.tool) ||
			typeof m.id !== "string" ||
			m.id.length > 80
		)
			return false;
		if (!/^#[0-9a-f]{6}$/i.test(m.color) || ![2, 3, 5, 8].includes(m.width)) return false;
		if (!Array.isArray(m.points) || !m.points.length || m.points.length > 5000) return false;
		points += m.points.length;
		if (
			points > 100000 ||
			!m.points.every(
				(p) =>
					p &&
					Number.isFinite(p.x) &&
					Number.isFinite(p.y) &&
					Math.abs(p.x) < 40000 &&
					Math.abs(p.y) < 40000,
			)
		)
			return false;
		if (m.text !== undefined && (typeof m.text !== "string" || m.text.length > 300))
			return false;
		if (m.bitmapUrl !== undefined) {
			if (
				typeof m.bitmapUrl !== "string" ||
				!m.bitmapUrl.startsWith("data:image/png;base64,")
			)
				return false;
			bitmapBytes += m.bitmapUrl.length;
			if (bitmapBytes > 24 * 1024 * 1024) return false;
		}
		return true;
	};
	return scene.marks.every(valid) && (scene.draft === null || valid(scene.draft));
}

export function drawingShortcut(
	event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
	editing: boolean,
) {
	if (editing) return null;
	const key = event.key.toLowerCase();
	if (key === "escape") return "pointer";
	if ((event.ctrlKey || event.metaKey) && !event.altKey) {
		if (key === "z") return event.shiftKey ? "redo" : "undo";
		if (key === "y") return "redo";
		return null;
	}
	if (event.ctrlKey || event.metaKey || event.altKey) return null;
	return (
		(
			{
				v: "pointer",
				p: "pen",
				l: "line",
				a: "arrow",
				h: "highlight",
				r: "rectangle",
				t: "text",
				b: "blur",
			} as Record<string, Tool>
		)[key] ?? null
	);
}
