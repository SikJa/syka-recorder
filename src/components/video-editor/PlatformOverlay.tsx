import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CaretDown, Check, DeviceMobile } from "@/components/ui/icons";
import {
	DEFAULT_PLATFORM_OVERLAY,
	normalizePlatformOverlayPreference,
	PLATFORM_OVERLAYS,
	PLATFORM_OVERLAYS_VERSION,
	type OverlayElement,
	type PlatformOverlay,
	type PlatformOverlayPreference,
} from "@/lib/platformOverlays";
import type { AspectRatio } from "@/utils/aspectRatioUtils";

const STORAGE_KEY = "syka.preview.platformOverlay.v1";

/** The app preview choice is per computer, like CapCut's: it never changes the project. */
export function usePlatformOverlayPreference() {
	const [preference, setState] = useState<PlatformOverlayPreference>(() => {
		try {
			return normalizePlatformOverlayPreference(
				JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"),
			);
		} catch {
			return DEFAULT_PLATFORM_OVERLAY;
		}
	});
	const setPreference = useCallback((next: PlatformOverlayPreference) => {
		setState(next);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {
			/* Still applies for this session. */
		}
	}, []);
	return [preference, setPreference] as const;
}

/** Overlays are drawn for the exact formats the apps use: 9:16 and 16:9. */
export function overlaysForAspect(aspectRatio: AspectRatio): PlatformOverlay[] {
	const orientation =
		aspectRatio === "9:16" ? "portrait" : aspectRatio === "16:9" ? "landscape" : null;
	return Object.values(PLATFORM_OVERLAYS).filter(
		(overlay) => overlay.orientation === orientation,
	);
}

