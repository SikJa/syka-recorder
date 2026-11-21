import { describe, expect, it, vi } from "vitest";
import type { CapturePickerWindow, SelectedSource } from "../ipc/types";
import { type CaptureSourceDeps, listCaptureSources, selectCaptureSource } from "./captureSources";

const browser: CapturePickerWindow = {
	id: "window:4242:0",
	appName: "Brave",
	title: "Zernio",
	x: 0,
	y: 0,
	width: 800,
	height: 600,
};

function deps(overrides: Partial<CaptureSourceDeps> = {}): CaptureSourceDeps & {
	applied: SelectedSource[];
} {
	const applied: SelectedSource[] = [];
	return {
		applied,
		displays: async () => [
			{ id: 10, name: "Screen 1 (Primary)", primary: true, width: 1366, height: 768 },
			{ id: 20, name: "Screen 2", primary: false, width: 768, height: 1366 },
		],
		windows: async () => [browser],
		screenSource: async (id) => ({
			id: `screen:${id}:0`,
			name: `Screen ${id}`,
			sourceType: "screen",
		}),
		windowSource: (window) => ({ id: window.id, name: window.title, sourceType: "window" }),
		validate: async (source) => source,
		apply: (source) => applied.push(source),
		busy: () => false,
		current: () => null,
		...overrides,
	};
}

describe("MCP capture sources", () => {
	it("lists screens and windows with ids select_source accepts", async () => {
		const result = await listCaptureSources(deps());
		expect(result.screens).toEqual([
			{
				id: "display:10",
				name: "Screen 1 (Primary)",
				primary: true,
				width: 1366,
				height: 768,
			},
			{ id: "display:20", name: "Screen 2", primary: false, width: 768, height: 1366 },
		]);
		expect(result.windows).toEqual([{ id: "window:4242:0", app: "Brave", title: "Zernio" }]);
		expect(result.selected).toBeNull();
	});
	it("still lists screens when windows cannot be read", async () => {
		const result = await listCaptureSources(
			deps({ windows: () => Promise.reject(new Error("denied")) }),
		);
		expect(result.screens).toHaveLength(2);
		expect(result.windows).toEqual([]);
	});
	it("selects a screen or a window like the picker", async () => {
		const d = deps();
		expect(await selectCaptureSource(d, "display:20")).toEqual({
			id: "screen:20:0",
			name: "Screen 20",
			type: "screen",
		});
		await selectCaptureSource(d, "window:4242:0");
		expect(d.applied.map((source) => source.id)).toEqual(["screen:20:0", "window:4242:0"]);
	});
	it("explains unknown ids and gone sources without changing the selection", async () => {
		const d = deps({ validate: async () => null });
		await expect(selectCaptureSource(d, "display:99")).rejects.toThrow("list_sources");
		await expect(selectCaptureSource(d, "window:1:0")).rejects.toThrow("may have closed");
		await expect(selectCaptureSource(d, "display:10")).rejects.toThrow("no longer available");
		expect(d.applied).toEqual([]);
	});
	it("never changes the source while recording, even if it starts mid-selection", async () => {
		await expect(selectCaptureSource(deps({ busy: () => true }), "display:10")).rejects.toThrow(
			"Stop the recording",
		);
		let recording = false;
		const d = deps({
			busy: () => recording,
			screenSource: vi.fn(async () => {
				recording = true;
				return { id: "screen:10:0", name: "Screen 1", sourceType: "screen" as const };
			}),
		});
		await expect(selectCaptureSource(d, "display:10")).rejects.toThrow("Stop the recording");
		expect(d.applied).toEqual([]);
	});
});
