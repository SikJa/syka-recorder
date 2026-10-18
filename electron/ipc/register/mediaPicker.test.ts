import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
	open: vi.fn(),
	loadProject: vi.fn(),
	approve: vi.fn(),
	clearProject: vi.fn(),
}));
vi.mock("electron", () => ({
	dialog: { showOpenDialog: mocks.open },
	ipcMain: { handle: (name: string, handler: (...args: unknown[]) => Promise<unknown>) => mocks.handlers.set(name, handler) },
}));
vi.mock("../constants", () => ({ PROJECT_FILE_EXTENSION: "recordly", LEGACY_PROJECT_FILE_EXTENSIONS: [] }));
vi.mock("../project/manager", () => ({
	hasProjectFileExtension: (value: string) => value.endsWith(".recordly"),
	loadProjectFromPath: mocks.loadProject,
}));
vi.mock("../state", () => ({ setCurrentProjectPath: mocks.clearProject }));
vi.mock("../utils", () => ({ approveUserPath: mocks.approve, getRecordingsDir: async () => "B:/recordings" }));

import { registerMediaPickerHandlers } from "./mediaPicker";

beforeEach(() => {
	vi.clearAllMocks();
	mocks.handlers.clear();
	registerMediaPickerHandlers();
});

it("keeps the active project trusted when picking a background or webcam video", async () => {
	mocks.open.mockResolvedValue({ canceled: false, filePaths: ["B:/background.mp4"] });
	const result = await mocks.handlers.get("open-video-file-picker")!({});
	expect(result).toMatchObject({ success: true, kind: "media", path: "B:/background.mp4" });
	expect(mocks.approve).toHaveBeenCalledWith("B:/background.mp4");
	expect(mocks.clearProject).not.toHaveBeenCalled();
	expect(mocks.loadProject).not.toHaveBeenCalled();
});

it("loads an explicitly selected project through the project loader", async () => {
	mocks.open.mockResolvedValue({ canceled: false, filePaths: ["B:/edit.recordly"] });
	mocks.loadProject.mockResolvedValue({ success: true, path: "B:/edit.recordly", project: { version: 2 } });
	const result = await mocks.handlers.get("open-video-file-picker")!({}, { includeProjects: true });
	expect(result).toMatchObject({ success: true, kind: "project" });
	expect(mocks.loadProject).toHaveBeenCalledWith("B:/edit.recordly");
});

it("leaves the project and approved paths unchanged when the picker is canceled", async () => {
	mocks.open.mockResolvedValue({ canceled: true, filePaths: [] });
	expect(await mocks.handlers.get("open-video-file-picker")!({})).toEqual({ success: false, canceled: true });
	expect(mocks.approve).not.toHaveBeenCalled();
	expect(mocks.clearProject).not.toHaveBeenCalled();
});
