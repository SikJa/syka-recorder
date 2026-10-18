import { buildTransfer, type BuildTransferInput } from "./buildTransfer";

// Camera sampling and curve fitting can take time on long recordings. Keep
// them off the editor thread so cancellation and the progress dialog stay usable.
self.onmessage = (event: MessageEvent<BuildTransferInput>) => {
	try {
		self.postMessage({ success: true, transfer: buildTransfer(event.data) });
	} catch (error) {
		self.postMessage({ success: false, error: String(error) });
	}
};
