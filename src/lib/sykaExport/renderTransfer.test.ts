import { describe, expect, it, vi } from "vitest";
import { renderTransfer } from "./renderTransfer";
import type { ExportResult } from "@/lib/exporter/types";

describe("transfer renderer cancellation", () => {
	it("releases the caller even when decoder initialization never resolves", async () => {
		const cancel = vi.fn();
		const render = renderTransfer(
			{
				export: () =>
					new Promise(() => {
						/* Simulate the destroyed decoder's pending request. */
					}),
				cancel,
			},
			vi.fn(),
		);
		render.cancel();
		await expect(render.result).rejects.toThrow("cancelada");
		expect(cancel).toHaveBeenCalledOnce();
	});
	it("discards a file returned after cancellation instead of leaking it", async () => {
		let finish: ((result: ExportResult) => void) | undefined;
		const pending = new Promise<ExportResult>((resolve) => {
			finish = resolve;
		});
		const discard = vi.fn().mockResolvedValue(undefined);
		const render = renderTransfer({ export: () => pending, cancel: vi.fn() }, discard);
		render.cancel();
		await expect(render.result).rejects.toThrow();
		finish!({ success: true, tempFilePath: "owned-temp.mp4" });
		await pending;
		await Promise.resolve();
		expect(discard).toHaveBeenCalledWith("owned-temp.mp4");
	});
});
