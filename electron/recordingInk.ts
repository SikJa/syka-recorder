import { BrowserWindow, desktopCapturer, ipcMain, screen } from "electron";
import {
	EMPTY_INK_SCENE,
	isInkScene,
	type InkRect,
	type InkScene,
	type InkUpdate,
} from "../src/components/launch/drawing/contract";

// The protected HUD owns input and controls; this non-interactive window owns
// only ink. It deliberately remains visible to screen/region WGC capture.
export function createRecordingInkController(options: {
	getHud: () => BrowserWindow | null;
	preload: string;
	load: (window: BrowserWindow) => Promise<unknown>;
}) {
	let active = false;
	let ink: BrowserWindow | null = null;
	let loading: Promise<void> | null = null;
	let scene: InkScene = EMPTY_INK_SCENE;
	const authorized = (sender: Electron.WebContents) =>
		active && sender === options.getHud()?.webContents;
	const dispose = () => {
		const previous = ink;
		ink = null;
		loading = null;
		scene = EMPTY_INK_SCENE;
		if (previous && !previous.isDestroyed()) previous.destroy();
	};
	async function ensure() {
		if (loading) return loading;
		if (ink && !ink.isDestroyed()) return;
		const hud = options.getHud();
		if (!active || !hud || process.platform !== "win32")
			throw new Error("Dibujo disponible durante una grabación en Windows.");
		const window = new BrowserWindow({
			...hud.getBounds(),
			title: "Syka Recorder — tinta",
			transparent: true,
			backgroundColor: "#00000000",
			frame: false,
			resizable: false,
			focusable: false,
			show: false,
			skipTaskbar: true,
			hasShadow: false,
			alwaysOnTop: true,
			webPreferences: {
				preload: options.preload,
				nodeIntegration: false,
				contextIsolation: true,
				backgroundThrottling: false,
			},
		});
		ink = window;
		window.setContentProtection(false);
		window.setAlwaysOnTop(true, "screen-saver");
		window.setIgnoreMouseEvents(true);
		const sync = () => {
			if (!window.isDestroyed() && !hud.isDestroyed())
				window.setBounds(hud.getBounds(), false);
		};
		hud.on("move", sync);
		hud.on("resize", sync);
		const close = () => {
			if (ink === window) dispose();
		};
		hud.once("closed", close);
		// A destroyed renderer must not leave an invisible input surface behind.
		window.webContents.on("render-process-gone", () => {
			if (!hud.isDestroyed())
				hud.webContents.send(
					"recording-ink-error",
					"Se cerró la capa de dibujo. Volvé a abrir el lápiz.",
				);
			close();
		});
		window.on("closed", () => {
			hud.removeListener("move", sync);
			hud.removeListener("resize", sync);
			hud.removeListener("closed", close);
		});
		loading = options
			.load(window)
			.then(() => {
				if (!active || ink !== window || window.isDestroyed()) return;
				window.showInactive();
				// Controls stay above ink, without moving/recreating the webcam or HUD.
				if (!hud.isDestroyed()) hud.moveTop();
			})
			.catch((error) => {
				if (ink === window) dispose();
				throw error;
			})
			.finally(() => {
				if (ink === window) loading = null;
			});
		return loading;
	}
	ipcMain.handle("recording-ink-start", async (event) => {
		if (!authorized(event.sender))
			return { success: false, error: "No hay una grabación activa." };
		try {
			await ensure();
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	});
	ipcMain.on("recording-ink-scene", (event, value: InkUpdate) => {
		if (
			!authorized(event.sender) ||
			!value ||
			!isInkScene({ marks: value.marks ?? [], draft: value.draft })
		)
			return;
		scene = { marks: value.marks ?? scene.marks, draft: value.draft };
		if (ink && !ink.isDestroyed()) ink.webContents.send("recording-ink-scene", value);
	});
	ipcMain.on("recording-ink-ready", (event) => {
		if (active && ink && event.sender === ink.webContents)
			event.sender.send("recording-ink-scene", scene);
	});
	ipcMain.handle("recording-ink-sample", async (event, rect: InkRect) => {
		if (!authorized(event.sender)) return { success: false, error: "Grabación terminada." };
		try {
			if (
				!rect ||
				![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) ||
				rect.width < 2 ||
				rect.height < 2
			)
				throw new Error("Área inválida.");
			const hud = options.getHud()!;
			const hudBounds = hud.getBounds(),
				display = screen.getDisplayMatching(hudBounds);
			const sources = await desktopCapturer.getSources({
				types: ["screen"],
				thumbnailSize: {
					width: Math.ceil(display.size.width * display.scaleFactor),
					height: Math.ceil(display.size.height * display.scaleFactor),
				},
			});
			if (!authorized(event.sender)) return { success: false, error: "Grabación terminada." };
			const source = sources.find((s) => s.display_id === String(display.id));
			if (!source || source.thumbnail.isEmpty())
				throw new Error("No se pudo tomar la muestra de pantalla.");
			const image = source.thumbnail,
				size = image.getSize();
			const sx = size.width / display.bounds.width,
				sy = size.height / display.bounds.height;
			const x = Math.max(0, Math.floor((hudBounds.x - display.bounds.x + rect.x) * sx));
			const y = Math.max(0, Math.floor((hudBounds.y - display.bounds.y + rect.y) * sy));
			const width = Math.min(size.width - x, Math.ceil(rect.width * sx));
			const height = Math.min(size.height - y, Math.ceil(rect.height * sy));
			if (width < 1 || height < 1) throw new Error("Área fuera de pantalla.");
			return { success: true, dataUrl: image.crop({ x, y, width, height }).toDataURL() };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	});
	return {
		setRecording(value: boolean) {
			active = value;
			if (!value) dispose();
		},
		dispose,
	};
}
