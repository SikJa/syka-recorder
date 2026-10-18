import { useEffect } from "react";

// Windows mouse forwarding can stop after a focus change. Give the existing HUD
// a native shape containing only its controls, popovers and floating webcam.
export function useHudInputShape(platform: string | null) {
	useEffect(() => {
		if (platform !== "win32" || !window.electronAPI?.hudOverlaySetInputRegions) return;
		const selector = '[data-hud-interactive], [data-slot="toast"], [role="tooltip"]';
		let frame: number | null = null;
		let previous = "";
		let dragPointerId: number | null = null;
		const observed = new Set<Element>();
		const publish = (regions: { x: number; y: number; width: number; height: number }[]) => {
			const signature = JSON.stringify(regions);
			if (signature === previous) return;
			previous = signature;
			window.electronAPI.hudOverlaySetInputRegions(regions);
		};
		const schedule = () => {
			if (frame === null) frame = requestAnimationFrame(update);
		};
		const resizeObserver = new ResizeObserver(schedule);
		const update = () => {
			frame = null;
			if (dragPointerId !== null) {
				// setShape also clips painting. While a pointer is captured, leave
				// room for the entire gesture instead of clipping each new frame to
				// the previous frame's bounds across asynchronous IPC.
				publish([{ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }]);
				return;
			}
			const elements = new Set(document.querySelectorAll<HTMLElement>(selector));
			for (const element of observed) {
				if (!elements.has(element as HTMLElement)) {
					resizeObserver.unobserve(element);
					observed.delete(element);
				}
			}
			const regions = [];
			for (const element of elements) {
				if (!observed.has(element)) {
					observed.add(element);
					resizeObserver.observe(element);
				}
				const rect = element.getBoundingClientRect();
				if (
					!rect.width ||
					!rect.height ||
					getComputedStyle(element).visibility === "hidden"
				)
					continue;
				regions.push({
					x: Math.floor(rect.x - 8),
					y: Math.floor(rect.y - 8),
					width: Math.ceil(rect.width + 16),
					height: Math.ceil(rect.height + 16),
				});
			}
			publish(regions);
		};
		const beginDrag = (event: PointerEvent) => {
			if (event.button !== 0 || dragPointerId !== null || !(event.target instanceof Element)) return;
			if (!event.target.closest("[data-hud-drag-handle]")) return;
			dragPointerId = event.pointerId;
			publish([{ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }]);
		};
		const endDrag = (event: PointerEvent) => {
			if (event.pointerId !== dragPointerId) return;
			dragPointerId = null;
			// Let the pointer handler commit its final transform before restoring
			// the small click-through regions.
			schedule();
		};
		const cancelDrag = () => {
			dragPointerId = null;
			schedule();
		};
		const observer = new MutationObserver(schedule);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["style", "class", "data-state", "hidden"],
		});
		window.addEventListener("resize", schedule);
		window.addEventListener("pointerdown", beginDrag, true);
		window.addEventListener("pointerup", endDrag, true);
		window.addEventListener("pointercancel", endDrag, true);
		window.addEventListener("lostpointercapture", endDrag, true);
		window.addEventListener("blur", cancelDrag);
		schedule();
		return () => {
			if (frame !== null) cancelAnimationFrame(frame);
			observer.disconnect();
			resizeObserver.disconnect();
			window.removeEventListener("resize", schedule);
			window.removeEventListener("pointerdown", beginDrag, true);
			window.removeEventListener("pointerup", endDrag, true);
			window.removeEventListener("pointercancel", endDrag, true);
			window.removeEventListener("lostpointercapture", endDrag, true);
			window.removeEventListener("blur", cancelDrag);
		};
	}, [platform]);
}
