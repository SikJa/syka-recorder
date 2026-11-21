// The MCP server lives in the main process; the recorder and the editor live
// in renderers. One request channel and one reply channel carry every command
// between them. Each window announces the commands it can answer, so main
// knows when a freshly loaded window is ready.

import type { ExportEncodingMode, ExportMp4FrameRate, ExportQuality } from "../exporter/types";

export const MCP_BRIDGE_REQUEST = "mcp-bridge-request";
export const MCP_BRIDGE_REPLY = "mcp-bridge-reply";
export const MCP_BRIDGE_READY = "mcp-bridge-ready";

/** What Settings shows next to the agent-control toggle. */
export type McpServerStatus = {
	enabled: boolean;
	running: boolean;
	url: string;
	error: string | null;
};

export type RecorderState = {
	recording: boolean;
	paused: boolean;
	finalizing: boolean;
	starting: boolean;
	countdownActive: boolean;
	countdownSeconds: number;
	microphoneEnabled: boolean;
	systemAudioEnabled: boolean;
	webcamEnabled: boolean;
};

export type RecordingInputs = {
	microphone?: boolean;
	systemAudio?: boolean;
	webcam?: boolean;
};

export type EditorState = {
	projectPath: string | null;
	videoSourcePath: string | null;
	ready: boolean;
	loading: boolean;
	exporting: boolean;
	durationSeconds: number;
	error: string | null;
	hasUnsavedChanges: boolean;
};

export type ExportMp4Args = {
	outputPath: string;
	quality: ExportQuality;
	fps: ExportMp4FrameRate;
	encodingMode: ExportEncodingMode;
};

export type ExportProgressUpdate = { percentage: number; message?: string };

/** Every command, with what it takes and what it answers. */
export type McpBridgeCommands = {
	"recorder.state": { args: undefined; result: RecorderState };
	"recorder.start": { args: RecordingInputs; result: RecorderState };
	"recorder.stop": { args: undefined; result: RecorderState };
	"recorder.pause": { args: undefined; result: RecorderState };
	"recorder.resume": { args: undefined; result: RecorderState };
	"recorder.restart": { args: undefined; result: RecorderState };
	"editor.state": { args: undefined; result: EditorState };
	"editor.open_project": { args: { path: string }; result: EditorState };
	"editor.export_mp4": { args: ExportMp4Args; result: { path: string } };
	"editor.transfer_to_studio": { args: { open: boolean }; result: { path: string } };
	"editor.show_recording_hud": { args: undefined; result: { shown: true } };
};

export type McpBridgeCommand = keyof McpBridgeCommands;

export type McpBridgeRequest = {
	id: string;
	command: McpBridgeCommand;
	args: unknown;
};

/** A renderer answers a request once, and may send progress before that. */
export type McpBridgeReply =
	| { id: string; kind: "progress"; progress: ExportProgressUpdate }
	| { id: string; kind: "result"; ok: true; result: unknown }
	| { id: string; kind: "result"; ok: false; error: string };

export type McpBridgeContext = {
	progress: (update: ExportProgressUpdate) => void;
};

export type McpBridgeHandlers = {
	[K in McpBridgeCommand]?: (
		args: McpBridgeCommands[K]["args"],
		context: McpBridgeContext,
	) => Promise<McpBridgeCommands[K]["result"]>;
};
