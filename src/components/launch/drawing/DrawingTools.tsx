import { useLayoutEffect, useRef, useState, type ComponentType, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
	ArrowCounterClockwise,
	ArrowClockwise,
	ArrowUpRight,
	CaretDown,
	Circle,
	Cursor,
	DotsNine,
	Highlighter,
	LineSegment,
	PencilSimple,
	Rectangle,
	TextT,
	Trash,
	Triangle,
	Diamond,
	Hexagon,
	Star,
	X,
} from "@phosphor-icons/react";
import type { Tool } from "./screen-annotations";
import type { RecordingDrawing } from "./useRecordingDrawing";
import styles from "./DrawingTools.module.css";

export const DRAWING_TOOLS: Record<
	Tool,
	{ label: string; icon: ComponentType<{ size?: number }> }
> = {
	pointer: { label: "Mouse", icon: Cursor },
	pen: { label: "Lápiz", icon: PencilSimple },
	line: { label: "Línea", icon: LineSegment },
	arrow: { label: "Flecha", icon: ArrowUpRight },
	highlight: { label: "Resaltador", icon: Highlighter },
	rectangle: { label: "Rectángulo", icon: Rectangle },
	ellipse: { label: "Elipse", icon: Circle },
	triangle: { label: "Triángulo", icon: Triangle },
	diamond: { label: "Rombo", icon: Diamond },
	hexagon: { label: "Hexágono", icon: Hexagon },
	star: { label: "Estrella", icon: Star },
	text: { label: "Texto", icon: TextT },
	blur: { label: "Difuminar", icon: DotsNine },
};
const strokes: Tool[] = ["pen", "line", "arrow", "highlight"],
	shapes: Tool[] = ["rectangle", "ellipse", "triangle", "diamond", "hexagon", "star"];
