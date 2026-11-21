import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserWindow } from "electron";
import { z } from "zod";
import type {
	EditorState,
	ExportProgressUpdate,
	McpBridgeCommand,
	McpBridgeCommands,
	RecorderState,
} from "../../src/lib/mcpBridge/contract";
import { probeNativeVideoMetadata } from "../ipc/export/native-video";
import { getFfmpegBinaryPath } from "../ipc/ffmpeg/binary";
import {
	hasProjectFileExtension,
	listProjectLibraryEntries,
	loadProjectFromPath,
	normalizePath,
} from "../ipc/project/manager";
import {
	countdownInProgress,
	currentProjectPath,
	currentRecordingSession,
	currentVideoPath,
	ffmpegScreenRecordingActive,
	nativeScreenRecordingActive,
	isCursorCaptureActive,
	selectedSource,
	setSelectedSource,
	windowsNativeCaptureActive,
} from "../ipc/state";
import { validateCaptureSource } from "../ipc/captureSelection";
import { listCapturePickerWindows } from "../ipc/capturePickerSources";
import { stopWindowBoundsCapture } from "../ipc/cursor/bounds";
import { createScreenSource } from "../ipc/register/capturePicker";
import { broadcastSelectedSourceChange, getDesktopSources } from "../ipc/register/sources";
import { createWindowSource } from "../ipc/sourceArea";
import { getScreen } from "../ipc/utils";
import { type CaptureSourceDeps, listCaptureSources, selectCaptureSource } from "./captureSources";
import { type BridgeRequestOptions, type BridgeTarget, RendererBridge } from "./rendererBridge";
import { authorizeTransferDestination } from "../syka-transfer/transferDestination";

export type McpToolContext = {
	version: string;
	url: string;
	bridge: RendererBridge;
	hudWindow(): BrowserWindow | null;
	editorWindow(): BrowserWindow | null;
	/** Creates the editor window, or brings the existing one to the front. */
	openEditor(): BrowserWindow | null;
};

type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
};

type ToolExtra = {
	signal: AbortSignal;
	_meta?: { progressToken?: string | number };
	sendNotification: (notification: {
		method: "notifications/progress";
		params: {
			progressToken: string | number;
			progress: number;
			total?: number;
			message?: string;
		};
	}) => Promise<void>;
};

class ToolError extends Error {}

const QUALITIES = ["medium", "good", "high", "source", "double"] as const;
const ENCODING_MODES = ["fast", "balanced", "quality"] as const;
const EDITOR_READY_TIMEOUT_MS = 60_000;
const RECORDING_SAVED_TIMEOUT_MS = 120_000;
const EXPORT_IDLE_TIMEOUT_MS = 180_000;
const TRANSFER_IDLE_TIMEOUT_MS = 300_000;

function ok(summary: string, data: Record<string, unknown>): ToolResult {
	return {
		content: [{ type: "text", text: `${summary}\n${JSON.stringify(data)}` }],
		structuredContent: data,
	};
}

