import { describe, expect, it } from "vitest";
import { anchoredPanelPosition, clampPanelPosition } from "./panelPosition";

const viewport = { width: 1366, height: 728 };
const panel = { width: 290, height: 260 };

describe("drawing panel position", () => {
	it("keeps a dragged palette fully inside the viewport", () => {
		expect(clampPanelPosition({ x: 500, y: 200 }, panel, viewport)).toEqual({ x: 500, y: 200 });
		expect(clampPanelPosition({ x: -40, y: -10 }, panel, viewport)).toEqual({ x: 8, y: 8 });
		expect(clampPanelPosition({ x: 1300, y: 700 }, panel, viewport)).toEqual({
			x: 1366 - 290 - 8,
			y: 728 - 260 - 8,
		});
	});

	it("pins an oversized palette to the top-left so its heading stays reachable", () => {
		expect(clampPanelPosition({ x: 100, y: 100 }, { width: 290, height: 900 }, viewport)).toEqual({
			x: 100,
			y: 8,
		});
	});

	it("centres the default position above the bar, or below it without room", () => {
		const bar = { x: 483, y: 660, width: 400, bottom: 708 };
		expect(anchoredPanelPosition(bar, panel, viewport)).toEqual({ x: 538, y: 390 });
		const topBar = { x: 483, y: 20, width: 400, bottom: 68 };
		expect(anchoredPanelPosition(topBar, panel, viewport)).toEqual({ x: 538, y: 78 });
	});
});
