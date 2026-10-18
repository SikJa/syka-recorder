import { expect, it } from "vitest";
import { shouldGrantEditorFullscreen } from "./permissionPolicy";
it("grants fullscreen to the local editor main frame only", () => {
	const base = ["http://127.0.0.1:1234/", "file:///app/index.html"];
	expect(shouldGrantEditorFullscreen("http://127.0.0.1:1234/?windowType=editor", true, base)).toBe(true);
	expect(shouldGrantEditorFullscreen("file:///app/index.html?windowType=editor", true, base)).toBe(true);
	expect(shouldGrantEditorFullscreen("file:///app/index.html?windowType=editor&devOpenInput=demo.mp4", true, base)).toBe(true);
	expect(shouldGrantEditorFullscreen("https://example.com/?windowType=editor", true, base)).toBe(false);
	expect(shouldGrantEditorFullscreen("http://127.0.0.1:1234/?windowType=hud-overlay", true, base)).toBe(false);
	expect(shouldGrantEditorFullscreen("http://127.0.0.1:1234/?windowType=editor", false, base)).toBe(false);
});
