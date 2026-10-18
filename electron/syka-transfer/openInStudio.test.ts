import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ message: vi.fn(), picker: vi.fn(), external: vi.fn(), validate: vi.fn() }));
vi.mock("electron", () => ({ app: { getPath: () => "C:\\Recorder\\Recorder.exe" }, BrowserWindow: {}, dialog: { showMessageBox: mocks.message, showOpenDialog: mocks.picker }, shell: { openExternal: mocks.external } }));
vi.mock("node:child_process", () => ({ execFile: (_file: string, _args: string[], _opts: unknown, done: (error: Error) => void) => done(new Error("not running")) }));
vi.mock("../appSettingsStore", () => ({ readAppSetting: () => null, writeAppSetting: vi.fn() }));
vi.mock("./studioInstallation", () => ({ studioInstallation: async () => null, installedStudioCandidates: async () => [] }));
vi.mock("./validateStudioProject", () => ({ validateStudioProject: mocks.validate }));
import { openInStudio, STUDIO_DOWNLOAD_URL } from "./openInStudio";
beforeEach(() => vi.clearAllMocks());
it("offers download without losing the saved project or opening an executable picker", async () => {
	mocks.message.mockResolvedValue({ response: 0 });
	expect(await openInStudio("C:\\Projects\\Demo", null)).toEqual({ success: false, canceled: true });
	expect(mocks.external).toHaveBeenCalledWith(STUDIO_DOWNLOAD_URL);
	expect(mocks.picker).not.toHaveBeenCalled();
	expect(mocks.message.mock.calls[0][0].detail).toContain("ya está guardado");
});
it("does nothing external when the user chooses later", async () => {
	mocks.message.mockResolvedValue({ response: 2 });
	await openInStudio("C:\\Projects\\Demo", null);
	expect(mocks.external).not.toHaveBeenCalled();
	expect(mocks.picker).not.toHaveBeenCalled();
});
it("offers a picker only when the user chooses to locate an installation", async () => {
	mocks.message.mockResolvedValue({ response: 1 }); mocks.picker.mockResolvedValue({ canceled: true });
	await openInStudio("C:\\Projects\\Demo", null);
	expect(mocks.picker).toHaveBeenCalledOnce();
	expect(mocks.external).not.toHaveBeenCalled();
});
