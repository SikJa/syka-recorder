import { describe, expect, it, vi } from "vitest";
import {
	confirmProjectOpened,
	isReloadInterruption,
	isSameProjectDirectory,
} from "./studioOpenConfirmation";

const project = "C:\\Users\\me\\Videos\\Clip-1.syka-recorder";
const noWait = async () => undefined;

describe("Studio open confirmation", () => {
	it("recognizes only the reload interruption from Studio's CLI", () => {
		const reload = Object.assign(
			new Error(`Command failed: Syka Studio.exe dapi.js open ${project}`),
			{ stderr: "The app reloaded before replying" },
		);
		expect(isReloadInterruption(reload)).toBe(true);
		expect(
			isReloadInterruption(new Error("Command failed: x The app reloaded before replying")),
		).toBe(true);
		expect(isReloadInterruption(new Error("The app's renderer crashed"))).toBe(false);
		expect(isReloadInterruption(new Error("spawn ENOENT"))).toBe(false);
	});

	it("confirms once context reports the requested folder", async () => {
		const readContext = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error("The app has no window"))
			.mockResolvedValueOnce(JSON.stringify({ projectDir: null }))
			.mockResolvedValueOnce(JSON.stringify({ projectDir: project }));

		await expect(confirmProjectOpened(readContext, project, { sleep: noWait })).resolves.toBe(
			true,
		);
		expect(readContext).toHaveBeenCalledTimes(3);
	});

	it("does not report success when another project stays open", async () => {
		const readContext = vi
			.fn<() => Promise<string>>()
			.mockResolvedValue(JSON.stringify({ projectDir: "C:\\Users\\me\\Other" }));

		await expect(
			confirmProjectOpened(readContext, project, { attempts: 4, sleep: noWait }),
		).resolves.toBe(false);
		expect(readContext).toHaveBeenCalledTimes(4);
	});

	it("compares folders ignoring trailing separators", () => {
		expect(isSameProjectDirectory(`${project}\\`, project)).toBe(true);
		expect(isSameProjectDirectory(project, `${project}-other`)).toBe(false);
	});
});
