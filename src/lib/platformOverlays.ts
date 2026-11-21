/**
 * What each social app draws over a video, for the editor's "app preview".
 * Never part of an export. Layouts as of the date below
 * (docs/platform-overlays-research.md): the safe areas come from each
 * platform's ad specs; the position of each button is estimated from current
 * screenshots and templates, so treat them as a guide, not a measurement.
 */
export const PLATFORM_OVERLAYS_VERSION = "2026-11-21";

export type PlatformOverlayId = "tiktok" | "reels" | "stories" | "shorts" | "youtube";

/** Fractions of the frame. */
export type OverlayBox = { x: number; y: number; w: number; h: number };

export type OverlayElement = OverlayBox & {
	id: string;
	kind: "icon" | "avatar" | "text" | "pill" | "bar" | "progress" | "gradient" | "area";
	/** Sample text for text and pill elements, or the area's name. */
	label?: string;
	/** Bottom navigation bars sit outside the video on tall phones. */
	optional?: boolean;
};

export type PlatformOverlay = {
	id: PlatformOverlayId;
	label: string;
	orientation: "portrait" | "landscape";
	/** Area nothing covers, from the platform's ad specs (null when none is published). */
	safe: OverlayBox | null;
	safeSource: string;
	elements: OverlayElement[];
};

const ICON = { w: 0.1, h: 0.055 };

