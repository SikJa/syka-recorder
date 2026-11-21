import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "@/styles/transitions.css";

/** Reads a duration such as `--dropdown-close-dur` from the stylesheet, in ms.
 * The production CSS minifier writes 150ms as `.15s`, so both units count. */
export function cssDuration(name: string, fallback: number) {
	if (typeof document === "undefined") return fallback;
	return parseCssDuration(
		getComputedStyle(document.documentElement).getPropertyValue(name),
		fallback,
	);
}

export function parseCssDuration(raw: string, fallback: number) {
	const value = raw.trim();
	const amount = parseFloat(value);
	if (!Number.isFinite(amount)) return fallback;
	return value.endsWith("ms") ? amount : value.endsWith("s") ? amount * 1000 : amount;
}

/**
 * Keeps a `.t-dropdown` surface mounted while it closes. Returns whether to
 * render it and the class for its state: mounted at rest, `is-open` one
 * frame later (so the open transitions), `is-closing` until it has faded.
 */
export function useDropdownPresence(open: boolean) {
	const [mounted, setMounted] = useState(open);
	const [state, setState] = useState<"" | "is-open" | "is-closing">(open ? "is-open" : "");
	useEffect(() => {
		if (open) {
			setMounted(true);
			const frame = requestAnimationFrame(() =>
				requestAnimationFrame(() => setState("is-open")),
			);
			return () => cancelAnimationFrame(frame);
		}
		setState((current) => (current === "is-open" ? "is-closing" : current));
		const timer = window.setTimeout(
			() => {
				setMounted(false);
				setState("");
			},
			cssDuration("--dropdown-close-dur", 150),
		);
		return () => window.clearTimeout(timer);
	}, [open]);
	return { mounted, className: `t-dropdown ${state}`.trim() };
}

/** True from the frame after mount, to start `.is-shown` / `data-state="in"` reveals. */
export function useShownAfterMount() {
	const [shown, setShown] = useState(false);
	useEffect(() => {
		const frame = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
		return () => cancelAnimationFrame(frame);
	}, []);
	return shown;
}

/** A label that swaps in place with the kit's text-states transition. */
export function TextSwap({ text, className }: { text: string; className?: string }) {
	const [shown, setShown] = useState(text);
	const ref = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		const element = ref.current;
		if (!element || text === shown) return;
		element.classList.add("is-exit");
		const timer = window.setTimeout(
			() => {
				// Park below without a transition; the new text rises once rendered.
				element.classList.remove("is-exit");
				element.classList.add("is-enter-start");
				setShown(text);
			},
			cssDuration("--text-swap-dur", 150),
		);
		return () => window.clearTimeout(timer);
	}, [text, shown]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Runs once the new text is rendered.
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element?.classList.contains("is-enter-start")) return;
		void element.offsetHeight;
		element.classList.remove("is-enter-start");
	}, [shown]);
	return (
		<span ref={ref} className={`t-text-swap ${className ?? ""}`.trim()}>
			{shown}
		</span>
	);
}

/** Animated check for a finished action (transitions-dev success check). */
export function SuccessCheck({ className }: { className?: string }) {
	const shown = useShownAfterMount();
	return (
		<span
			className={`t-success-check ${className ?? ""}`.trim()}
			data-state={shown ? "in" : "out"}
			aria-hidden="true"
		>
			<svg viewBox="0 0 24 24" width="20" height="20" fill="none">
				<circle cx="12" cy="12" r="11" fill="var(--success, #22c55e)" opacity="0.18" />
				<path
					d="M7 12.5l3.2 3.2L17 9"
					stroke="var(--success, #22c55e)"
					strokeWidth="2.2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</span>
	);
}