export function PlatformOverlayMenu({
	aspectRatio,
	preference,
	onChange,
}: {
	aspectRatio: AspectRatio;
	preference: PlatformOverlayPreference;
	onChange: (next: PlatformOverlayPreference) => void;
}) {
	const available = overlaysForAspect(aspectRatio);
	const active = available.find((overlay) => overlay.id === preference.platform);
	const item =
		"flex cursor-pointer items-center justify-between gap-3 text-muted-foreground hover:bg-foreground/10 hover:text-foreground";
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 gap-1.5 px-2 text-xs"
					title={`Interfaces al ${PLATFORM_OVERLAYS_VERSION}. Solo se ven acá; no se exportan.`}
				>
					<DeviceMobile className="h-3.5 w-3.5" />
					<span className="font-medium">{active ? active.label : "Vista de app"}</span>
					{active ? <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" /> : null}
					<CaretDown className="h-3 w-3" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="center">
				{available.length === 0 ? (
					<DropdownMenuItem disabled className="max-w-60 text-xs text-muted-foreground">
						Elegí 9:16 o 16:9 para ver cómo queda en TikTok, Instagram o YouTube.
					</DropdownMenuItem>
				) : (
					<>
						<DropdownMenuItem
							className={item}
							onClick={() => onChange({ ...preference, platform: null })}
						>
							<span>Sin vista de app</span>
							{!active ? <Check className="h-3 w-3 text-[#2563EB]" /> : null}
						</DropdownMenuItem>
						{available.map((overlay) => (
							<DropdownMenuItem
								key={overlay.id}
								className={item}
								onClick={() => onChange({ ...preference, platform: overlay.id })}
							>
								<span>{overlay.label}</span>
								{active?.id === overlay.id ? (
									<Check className="h-3 w-3 text-[#2563EB]" />
								) : null}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className={item}
							onClick={() => onChange({ ...preference, mode: "app" })}
						>
							<span>Mostrar la interfaz</span>
							{preference.mode === "app" ? (
								<Check className="h-3 w-3 text-[#2563EB]" />
							) : null}
						</DropdownMenuItem>
						<DropdownMenuItem
							className={item}
							onClick={() => onChange({ ...preference, mode: "safe" })}
						>
							<span>Solo zonas seguras</span>
							{preference.mode === "safe" ? (
								<Check className="h-3 w-3 text-[#2563EB]" />
							) : null}
						</DropdownMenuItem>
						{aspectRatio === "9:16" && (
							<DropdownMenuItem
								className={item}
								onClick={() =>
									onChange({ ...preference, showNavBar: !preference.showNavBar })
								}
							>
								<span>Barra de navegación del celular</span>
								{preference.showNavBar ? (
									<Check className="h-3 w-3 text-[#2563EB]" />
								) : null}
							</DropdownMenuItem>
						)}
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** 24-unit glyphs for the app buttons, drawn white like the apps do. */
const GLYPHS: Record<string, string> = {
	like: "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.3 2.4.7-1.2 2.1-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C18.5 16.4 12 21 12 21z",
	comment:
		"M12 3.5c5 0 9 3.3 9 7.6s-4 7.6-9 7.6c-1 0-2-.1-2.9-.4L4.5 20l1.2-3.6C4 15 3 13.1 3 11.1 3 6.8 7 3.5 12 3.5z",
	bookmark: "M6.5 3.5h11a1 1 0 0 1 1 1V21L12 16.8 5.5 21V4.5a1 1 0 0 1 1-1z",
	share: "M13.5 4.5 21 11.5l-7.5 7v-4.2C8.5 14.3 5 16 3 20c.5-6.3 4.4-10.3 10.5-11.2z",
	repost: "M7 7h10l-2.5-2.5M17 17H7l2.5 2.5M17 7v5M7 17v-5",
	remix: "M12 4a8 8 0 1 0 8 8M12 4l3-2.5M12 4l3 2.5",
	search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 21 21",
	camera: "M4 8h3.5L9 5.5h6L16.5 8H20v11H4zM12 10.5a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4z",
	more: "M5 12h.01M12 12h.01M19 12h.01",
	close: "M6 6l12 12M18 6 6 18",
};
const STROKED = new Set(["repost", "remix", "search", "camera", "more", "close"]);
const COUNTS: Record<string, string> = {
	like: "24,5 mil",
	comment: "318",
	bookmark: "1204",
	share: "Compartir",
	remix: "Remix",
};

function renderElement(element: OverlayElement, W: number, H: number) {
	const x = element.x * W,
		y = element.y * H,
		w = element.w * W,
		h = element.h * H;
	switch (element.kind) {
		case "icon": {
			const glyph = GLYPHS[element.id] ?? GLYPHS.more;
			const size = Math.min(w, h) * (COUNTS[element.id] ? 0.78 : 0.8);
			const cx = x + w / 2;
			const count = COUNTS[element.id];
			return (
				<g key={element.id}>
					<g
						transform={`translate(${cx - size / 2} ${y}) scale(${size / 24})`}
						fill={STROKED.has(element.id) ? "none" : "#fff"}
						stroke={STROKED.has(element.id) ? "#fff" : "none"}
						strokeWidth={STROKED.has(element.id) ? 2.2 : 0}
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d={glyph} />
					</g>
					{count ? (
						<text
							x={cx}
							y={y + size + h * 0.32}
							textAnchor="middle"
							fontSize={h * 0.3}
							fontWeight={600}
							fill="#fff"
						>
							{count}
						</text>
					) : null}
				</g>
			);
		}
		case "avatar": {
			const r = Math.min(w, h) / 2;
			return (
				<g key={element.id}>
					<circle
						cx={x + w / 2}
						cy={y + h / 2}
						r={r}
						fill="#3a3a3a"
						stroke="#fff"
						strokeWidth={r * 0.08}
					/>
					<circle cx={x + w / 2} cy={y + h / 2 - r * 0.15} r={r * 0.35} fill="#9a9a9a" />
				</g>
			);
		}
		case "text":
			return (
				<text
					key={element.id}
					x={x}
					y={y + h * 0.8}
					fontSize={h * 0.8}
					fontWeight={element.id === "username" || element.id === "title" ? 700 : 500}
					fill="#fff"
				>
					{element.label}
				</text>
			);
		case "pill": {
			const solid = element.label === "Suscribirse";
			return (
				<g key={element.id}>
					<rect
						x={x}
						y={y}
						width={w}
						height={h}
						rx={h / 2}
						fill={solid ? "#fff" : "rgba(0,0,0,0.35)"}
					/>
					{!solid && <circle cx={x + h / 2} cy={y + h / 2} r={h * 0.38} fill="#9a9a9a" />}
					<text
						x={solid ? x + w / 2 : x + h * 1.05}
						y={y + h * 0.68}
						textAnchor={solid ? "middle" : "start"}
						fontSize={h * 0.5}
						fontWeight={600}
						fill={solid ? "#0f0f0f" : "#fff"}
					>
						{element.label}
					</text>
				</g>
			);
		}
		case "bar": {
			const slots = element.id === "controls" ? 0 : 5;
			return (
				<g key={element.id}>
					<rect x={x} y={y} width={w} height={h} fill="rgba(0,0,0,0.55)" />
					{Array.from({ length: slots }, (_, index) => (
						<rect
							key={index}
							x={x + (w / slots) * (index + 0.5) - h * 0.18}
							y={y + h * 0.32}
							width={h * 0.36}
							height={h * 0.36}
							rx={h * 0.08}
							fill={index === 2 ? "#fff" : "rgba(255,255,255,0.8)"}
						/>
					))}
					{element.id === "controls" && (
						<>
							<path
								d={`M${x + h * 0.4} ${y + h * 0.28}l${h * 0.36} ${h * 0.22}-${h * 0.36} ${h * 0.22}z`}
								fill="#fff"
							/>
							<text x={x + h * 1.2} y={y + h * 0.62} fontSize={h * 0.32} fill="#fff">
								0:42 / 3:15
							</text>
							{[0, 1, 2, 3].map((index) => (
								<rect
									key={index}
									x={x + w - h * (0.75 + index * 0.75)}
									y={y + h * 0.32}
									width={h * 0.36}
									height={h * 0.36}
									rx={h * 0.08}
									fill="rgba(255,255,255,0.85)"
								/>
							))}
						</>
					)}
				</g>
			);
		}
		case "progress":
			return (
				<g key={element.id}>
					<rect x={x} y={y} width={w} height={h} fill="rgba(255,255,255,0.35)" />
					<rect
						x={x}
						y={y}
						width={w * 0.35}
						height={h}
						fill={element.id === "progress" && W > H ? "#ff0033" : "#fff"}
					/>
				</g>
			);
		case "gradient":
			return (
				<rect
					key={element.id}
					x={x}
					y={y}
					width={w}
					height={h}
					fill="url(#syka-overlay-fade)"
				/>
			);
		case "area":
			return (
				<g key={element.id}>
					<rect
						x={x}
						y={y}
						width={w}
						height={h}
						rx={8}
						fill="rgba(255,255,255,0.06)"
						stroke="rgba(255,255,255,0.7)"
						strokeWidth={2}
						strokeDasharray="10 8"
					/>
					<text
						x={x + 14}
						y={y + 34}
						fontSize={26}
						fontWeight={600}
						fill="rgba(255,255,255,0.85)"
					>
						{element.label}
					</text>
				</g>
			);
	}
}

/** Drawn over the preview frame only; pointer events pass through to the editor. */
export function PlatformOverlayLayer({
	aspectRatio,
	preference,
}: {
	aspectRatio: AspectRatio;
	preference: PlatformOverlayPreference;
}) {
	const overlay = overlaysForAspect(aspectRatio).find(
		(candidate) => candidate.id === preference.platform,
	);
	if (!overlay) return null;
	const portrait = overlay.orientation === "portrait";
	const W = portrait ? 1080 : 1920,
		H = portrait ? 1920 : 1080;
	const safe = overlay.safe;
	const elements = overlay.elements.filter(
		(element) => !element.optional || preference.showNavBar,
	);
	return (
		<svg
			className="pointer-events-none absolute inset-0 z-30 h-full w-full"
			viewBox={`0 0 ${W} ${H}`}
			preserveAspectRatio="none"
			aria-hidden="true"
			data-platform-overlay={overlay.id}
			style={{ fontFamily: "Inter, system-ui, sans-serif" }}
		>
			<defs>
				<linearGradient id="syka-overlay-fade" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#000" stopOpacity="0" />
					<stop offset="1" stopColor="#000" stopOpacity="0.6" />
				</linearGradient>
				<filter id="syka-overlay-shadow" x="-10%" y="-10%" width="120%" height="120%">
					<feDropShadow
						dx="0"
						dy="1"
						stdDeviation="2.5"
						floodColor="#000"
						floodOpacity="0.55"
					/>
				</filter>
			</defs>
			{preference.mode === "safe" ? (
				safe ? (
					<g>
						<path
							d={`M0 0H${W}V${H}H0Z M${safe.x * W} ${safe.y * H}v${safe.h * H}h${safe.w * W}v${-safe.h * H}Z`}
							fill="rgba(244,53,53,0.22)"
							fillRule="evenodd"
						/>
						<rect
							x={safe.x * W}
							y={safe.y * H}
							width={safe.w * W}
							height={safe.h * H}
							fill="none"
							stroke="rgba(244,53,53,0.85)"
							strokeWidth={3}
							strokeDasharray="14 10"
						/>
						<text
							x={safe.x * W + 16}
							y={safe.y * H + 40}
							fontSize={30}
							fontWeight={600}
							fill="#fff"
							filter="url(#syka-overlay-shadow)"
						>
							{`Zona segura · ${overlay.label}`}
						</text>
					</g>
				) : (
					<g>
						{overlay.elements
							.filter((element) => element.kind === "area")
							.map((element) => renderElement(element, W, H))}
					</g>
				)
			) : (
				<g opacity={0.92} filter="url(#syka-overlay-shadow)">
					{safe && (
						<rect
							x={safe.x * W}
							y={safe.y * H}
							width={safe.w * W}
							height={safe.h * H}
							fill="none"
							stroke="rgba(255,255,255,0.35)"
							strokeWidth={2}
							strokeDasharray="12 10"
						/>
					)}
					{elements.map((element) => renderElement(element, W, H))}
				</g>
			)}
		</svg>
	);
}
