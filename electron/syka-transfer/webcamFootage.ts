import { spawn } from "node:child_process";
import type { TransferPlan } from "../../src/lib/sykaExport/contract";

type Crop = NonNullable<TransferPlan["webcam"]>["crop"];

const EPSILON = 0.0005;

export function isFullFrameCrop(crop: Crop): boolean {
	return (
		Math.abs(crop.x) < EPSILON &&
		Math.abs(crop.y) < EPSILON &&
		Math.abs(crop.width - 1) < EPSILON &&
		Math.abs(crop.height - 1) < EPSILON
	);
}

/** Whether the recording can be placed in Studio as it is. */
export function needsPreparedWebcam(webcam: { crop: Crop; mirror: boolean }): boolean {
	return webcam.mirror || !isFullFrameCrop(webcam.crop);
}

const fraction = (value: number) => Number(Math.min(1, Math.max(0, value)).toFixed(6));

/**
 * Studio covers a video's box from its centre and has no crop or flip that
 * survives in the project file. Baking Recorder's crop and mirror into the
 * footage keeps the camera one plain video there, with the same framing.
 */
export function webcamFootageArgs(
	inputPath: string,
	outputPath: string,
	webcam: { crop: Crop; mirror: boolean },
): string[] {
	const filters: string[] = [];
	if (!isFullFrameCrop(webcam.crop)) {
		const { x, y, width, height } = webcam.crop;
		filters.push(
			`crop=w=trunc(iw*${fraction(width)}/2)*2:h=trunc(ih*${fraction(height)}/2)*2:x=trunc(iw*${fraction(x)}):y=trunc(ih*${fraction(y)})`,
		);
	}
	if (webcam.mirror) filters.push("hflip");
	filters.push("format=yuv420p");
	return [
		"-hide_banner",
		"-nostdin",
		"-y",
		"-i",
		inputPath,
		"-map",
		"0:v:0",
		"-vf",
		filters.join(","),
		// Keep every source timestamp so the camera stays in sync with the screen.
		"-fps_mode",
		"passthrough",
		"-c:v",
		"libx264",
		"-preset",
		"veryfast",
		"-crf",
		"16",
		"-an",
		"-sn",
		"-dn",
		"-movflags",
		"+faststart",
		outputPath,
	];
}

export async function prepareWebcamFootage(options: {
	ffmpegPath: string;
	inputPath: string;
	outputPath: string;
	webcam: { crop: Crop; mirror: boolean };
	signal?: AbortSignal;
}): Promise<void> {
	options.signal?.throwIfAborted();
	await new Promise<void>((resolve, reject) => {
		const child = spawn(
			options.ffmpegPath,
			webcamFootageArgs(options.inputPath, options.outputPath, options.webcam),
			{ windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
		);
		let stderr = "";
		child.stderr.on("data", (chunk: Buffer) => {
			stderr = (stderr + chunk.toString()).slice(-4000);
		});
		const abort = () => child.kill();
		options.signal?.addEventListener("abort", abort, { once: true });
		child.on("error", (error) => {
			options.signal?.removeEventListener("abort", abort);
			reject(error);
		});
		child.on("close", (code) => {
			options.signal?.removeEventListener("abort", abort);
			if (options.signal?.aborted) reject(options.signal.reason);
			else if (code === 0) resolve();
			else
				reject(
					new Error(
						`No se pudo preparar la webcam para Studio (FFmpeg ${code}): ${stderr.trim().split("\n").pop() ?? ""}`,
					),
				);
		});
	});
}
