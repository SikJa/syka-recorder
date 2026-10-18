import path from "node:path";
import { dialog, ipcMain } from "electron";
import { LEGACY_PROJECT_FILE_EXTENSIONS, PROJECT_FILE_EXTENSION } from "../constants";
import { hasProjectFileExtension, loadProjectFromPath } from "../project/manager";
import { approveUserPath, getRecordingsDir } from "../utils";

const VIDEO_FILE_EXTENSIONS = ["webm", "mp4", "mov", "avi", "mkv"];
const PROJECT_FILE_EXTENSIONS = [PROJECT_FILE_EXTENSION, ...LEGACY_PROJECT_FILE_EXTENSIONS];
type OpenVideoFilePickerOptions = { includeProjects?: boolean };

export function registerMediaPickerHandlers() {
	ipcMain.handle("open-video-file-picker", async (_, options?: OpenVideoFilePickerOptions) => {
		try {
			const includeProjects = Boolean(options?.includeProjects);
			const recordingsDir = await getRecordingsDir();
			const result = await dialog.showOpenDialog({
				title: includeProjects ? "Import Media or Recordly Project" : "Select Video File",
				defaultPath: recordingsDir,
				filters: [
					...(includeProjects
						? [
								{
									name: "Media or Recordly Projects",
									extensions: [
										...VIDEO_FILE_EXTENSIONS,
										...PROJECT_FILE_EXTENSIONS,
									],
								},
							]
						: []),
					{ name: "Video Files", extensions: VIDEO_FILE_EXTENSIONS },
					...(includeProjects
						? [{ name: "Recordly Projects", extensions: PROJECT_FILE_EXTENSIONS }]
						: []),
					{ name: "All Files", extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			const selectedPath = result.filePaths[0];

			if (includeProjects && hasProjectFileExtension(selectedPath)) {
				const projectResult = await loadProjectFromPath(selectedPath);
				return projectResult.success
					? { ...projectResult, kind: "project" }
					: projectResult;
			}

			approveUserPath(selectedPath);
			// Picking an asset must not replace the active project. Source import
			// updates the recording session only when accepting a new primary video.
			return {
				success: true,
				kind: "media",
				path: selectedPath,
				extension: path.extname(selectedPath).replace(/^\./, "").toLowerCase(),
			};
		} catch (error) {
			console.error("Failed to open file picker:", error);
			return {
				success: false,
				message: "Failed to open file picker",
				error: String(error),
			};
		}
	});

	ipcMain.handle("open-audio-file-picker", async () => {
		try {
			const result = await dialog.showOpenDialog({
				title: "Select Audio File",
				filters: [
					{
						name: "Audio Files",
						extensions: ["mp3", "wav", "aac", "m4a", "flac", "ogg"],
					},
					{ name: "All Files", extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			approveUserPath(result.filePaths[0]);
			return {
				success: true,
				path: result.filePaths[0],
			};
		} catch (error) {
			console.error("Failed to open audio file picker:", error);
			return {
				success: false,
				message: "Failed to open audio file picker",
				error: String(error),
			};
		}
	});

}
