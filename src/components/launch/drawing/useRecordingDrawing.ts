import { useEffect, useRef, useState, type PointerEvent } from "react";
import { toast } from "@/components/ui/toast";
import {
	bounds,
	blurredTile,
	commit,
	constrained,
	emptyHistory,
	redo,
	undo,
	type History,
	type Mark,
	type Tool,
} from "./screen-annotations";
import { drawingShortcut, type InkMark } from "./contract";

type TextDraft = { x: number; y: number; value: string; color: string; width: number };
export function useRecordingDrawing(recording: boolean) {
	const [tool, setTool] = useState<Tool>("pointer");
	const [panel, setPanel] = useState(false),
		[compact, setCompact] = useState(false);
	const [color, setColor] = useState("#50B1FD"),
		[width, setWidth] = useState(3);
	const [history, setHistory] = useState(emptyHistory),
		[text, setText] = useState<TextDraft | null>(null);
	const [busy, setBusy] = useState(false);
	const historyRef = useRef(history),
		draft = useRef<Mark | null>(null),
		textRef = useRef(text);
	const session = useRef(0),
		active = useRef(recording),
		ready = useRef(false),
		raf = useRef<number | null>(null);
	const fullUpdate = useRef(false),
		toolRequest = useRef(0);
	const bitmapCache = useRef(new WeakMap<HTMLCanvasElement, string>());
	const blurRequest = useRef(0),
		sampling = useRef(false);
	function cancelSample() {
		blurRequest.current++;
		sampling.current = false;
		setBusy(false);
	}
	active.current = recording;
	function encode(mark: Mark): InkMark {
		const { bitmap, ...rest } = mark;
		if (!bitmap) return rest;
		let bitmapUrl = bitmapCache.current.get(bitmap);
		if (!bitmapUrl) {
			bitmapUrl = bitmap.toDataURL();
			bitmapCache.current.set(bitmap, bitmapUrl);
		}
		return { ...rest, bitmapUrl };
	}
	function publish(full = false) {
		fullUpdate.current ||= full;
		if (raf.current !== null) return;
		raf.current = requestAnimationFrame(() => {
			raf.current = null;
			if (!ready.current || !active.current) return;
			const marks = fullUpdate.current ? historyRef.current.present.map(encode) : undefined;
			fullUpdate.current = false;
			window.electronAPI.recordingInkScene({
				marks,
				draft: draft.current ? encode(draft.current) : null,
			});
		});
	}
	function writeHistory(next: History) {
		historyRef.current = next;
		setHistory(next);
		publish(true);
	}
	function add(mark: Mark) {
		let marks = [...historyRef.current.present, mark].slice(-500);
		let count = marks.reduce((sum, m) => sum + m.points.length, 0);
		while (count > 100000 && marks.length > 1) {
			count -= marks[0].points.length;
			marks = marks.slice(1);
		}
		writeHistory(commit(historyRef.current, marks));
	}
	function updateText(value: TextDraft | null) {
		textRef.current = value;
		setText(value);
	}
	function saveText() {
		const value = textRef.current;
		updateText(null);
		if (value?.value.trim())
			add({
				id: crypto.randomUUID(),
				tool: "text",
				color: value.color,
				width: value.width,
				points: [{ x: value.x, y: value.y }],
				text: value.value.trim(),
			});
	}
	function closePanel() {
		setPanel(false);
	}
	function returnToMouse() {
		cancelSample();
		toolRequest.current++;
		draft.current = null;
		updateText(null);
		setTool("pointer");
		closePanel();
		publish();
	}
	async function ensureReady() {
		if (ready.current) return true;
		const epoch = session.current;
		const result = await window.electronAPI.recordingInkStart().catch(() => ({
			success: false,
			error: "No se pudo abrir el dibujo. Reabrí Recorder.",
		}));
		if (epoch !== session.current || !active.current) return false;
		if (!result.success) {
			toast.error(result.error || "No se pudo abrir el dibujo.");
			return false;
		}
		ready.current = true;
		publish(true);
		return true;
	}
	async function choose(next: Tool) {
		saveText();
		draft.current = null;
		const request = ++toolRequest.current;
		if (next !== "pointer" && !(await ensureReady())) return;
		if (request !== toolRequest.current || !active.current) return;
		setTool(next);
		closePanel();
		publish();
	}
	async function togglePanel() {
		saveText();
		if (panel) {
			closePanel();
			return;
		}
		if (await ensureReady()) setPanel(true);
	}
	function minimize() {
		saveText();
		setCompact((v) => !v);
		closePanel();
	}
	const undoMark = () => {
		if (sampling.current) {
			cancelSample();
			return;
		}
		draft.current = null;
		writeHistory(undo(historyRef.current));
	};
	const redoMark = () => {
		cancelSample();
		draft.current = null;
		writeHistory(redo(historyRef.current));
	};
	useEffect(() => {
		cancelSample();
		session.current++;
		ready.current = false;
		toolRequest.current++;
		historyRef.current = emptyHistory();
		setHistory(historyRef.current);
		setTool("pointer");
		setPanel(false);
		setCompact(false);
		updateText(null);
		draft.current = null;
		setBusy(false);
		if (raf.current !== null) {
			cancelAnimationFrame(raf.current);
			raf.current = null;
		}
		fullUpdate.current = false;
		return () => {
			session.current++;
			toolRequest.current++;
			if (raf.current !== null) {
				cancelAnimationFrame(raf.current);
				raf.current = null;
			}
		};
	}, [recording]);
	useEffect(
		() =>
			window.electronAPI?.onRecordingInkError?.((message) => {
				ready.current = false;
				returnToMouse();
				toast.error(message);
			}),
		[],
	);
	useEffect(() => window.electronAPI?.onRecordingControlsRestore?.(() => setCompact(false)), []);
	useEffect(() => {
		if (!recording) return;
		const keydown = (event: KeyboardEvent) => {
			if (event.isComposing) return;
			const editing =
				event.target instanceof Element &&
				!!event.target.closest('input,textarea,[contenteditable="true"]');
			const action = drawingShortcut(event, editing);
			if (!action) return;
			event.preventDefault();
			if (action === "undo") undoMark();
			else if (action === "redo") redoMark();
			else if (action === "pointer") returnToMouse();
			else void choose(action);
		};
		window.addEventListener("keydown", keydown);
		return () => window.removeEventListener("keydown", keydown);
	}, [recording, color, width]);
	const point = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY });
	function pointerDown(event: PointerEvent<HTMLDivElement>) {
		if (event.button !== 0 || sampling.current || !recording || tool === "pointer") return;
		event.preventDefault();
		saveText();
		closePanel();
		const p = point(event);
		if (tool === "text") {
			updateText({
				x: Math.max(8, Math.min(p.x, innerWidth - 240)),
				y: Math.max(8, Math.min(p.y, innerHeight - 70)),
				value: "",
				color,
				width,
			});
			return;
		}
		event.currentTarget.setPointerCapture(event.pointerId);
		draft.current = { id: crypto.randomUUID(), tool, color, width, points: [p] };
		publish();
	}
	function pointerMove(event: PointerEvent<HTMLDivElement>) {
		const mark = draft.current;
		if (!mark) return;
		const p = constrained(mark.points[0], point(event), mark.tool, event.shiftKey);
		if (mark.tool === "pen" || mark.tool === "highlight") {
			if (mark.points.length < 5000) mark.points = [...mark.points, p];
		} else mark.points = [mark.points[0], p];
		publish();
	}
	async function pointerUp(event: PointerEvent<HTMLDivElement>) {
		pointerMove(event);
		const mark = draft.current;
		if (!mark) return;
		draft.current = null;
		if (mark.tool !== "blur") {
			add(mark);
			return;
		}
		const rect = bounds(mark),
			epoch = session.current;
		publish();
		if (rect.width < 3 || rect.height < 3) return;
		setBusy(true);
		sampling.current = true;
		const request = ++blurRequest.current;
		try {
			const result = await window.electronAPI.recordingInkSample(rect);
			if (!result.success || !result.dataUrl)
				throw new Error(result.error || "No se pudo difuminar.");
			const img = new Image();
			img.src = result.dataUrl;
			await img.decode();
			if (epoch !== session.current || !active.current || request !== blurRequest.current)
				return;
			mark.bitmap = blurredTile(img, rect.width, rect.height, 1);
			add(mark);
		} catch (error) {
			if (epoch === session.current && request === blurRequest.current)
				toast.error(error instanceof Error ? error.message : "No se pudo difuminar.");
		} finally {
			if (epoch === session.current && request === blurRequest.current) {
				sampling.current = false;
				setBusy(false);
			}
		}
	}
	function cancelStroke() {
		draft.current = null;
		publish();
	}
	return {
		tool,
		panel,
		compact,
		color,
		width,
		history,
		text,
		busy,
		active: recording && tool !== "pointer",
		setColor,
		setWidth,
		choose,
		togglePanel,
		closePanel,
		minimize,
		updateText,
		saveText,
		undo: undoMark,
		redo: redoMark,
		clear: () => {
			cancelSample();
			writeHistory(commit(historyRef.current, []));
		},
		pointerDown,
		pointerMove,
		pointerUp,
		cancelStroke,
	};
}
export type RecordingDrawing = ReturnType<typeof useRecordingDrawing>;
