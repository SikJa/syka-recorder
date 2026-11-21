import { useEffect } from "react";

// Infinite animations (the REC dot, spinners) never settle and do not move
// any control, so only finite ones keep the per-frame measurement running.
function hasFiniteAnimationRunning() {
	if (typeof document.getAnimations !== "function") return false;
	return document.getAnimations().some((animation) => {
		if (animation.playState !== "running") return false;
		const end = animation.effect?.getComputedTiming().endTime;
		return typeof end === "number" && Number.isFinite(end);
	});
}

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
			// Popovers and tooltips zoom in from 90% (HeroUI data-entering) and the
			// bar's state swap runs on WAAPI. Neither changes an observed attribute
			// or the layout size when it settles, so keep measuring every frame
			// until finite animations finish; otherwise the shape stays fitted to
			// the first, smaller frame and clips the edges of the finished popover.
			if (hasFiniteAnimationRunning()) schedule();
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
			attributeFilter: [
				"style",
				"class",
				"data-state",
				"hidden",
				"data-entering",
				"data-exiting",
			],
		});
		// setShape converts DIPs to pixels with the scale factor current at the
		// call. When the HUD moves to a display with another scale, the identical
		// DIP regions must be sent again or the old pixel shape stays in place.
		let scaleQuery: MediaQueryList | null = null;
		const watchScale = () => {
			scaleQuery?.removeEventListener("change", onScaleChange);
			scaleQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
			scaleQuery.addEventListener("change", onScaleChange);
		};
		const onScaleChange = () => {
			previous = "";
			watchScale();
			schedule();
		};
		watchScale();
		window.addEventListener("resize", schedule);
		document.addEventListener("animationend", schedule, true);
		document.addEventListener("transitionend", schedule, true);
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
			scaleQuery?.removeEventListener("change", onScaleChange);
			window.removeEventListener("resize", schedule);
			document.removeEventListener("animationend", schedule, true);
			document.removeEventListener("transitionend", schedule, true);
			window.removeEventListener("pointerdown", beginDrag, true);
			window.removeEventListener("pointerup", endDrag, true);
			window.removeEventListener("pointercancel", endDrag, true);
			window.removeEventListener("lostpointercapture", endDrag, true);
			window.removeEventListener("blur", cancelDrag);
		};
	}, [platform]);
}
