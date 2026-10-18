import { Input, Label, TextField } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { readProfilePicture, saveLocalProfile, useLocalProfile } from "@/lib/localProfile";

export function LocalProfileForm({ onSaved }: { onSaved?: () => void }) {
	const profile = useLocalProfile();
	const [name, setName] = useState(profile.name);
	const [picture, setPicture] = useState(profile.picture);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const [saved, setSaved] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	useEffect(() => {
		setName(profile.name);
		setPicture(profile.picture);
	}, [profile]);
	return (
		<form
			className="space-y-5"
			onSubmit={(event) => {
				event.preventDefault();
				try {
					saveLocalProfile({ name, picture });
					setError(undefined);
					setSaved(true);
					onSaved?.();
				} catch (error) {
					setError(String(error instanceof Error ? error.message : error));
				}
			}}
		>
			<div className="flex items-center gap-4">
				<div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-xl font-medium text-accent">
					{picture ? (
						<img
							src={picture}
							alt="Foto de perfil"
							className="size-full object-cover"
						/>
					) : (
						(name.trim()[0] || "S").toUpperCase()
					)}
				</div>
				<div className="space-y-2">
					<Button
						type="button"
						variant="secondary"
						size="sm"
						disabled={busy}
						onClick={() => input.current?.click()}
					>
						{busy ? "Preparando imagen…" : "Elegir imagen"}
					</Button>
					{picture && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={busy}
							onClick={() => {
								setPicture(undefined);
								setSaved(false);
							}}
						>
							Quitar
						</Button>
					)}
					<p className="text-xs text-muted">PNG, JPG, WebP o GIF · hasta 10 MB</p>
				</div>
				<input
					ref={input}
					type="file"
					accept="image/png,image/jpeg,image/webp,image/gif"
					className="hidden"
					aria-label="Imagen de perfil local"
					onChange={async (event) => {
						const file = event.target.files?.[0];
						event.target.value = "";
						if (!file) return;
						setBusy(true);
						setError(undefined);
						setSaved(false);
						try {
							setPicture(await readProfilePicture(file));
						} catch (error) {
							setError(error instanceof Error ? error.message : String(error));
						} finally {
							setBusy(false);
						}
					}}
				/>
			</div>
			<TextField
				name="localProfileName"
				value={name}
				onChange={(value) => {
					setName(value);
					setSaved(false);
				}}
			>
				<Label>Nombre</Label>
				<Input maxLength={80} autoComplete="nickname" />
			</TextField>
			{error && (
				<p role="alert" className="text-sm text-danger">
					{error}
				</p>
			)}
			{saved && (
				<p role="status" className="text-sm text-success">
					Perfil guardado.
				</p>
			)}
			<Button type="submit" disabled={busy}>
				Guardar perfil
			</Button>
		</form>
	);
}

export function LocalProfileDialog({
	open,
	onOpenChange,
	share = false,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	share?: boolean;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{share ? "Compartir grabación" : "Tu perfil en Syka Recorder"}
					</DialogTitle>
					<DialogDescription>
						{share
							? "Podés exportar el video o abrir el proyecto en Syka Studio. Compartir por enlace todavía no está disponible."
							: "Tu nombre y tu imagen se guardan en este equipo."}
					</DialogDescription>
				</DialogHeader>
				{share ? (
					<Button onClick={() => onOpenChange(false)}>Entendido</Button>
				) : (
					<LocalProfileForm onSaved={() => onOpenChange(false)} />
				)}
			</DialogContent>
		</Dialog>
	);
}
