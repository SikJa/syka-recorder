import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ExportSettingsMenu } from "../ExportSettingsMenu";
import type { useSykaTransfer } from "./useSykaTransfer";

export function SykaTransferButton({
	transfer,
	disabled,
}: {
	transfer: ReturnType<typeof useSykaTransfer>;
	disabled: boolean;
}) {
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
					<DialogHeader>
						<DialogTitle>Seguí editando en Syka Studio</DialogTitle>
						<DialogDescription>
							Cortes y zooms editables, con audio y webcam en pistas separadas.
						</DialogDescription>
					</DialogHeader>
					<p className="text-sm text-muted">
						Se conservan el fondo, los márgenes, los bordes y las sombras. La cámara
						queda en su propia pista. El cursor y el recorte quedan incorporados al video.
					</p>
					{!transfer.busy && !transfer.path && (
						<ExportSettingsMenu
							exportFormat="mp4"
							exportQuality={transfer.exportSettings.exportQuality}
							onExportQualityChange={transfer.exportSettings.setExportQuality}
							exportEncodingMode={transfer.exportSettings.exportEncodingMode}
							onExportEncodingModeChange={
								transfer.exportSettings.setExportEncodingMode
							}
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
					)}
					{transfer.busy && (
						<div role="status" aria-live="polite" className="space-y-2">
							<p className="text-sm">{transfer.phase}</p>
							<progress
								className="h-2 w-full accent-accent"
								value={transfer.progress}
								max={100}
								aria-label="Preparación del paquete"
							/>
						</div>
					)}
					{transfer.error && (
						<p role="alert" className="text-sm text-danger">
							{transfer.error}
						</p>
					)}
					{transfer.path && (
						<div role="status" className="space-y-2">
							<p className="text-sm">
								Proyecto listo. Abrilo directamente en Studio para seguir editando.
							</p>
							<p className="text-sm text-muted">
								Para abrirlo manualmente, elegí esta carpeta como proyecto en
								Studio. El manifest.json solo describe el montaje: adjuntarlo al
								chat no importa los videos.
							</p>
							<label className="block space-y-1 text-sm">
								<span>Carpeta del proyecto</span>
								<input
									readOnly
									value={transfer.projectFolder}
									onFocus={(event) => event.currentTarget.select()}
									className="w-full rounded-md bg-background px-3 py-2 text-sm"
								/>
							</label>
							<Button
								variant="secondary"
								onClick={() => void transfer.copyProjectFolder()}
							>
								{transfer.folderCopied
									? "Ruta copiada"
									: "Copiar ruta de la carpeta"}
							</Button>
							{transfer.warnings.length > 0 && (
								<details className="text-sm text-muted">
									<summary>Qué se conserva y qué cambia</summary>
									<ul className="mt-2 list-disc pl-4">
										{transfer.warnings.map((warning) => (
											<li key={warning}>{warning}</li>
										))}
									</ul>
								</details>
							)}
						</div>
					)}
					<DialogFooter>
						{transfer.busy ? (
							<Button variant="secondary" onClick={transfer.cancel}>
								Cancelar
							</Button>
						) : (
							<>
								<Button variant="ghost" onClick={() => transfer.setOpen(false)}>
									Cerrar
								</Button>
								{transfer.path ? (
									<>
										<Button
											variant="ghost"
											disabled={transfer.openingStudio}
											onClick={() => void transfer.start()}
										>
											Guardar de nuevo
										</Button>
										<Button
											variant="secondary"
											onClick={() =>
												void window.electronAPI.revealInFolder(
													transfer.path!,
												)
											}
										>
											Mostrar carpeta
										</Button>
										<Button
											disabled={transfer.openingStudio}
											onClick={() => void transfer.openInStudio()}
										>
											{transfer.openingStudio
												? "Abriendo Studio…"
												: "Abrir en Syka Studio"}
										</Button>
									</>
								) : (
									<>
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
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