const colors = ["#50B1FD", "#F51C28", "#E5B322", "#9024DC", "#800020", "#000000", "#F3F3F3"];
export function DrawingInput({ drawing: d }: { drawing: RecordingDrawing }) {
	return (
		<>
			{d.active && (
				<div
					data-hud-interactive
					className={styles.inputLayer}
					style={{ cursor: d.busy ? "wait" : d.tool === "text" ? "text" : "crosshair" }}
					aria-label="Área de dibujo"
					onPointerDown={d.pointerDown}
					onPointerMove={d.pointerMove}
					onPointerUp={d.pointerUp}
					onPointerCancel={d.cancelStroke}
				/>
			)}
			{d.text &&
				createPortal(
					<div
						data-hud-interactive
						className={styles.textEditor}
						style={{ left: d.text.x, top: d.text.y }}
					>
						<input
							autoFocus
							aria-label="Texto de la anotación"
							maxLength={300}
							placeholder="Escribí acá…"
							value={d.text.value}
							onChange={(e) => d.updateText({ ...d.text!, value: e.target.value })}
							onBlur={d.saveText}
							onKeyDown={(e) => {
								if (e.nativeEvent.isComposing) return;
								if (e.key === "Enter") {
									e.preventDefault();
									e.stopPropagation();
									d.saveText();
								}
								if (e.key === "Escape") {
									e.preventDefault();
									e.stopPropagation();
									d.updateText(null);
								}
							}}
						/>
						<small>Enter: guardar · Esc: cancelar</small>
					</div>,
					document.body,
				)}
		</>
	);
}
export function DrawingTools({
	drawing: d,
	anchor,
}: {
	drawing: RecordingDrawing;
	anchor: RefObject<HTMLDivElement | null>;
}) {
	const [group, setGroup] = useState<"stroke" | "shape" | null>(null);
	const panel = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ x: 8, y: 8 });
	useLayoutEffect(() => {
		if (!d.panel) return;
		let frame: number | null = null;
		const update = () => {
			frame = null;
			const a = anchor.current?.getBoundingClientRect(),
				p = panel.current?.getBoundingClientRect();
			if (!a || !p) return;
			const x = Math.max(
				8,
				Math.min(a.x + (a.width - p.width) / 2, innerWidth - p.width - 8),
			);
			const y = Math.max(
				8,
				Math.min(
					a.y - p.height - 10 < 8 ? a.bottom + 10 : a.y - p.height - 10,
					innerHeight - p.height - 8,
				),
			);
			setPosition((old) => (old.x === x && old.y === y ? old : { x, y }));
		};
		const schedule = () => {
			if (frame === null) frame = requestAnimationFrame(update);
		};
		const resize = new ResizeObserver(schedule);
		if (panel.current) resize.observe(panel.current);
		if (anchor.current) resize.observe(anchor.current);
		window.addEventListener("pointermove", schedule);
		window.addEventListener("resize", schedule);
		update();
		return () => {
			resize.disconnect();
			window.removeEventListener("pointermove", schedule);
			window.removeEventListener("resize", schedule);
			if (frame !== null) cancelAnimationFrame(frame);
		};
	}, [d.panel, d.tool, group, anchor]);
	useLayoutEffect(() => {
		if (!d.panel) setGroup(null);
	}, [d.panel]);
	if (!d.panel || d.compact) return null;
	const toolButton = (tool: Tool, label: string) => {
		const Icon = DRAWING_TOOLS[tool].icon;
		return (
			<button
				type="button"
				title={label}
				aria-label={label}
				aria-pressed={d.tool === tool}
				onClick={() => void d.choose(tool)}
			>
				<Icon size={18} />
			</button>
		);
	};
	const Stroke = strokes.includes(d.tool) ? DRAWING_TOOLS[d.tool].icon : PencilSimple;
	const Shape = shapes.includes(d.tool) ? DRAWING_TOOLS[d.tool].icon : Rectangle;
	return createPortal(
		<div
			ref={panel}
			data-hud-interactive
			className={styles.panel}
			style={{ left: position.x, top: position.y }}
			role="region"
			aria-label="Herramientas de dibujo"
		>
			<div className={styles.heading}>
				<span>Dibujar en pantalla</span>
				<button
					type="button"
					aria-label="Cerrar herramientas"
					title="Cerrar panel y seguir dibujando"
					onClick={d.closePanel}
				>
					<X size={15} />
				</button>
			</div>
			<div className={styles.tools}>
				{toolButton("pointer", "Mouse (V)")}
				<button
					type="button"
					title="Trazos"
					aria-label="Trazos"
					aria-expanded={group === "stroke"}
					aria-pressed={strokes.includes(d.tool)}
					onClick={() => setGroup(group === "stroke" ? null : "stroke")}
				>
					<Stroke size={18} />
					<CaretDown className={styles.caret} size={9} />
				</button>
				<button
					type="button"
					title="Formas"
					aria-label="Formas"
					aria-expanded={group === "shape"}
					aria-pressed={shapes.includes(d.tool)}
					onClick={() => setGroup(group === "shape" ? null : "shape")}
				>
					<Shape size={18} />
					<CaretDown className={styles.caret} size={9} />
				</button>
				{toolButton("text", "Texto (T)")}
				{toolButton("blur", "Difuminar (B)")}
			</div>
			{group && (
				<div className={styles.picker}>
					{(group === "stroke" ? strokes : shapes).map((tool) => {
						const Icon = DRAWING_TOOLS[tool].icon;
						return (
							<button
								type="button"
								key={tool}
								aria-pressed={d.tool === tool}
								onClick={() => void d.choose(tool)}
							>
								<Icon size={18} />
								{DRAWING_TOOLS[tool].label}
							</button>
						);
					})}
				</div>
			)}
			{d.tool === "blur" ? (
				<p className={styles.note}>Arrastrá para difuminar una muestra de la pantalla.</p>
			) : (
				<>
					<div className={styles.colors}>
						{colors.map((color) => (
							<button
								type="button"
								key={color}
								title={color}
								aria-label={`Color ${color}`}
								aria-pressed={d.color === color}
								className={styles.swatch}
								style={{ background: color }}
								onClick={() => d.setColor(color)}
							/>
						))}
						<label className={styles.customColor} title="Color personalizado">
							<input
								type="color"
								aria-label="Color personalizado"
								value={d.color}
								onChange={(e) => d.setColor(e.target.value)}
							/>
							<span>+</span>
						</label>
					</div>
					<div className={styles.widths}>
						<span>Grosor</span>
						{[2, 3, 5, 8].map((width) => (
							<button
								type="button"
								key={width}
								aria-label={`Grosor ${width} px`}
								aria-pressed={d.width === width}
								onClick={() => d.setWidth(width)}
							>
								<i style={{ height: width }} />
								<small>{width}</small>
							</button>
						))}
					</div>
				</>
			)}
			<div className={styles.actions}>
				<span>
					{DRAWING_TOOLS[d.tool].label}
					<small>{d.history.present.length} marcas · Esc: mouse</small>
				</span>
				<button
					type="button"
					title="Deshacer (Ctrl+Z)"
					aria-label="Deshacer"
					disabled={!d.history.past.length}
					onClick={d.undo}
				>
					<ArrowCounterClockwise size={18} />
				</button>
				<button
					type="button"
					title="Rehacer (Ctrl+Shift+Z)"
					aria-label="Rehacer"
					disabled={!d.history.future.length}
					onClick={d.redo}
				>
					<ArrowClockwise size={18} />
				</button>
				<button
					type="button"
					title="Borrar dibujos"
					aria-label="Borrar dibujos"
					disabled={!d.history.present.length}
					onClick={d.clear}
				>
					<Trash size={18} />
				</button>
			</div>
		</div>,
		document.body,
	);
}