function failure(error: unknown): ToolResult {
	return {
		isError: true,
		content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
	};
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function bridgeTarget(window: BrowserWindow): BridgeTarget {
	return {
		id: window.webContents.id,
		isDestroyed: () => window.isDestroyed() || window.webContents.isDestroyed(),
		send: (channel, payload) => window.webContents.send(channel, payload),
	};
}

function liveWindow(window: BrowserWindow | null): BrowserWindow | null {
	return window && !window.isDestroyed() && !window.webContents.isDestroyed() ? window : null;
}

function progressReporter(extra: ToolExtra) {
	const token = extra._meta?.progressToken;
	if (token === undefined) return undefined;
	let last = -1;
	return (update: ExportProgressUpdate) => {
		const progress = Math.max(0, Math.min(100, Math.round(update.percentage)));
		if (progress === last) return;
		last = progress;
		void extra
			.sendNotification({
				method: "notifications/progress",
				params: { progressToken: token, progress, total: 100, message: update.message },
			})
			.catch(() => undefined);
	};
}

/** The capture picker's own helpers, so agents and the picker choose alike. */
const captureSourceDeps: CaptureSourceDeps = {
	displays: async () => {
		const primary = getScreen().getPrimaryDisplay().id;
		const named = await getDesktopSources({
			types: ["screen"],
			thumbnailSize: { width: 0, height: 0 },
		}).catch(() => []);
		return getScreen()
			.getAllDisplays()
			.map((display, index) => ({
				id: display.id,
				name:
					named.find((source) => source.display_id === String(display.id))?.name ??
					(display.id === primary
						? `Screen ${index + 1} (Primary)`
						: `Screen ${index + 1}`),
				primary: display.id === primary,
				width: display.size.width,
				height: display.size.height,
			}));
	},
	windows: listCapturePickerWindows,
	screenSource: createScreenSource,
	windowSource: createWindowSource,
	validate: validateCaptureSource,
	apply: (source) => {
		setSelectedSource(source);
		broadcastSelectedSourceChange();
		stopWindowBoundsCapture();
	},
	busy: () => isCursorCaptureActive || mainProcessRecording(),
	current: () => selectedSource,
};

function mainProcessRecording(): boolean {
	return (
		countdownInProgress ||
		nativeScreenRecordingActive ||
		windowsNativeCaptureActive ||
		ffmpegScreenRecordingActive
	);
}

function requireAbsolute(value: string, label: string): string {
	if (!path.isAbsolute(value)) throw new ToolError(`${label} must be an absolute path.`);
	return path.resolve(value);
}

/** Timeline length from the saved clips, without decoding any media. */
function projectDurationSeconds(editor: Record<string, unknown> | undefined): number | null {
	const clips = editor?.clipRegions;
	if (!Array.isArray(clips) || clips.length === 0) return null;
	let totalMs = 0;
	for (const clip of clips as Array<{ startMs?: unknown; endMs?: unknown; speed?: unknown }>) {
		const start = Number(clip?.startMs);
		const end = Number(clip?.endMs);
		const speed = Number(clip?.speed) > 0 ? Number(clip.speed) : 1;
		if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
		totalMs += (end - start) / speed;
	}
	return totalMs > 0 ? Math.round(totalMs / 100) / 10 : null;
}

async function readProjectSummary(projectPath: string) {
	try {
		const stats = await fs.stat(projectPath);
		if (stats.size > 8 * 1024 * 1024) return { durationSeconds: null, hasWebcam: false };
		const text = (await fs.readFile(projectPath, "utf-8")).replace(/^﻿/, "");
		const project = JSON.parse(text) as { editor?: Record<string, unknown> };
		const webcam = project.editor?.webcam as
			| { enabled?: unknown; sourcePath?: unknown }
			| undefined;
		return {
			durationSeconds: projectDurationSeconds(project.editor),
			hasWebcam: Boolean(
				webcam?.enabled && typeof webcam.sourcePath === "string" && webcam.sourcePath,
			),
		};
	} catch {
		return { durationSeconds: null, hasWebcam: false };
	}
}

export class McpTools {
	constructor(private readonly ctx: McpToolContext) {}

	private call<K extends McpBridgeCommand>(
		window: BrowserWindow,
		command: K,
		args: McpBridgeCommands[K]["args"],
		options?: BridgeRequestOptions,
	) {
		return this.ctx.bridge.request(bridgeTarget(window), command, args, options);
	}

	private async recorderState(): Promise<RecorderState | null> {
		const hud = liveWindow(this.ctx.hudWindow());
		if (!hud || !this.ctx.bridge.supports(hud.webContents.id, "recorder.state")) return null;
		return this.call(hud, "recorder.state", undefined, { timeoutMs: 3_000 }).catch(() => null);
	}

	private async editorState(): Promise<EditorState | null> {
		const editor = liveWindow(this.ctx.editorWindow());
		if (!editor || !this.ctx.bridge.supports(editor.webContents.id, "editor.state"))
			return null;
		return this.call(editor, "editor.state", undefined, { timeoutMs: 3_000 }).catch(() => null);
	}

	private async isRecording(): Promise<boolean> {
		const recorder = await this.recorderState();
		if (recorder) return recorder.recording || recorder.starting || recorder.finalizing;
		return mainProcessRecording();
	}

	/** The editor window once its renderer answers, opening it when there is none. */
	private async editor(signal: AbortSignal): Promise<BrowserWindow> {
		let editor = liveWindow(this.ctx.editorWindow());
		// A new window's URL is only committed once it loads, so use the one returned.
		if (!editor) editor = liveWindow(this.ctx.openEditor());
		if (!editor) throw new ToolError("Could not open the editor window.");
		await this.call(editor, "editor.state", undefined, {
			readyTimeoutMs: EDITOR_READY_TIMEOUT_MS,
			signal,
		});
		return editor;
	}

	private async waitForEditor(
		editor: BrowserWindow,
		done: (state: EditorState) => boolean,
		signal: AbortSignal,
		timeoutMs = EDITOR_READY_TIMEOUT_MS,
	): Promise<EditorState> {
		const deadline = Date.now() + timeoutMs;
		let last: EditorState | null = null;
		while (Date.now() < deadline) {
			if (signal.aborted) throw new ToolError("The request was canceled.");
			if (!liveWindow(editor)) throw new ToolError("The editor window closed.");
			last = await this.call(editor, "editor.state", undefined, {
				readyTimeoutMs: Math.max(1_000, deadline - Date.now()),
				signal,
			}).catch(() => last);
			if (last?.error) throw new ToolError(last.error);
			if (last && done(last)) return last;
			await sleep(400);
		}
		throw new ToolError(
			`The editor did not finish loading within ${Math.round(timeoutMs / 1000)} s.`,
		);
	}

	async status(): Promise<ToolResult> {
		const [recorder, editorState] = await Promise.all([
			this.recorderState(),
			this.editorState(),
		]);
		const editor = liveWindow(this.ctx.editorWindow());
		const data = {
			app: { name: "Syka Recorder", version: this.ctx.version },
			recorder: recorder ?? {
				available: false,
				recording: mainProcessRecording(),
			},
			selectedSource: selectedSource
				? {
						id: selectedSource.id ?? null,
						name: selectedSource.name,
						type: selectedSource.sourceType ?? null,
					}
				: null,
			editor: {
				open: Boolean(editor),
				visible: Boolean(editor?.isVisible()),
				projectPath: editorState?.projectPath ?? currentProjectPath ?? null,
				videoPath: editorState?.videoSourcePath ?? currentVideoPath ?? null,
				...(editorState ? { state: editorState } : {}),
			},
			lastRecording: currentRecordingSession
				? {
						videoPath: currentRecordingSession.videoPath,
						webcamPath: currentRecordingSession.webcamPath ?? null,
					}
				: null,
			mcp: { url: this.ctx.url },
		};
		const recording = recorder
			? recorder.recording
				? recorder.paused
					? "paused"
					: "recording"
				: recorder.finalizing
					? "finalizing"
					: "idle"
			: "unknown";
		return ok(
			`Syka Recorder ${this.ctx.version}: recorder ${recording}, source ${data.selectedSource?.name ?? "none"}, project ${data.editor.projectPath ?? "none"}.`,
			data,
		);
	}

	async listProjects(): Promise<ToolResult> {
		const library = await listProjectLibraryEntries();
		const projects = await Promise.all(
			library.entries.map(async (entry) => ({
				name: entry.name,
				path: entry.path,
				modifiedAt: new Date(entry.updatedAt).toISOString(),
				...(await readProjectSummary(entry.path)),
				isOpen: entry.isCurrent,
			})),
		);
		return ok(`${projects.length} project(s) in ${library.projectsDir}.`, {
			projectsDir: library.projectsDir,
			projects,
		});
	}

	async openProject(projectPath: string, signal: AbortSignal): Promise<EditorState> {
		const target = requireAbsolute(projectPath, "path");
		if (!hasProjectFileExtension(target))
			throw new ToolError("path must point to a .recordly project file.");
		const stats = await fs.stat(target).catch(() => null);
		if (!stats?.isFile()) throw new ToolError(`Project not found: ${target}`);
		if (await this.isRecording())
			throw new ToolError("Stop the current recording before opening a project.");

		const normalized = normalizePath(target);
		const sameProject = (state: EditorState) =>
			state.projectPath !== null && normalizePath(state.projectPath) === normalized;
		const existing = liveWindow(this.ctx.editorWindow());
		if (existing) {
			const state = await this.call(
				existing,
				"editor.open_project",
				{ path: target },
				// The editor gives up on its own after a minute and says why.
				{
					timeoutMs: EDITOR_READY_TIMEOUT_MS * 2,
					readyTimeoutMs: EDITOR_READY_TIMEOUT_MS,
					signal,
				},
			);
			this.ctx.openEditor();
			return state;
		}
		// No editor yet: the same path the recording bar's project list takes.
		// The editor window picks the project up from main when it loads.
		const loaded = await loadProjectFromPath(target);
		if (!loaded.success) throw new ToolError(loaded.message || "Could not open the project.");
		const editor = await this.editor(signal);
		return this.waitForEditor(editor, (state) => sameProject(state) && state.ready, signal);
	}

	async openProjectTool(projectPath: string, signal: AbortSignal): Promise<ToolResult> {
		const state = await this.openProject(projectPath, signal);
		return ok(`Opened ${state.projectPath ?? projectPath} in the editor.`, { editor: state });
	}

	/** The editor with a loaded video, opening `projectPath` first when it is another project. */
	private async editorWithProject(
		projectPath: string | undefined,
		signal: AbortSignal,
	): Promise<{ editor: BrowserWindow; state: EditorState }> {
		if (projectPath) {
			const current = await this.editorState();
			const wanted = normalizePath(requireAbsolute(projectPath, "projectPath"));
			if (!current?.projectPath || normalizePath(current.projectPath) !== wanted)
				await this.openProject(projectPath, signal);
		}
		const editor = liveWindow(this.ctx.editorWindow());
		if (!editor)
			throw new ToolError(
				"No project is open. Call open_project first, or pass projectPath.",
			);
		const state = await this.waitForEditor(
			editor,
			(state) => state.ready || (!state.loading && !state.videoSourcePath),
			signal,
		);
		if (!state.videoSourcePath)
			throw new ToolError(
				"The editor has no project or video loaded. Call open_project first.",
			);
		if (state.exporting) throw new ToolError("The editor is already exporting.");
		return { editor, state };
	}

	async exportMp4(
		args: {
			outputPath: string;
			quality: (typeof QUALITIES)[number];
			fps: number;
			encodingMode: (typeof ENCODING_MODES)[number];
			projectPath?: string;
		},
		extra: ToolExtra,
	): Promise<ToolResult> {
		const outputPath = requireAbsolute(args.outputPath, "outputPath");
		if (path.extname(outputPath).toLowerCase() !== ".mp4")
			throw new ToolError("outputPath must end in .mp4.");
		if (args.fps !== 24 && args.fps !== 30 && args.fps !== 60)
			throw new ToolError("fps must be 24, 30 or 60.");
		await fs.mkdir(path.dirname(outputPath), { recursive: true });
		const { editor, state } = await this.editorWithProject(args.projectPath, extra.signal);
		const startedAt = Date.now();
		const result = await this.call(
			editor,
			"editor.export_mp4",
			{ outputPath, quality: args.quality, fps: args.fps, encodingMode: args.encodingMode },
			{
				timeoutMs: EXPORT_IDLE_TIMEOUT_MS,
				signal: extra.signal,
				onProgress: progressReporter(extra),
			},
		);
		const stats = await fs.stat(result.path);
		const metadata = await probeNativeVideoMetadata(getFfmpegBinaryPath(), result.path).catch(
			() => null,
		);
		const data = {
			path: result.path,
			sizeBytes: stats.size,
			durationSeconds: metadata ? Math.round(metadata.duration * 1000) / 1000 : null,
			width: metadata?.width ?? null,
			height: metadata?.height ?? null,
			frameRate: metadata?.frameRate ?? null,
			quality: args.quality,
			fps: args.fps,
			encodingMode: args.encodingMode,
			projectPath: state.projectPath,
			elapsedSeconds: Math.round((Date.now() - startedAt) / 100) / 10,
		};
		return ok(
			`Exported ${result.path} (${(stats.size / 1048576).toFixed(1)} MB${data.durationSeconds ? `, ${data.durationSeconds} s` : ""}).`,
			data,
		);
	}

	async transferToStudio(
		args: { destinationFolder: string; open: boolean; projectPath?: string },
		extra: ToolExtra,
	): Promise<ToolResult> {
		const folder = requireAbsolute(args.destinationFolder, "destinationFolder");
		await fs.mkdir(folder, { recursive: true });
		const { editor, state } = await this.editorWithProject(args.projectPath, extra.signal);
		// The transfer normally asks for a folder with a dialog; this window's
		// next transfer uses the agent's folder instead.
		const disarm = authorizeTransferDestination(editor.webContents.id, folder);
		try {
			const result = await this.call(
				editor,
				"editor.transfer_to_studio",
				{ open: args.open },
				{
					timeoutMs: TRANSFER_IDLE_TIMEOUT_MS,
					signal: extra.signal,
					onProgress: progressReporter(extra),
				},
			);
			const packageFolder = result.path.replace(/[\\/]manifest\.json$/i, "");
			return ok(`Saved the Studio package in ${packageFolder}.`, {
				packageFolder,
				manifestPath: result.path,
				openedInStudio: args.open,
				projectPath: state.projectPath,
			});
		} finally {
			disarm();
		}
	}

	/** The recording bar, brought back from behind the editor when needed. */
	private async hud(signal: AbortSignal): Promise<BrowserWindow> {
		let hud = liveWindow(this.ctx.hudWindow());
		const editor = liveWindow(this.ctx.editorWindow());
		if ((!hud || !hud.isVisible()) && editor) {
			await this.call(editor, "editor.show_recording_hud", undefined, {
				readyTimeoutMs: EDITOR_READY_TIMEOUT_MS,
				signal,
			});
			const deadline = Date.now() + 10_000;
			while (Date.now() < deadline && !liveWindow(this.ctx.hudWindow())) await sleep(200);
			hud = liveWindow(this.ctx.hudWindow());
		}
		if (!hud) throw new ToolError("The recording bar is not open.");
		return hud;
	}

	async recorderCommand(
		command: "recorder.pause" | "recorder.resume" | "recorder.restart",
		signal: AbortSignal,
	): Promise<ToolResult> {
		const hud = liveWindow(this.ctx.hudWindow());
		if (!hud) throw new ToolError("The recording bar is not open, so nothing is recording.");
		const state = await this.call(hud, command, undefined, { timeoutMs: 60_000, signal });
		const verb = {
			"recorder.pause": "Paused",
			"recorder.resume": "Resumed",
			"recorder.restart": "Restarted",
		}[command];
		return ok(`${verb} the recording.`, { recorder: state });
	}

	async startRecording(
		inputs: { microphone?: boolean; systemAudio?: boolean; webcam?: boolean },
		signal: AbortSignal,
	): Promise<ToolResult> {
		if (!selectedSource)
			throw new ToolError(
				"No capture source is selected. Pick a screen, window or area in the recording bar first.",
			);
		const hud = await this.hud(signal);
		const state = await this.call(hud, "recorder.start", inputs, {
			timeoutMs: 90_000,
			readyTimeoutMs: EDITOR_READY_TIMEOUT_MS,
			signal,
		});
		return ok(`Recording ${selectedSource.name}.`, {
			recorder: state,
			source: {
				id: selectedSource.id ?? null,
				name: selectedSource.name,
				type: selectedSource.sourceType ?? null,
			},
		});
	}

	async stopRecording(signal: AbortSignal): Promise<ToolResult> {
		const hud = liveWindow(this.ctx.hudWindow());
		if (!hud) throw new ToolError("The recording bar is not open, so nothing is recording.");
		const previousVideo = currentRecordingSession?.videoPath ?? currentVideoPath ?? null;
		const state = await this.call(hud, "recorder.stop", undefined, {
			timeoutMs: 60_000,
			signal,
		});
		// The bar saves the take, hands it to main and opens the editor on it.
		const deadline = Date.now() + RECORDING_SAVED_TIMEOUT_MS;
		while (Date.now() < deadline) {
			if (signal.aborted) throw new ToolError("The request was canceled.");
			const video = currentRecordingSession?.videoPath ?? currentVideoPath ?? null;
			if (video && video !== previousVideo) break;
			await sleep(300);
		}
		const videoPath = currentRecordingSession?.videoPath ?? currentVideoPath ?? null;
		if (!videoPath || videoPath === previousVideo) {
			return ok(
				"Stopped the recording, but it was not saved yet. Call status to see lastRecording once it is.",
				{ recorder: state, saved: false },
			);
		}
		let editorState: EditorState | null = null;
		const editor = liveWindow(this.ctx.editorWindow());
		if (editor) {
			editorState = await this.waitForEditor(
				editor,
				(next) => next.videoSourcePath !== null && next.ready,
				signal,
			).catch(() => null);
		}
		return ok(`Saved the recording to ${videoPath} and opened it in the editor.`, {
			saved: true,
			videoPath,
			webcamPath: currentRecordingSession?.webcamPath ?? null,
			projectPath: editorState?.projectPath ?? currentProjectPath ?? null,
			editor: editorState,
			note: "A fresh recording has no .recordly project until the editor saves it; projectPath stays null until then.",
		});
	}

	register(server: McpServer): void {
		const run =
			<A>(handler: (args: A, extra: ToolExtra) => Promise<ToolResult>) =>
			async (args: A, extra: unknown) => {
				try {
					return await handler(args, extra as ToolExtra);
				} catch (error) {
					return failure(error);
				}
			};

		server.registerTool(
			"status",
			{
				title: "Recorder status",
				description:
					"Report Syka Recorder's state: app version, whether a recording is running, paused or finalizing, the selected capture source, the project open in the editor, the last recording saved and this MCP endpoint. Call it first, and after stop_recording if the new recording was not saved yet.",
				inputSchema: {},
				annotations: { readOnlyHint: true },
			},
			run(async () => this.status()),
		);
		server.registerTool(
			"list_projects",
			{
				title: "List projects",
				description:
					"List the .recordly projects in the library (the projects folder plus recently opened ones), newest first: name, absolute path, modification time, timeline duration in seconds when the project stores clips, whether it has a webcam track and whether it is the one open in the editor.",
				inputSchema: {},
				annotations: { readOnlyHint: true },
			},
			run(async () => this.listProjects()),
		);
		server.registerTool(
			"list_sources",
			{
				title: "List capture sources",
				description:
					"List what can be recorded: every screen (id `display:<n>`, size, which is primary) and every open window (id `window:...`, app and title), plus the source selected now. Pass an id to select_source.",
				inputSchema: {},
				annotations: { readOnlyHint: true },
			},
			run(async () => {
				const sources = await listCaptureSources(captureSourceDeps);
				return ok(
					`${sources.screens.length} screen(s), ${sources.windows.length} window(s).`,
					sources,
				);
			}),
		);
		server.registerTool(
			"select_source",
			{
				title: "Select capture source",
				description:
					"Choose the screen or window the next recording captures, by an id from list_sources. The recording bar shows the new choice, as if the person picked it. Refused while recording.",
				inputSchema: {
					id: z
						.string()
						.min(1)
						.describe(
							"A screen id (`display:<n>`) or window id (`window:...`) from list_sources.",
						),
				},
			},
			run(async (args: { id: string }) => {
				const selected = await selectCaptureSource(captureSourceDeps, args.id);
				return ok(`Selected ${selected.name}.`, { selected });
			}),
		);
		server.registerTool(
			"open_project",
			{
				title: "Open project",
				description:
					"Open a .recordly project in the editor window, opening the editor if needed, and wait until its preview is ready. Unsaved changes in the project already open are saved first, like opening a project from the library. Refused while recording.",
				inputSchema: {
					path: z
						.string()
						.min(1)
						.describe("Absolute path of the .recordly project file."),
				},
			},
			run(async (args: { path: string }, extra) =>
				this.openProjectTool(args.path, extra.signal),
			),
		);
		server.registerTool(
			"start_recording",
			{
				title: "Start recording",
				description:
					"Start a recording of the capture source currently selected in the recording bar, with its countdown. Optionally turn the microphone, system audio or webcam on or off first; those choices are saved, like flipping them in the bar. Fails if no source is selected (see list_sources and select_source) or a recording is already running. The person sees the recording bar and can stop it themselves.",
				inputSchema: {
					microphone: z.boolean().optional().describe("Record the microphone."),
					systemAudio: z.boolean().optional().describe("Record the computer's sound."),
					webcam: z.boolean().optional().describe("Record the webcam."),
				},
			},
			run(
				async (
					args: { microphone?: boolean; systemAudio?: boolean; webcam?: boolean },
					extra,
				) => this.startRecording(args, extra.signal),
			),
		);
		server.registerTool(
			"stop_recording",
			{
				title: "Stop recording",
				description:
					"Stop the running recording, wait until the take is saved and opened in the editor, and return the recording's video path (and webcam path). A fresh take has no .recordly project until the editor saves it. Fails when nothing is recording.",
				inputSchema: {},
			},
			run(async (_args: unknown, extra) => this.stopRecording(extra.signal)),
		);
		server.registerTool(
			"pause_recording",
			{
				title: "Pause recording",
				description:
					"Pause the running recording. Fails when nothing is recording or it is already paused.",
				inputSchema: {},
			},
			run(async (_args: unknown, extra) =>
				this.recorderCommand("recorder.pause", extra.signal),
			),
		);
		server.registerTool(
			"resume_recording",
			{
				title: "Resume recording",
				description: "Resume a paused recording. Fails when the recording is not paused.",
				inputSchema: {},
			},
			run(async (_args: unknown, extra) =>
				this.recorderCommand("recorder.resume", extra.signal),
			),
		);
		server.registerTool(
			"restart_recording",
			{
				title: "Restart recording",
				description:
					'Discard the running take and start a new one right away with the same source and devices (the recording bar\'s "Volver a grabar"). The discarded take is not kept. Fails when nothing is recording.',
				annotations: { destructiveHint: true },
				inputSchema: {},
			},
			run(async (_args: unknown, extra) =>
				this.recorderCommand("recorder.restart", extra.signal),
			),
		);
		server.registerTool(
			"export_mp4",
			{
				title: "Export MP4",
				description:
					"Export the project open in the editor (or projectPath, opened first) to an MP4 file with the editor's own export pipeline, the same as its Export button: background, zooms, cursor, webcam, cuts and audio included. Sends progress notifications when the client asks for them. Returns the file's path, size, duration and dimensions. An existing file at outputPath is replaced.",
				inputSchema: {
					outputPath: z
						.string()
						.min(1)
						.describe("Absolute path of the .mp4 file to write."),
					quality: z
						.enum(QUALITIES)
						.default("good")
						.describe(
							"Output size, relative to the composed frame at the recording's size: medium (60%), good (75%), high (90%), source (100%) or double (200% when the encoder allows it).",
						),
					fps: z
						.union([z.literal(24), z.literal(30), z.literal(60)])
						.default(30)
						.describe("Frames per second: 24, 30 or 60."),
					encodingMode: z
						.enum(ENCODING_MODES)
						.default("balanced")
						.describe("Encoder preset: fast, balanced or quality."),
					projectPath: z
						.string()
						.optional()
						.describe(
							"Absolute path of a .recordly project to open and export instead of the open one.",
						),
				},
			},
			run(
				async (
					args: {
						outputPath: string;
						quality: (typeof QUALITIES)[number];
						fps: 24 | 30 | 60;
						encodingMode: (typeof ENCODING_MODES)[number];
						projectPath?: string;
					},
					extra,
				) => this.exportMp4(args, extra),
			),
		);
		server.registerTool(
			"transfer_to_studio",
			{
				title: "Transfer to Syka Studio",
				description:
					'Run "Editar en Syka" on the project open in the editor (or projectPath, opened first): render the screen video with its cursor and save a native Syka Studio package inside destinationFolder, using the editor\'s export quality settings. With open: true it then opens the package in Syka Studio. Returns the package folder.',
				inputSchema: {
					destinationFolder: z
						.string()
						.min(1)
						.describe(
							"Absolute path of the folder that will contain the package; created if missing.",
						),
					open: z
						.boolean()
						.default(false)
						.describe("Open the package in Syka Studio afterwards."),
					projectPath: z
						.string()
						.optional()
						.describe(
							"Absolute path of a .recordly project to open and transfer instead of the open one.",
						),
				},
			},
			run(
				async (
					args: { destinationFolder: string; open: boolean; projectPath?: string },
					extra,
				) => this.transferToStudio(args, extra),
			),
		);
	}
}
