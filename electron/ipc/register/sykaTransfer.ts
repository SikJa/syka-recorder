import { randomUUID } from "node:crypto";
import path from "node:path";
import { BrowserWindow, dialog, ipcMain } from "electron";
import type { SaveTransferRequest } from "../../../src/lib/sykaExport/contract";
import { openInStudio } from "../../syka-transfer/openInStudio";
import { writeTransferPackage } from "../../syka-transfer/package";
import { isOwnedExportPath } from "../export/exportStream";
import { resolveApprovedLocalMediaPath } from "../project/manager";
import { currentProjectPath } from "../state";

export function registerSykaTransferHandlers() {
	const completed = new Map<string, number>();
	const opening = new Set<number>();
	ipcMain.handle("syka-transfer-open-studio", async (event, manifestPath: string) => {
		if (completed.get(manifestPath) !== event.sender.id)
			return { success: false, error: "Volvé a guardar el proyecto para abrirlo en Studio." };
		if (opening.has(event.sender.id))
			return { success: false, error: "Studio ya se está abriendo." };
		opening.add(event.sender.id);
		try {
			return await openInStudio(
				path.dirname(manifestPath),
				BrowserWindow.fromWebContents(event.sender),
			);
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		} finally {
			opening.delete(event.sender.id);
		}
	});
	const pending = new Map<
		string,
		{
			owner: number;
			parent: string;
			originalProjectPath: string | null;
			abort: AbortController;
			saving: boolean;
			dispose: () => void;
		}
	>();
	ipcMain.handle("syka-transfer-begin", async (event) => {
		if ([...pending.values()].some((job) => job.owner === event.sender.id))
			throw new Error("A transfer is already running");
		const window = BrowserWindow.fromWebContents(event.sender);
		const options: Electron.OpenDialogOptions = {
			title: "Guardar paquete para Syka Studio",
			properties: ["openDirectory", "createDirectory"],
		};
		const result = window
			? await dialog.showOpenDialog(window, options)
			: await dialog.showOpenDialog(options);
		if (result.canceled || !result.filePaths[0]) return { canceled: true };
		if (event.sender.isDestroyed()) return { canceled: true };
		const operationId = randomUUID();
		const onDestroyed = () => {
			pending.get(operationId)?.abort.abort();
			dispose();
		};
		const onNavigation = (
			details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>,
		) => {
			if (details.isMainFrame && !details.isSameDocument) onDestroyed();
		};
		const dispose = () => {
			event.sender.removeListener("destroyed", onDestroyed);
			event.sender.removeListener("did-start-navigation", onNavigation);
			pending.delete(operationId);
		};
		pending.set(operationId, {
			owner: event.sender.id,
			parent: result.filePaths[0],
			originalProjectPath: currentProjectPath,
			abort: new AbortController(),
			saving: false,
			dispose,
		});
		event.sender.once("destroyed", onDestroyed);
		event.sender.on("did-start-navigation", onNavigation);
		return { operationId };
	});
	ipcMain.handle("syka-transfer-cancel", (event, operationId: string) => {
		const job = pending.get(operationId);
		if (job?.owner === event.sender.id) {
			job.abort.abort();
			if (!job.saving) job.dispose();
		}
	});
	ipcMain.handle("syka-transfer-save", async (event, request: SaveTransferRequest) => {
		const job = pending.get(request?.operationId);
		if (!job || job.owner !== event.sender.id || job.saving)
			return { success: false, error: "Transfer session expired" };
		job.saving = true;
		try {
			if (!Array.isArray(request.assets) || request.assets.length > 512)
				throw new Error("Invalid assets");
			const assets = [];
			for (const asset of request.assets) {
				if (typeof asset.sourcePath !== "string") throw new Error("Invalid source path");
				const approved =
					asset.id === "screen" && isOwnedExportPath(asset.sourcePath)
						? asset.sourcePath
						: await resolveApprovedLocalMediaPath(asset.sourcePath);
				if (!approved)
					throw new Error(`No se puede leer el medio seleccionado: ${asset.id}`);
				assets.push({ ...asset, sourcePath: approved });
			}
			const savedPath = await writeTransferPackage({
				parent: job.parent,
				plan: request.plan,
				assets,
				project: request.project,
				cursorTelemetry: request.cursorTelemetry,
				originalProjectPath: job.originalProjectPath,
				signal: job.abort.signal,
			});
			completed.set(savedPath, event.sender.id);
			if (completed.size > 64) completed.delete(completed.keys().next().value!);
			return { success: true, path: savedPath };
		} catch (error) {
			return { success: false, canceled: job.abort.signal.aborted, error: String(error) };
		} finally {
			job.dispose();
		}
	});
}
