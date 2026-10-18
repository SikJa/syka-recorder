import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { app, BrowserWindow, dialog, shell } from "electron";
import { readAppSetting, writeAppSetting } from "../appSettingsStore";
import { studioEnvironment } from "./studioEnvironment";
import {
	confirmProjectOpened,
	isReloadInterruption,
	isSameProjectDirectory,
} from "./studioOpenConfirmation";
import { validateStudioProject } from "./validateStudioProject";
import { installedStudioCandidates, studioInstallation as installation } from "./studioInstallation";

const run = promisify(execFile);
const SETTING = "syka.studioExecutable";
export const STUDIO_DOWNLOAD_URL = "https://github.com/SikJa/syka-studio/releases/latest";

export async function openInStudio(projectDirectory: string, owner: BrowserWindow | null) {
	await validateStudioProject(projectDirectory);
	if (process.platform !== "win32")
		throw new Error("Abrí la carpeta del proyecto desde Syka Studio en este sistema.");
	let studio: Awaited<ReturnType<typeof installation>> = null;
	if (!studio) {
		// A running custom installation is authoritative; no assumptions about drive letters.
		try {
			const result = await run(
				"powershell.exe",
				[
					"-NoProfile",
					"-NonInteractive",
					"-Command",
					"Get-CimInstance Win32_Process -Filter \"Name='Syka Studio.exe'\" | Select-Object -ExpandProperty ExecutablePath -Unique",
				],
				{ windowsHide: true, timeout: 10000 },
			);
			for (const candidate of result.stdout.trim().split(/\r?\n/)) {
				studio = await installation(candidate.trim());
				if (studio) break;
			}
		} catch {
			/* Fall through to standard locations or the user's selection. */
		}
	}
	if (!studio) {
		for (const candidate of await installedStudioCandidates()) {
			studio = await installation(candidate);
			if (studio) break;
		}
	}
	if (!studio) studio = await installation(readAppSetting(SETTING));
	if (!studio) {
		const prompt: Electron.MessageBoxOptions = {
			type: "info",
			title: "Syka Studio no encontrado",
			message: "No encontramos Syka Studio en esta computadora",
			detail: "Tu proyecto ya está guardado. Instalá Syka Studio para seguir editándolo, o indicá dónde está si lo instalaste en otra carpeta. Después podés volver a tocar Abrir en Syka Studio.",
			buttons: ["Descargar Syka Studio", "Buscar instalación", "Ahora no"],
			defaultId: 0,
			cancelId: 2,
			noLink: true,
		};
		const choice = owner ? await dialog.showMessageBox(owner, prompt) : await dialog.showMessageBox(prompt);
		if (choice.response === 0) {
			await shell.openExternal(STUDIO_DOWNLOAD_URL);
			return { success: false, canceled: true };
		}
		if (choice.response !== 1) return { success: false, canceled: true };
		const options: Electron.OpenDialogOptions = {
			title: "Elegí Syka Studio para abrir tus proyectos",
			defaultPath: app.getPath("exe"),
			properties: ["openFile"],
			filters: [{ name: "Syka Studio", extensions: ["exe"] }],
		};
		const selected = owner
			? await dialog.showOpenDialog(owner, options)
			: await dialog.showOpenDialog(options);
		if (selected.canceled) return { success: false, canceled: true };
		studio = await installation(selected.filePaths[0]);
		if (!studio) throw new Error("Elegí Syka Studio.exe de una instalación de Syka Studio.");
	}
	writeAppSetting(SETTING, studio.executable);
	const env = await studioEnvironment(studio.executable);
	// Studio's single-instance lock is scoped to its profile. With the same
	// runtime as the user's launcher, its CLI focuses that existing window.
	const { executable, cli: cliScript } = studio;
	const cli = (command: string[], timeout: number) =>
		run(executable, [cliScript, ...command], {
			env,
			windowsHide: true,
			timeout,
			maxBuffer: 1024 * 1024,
		});
	let stdout: string;
	try {
		({ stdout } = await cli(["open", projectDirectory], 90000));
	} catch (error) {
		if (!isReloadInterruption(error)) throw error;
		const opened = await confirmProjectOpened(
			async () => (await cli(["context"], 15000)).stdout,
			projectDirectory,
		);
		if (!opened)
			throw new Error(
				"Studio se recargó al cambiar de proyecto y no confirmó la apertura. La carpeta sigue guardada.",
			);
		return { success: true };
	}
	const result = JSON.parse(stdout.trim()) as { dir?: unknown } | undefined;
	if (typeof result?.dir !== "string" || !isSameProjectDirectory(result.dir, projectDirectory))
		throw new Error("Studio no confirmó la apertura del proyecto. La carpeta sigue guardada.");
	return { success: true };
}
