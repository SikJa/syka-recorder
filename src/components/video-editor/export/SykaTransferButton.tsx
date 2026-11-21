import { Description, Label } from "@heroui/react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Copy, FilmStrip, FolderOpen } from "@/components/ui/icons";
import { SuccessCheck, TextSwap, useShownAfterMount } from "@/components/ui/motion";
import { Switch } from "@/components/ui/switch";
import { SYKA_PACKAGE_FOLDERS } from "@/lib/sykaExport/contract";
import { ExportSettingsMenu } from "../ExportSettingsMenu";
import type { useSykaTransfer } from "./useSykaTransfer";

type Transfer = ReturnType<typeof useSykaTransfer>;

const folderName = (folder: string) => folder.split(/[\\/]/).filter(Boolean).pop() ?? folder;

export function SykaTransferButton({
	transfer,
	disabled,
}: {
	transfer: Transfer;
	disabled: boolean;
}) {
	const done = Boolean(transfer.path) && !transfer.busy;
	return (
		<>
			<Button
				variant="secondary"
				disabled={disabled && !transfer.busy}
				onClick={() => transfer.setOpen(true)}
			>
				<img src="./app-icons/syka-recorder-32.png" width={18} height={18} alt="" />
				Editar en Syka
			</Button>
			<Dialog
				open={transfer.open}
				onOpenChange={(open) => {
					if (!transfer.busy) transfer.setOpen(open);
				}}
			>
				<DialogContent>
					{done ? (
						<TransferDone transfer={transfer} />
					) : (
						<>
							<DialogHeader>
								<DialogTitle>Seguir editando en Syka Studio</DialogTitle>
								<DialogDescription>
									Guarda un proyecto editable: cortes, zooms, cámara y audio en
									pistas separadas, con tu fondo y tus bordes.
								</DialogDescription>
							</DialogHeader>
							{transfer.busy ? (
								<TransferProgress transfer={transfer} />
							) : (
								<TransferOptions transfer={transfer} />
							)}
							{transfer.error && (
								<p role="alert" className="text-sm text-danger">
									{transfer.error}
								</p>
							)}
							<DialogFooter>
								{transfer.busy ? (
									<Button variant="secondary" onClick={transfer.cancel}>
										Cancelar
									</Button>
								) : (
									<>
										<Button
											variant="ghost"
											onClick={() => transfer.setOpen(false)}
										>
											Cerrar
										</Button>
										<Button
											variant="secondary"
											onClick={() => void transfer.start()}
										>
											Solo guardar
										</Button>
										<Button onClick={() => void transfer.start(true)}>
											Guardar y abrir en Studio
										</Button>
									</>
								)}
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

function TransferOptions({ transfer }: { transfer: Transfer }) {
	return (
		<>
			<ExportSettingsMenu
				exportFormat="mp4"
				exportQuality={transfer.exportSettings.exportQuality}
				onExportQualityChange={transfer.exportSettings.setExportQuality}
				exportEncodingMode={transfer.exportSettings.exportEncodingMode}
				onExportEncodingModeChange={transfer.exportSettings.setExportEncodingMode}
				mp4FrameRate={transfer.exportSettings.mp4FrameRate}
				onMp4FrameRateChange={transfer.exportSettings.setMp4FrameRate}
				mp4OutputDimensions={transfer.getOutputDimensions()}
				gifFrameRate={transfer.exportSettings.gifFrameRate}
				gifLoop={transfer.exportSettings.gifLoop}
				gifSizePreset={transfer.exportSettings.gifSizePreset}
				gifOutputDimensions={{ width: 0, height: 0 }}
				hideHeading
				hideAction
				linkMode
				className="rounded-none bg-transparent p-0 shadow-none"
			/>
			{transfer.canIncludeFinal && (
				<div className="space-y-1">
					<Switch
						checked={transfer.includeFinal}
						onCheckedChange={transfer.setIncludeFinal}
					>
						<Label>Incluir el video terminado</Label>
					</Switch>
					<Description>
						También exporta el video con fondo, cámara y zooms. Tarda lo mismo que
						Exportar.
					</Description>
				</div>
			)}
		</>
	);
}

function TransferProgress({ transfer }: { transfer: Transfer }) {
	return (
		<div role="status" aria-live="polite" className="space-y-3">
			<div className="flex items-baseline justify-between gap-3 text-sm">
				<span key={transfer.phase} className="t-shimmer" data-text={transfer.phase}>
					{transfer.phase}
				</span>
				<span className="shrink-0 tabular-nums text-muted">
					<TextSwap text={`${transfer.progress}%`} />
				</span>
			</div>
			<progress
				className="h-1.5 w-full accent-accent"
				value={transfer.progress}
				max={100}
				aria-label="Preparación del proyecto"
			/>
		</div>
	);
}

/** The result: what happened, where it is, and the one thing to do next. */
function TransferDone({ transfer }: { transfer: Transfer }) {
	const shown = useShownAfterMount();
	const folder = transfer.projectFolder;
	const finalVideo = transfer.finalVideoPath;
	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<SuccessCheck />
					Listo para Studio
				</DialogTitle>
			</DialogHeader>
			<div role="status" className={`t-stagger space-y-2 ${shown ? "is-shown" : ""}`}>
				<div className="t-stagger-line">
					<div className="flex items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2.5">
						<FolderOpen className="size-5 shrink-0 text-muted" />
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium" title={folder}>
								{folderName(folder)}
							</p>
							<p className="text-xs text-muted">Proyecto editable</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							aria-label="Copiar la ruta de la carpeta"
							title={transfer.folderCopied ? "Ruta copiada" : "Copiar ruta"}
							onClick={() => void transfer.copyProjectFolder()}
						>
							<Copy className="size-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => void window.electronAPI.revealInFolder(transfer.path!)}
						>
							Mostrar
						</Button>
					</div>
				</div>
				{finalVideo && (
					<div className="t-stagger-line t-stagger-line--2">
						<div className="flex items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2.5">
							<FilmStrip className="size-5 shrink-0 text-muted" />
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium" title={finalVideo}>
									{folderName(finalVideo)}
								</p>
								<p className="text-xs text-muted">
									Video terminado, en {SYKA_PACKAGE_FOLDERS.finals}
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => void window.electronAPI.revealInFolder(finalVideo)}
							>
								Mostrar
							</Button>
						</div>
					</div>
				)}
				{transfer.error && (
					<p role="alert" className="t-stagger-line text-sm text-danger">
						{transfer.error}
					</p>
				)}
				{transfer.warnings.length > 0 && (
					<details className="t-stagger-line t-stagger-line--3 text-xs text-muted">
						<summary className="cursor-pointer">Qué cambia en Studio</summary>
						<ul className="mt-2 list-disc space-y-1 pl-4">
							{transfer.warnings.map((warning) => (
								<li key={warning}>{warning}</li>
							))}
						</ul>
					</details>
				)}
			</div>
			<DialogFooter>
				<Button
					variant="ghost"
					disabled={transfer.openingStudio}
					onClick={() => void transfer.start()}
				>
					Guardar de nuevo
				</Button>
				<Button
					disabled={transfer.openingStudio}
					onClick={() => void transfer.openInStudio()}
				>
					{transfer.openingStudio ? "Abriendo Studio…" : "Abrir en Syka Studio"}
				</Button>
			</DialogFooter>
		</>
	);
}
