import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireSharedWebcamStream } from "./sharedWebcamStream";

afterEach(() => vi.unstubAllGlobals());

function camera(deviceId: string) {
	const stop = vi.fn();
	const track = { stop, getSettings: () => ({ deviceId }) };
	const stream = {
		getVideoTracks: () => [track],
		getTracks: () => [track],
	} as unknown as MediaStream;
	return { stream, stop };
}

function setup(getUserMedia: ReturnType<typeof vi.fn>) {
	vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
}

describe("shared webcam", () => {
	it("opens one camera for preview and recorder and retains it until both stop", async () => {
		const device = camera("shared");
		const getUserMedia = vi.fn().mockResolvedValue(device.stream);
		setup(getUserMedia);
		const preview = acquireSharedWebcamStream("shared");
		const recorder = acquireSharedWebcamStream("shared");
		await Promise.all([preview.stream, recorder.stream]);
		expect(getUserMedia).toHaveBeenCalledTimes(1);
		preview.release();
		preview.release(); // Effect cleanup must not release the recorder's lease.
		await Promise.resolve();
		expect(device.stop).not.toHaveBeenCalled();
		recorder.release();
		await Promise.resolve();
		expect(device.stop).toHaveBeenCalledTimes(1);
	});

	it("reuses a pending camera request across an unmount and remount", async () => {
		const device = camera("pending");
		let resolve!: (stream: MediaStream) => void;
		const getUserMedia = vi.fn(
			() =>
				new Promise<MediaStream>((done) => {
					resolve = done;
				}),
		);
		setup(getUserMedia);
		const first = acquireSharedWebcamStream("pending");
		first.release();
		const next = acquireSharedWebcamStream("pending");
		resolve(device.stream);
		await next.stream;
		expect(getUserMedia).toHaveBeenCalledTimes(1);
		expect(device.stop).not.toHaveBeenCalled();
		next.release();
		await Promise.resolve();
		expect(device.stop).toHaveBeenCalledTimes(1);
	});

	it("stops a camera that resolves after its only consumer was canceled", async () => {
		const device = camera("canceled");
		setup(vi.fn().mockResolvedValue(device.stream));
		const lease = acquireSharedWebcamStream("canceled");
		lease.release();
		await lease.stream;
		expect(device.stop).toHaveBeenCalledTimes(1);
	});

	it("retries after a failed camera acquisition", async () => {
		const device = camera("retry");
		const getUserMedia = vi
			.fn()
			.mockRejectedValueOnce(new Error("disconnected"))
			.mockResolvedValue(device.stream);
		setup(getUserMedia);
		const failed = acquireSharedWebcamStream("retry");
		await expect(failed.stream).rejects.toThrow("disconnected");
		failed.release();
		const next = acquireSharedWebcamStream("retry");
		await next.stream;
		expect(getUserMedia).toHaveBeenCalledTimes(2);
		next.release();
		await Promise.resolve();
	});

	it("matches the camera opened by a default permission probe to its resolved device", async () => {
		const device = camera("resolved");
		const getUserMedia = vi.fn().mockResolvedValue(device.stream);
		setup(getUserMedia);
		const probe = acquireSharedWebcamStream();
		await probe.stream;
		const preview = acquireSharedWebcamStream("resolved");
		expect(getUserMedia).toHaveBeenCalledTimes(1);
		probe.release();
		preview.release();
		await Promise.resolve();
	});
});
