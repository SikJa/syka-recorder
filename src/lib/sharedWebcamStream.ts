// Based on Recordly PR #971: share the camera handle between preview and recorder.
// Each consumer owns a lease so cleanup remains safe during React effect restarts.
export interface WebcamStreamLease {
	stream: Promise<MediaStream>;
	release: () => void;
}

interface CameraSource {
	deviceId?: string;
	stream: Promise<MediaStream>;
	consumers: number;
}

const sources = new Set<CameraSource>();

export function acquireSharedWebcamStream(deviceId?: string): WebcamStreamLease {
	const requestedId = deviceId && deviceId !== "default" ? deviceId : undefined;
	let source = [...sources].find((item) => !requestedId || item.deviceId === requestedId);
	if (!source) {
		const created: CameraSource = {
			deviceId: requestedId,
			consumers: 0,
			stream: navigator.mediaDevices.getUserMedia({
				video: {
					...(requestedId ? { deviceId: { exact: requestedId } } : {}),
					width: { ideal: 1280 },
					height: { ideal: 720 },
					frameRate: { ideal: 30, max: 30 },
				},
				audio: false,
			}),
		};
		created.stream = created.stream.then(
			(stream) => {
				created.deviceId =
					stream.getVideoTracks()[0]?.getSettings().deviceId ?? requestedId;
				return stream;
			},
			(error: unknown) => {
				sources.delete(created);
				throw error;
			},
		);
		sources.add(created);
		source = created;
	}
	const acquired = source;
	acquired.consumers += 1;
	let released = false;
	return {
		stream: acquired.stream,
		release() {
			if (released) return;
			released = true;
			acquired.consumers -= 1;
			// Keep pending requests reusable until they resolve. A new consumer can
			// acquire the same source before this deferred cleanup executes.
			void acquired.stream.then(
				(stream) => {
					if (acquired.consumers === 0 && sources.delete(acquired)) {
						stream.getTracks().forEach((track) => track.stop());
					}
				},
				() => undefined,
			);
		},
	};
}
