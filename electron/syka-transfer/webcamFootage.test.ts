import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { needsPreparedWebcam, prepareWebcamFootage, webcamFootageArgs } from "./webcamFootage";

const run = promisify(execFile);
const ffmpeg: string = createRequire(import.meta.url)("ffmpeg-static");
const full = { x: 0, y: 0, width: 1, height: 1 };
const temporary: string[] = [];
afterEach(async () => {
	for (const dir of temporary.splice(0)) await rm(dir, { recursive: true, force: true });
});

/** Average RGB of the left and right halves of the first frame. */
async function halves(file: string) {
	const { stdout } = await run(
		ffmpeg,
		[
			"-v",
			"error",
			"-i",
			file,
			"-frames:v",
			"1",
			"-vf",
			"format=rgb24,scale=2:1:flags=area",
			"-f",
			"rawvideo",
			"-pix_fmt",
			"rgb24",
			"-",
		],
		{ encoding: "buffer" },
	);
	return { left: [...stdout.subarray(0, 3)], right: [...stdout.subarray(3, 6)] };
}

describe("Studio webcam footage", () => {
	it("leaves an uncropped, unmirrored recording as it is", () => {
		expect(needsPreparedWebcam({ crop: full, mirror: false })).toBe(false);
		expect(needsPreparedWebcam({ crop: full, mirror: true })).toBe(true);
		expect(needsPreparedWebcam({ crop: { ...full, width: 0.5 }, mirror: false })).toBe(true);
	});
	it("keeps source timestamps and drops audio", () => {
		const args = webcamFootageArgs("in.webm", "out.mp4", { crop: full, mirror: true });
		expect(args.join(" ")).toContain("-fps_mode passthrough");
		expect(args).toContain("-an");
		expect(args[args.indexOf("-vf") + 1]).toBe("hflip,format=yuv420p");
	});
	it("bakes Recorder's crop and mirror into the pixels", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "syka-webcam-footage-"));
		temporary.push(root);
		const source = path.join(root, "camera.mp4");
		// Red on the left half, blue on the right.
		await run(ffmpeg, [
			"-v",
			"error",
			"-f",
			"lavfi",
			"-i",
			"color=c=red:s=128x64:d=0.5",
			"-f",
			"lavfi",
			"-i",
			"color=c=blue:s=128x64:d=0.5",
			"-filter_complex",
			"[0][1]overlay=x=64",
			"-c:v",
			"libx264",
			"-pix_fmt",
			"yuv420p",
			source,
		]);
		const mirrored = path.join(root, "mirrored.mp4");
		await prepareWebcamFootage({
			ffmpegPath: ffmpeg,
			inputPath: source,
			outputPath: mirrored,
			webcam: { crop: full, mirror: true },
		});
		const flipped = await halves(mirrored);
		expect(flipped.left[2]).toBeGreaterThan(200);
		expect(flipped.right[0]).toBeGreaterThan(200);

		const cropped = path.join(root, "cropped.mp4");
		await prepareWebcamFootage({
			ffmpegPath: ffmpeg,
			inputPath: source,
			outputPath: cropped,
			webcam: { crop: { x: 0.5, y: 0, width: 0.5, height: 1 }, mirror: false },
		});
		const right = await halves(cropped);
		expect(right.left[2]).toBeGreaterThan(200);
		expect(right.right[2]).toBeGreaterThan(200);
		const { stderr } = await run(ffmpeg, ["-hide_banner", "-i", cropped], {
			encoding: "utf8",
		}).catch((error) => error);
		expect(stderr).toMatch(/64x64/);
	});
	it("stops FFmpeg when the transfer is cancelled", async () => {
		const controller = new AbortController();
		controller.abort(new Error("cancelled"));
		await expect(
			prepareWebcamFootage({
				ffmpegPath: ffmpeg,
				inputPath: "missing.mp4",
				outputPath: "out.mp4",
				webcam: { crop: full, mirror: true },
				signal: controller.signal,
			}),
		).rejects.toThrow("cancelled");
	});
});
