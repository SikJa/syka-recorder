import { expect, it, vi } from "vitest";
import { useAutoCaptionController } from "./useAutoCaptionController";

vi.mock("react", () => ({
	useCallback: (callback: unknown) => callback,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ toast }));
const editing = vi.hoisted(() => ({
	updateCaptionCuesForEditedTarget: vi.fn(() => [{ id: "edited" }]),
}));
vi.mock("../captionEditing", () => editing);

// Syka Recorder no longer generates captions; projects that already have cues stay editable.
it("saves an edit to existing caption cues without running Whisper", () => {
	const existing = [{ id: "cue-1", startMs: 0, endMs: 1000, text: "Hello" }];
	let captions: unknown = existing;
	const setAutoCaptions = vi.fn((update: unknown) => {
		captions = typeof update === "function" ? update(captions) : update;
	});
	const target = { words: [] };
	const controller = useAutoCaptionController({
		t: (key: string, fallback?: string) => fallback ?? key,
		setAutoCaptions,
	} as unknown as Parameters<typeof useAutoCaptionController>[0]);

	controller.handleSaveAutoCaptionEdit(target as never, "Hola");

	expect(editing.updateCaptionCuesForEditedTarget).toHaveBeenCalledWith(existing, target, "Hola");
	expect(captions).toEqual([{ id: "edited" }]);
	expect(toast.success).toHaveBeenCalledWith("Caption updated");
});
