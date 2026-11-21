export type PanelPoint = { x: number; y: number };
type Size = { width: number; height: number };
type Anchor = { x: number; y: number; width: number; bottom: number };

const MARGIN = 8;

// Keeps the whole palette on screen; if it is larger than the viewport the
// top-left corner wins so the heading (the drag handle) stays reachable.
export function clampPanelPosition(point: PanelPoint, panel: Size, viewport: Size): PanelPoint {
	return {
		x: Math.max(MARGIN, Math.min(point.x, viewport.width - panel.width - MARGIN)),
		y: Math.max(MARGIN, Math.min(point.y, viewport.height - panel.height - MARGIN)),
	};
}

// Default spot until the user moves the palette: centred over the bar, or
// below it when there is no room above.
export function anchoredPanelPosition(anchor: Anchor, panel: Size, viewport: Size): PanelPoint {
	const above = anchor.y - panel.height - 10;
	return clampPanelPosition(
		{
			x: anchor.x + (anchor.width - panel.width) / 2,
			y: above < MARGIN ? anchor.bottom + 10 : above,
		},
		panel,
		viewport,
	);
}