export const PLATFORM_OVERLAYS: Record<PlatformOverlayId, PlatformOverlay> = {
	tiktok: {
		id: "tiktok",
		label: "TikTok",
		orientation: "portrait",
		safe: { x: 0.111, y: 0.125, w: 0.778, h: 0.531 },
		safeSource: "TikTok, plantilla oficial de anuncios",
		elements: [
			{ id: "live", kind: "text", label: "LIVE", x: 0.03, y: 0.035, w: 0.08, h: 0.04 },
			{
				id: "tabs",
				kind: "text",
				label: "Siguiendo   Para ti",
				x: 0.27,
				y: 0.035,
				w: 0.46,
				h: 0.04,
			},
			{ id: "search", kind: "icon", x: 0.9, y: 0.035, w: 0.07, h: 0.04 },
			{ id: "avatar", kind: "avatar", x: 0.855, y: 0.47, w: 0.11, h: 0.065 },
			{ id: "like", kind: "icon", x: 0.86, y: 0.56, ...ICON },
			{ id: "comment", kind: "icon", x: 0.86, y: 0.63, ...ICON },
			{ id: "bookmark", kind: "icon", x: 0.86, y: 0.7, ...ICON },
			{ id: "share", kind: "icon", x: 0.86, y: 0.77, ...ICON },
			{ id: "disc", kind: "avatar", x: 0.87, y: 0.845, w: 0.08, h: 0.045 },
			{
				id: "username",
				kind: "text",
				label: "@tu_usuario",
				x: 0.03,
				y: 0.8,
				w: 0.5,
				h: 0.03,
			},
			{
				id: "caption",
				kind: "text",
				label: "Así se ve tu descripción… más",
				x: 0.03,
				y: 0.835,
				w: 0.72,
				h: 0.03,
			},
			{
				id: "sound",
				kind: "text",
				label: "♫ sonido original",
				x: 0.03,
				y: 0.88,
				w: 0.6,
				h: 0.025,
			},
			{ id: "progress", kind: "progress", x: 0, y: 0.993, w: 1, h: 0.004 },
			{ id: "navbar", kind: "bar", x: 0, y: 0.925, w: 1, h: 0.075, optional: true },
		],
	},
	reels: {
		id: "reels",
		label: "Instagram Reels",
		orientation: "portrait",
		safe: { x: 0.06, y: 0.14, w: 0.88, h: 0.51 },
		safeSource: "Meta, guía de anuncios",
		elements: [
			{ id: "title", kind: "text", label: "Reels", x: 0.04, y: 0.035, w: 0.2, h: 0.04 },
			{ id: "camera", kind: "icon", x: 0.89, y: 0.035, w: 0.07, h: 0.04 },
			{ id: "like", kind: "icon", x: 0.875, y: 0.6, w: 0.09, h: 0.05 },
			{ id: "comment", kind: "icon", x: 0.875, y: 0.665, w: 0.09, h: 0.05 },
			{ id: "repost", kind: "icon", x: 0.875, y: 0.73, w: 0.09, h: 0.05 },
			{ id: "share", kind: "icon", x: 0.875, y: 0.795, w: 0.09, h: 0.05 },
			{ id: "more", kind: "icon", x: 0.875, y: 0.86, w: 0.09, h: 0.03 },
			{ id: "audio", kind: "avatar", x: 0.88, y: 0.9, w: 0.08, h: 0.045 },
			{
				id: "account",
				kind: "pill",
				label: "tu_usuario · Seguir",
				x: 0.04,
				y: 0.8,
				w: 0.6,
				h: 0.04,
			},
			{
				id: "caption",
				kind: "text",
				label: "Así se ve tu descripción… más",
				x: 0.04,
				y: 0.85,
				w: 0.75,
				h: 0.03,
			},
			{
				id: "audio-line",
				kind: "text",
				label: "♫ tu_usuario · Audio original",
				x: 0.04,
				y: 0.89,
				w: 0.6,
				h: 0.025,
			},
			{ id: "navbar", kind: "bar", x: 0, y: 0.93, w: 1, h: 0.07, optional: true },
		],
	},
	stories: {
		id: "stories",
		label: "Instagram Stories",
		orientation: "portrait",
		safe: { x: 0.06, y: 0.14, w: 0.88, h: 0.51 },
		safeSource: "Meta, guía de anuncios",
		elements: [
			{ id: "segments", kind: "progress", x: 0.02, y: 0.01, w: 0.96, h: 0.004 },
			{
				id: "header",
				kind: "pill",
				label: "tu_usuario  2 h",
				x: 0.03,
				y: 0.025,
				w: 0.6,
				h: 0.04,
			},
			{ id: "close", kind: "icon", x: 0.88, y: 0.025, w: 0.09, h: 0.04 },
			{
				id: "reply",
				kind: "pill",
				label: "Enviar mensaje",
				x: 0.03,
				y: 0.925,
				w: 0.68,
				h: 0.045,
			},
			{ id: "like", kind: "icon", x: 0.74, y: 0.925, w: 0.1, h: 0.045 },
			{ id: "share", kind: "icon", x: 0.86, y: 0.925, w: 0.1, h: 0.045 },
		],
	},
	shorts: {
		id: "shorts",
		label: "YouTube Shorts",
		orientation: "portrait",
		safe: { x: 0.044, y: 0.15, w: 0.778, h: 0.5 },
		safeSource: "Google Ads, zona segura de Shorts",
		elements: [
			{ id: "search", kind: "icon", x: 0.8, y: 0.03, w: 0.08, h: 0.045 },
			{ id: "more", kind: "icon", x: 0.89, y: 0.03, w: 0.08, h: 0.045 },
			{ id: "like", kind: "icon", x: 0.87, y: 0.55, ...ICON },
			{ id: "comment", kind: "icon", x: 0.87, y: 0.625, ...ICON },
			{ id: "share", kind: "icon", x: 0.87, y: 0.7, ...ICON },
			{ id: "remix", kind: "icon", x: 0.87, y: 0.775, ...ICON },
			{ id: "sound", kind: "avatar", x: 0.88, y: 0.85, w: 0.08, h: 0.045 },
			{ id: "channel", kind: "pill", label: "@tu_canal", x: 0.03, y: 0.82, w: 0.38, h: 0.04 },
			{
				id: "subscribe",
				kind: "pill",
				label: "Suscribirse",
				x: 0.42,
				y: 0.822,
				w: 0.2,
				h: 0.035,
			},
			{
				id: "title",
				kind: "text",
				label: "El título de tu Short",
				x: 0.03,
				y: 0.87,
				w: 0.78,
				h: 0.03,
			},
			{
				id: "sound-line",
				kind: "text",
				label: "♫ sonido original",
				x: 0.03,
				y: 0.91,
				w: 0.6,
				h: 0.025,
			},
			{ id: "progress", kind: "progress", x: 0, y: 0.993, w: 1, h: 0.004 },
			{ id: "navbar", kind: "bar", x: 0, y: 0.93, w: 1, h: 0.07, optional: true },
		],
	},
	youtube: {
		id: "youtube",
		label: "YouTube",
		orientation: "landscape",
		safe: null,
		safeSource: "YouTube no publica un área segura para el reproductor",
		elements: [
			{
				id: "title",
				kind: "text",
				label: "El título de tu video · Tu canal",
				x: 0.02,
				y: 0.03,
				w: 0.6,
				h: 0.05,
			},
			{
				id: "end-screen",
				kind: "area",
				label: "Pantalla final (últimos 5–20 s)",
				x: 0.05,
				y: 0.25,
				w: 0.9,
				h: 0.5,
			},
			{
				id: "captions",
				kind: "area",
				label: "Subtítulos",
				x: 0.15,
				y: 0.78,
				w: 0.7,
				h: 0.09,
			},
			{ id: "gradient", kind: "gradient", x: 0, y: 0.78, w: 1, h: 0.22 },
			{ id: "progress", kind: "progress", x: 0.012, y: 0.895, w: 0.976, h: 0.006 },
			{ id: "controls", kind: "bar", x: 0, y: 0.91, w: 1, h: 0.08 },
		],
	},
};

export type PlatformOverlayMode = "app" | "safe";

export type PlatformOverlayPreference = {
	platform: PlatformOverlayId | null;
	mode: PlatformOverlayMode;
	showNavBar: boolean;
};

export const DEFAULT_PLATFORM_OVERLAY: PlatformOverlayPreference = {
	platform: null,
	mode: "app",
	showNavBar: false,
};

/** Platforms that fit a frame of this shape. */
export function platformsForFrame(width: number, height: number): PlatformOverlay[] {
	const orientation = height > width ? "portrait" : "landscape";
	return Object.values(PLATFORM_OVERLAYS).filter(
		(overlay) => overlay.orientation === orientation,
	);
}

export function normalizePlatformOverlayPreference(raw: unknown): PlatformOverlayPreference {
	if (!raw || typeof raw !== "object") return DEFAULT_PLATFORM_OVERLAY;
	const value = raw as Partial<PlatformOverlayPreference>;
	return {
		platform:
			typeof value.platform === "string" && value.platform in PLATFORM_OVERLAYS
				? value.platform
				: null,
		mode: value.mode === "safe" ? "safe" : "app",
		showNavBar: value.showNavBar === true,
	};
}
