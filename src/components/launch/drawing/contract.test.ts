import { describe, expect, it } from "vitest";
import { drawingShortcut, isInkScene } from "./contract";
import { commit, emptyHistory, redo, undo, constrained, type Mark } from "./screen-annotations";
const mark: Mark = {
	id: "stroke",
	tool: "pen",
	color: "#50B1FD",
	width: 3,
	points: [
		{ x: 20, y: 30 },
		{ x: 40, y: 50 },
	],
};
const key = (key: string, options = {}) => ({
	key,
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	shiftKey: false,
	...options,
});
describe("live ink protocol and keyboard", () => {
	it("accepts bounded ink, rejects arbitrary payloads and remote bitmap URLs", () => {
		expect(isInkScene({ marks: [mark], draft: null })).toBe(true);
		for (const value of [
			null,
			{},
			{ marks: [{ ...mark, width: 0 }], draft: null },
			{ marks: [{ ...mark, points: [{ x: Infinity, y: 0 }] }], draft: null },
			{ marks: [{ ...mark, bitmapUrl: "https://example.com/image.png" }], draft: null },
			{ marks: Array(501).fill(mark), draft: null },
		])
			expect(isInkScene(value)).toBe(false);
	});
	it("supports shortcuts without any panel state and leaves text editing alone", () => {
		expect(drawingShortcut(key("P"), false)).toBe("pen");
		expect(drawingShortcut(key("z", { ctrlKey: true }), false)).toBe("undo");
		expect(drawingShortcut(key("z", { ctrlKey: true, shiftKey: true }), false)).toBe("redo");
		expect(drawingShortcut(key("y", { ctrlKey: true }), false)).toBe("redo");
		for (const event of [key("p"), key("z", { ctrlKey: true }), key("Escape")])
			expect(drawingShortcut(event, true)).toBeNull();
		expect(drawingShortcut(key("p", { ctrlKey: true }), false)).toBeNull();
		expect(drawingShortcut(key("Escape"), false)).toBe("pointer");
	});
	it("undo restores cleared drawings and new edits invalidate redo", () => {
		const drawn = commit(emptyHistory(), [mark]),
			cleared = commit(drawn, []);
		expect(undo(cleared).present).toEqual([mark]);
		expect(redo(undo(cleared)).present).toEqual([]);
		expect(commit(undo(cleared), [{ ...mark, id: "new" }]).future).toEqual([]);
	});
	it("bounds history and preserves immutable snapshots", () => {
		let history = emptyHistory();
		for (let i = 0; i < 100; i++) history = commit(history, [{ ...mark, id: String(i) }]);
		expect(history.past).toHaveLength(80);
		expect(undo(history).present[0].id).toBe("98");
		expect(history.present[0].id).toBe("99");
	});
	it("constrains shapes and diagonal lines with Shift", () => {
		expect(constrained({ x: 10, y: 10 }, { x: 30, y: 25 }, "rectangle", true)).toEqual({
			x: 30,
			y: 30,
		});
		const point = constrained({ x: 0, y: 0 }, { x: 100, y: 90 }, "arrow", true);
		expect(point.x).toBeCloseTo(point.y);
	});
});
