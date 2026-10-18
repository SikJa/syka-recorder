import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
	listeners: new Map<string, (...args: unknown[]) => void>(),
	quitAndInstall: vi.fn(), showMessageBox: vi.fn(async () => ({ response: 0 })),
	checkForUpdates: vi.fn(async () => null), downloadUpdate: vi.fn(async () => []),
}));
vi.mock("electron", () => ({
	app: { getVersion: () => "1.4.0", isPackaged: true, on: vi.fn() },
	BrowserWindow: {}, dialog: { showMessageBox: mocks.showMessageBox },
}));
vi.mock("node:fs", () => ({ default: { mkdirSync: vi.fn(), appendFileSync: vi.fn() } }));
vi.mock("./appPaths", () => ({ USER_DATA_PATH: "/qa" }));
vi.mock("./appSettingsStore", () => ({ writeAppSetting: vi.fn() }));
vi.mock("electron-updater", () => ({ autoUpdater: {
	on: (name: string, callback: (...args: unknown[]) => void) => mocks.listeners.set(name, callback),
	quitAndInstall: mocks.quitAndInstall, setFeedURL: vi.fn(),
	checkForUpdates: mocks.checkForUpdates, downloadUpdate: mocks.downloadUpdate,
} }));
afterEach(() => { vi.useRealTimers(); vi.resetModules(); vi.clearAllMocks(); mocks.listeners.clear(); });
it("notifies without downloading or restarting, then protects active work at install time", async () => {
	vi.useFakeTimers();
	const updater = await import("./updater");
	const send = vi.fn(() => true);
	let blocked: string | null = "Terminá la grabación.";
	updater.setupAutoUpdates(() => null, send, () => blocked);
	expect(updater.isAutoUpdateFeatureEnabled()).toBe(true);
	expect(updater.getExperimentalUpdatesEnabled()).toBe(false);
	mocks.listeners.get("update-available")!({ version: "1.4.1" });
	expect(mocks.downloadUpdate).not.toHaveBeenCalled();
	expect(mocks.quitAndInstall).not.toHaveBeenCalled();
	mocks.listeners.get("update-downloaded")!({ version: "1.4.1" });
	updater.installDownloadedUpdateNow(send);
	expect(mocks.quitAndInstall).not.toHaveBeenCalled();
	expect(mocks.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({ message: blocked }));
	blocked = null;
	updater.installDownloadedUpdateNow(send);
	expect(mocks.quitAndInstall).toHaveBeenCalledOnce();
});
it("never invokes the installer before a download is ready", async () => {
	const updater = await import("./updater");
	updater.installDownloadedUpdateNow();
	expect(mocks.quitAndInstall).not.toHaveBeenCalled();
});
