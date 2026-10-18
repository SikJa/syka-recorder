import { useEffect, useRef } from "react";
import { paint, type Mark } from "./screen-annotations";
import type { InkScene } from "./contract";

export default function RecordingInkWindow() {
	const canvas = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		let scene: InkScene = { marks: [], draft: null };
		const bitmaps = new Map<string, HTMLCanvasElement>();
		const pending = new Set<string>();
		let disposed = false;
		function draw() {
			if (disposed || !canvas.current) return;
			const el = canvas.current,
				dpr = window.devicePixelRatio || 1;
			if (
				el.width !== Math.round(innerWidth * dpr) ||
				el.height !== Math.round(innerHeight * dpr)
			) {
				el.width = Math.round(innerWidth * dpr);
				el.height = Math.round(innerHeight * dpr);
			}
			const ctx = el.getContext("2d")!;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, innerWidth, innerHeight);
			for (const mark of [...scene.marks, ...(scene.draft ? [scene.draft] : [])]) {
				if (mark.bitmapUrl && !bitmaps.has(mark.id)) {
					if (!pending.has(mark.id)) {
						pending.add(mark.id);
						const img = new Image();
						img.onload = () => {
							if (disposed) return;
							const tile = document.createElement("canvas");
							tile.width = img.width;
							tile.height = img.height;
							tile.getContext("2d")!.drawImage(img, 0, 0);
							bitmaps.set(mark.id, tile);
							pending.delete(mark.id);
							draw();
						};
						img.onerror = () => pending.delete(mark.id);
						img.src = mark.bitmapUrl;
					}
					continue;
				}
				paint(ctx, { ...mark, bitmap: bitmaps.get(mark.id) } as Mark);
			}
		}
		const off = window.electronAPI.onRecordingInkScene((value) => {
			scene = { marks: value.marks ?? scene.marks, draft: value.draft };
			const ids = new Set(scene.marks.map((m) => m.id));
			for (const id of bitmaps.keys()) if (!ids.has(id)) bitmaps.delete(id);
			draw();
		});
		window.electronAPI.recordingInkReady();
		window.addEventListener("resize", draw);
		return () => {
			disposed = true;
			off();
			window.removeEventListener("resize", draw);
		};
	}, []);
	return (
		<canvas
			ref={canvas}
			style={{
				position: "fixed",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		/>
	);
}
