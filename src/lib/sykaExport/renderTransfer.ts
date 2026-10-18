import type { ExportResult } from "@/lib/exporter/types";

/** The legacy decoder can leave metadata promises pending when its worker is
 * destroyed. Release the transfer UI on cancel, and discard any late output. */
export function renderTransfer(
	renderer: { export: () => Promise<ExportResult>; cancel: () => void },
	discard: (path: string) => Promise<unknown>,
) {
	let canceled = false;
	let rejectPending: ((error: Error) => void) | undefined;
	const result = new Promise<ExportResult>((resolve, reject) => {
		rejectPending = reject;
		renderer
			.export()
			.then(async (output) => {
				if (canceled) {
					if (output.tempFilePath) await discard(output.tempFilePath);
					return;
				}
				resolve(output);
			})
			.catch(reject);
	});
	return {
		result,
		cancel: () => {
			canceled = true;
			try {
				renderer.cancel();
			} finally {
				rejectPending?.(new Error("Transferencia cancelada"));
			}
		},
	};
}
