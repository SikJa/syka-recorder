import type { buildTransfer, BuildTransferInput } from "./buildTransfer";

export function planTransfer(input: BuildTransferInput) {
	const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
	let rejectPending: ((error: Error) => void) | undefined;
	const result = new Promise<ReturnType<typeof buildTransfer>>((resolve, reject) => {
		rejectPending = reject;
		worker.onmessage = (event) => {
			worker.terminate();
			if (event.data.success) resolve(event.data.transfer);
			else reject(new Error(event.data.error));
		};
		worker.onerror = (event) => {
			worker.terminate();
			reject(new Error(event.message || "No se pudieron preparar los zooms"));
		};
		try {
			worker.postMessage(input);
		} catch (error) {
			worker.terminate();
			reject(error);
		}
	});
	return {
		result,
		cancel: () => {
			worker.terminate();
			rejectPending?.(new Error("Transferencia cancelada"));
		},
	};
}
