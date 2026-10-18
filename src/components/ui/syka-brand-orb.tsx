import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { MODE_DRAWS, resolvePreset } from "@/lib/vendor/thinking-orbs/engine";

/** The original Syka composing orb, with Studio's header geometry and idle speed. */
export function SykaBrandOrb() {
	const canvas = useRef<HTMLCanvasElement>(null);
	const reducedMotion = useReducedMotion();
	const { theme } = useTheme();
	useEffect(() => {
		const element = canvas.current;
		const context = element?.getContext("2d");
		if (!element || !context) return;
		const preset = resolvePreset("composing", 20);
		const draw = MODE_DRAWS[preset.mode];
		let frame = 0;
		let lastDraw = 0;
		let visible = true;
		const paint = (time: number) => {
			context.setTransform(element.width / 20, 0, 0, element.height / 20, 0, 0);
			context.clearRect(0, 0, 20, 20);
			draw(context, 20, time, theme === "dark", preset.opts);
		};
		const resize = () => {
			element.width = Math.ceil(28 * Math.max(2, Math.min(3, devicePixelRatio || 1)));
			element.height = element.width;
			paint(0.6);
		};
		const tick = (now: number) => {
			if (now - lastDraw >= 1000 / 30) {
				paint((now / 1000) * preset.speed * 0.62);
				lastDraw = now;
			}
			frame = requestAnimationFrame(tick);
		};
		const sync = () => {
			cancelAnimationFrame(frame);
			if (!reducedMotion && visible && document.visibilityState !== "hidden")
				frame = requestAnimationFrame(tick);
		};
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			sync();
		});
		observer.observe(element);
		resize();
		sync();
		document.addEventListener("visibilitychange", sync);
		window.addEventListener("resize", resize);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			document.removeEventListener("visibilitychange", sync);
			window.removeEventListener("resize", resize);
		};
	}, [theme, reducedMotion]);
	return <canvas ref={canvas} className="size-7 shrink-0" aria-hidden="true" data-syka-orb />;
}
