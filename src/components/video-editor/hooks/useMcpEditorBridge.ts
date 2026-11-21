import { useRef } from "react";
import type { ExportMp4Args, EditorState } from "@/lib/mcpBridge/contract";
import { useMcpBridge, waitFor } from "@/lib/mcpBridge/useMcpBridge";
import type { ExportOutcome } from "../export/useExportRunner";
import type { useEditorExportController } from "../export/useEditorExportController";
import type { useExportSession } from "../export/useExportSession";
import type { useEditorProjectController } from "../project/useEditorProjectController";
import type { useProjectState } from "../state/useProjectState";

type Input = {
	project: ReturnType<typeof useProjectState>;
	projectController: ReturnType<typeof useEditorProjectController>;
	exportController: ReturnType<typeof useEditorExportController>;
	exportSession: ReturnType<typeof useExportSession>;
	isPreviewReady: boolean;
	duration: number;
};

const READY_TIMEOUT_MS = 60_000;

function samePath(left: string | null, right: string | null) {
	if (!left || !right) return false;
	const normalize = (value: string) => value.replace(/\//g, "\\").toLowerCase();
	return normalize(left) === normalize(right);
}

/** The editor's side of the MCP server: the same actions as its own buttons. */
export function useMcpEditorBridge(input: Input) {
	// Handlers await renders, so they read the editor through this ref.
	const latest = useRef(input);
	latest.current = input;

	const state = (): EditorState => {
		const { project, projectController, exportSession, isPreviewReady, duration } =
			latest.current;
		return {
			projectPath: project.currentProjectPath,
			videoSourcePath: project.videoSourcePath,
			ready: Boolean(project.videoPath) && !project.loading && isPreviewReady && duration > 0,
			loading: project.loading,
			exporting: exportSession.isExporting || latest.current.exportController.sykaTransfer.busy,
			durationSeconds: duration,
			error: project.error,
			hasUnsavedChanges: projectController.hasUnsavedChanges,
		};
	};
	const whenReady = async (what: string) => {
		await waitFor(
			() => state().ready || Boolean(latest.current.project.error),
			READY_TIMEOUT_MS,
			`The editor did not get ready to ${what}.`,
		);
		const error = latest.current.project.error;
		if (error) throw new Error(error);
	};
	const refuseWhileBusy = () => {
		if (state().exporting) throw new Error("The editor is busy exporting or transferring.");
	};

	useMcpBridge({
		"editor.state": async () => state(),
		"editor.open_project": async ({ path }) => {
			refuseWhileBusy();
			// Reloading the open project keeps the same video element, which never
			// reports its duration again; it is already the one on screen.
			if (samePath(latest.current.project.currentProjectPath, path)) {
				await whenReady("show the project");
				return state();
			}
			const opened =
				await latest.current.projectController.openActions.handleOpenProjectFromLibrary(path);
			if (opened !== true)
				throw new Error(latest.current.project.error || "Could not open the project.");
			await waitFor(
				() => samePath(latest.current.project.currentProjectPath, path) || Boolean(latest.current.project.error),
				READY_TIMEOUT_MS,
				"The editor did not switch to the project.",
			);
			await whenReady("show the project");
			return state();
		},
		"editor.export_mp4": async (args: ExportMp4Args, context) => {
			refuseWhileBusy();
			await whenReady("export");
			let outcome: ExportOutcome | undefined;
			await latest.current.exportController.handleExport(
				{
					format: "mp4",
					quality: args.quality,
					encodingMode: args.encodingMode,
					mp4FrameRate: args.fps,
				},
				{
					destination: "download",
					outputPath: args.outputPath,
					onProgress: (progress) =>
						context.progress({ percentage: progress.percentage, message: progress.phase }),
					onSettled: (result) => {
						outcome = result;
					},
				},
			);
			if (!outcome) throw new Error("The export was canceled before it finished.");
			if (!outcome.success) throw new Error(outcome.error);
			return { path: outcome.path };
		},
		"editor.transfer_to_studio": async ({ open }, context) => {
			refuseWhileBusy();
			await whenReady("transfer");
			const report = window.setInterval(() => {
				const transfer = latest.current.exportController.sykaTransfer;
				if (transfer.busy)
					context.progress({ percentage: transfer.progress, message: transfer.phase });
			}, 1000);
			try {
				await latest.current.exportController.sykaTransfer.start(open);
			} finally {
				window.clearInterval(report);
			}
			await waitFor(
				() => !latest.current.exportController.sykaTransfer.busy,
				10_000,
				"The transfer did not finish.",
			);
			const transfer = latest.current.exportController.sykaTransfer;
			if (transfer.path) return { path: transfer.path };
			throw new Error(transfer.error || "The transfer did not start: no destination folder was accepted.");
		},
		"editor.show_recording_hud": async () => {
			refuseWhileBusy();
			// Home saves the project before it hands over to the recording bar.
			const { project, projectController } = latest.current;
			if (project.videoPath && projectController.hasUnsavedChanges)
				await projectController.saveActions.saveProject(false, {
					silent: true,
					remountPreviewAfterSave: false,
					refreshLibraryAfterSave: false,
				});
			await window.electronAPI.showRecordingHud();
			return { shown: true };
		},
	});
}
