import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { McpBridgeRequest } from "../../src/lib/mcpBridge/contract";
import { type BridgeTarget, RendererBridge } from "./rendererBridge";

function fakeWindow(id = 1) {
	const sent: McpBridgeRequest[] = [];
	let destroyed = false;
	const target: BridgeTarget = {
		id,
		isDestroyed: () => destroyed,
		send: (_channel, payload) => {
			sent.push(payload);
		},
	};
	return {
		target,
		sent,
		destroy: () => {
			destroyed = true;
		},
	};
}

describe("RendererBridge", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("resolves with the renderer's result", async () => {
		const bridge = new RendererBridge();
		const window = fakeWindow();
		bridge.announce(1, ["recorder.state"]);
		const pending = bridge.request(window.target, "recorder.state", undefined);
		await vi.advanceTimersByTimeAsync(0);
		expect(window.sent).toHaveLength(1);
		bridge.reply(1, { id: window.sent[0].id, kind: "result", ok: true, result: { recording: false } });
		await expect(pending).resolves.toEqual({ recording: false });
	});

	it("rejects with the renderer's error message", async () => {
		const bridge = new RendererBridge();
		const window = fakeWindow();
		bridge.announce(1, ["recorder.stop"]);
		const pending = bridge.request(window.target, "recorder.stop", undefined);
		await vi.advanceTimersByTimeAsync(0);
		bridge.reply(1, { id: window.sent[0].id, kind: "result", ok: false, error: "Nothing is recording." });
		await expect(pending).rejects.toThrow("Nothing is recording.");
	});

	it("times out when the window never answers", async () => {
		const bridge = new RendererBridge();
		const window = fakeWindow();
		bridge.announce(1, ["recorder.state"]);
		const pending = bridge.request(window.target, "recorder.state", undefined, { timeoutMs: 1_000 });
		const assertion = expect(pending).rejects.toThrow(/did not answer recorder\.state/);
		await vi.advanceTimersByTimeAsync(1_001);
		await assertion;
		// A late reply is ignored.
		bridge.reply(1, { id: window.sent[0].id, kind: "result", ok: true, result: {} });
	});

	it("restarts the timeout on progress and forwards it", async () => {
		const bridge = new RendererBridge();
		const window = fakeWindow();
		const progress = vi.fn();
		bridge.announce(1, ["editor.export_mp4"]);
		const pending = bridge.request(
			window.target,
			"editor.export_mp4",
			{ outputPath: "C:\\out.mp4", quality: "good", fps: 30, encodingMode: "balanced" },
			{ timeoutMs: 1_000, onProgress: progress },
		);
		await vi.advanceTimersByTimeAsync(0);
		const id = window.sent[0].id;
		for (let step = 1; step <= 3; step++) {
			await vi.advanceTimersByTimeAsync(800);
			bridge.reply(1, { id, kind: "progress", progress: { percentage: step * 25 } });
		}
		expect(progress).toHaveBeenCalledTimes(3);
		bridge.reply(1, { id, kind: "result", ok: true, result: { path: "C:\\out.mp4" } });
		await expect(pending).resolves.toEqual({ path: "C:\\out.mp4" });
	});

	it("ignores replies from another window", async () => {
		const bridge = new RendererBridge();
		const window = fakeWindow(1);
		bridge.announce(1, ["recorder.state"]);
		const pending = bridge.request(window.target, "recorder.state", undefined, { timeoutMs: 1_000 });
		const assertion = expect(pending).rejects.toThrow(/did not answer/);
		await vi.advanceTimersByTimeAsync(0);
		bridge.reply(2, { id: window.sent[0].id, kind: "result", ok: true, result: "forged" });
		bridge.reply(1, null);
		bridge.reply(1, { id: 42 });
		await vi.advanceTimersByTimeAsync(1_001);
		await assertion;
	});

	it("waits for a loading window to announce the command", async () => {
		const bridge = new RendererBridge();
		const window = fakeWindow();
		const pending = bridge.request(window.target, "editor.state", undefined);
		await vi.advanceTimersByTimeAsync(500);
		expect(window.sent).toHaveLength(0);
		bridge.announce(1, ["editor.state"]);
		await vi.advanceTimersByTimeAsync(0);
		expect(window.sent).toHaveLength(1);
		bridge.reply(1, { id: window.sent[0].id, kind: "result", ok: true, result: "ready" });
		await expect(pending).resolves.toBe("ready");
	});

	it("fails when the window never becomes ready", async () => {
		const bridge = new RendererBridge();
		const window = fakeWindow();
		bridge.announce(1, ["recorder.state"]);
		const pending = bridge.request(window.target, "editor.state", undefined, { readyTimeoutMs: 2_000 });
		const assertion = expect(pending).rejects.toThrow(/did not become ready for editor\.state/);
		await vi.advanceTimersByTimeAsync(2_001);
		await assertion;
		expect(window.sent).toHaveLength(0);
	});

	it("fails pending requests when the window reloads or closes", async () => {
		const bridge = new RendererBridge();
		const window = fakeWindow();
		bridge.announce(1, ["recorder.stop"]);
		const pending = bridge.request(window.target, "recorder.stop", undefined);
		await vi.advanceTimersByTimeAsync(0);
		bridge.forget(1, "The window reloaded before answering.");
		await expect(pending).rejects.toThrow("The window reloaded before answering.");
		expect(bridge.supports(1, "recorder.stop")).toBe(false);
	});

	it("does not send to a destroyed window", async () => {
		const bridge = new RendererBridge();
		const window = fakeWindow();
		bridge.announce(1, ["recorder.state"]);
		window.destroy();
		await expect(bridge.request(window.target, "recorder.state", undefined)).rejects.toThrow(
			"The window is closed.",
		);
		expect(window.sent).toHaveLength(0);
	});

	it("honors cancellation", async () => {
		const bridge = new RendererBridge();
		const window = fakeWindow();
		const controller = new AbortController();
		bridge.announce(1, ["recorder.state"]);
		const pending = bridge.request(window.target, "recorder.state", undefined, {
			signal: controller.signal,
		});
		await vi.advanceTimersByTimeAsync(0);
		controller.abort();
		await expect(pending).rejects.toThrow("The request was canceled.");
	});

	it("stops announcing when a window sends an empty list", () => {
		const bridge = new RendererBridge();
		bridge.announce(1, ["recorder.state", 3]);
		expect(bridge.supports(1, "recorder.state")).toBe(true);
		bridge.announce(1, []);
		expect(bridge.supports(1, "recorder.state")).toBe(false);
	});
});
