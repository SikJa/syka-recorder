import { type KeyboardEvent, type PointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
	mergeHudInteractiveBounds,
	shouldRestoreHudMousePassthroughAfterDrag,
} from "../hudMousePassthrough";
import { clampHudOffsetToViewport } from "../hudViewportBounds";

const DEFAULT_RECORDING_HUD_OFFSET = { x: 0, y: 0 };

export function useHudBarDrag({
	hudContentRef,
	hudBarRef,
	recordingWebcamPreviewContainerRef,
}: {
	hudContentRef: RefObject<HTMLDivElement | null>;
	hudBarRef: RefObject<HTMLDivElement | null>;
	recordingWebcamPreviewContainerRef: RefObject<HTMLDivElement | null>;
}) {
	const [recordingHudOffset, setRecordingHudOffset] = useState(DEFAULT_RECORDING_HUD_OFFSET);
	const [isHudDragging, setIsHudDragging] = useState(false);
	const hudBarTransformRef = useRef<HTMLDivElement | null>(null);
	const recordingHudOffsetRef = useRef(DEFAULT_RECORDING_HUD_OFFSET);
	const hudDragStartRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		originX: number;
		originY: number;
		initialLeft: number;
		initialTop: number;
		hudWidth: number;
		hudHeight: number;
	} | null>(null);
	const isHudDraggingRef = useRef(false);
	const hudDragMoveRafRef = useRef<number | null>(null);
	const hudDragPendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);

	useEffect(() => {
		recordingHudOffsetRef.current = recordingHudOffset;
		if (!isHudDraggingRef.current && hudBarTransformRef.current) {
			hudBarTransformRef.current.style.transform = `translate3d(${recordingHudOffset.x}px, ${recordingHudOffset.y}px, 0)`;
		}
	}, [recordingHudOffset]);

	const keepHudBarInsideViewport = useCallback(() => {
		if (isHudDraggingRef.current || !hudBarRef.current) {
			return;
		}

		const bounds = hudBarRef.current.getBoundingClientRect();
		const nextOffset = clampHudOffsetToViewport(recordingHudOffsetRef.current, bounds, {
			width: window.innerWidth,
			height: window.innerHeight,
		});
		if (
			nextOffset.x === recordingHudOffsetRef.current.x &&
			nextOffset.y === recordingHudOffsetRef.current.y
		) {
			return;
		}

		recordingHudOffsetRef.current = nextOffset;
		if (hudBarTransformRef.current) {
			hudBarTransformRef.current.style.transform = `translate3d(${nextOffset.x}px, ${nextOffset.y}px, 0)`;
		}
		setRecordingHudOffset(nextOffset);
	}, [hudBarRef]);

	useEffect(() => {
		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(keepHudBarInsideViewport);
		if (hudBarRef.current) {
			resizeObserver?.observe(hudBarRef.current);
		}
		window.addEventListener("resize", keepHudBarInsideViewport);

		return () => {
			window.removeEventListener("resize", keepHudBarInsideViewport);
			resizeObserver?.disconnect();
		};
	}, [hudBarRef, keepHudBarInsideViewport]);

	const handleHudBarPointerDown = useCallback(
		(event: PointerEvent<HTMLElement>) => {
			if (event.button !== 0 || !hudBarRef.current || hudDragStartRef.current) {
				return;
			}

			event.preventDefault();
			event.currentTarget.focus({ preventScroll: true });
			event.currentTarget.setPointerCapture(event.pointerId);
			isHudDraggingRef.current = true;
			setIsHudDragging(true);
			window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);
			const hudRect = hudBarRef.current.getBoundingClientRect();
			hudDragStartRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				originX: recordingHudOffsetRef.current.x,
				originY: recordingHudOffsetRef.current.y,
				initialLeft: hudRect.left,
				initialTop: hudRect.top,
				hudWidth: hudRect.width,
				hudHeight: hudRect.height,
			};
		},
		[hudBarRef],
	);

	const handleHudBarPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
		const dragState = hudDragStartRef.current;
		if (!dragState || dragState.pointerId !== event.pointerId) {
			return;
		}

		hudDragPendingPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
		if (hudDragMoveRafRef.current !== null) {
			return;
		}

		hudDragMoveRafRef.current = requestAnimationFrame(() => {
			hudDragMoveRafRef.current = null;
			const latestDragState = hudDragStartRef.current;
			const pointer = hudDragPendingPointerRef.current;
			if (!latestDragState || !pointer) {
				return;
			}

			const deltaX = pointer.clientX - latestDragState.startX;
			const deltaY = pointer.clientY - latestDragState.startY;
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			const unclampedLeft = latestDragState.initialLeft + deltaX;
			const unclampedTop = latestDragState.initialTop + deltaY;
			const clampedLeft = Math.min(
				Math.max(0, unclampedLeft),
				Math.max(0, viewportWidth - latestDragState.hudWidth),
			);
			const clampedTop = Math.min(
				Math.max(0, unclampedTop),
				Math.max(0, viewportHeight - latestDragState.hudHeight),
			);

			const nextOffset = {
				x: latestDragState.originX + (clampedLeft - latestDragState.initialLeft),
				y: latestDragState.originY + (clampedTop - latestDragState.initialTop),
			};
			recordingHudOffsetRef.current = nextOffset;
			if (hudBarTransformRef.current) {
				hudBarTransformRef.current.style.transform = `translate3d(${nextOffset.x}px, ${nextOffset.y}px, 0)`;
			}
		});
	}, []);

	const handleHudBarPointerUp = useCallback(
		(event: PointerEvent<HTMLElement>) => {
			const dragState = hudDragStartRef.current;
			if (!dragState || dragState.pointerId !== event.pointerId) {
				return;
			}

			// A fast release can arrive before the last animation frame. Use its
			// actual position; cancellation/lost capture must keep the last position.
			const pointer = event.type === "pointerup"
				? { clientX: event.clientX, clientY: event.clientY }
				: hudDragPendingPointerRef.current ?? {
					clientX: dragState.startX + recordingHudOffsetRef.current.x - dragState.originX,
					clientY: dragState.startY + recordingHudOffsetRef.current.y - dragState.originY,
				};
			const deltaX = pointer.clientX - dragState.startX;
			const deltaY = pointer.clientY - dragState.startY;
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			const clampedLeft = Math.min(
				Math.max(0, dragState.initialLeft + deltaX),
				Math.max(0, viewportWidth - dragState.hudWidth),
			);
			const clampedTop = Math.min(
				Math.max(0, dragState.initialTop + deltaY),
				Math.max(0, viewportHeight - dragState.hudHeight),
			);

			recordingHudOffsetRef.current = {
				x: dragState.originX + (clampedLeft - dragState.initialLeft),
				y: dragState.originY + (clampedTop - dragState.initialTop),
			};
			if (hudBarTransformRef.current) {
				const { x, y } = recordingHudOffsetRef.current;
				hudBarTransformRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
			}

			if (hudDragMoveRafRef.current !== null) {
				cancelAnimationFrame(hudDragMoveRafRef.current);
				hudDragMoveRafRef.current = null;
			}
			hudDragPendingPointerRef.current = null;

			hudDragStartRef.current = null;
			const wasDragging = isHudDraggingRef.current;
			isHudDraggingRef.current = false;
			setRecordingHudOffset({ ...recordingHudOffsetRef.current });
			setIsHudDragging(false);
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			const hudBounds = mergeHudInteractiveBounds(
				[
					hudContentRef.current?.getBoundingClientRect(),
					hudBarRef.current?.getBoundingClientRect(),
					recordingWebcamPreviewContainerRef.current?.getBoundingClientRect(),
				].map((bounds) =>
					bounds
						? {
								left: bounds.left,
								top: bounds.top,
								right: bounds.right,
								bottom: bounds.bottom,
							}
						: null,
				),
			);
			if (
				wasDragging &&
				shouldRestoreHudMousePassthroughAfterDrag(hudBounds, event.clientX, event.clientY)
			) {
				window.electronAPI?.hudOverlaySetIgnoreMouse?.(true);
			}
		},
		[hudBarRef, hudContentRef, recordingWebcamPreviewContainerRef],
	);

	const handleHudBarKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
		const directions: Record<string, { x: number; y: number }> = {
			ArrowLeft: { x: -1, y: 0 },
			ArrowRight: { x: 1, y: 0 },
			ArrowUp: { x: 0, y: -1 },
			ArrowDown: { x: 0, y: 1 },
		};
		const direction = directions[event.key];
		if (!direction || !hudBarRef.current || isHudDraggingRef.current) return;
		event.preventDefault();
		const step = event.shiftKey ? 40 : 10;
		const dx = direction.x * step;
		const dy = direction.y * step;
		const bounds = hudBarRef.current.getBoundingClientRect();
		const nextOffset = clampHudOffsetToViewport(
			{ x: recordingHudOffsetRef.current.x + dx, y: recordingHudOffsetRef.current.y + dy },
			{ left: bounds.left + dx, right: bounds.right + dx, top: bounds.top + dy, bottom: bounds.bottom + dy },
			{ width: window.innerWidth, height: window.innerHeight },
		);
		recordingHudOffsetRef.current = nextOffset;
		if (hudBarTransformRef.current) {
			hudBarTransformRef.current.style.transform = `translate3d(${nextOffset.x}px, ${nextOffset.y}px, 0)`;
		}
		setRecordingHudOffset(nextOffset);
	}, [hudBarRef]);

	useEffect(() => {
		return () => {
			if (hudDragMoveRafRef.current !== null) {
				cancelAnimationFrame(hudDragMoveRafRef.current);
			}
			hudDragMoveRafRef.current = null;
			hudDragPendingPointerRef.current = null;
			hudDragStartRef.current = null;
		};
	}, []);

	return {
		recordingHudOffset,
		isHudDragging,
		hudBarTransformRef,
		isHudDraggingRef,
		handleHudBarPointerDown,
		handleHudBarPointerMove,
		handleHudBarPointerUp,
		handleHudBarLostPointerCapture: handleHudBarPointerUp,
		handleHudBarKeyDown,
	};
}
