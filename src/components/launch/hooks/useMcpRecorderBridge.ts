import { useRef } from "react";
import type { RecorderState, RecordingInputs } from "@/lib/mcpBridge/contract";
import { useMcpBridge, waitFor } from "@/lib/mcpBridge/useMcpBridge";
import type { useScreenRecorder } from "../../../hooks/useScreenRecorder";

type Recorder = ReturnType<typeof useScreenRecorder>;

const SETTLE_TIMEOUT_MS = 5_000;
/** Native capture and device warm-up, on top of the countdown. */
const START_GRACE_MS = 30_000;

function snapshot(recorder: Recorder): RecorderState {
	return {
		recording: recorder.recording,
		paused: recorder.paused,
		finalizing: recorder.finalizing,
		starting: recorder.starting,
		countdownActive: recorder.countdownActive,
		countdownSeconds: recorder.countdownDelay,
		microphoneEnabled: recorder.microphoneEnabled,
		systemAudioEnabled: recorder.systemAudioEnabled,
		webcamEnabled: recorder.webcamEnabled,
	};
}

/** The recording bar's side of the MCP server: the same actions as its buttons. */
export function useMcpRecorderBridge(recorder: Recorder) {
	// Handlers await renders, so they read the recorder through this ref.
	const latest = useRef(recorder);
	latest.current = recorder;
	const busy = () => {
		const now = latest.current;
		return now.starting || now.countdownActive || now.finalizing;
	};

	useMcpBridge({
		"recorder.state": async () => snapshot(latest.current),
		"recorder.start": async (inputs: RecordingInputs) => {
			if (latest.current.recording) throw new Error("A recording is already running.");
			if (busy()) throw new Error("The recorder is busy starting or saving a recording.");
			const now = latest.current;
			if (inputs?.microphone !== undefined && inputs.microphone !== now.microphoneEnabled)
				now.setMicrophoneEnabled(inputs.microphone);
			if (inputs?.systemAudio !== undefined && inputs.systemAudio !== now.systemAudioEnabled)
				now.setSystemAudioEnabled(inputs.systemAudio);
			if (inputs?.webcam !== undefined && inputs.webcam !== now.webcamEnabled)
				now.setWebcamEnabled(inputs.webcam);
			// The start action reads the toggles of the render it belongs to.
			await waitFor(
				() =>
					(inputs?.microphone === undefined ||
						latest.current.microphoneEnabled === inputs.microphone) &&
					(inputs?.systemAudio === undefined ||
						latest.current.systemAudioEnabled === inputs.systemAudio) &&
					(inputs?.webcam === undefined || latest.current.webcamEnabled === inputs.webcam),
				SETTLE_TIMEOUT_MS,
				"The recording options did not apply.",
			);
			await latest.current.toggleRecording();
			await waitFor(
				() => latest.current.recording || latest.current.starting || latest.current.countdownActive,
				SETTLE_TIMEOUT_MS,
				"The recording did not start. Check that a capture source is selected.",
			);
			await waitFor(
				() => !latest.current.starting && !latest.current.countdownActive,
				latest.current.countdownDelay * 1000 + START_GRACE_MS,
				"The recording is taking too long to start.",
			);
			if (!latest.current.recording)
				throw new Error("The recording did not start. The recording bar shows why.");
			return snapshot(latest.current);
		},
		"recorder.stop": async () => {
			if (!latest.current.recording) throw new Error("Nothing is recording.");
			await latest.current.toggleRecording();
			await waitFor(
				() => !latest.current.recording,
				SETTLE_TIMEOUT_MS,
				"The recording did not stop.",
			);
			return snapshot(latest.current);
		},
		"recorder.pause": async () => {
			if (!latest.current.recording) throw new Error("Nothing is recording.");
			if (latest.current.paused) throw new Error("The recording is already paused.");
			latest.current.pauseRecording();
			await waitFor(() => latest.current.paused, SETTLE_TIMEOUT_MS, "The recording did not pause.");
			return snapshot(latest.current);
		},
		"recorder.resume": async () => {
			if (!latest.current.recording) throw new Error("Nothing is recording.");
			if (!latest.current.paused) throw new Error("The recording is not paused.");
			latest.current.resumeRecording();
			await waitFor(
				() => !latest.current.paused,
				SETTLE_TIMEOUT_MS,
				"The recording did not resume.",
			);
			return snapshot(latest.current);
		},
		"recorder.restart": async () => {
			if (!latest.current.recording) throw new Error("Nothing is recording.");
			if (latest.current.finalizing) throw new Error("The recording is being saved.");
			await latest.current.restartRecording();
			await waitFor(
				() => latest.current.recording && !latest.current.starting,
				latest.current.countdownDelay * 1000 + START_GRACE_MS,
				"The new take did not start.",
			);
			return snapshot(latest.current);
		},
	});
}
