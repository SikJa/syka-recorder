import type { CapturePickerWindow, SelectedSource } from "../ipc/types";

/** What the capture picker can offer; injected so the rules stay testable. */
export type CaptureSourceDeps = {
	/** Screens with the names the app's own source list shows. */
	displays(): Promise<
		{ id: number; name: string; primary: boolean; width: number; height: number }[]
	>;
	windows(): Promise<CapturePickerWindow[]>;
	screenSource(displayId: number): Promise<SelectedSource | null>;
	windowSource(window: CapturePickerWindow): SelectedSource;
	validate(source: SelectedSource): Promise<SelectedSource | null>;
	apply(source: SelectedSource): void;
	busy(): boolean;
	current(): SelectedSource | null;
};

const SCREEN_PREFIX = "display:";

export async function listCaptureSources(deps: CaptureSourceDeps) {
	const current = deps.current();
	const displays = await deps.displays();
	// Same window list as the picker; an empty list is not an error.
	const windows = await deps.windows().catch(() => []);
	return {
		selected: current
			? { id: current.id ?? null, name: current.name, type: current.sourceType ?? null }
			: null,
		screens: displays.map((display) => ({
			id: `${SCREEN_PREFIX}${display.id}`,
			name: display.name,
			primary: display.primary,
			width: display.width,
			height: display.height,
		})),
		windows: windows.map((window) => ({
			id: window.id,
			app: window.appName,
			title: window.title,
		})),
	};
}

/** Selects a screen (`display:<id>`) or window (`window:...`) for the next recording. */
export async function selectCaptureSource(deps: CaptureSourceDeps, id: string) {
	if (deps.busy()) throw new Error("Stop the recording before changing the capture source.");
	let source: SelectedSource | null = null;
	if (id.startsWith(SCREEN_PREFIX)) {
		const displayId = Number(id.slice(SCREEN_PREFIX.length));
		if (!Number.isFinite(displayId) || !(await deps.displays()).some((d) => d.id === displayId))
			throw new Error(`No screen with id ${id}. Call list_sources for the current ids.`);
		source = await deps.screenSource(displayId);
	} else {
		const window = (await deps.windows()).find((entry) => entry.id === id);
		if (!window)
			throw new Error(
				`No open window with id ${id}. It may have closed; call list_sources again.`,
			);
		source = deps.windowSource(window);
	}
	const validated = source ? await deps.validate(source) : null;
	if (!validated) throw new Error("That window or screen is no longer available.");
	// The recording may have started while the source was being resolved.
	if (deps.busy()) throw new Error("Stop the recording before changing the capture source.");
	deps.apply(validated);
	return {
		id: validated.id ?? null,
		name: validated.name,
		type: validated.sourceType ?? null,
	};
}
