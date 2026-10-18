import { ChatCircle } from "@phosphor-icons/react";
import { AccountAvatar } from "@/components/ui/account-avatar";
import { Button } from "@/components/ui/button";
import { File, GearSix, House, Plus } from "@/components/ui/icons";
import { SykaBrandIcon } from "@/components/ui/syka-brand-icon";
import { useScopedT } from "@/contexts/I18nContext";
import { openExternalLink } from "../TutorialHelp";
import { FolderRow } from "./FolderRow";
import { RecordNewButton } from "./RecordNewButton";
import { SidebarCards } from "./SidebarCards";

import type { DashboardProps } from "./types";

import type { DashboardModel } from "./useDashboardModel";
import { FOLDER_COLORS } from "./useProjectFolders";

export function DashboardSidebar({
	busy,
	run,
	folders,
	save,
	section,
	setSection,
	metadata,
	update,
	navClass,
	onSignIn,
	accountLabel,
}: Pick<
	DashboardProps & DashboardModel,
	| "busy"
	| "run"
	| "folders"
	| "save"
	| "section"
	| "setSection"
	| "metadata"
	| "update"
	| "navClass"
	| "onSignIn"
	| "accountLabel"
>) {
	const tc = useScopedT("common");
	return (
		<>
			<aside
				aria-label="Library navigation"
				className="flex w-48 shrink-0 flex-col bg-transparent px-4 pb-5 pt-12 lg:w-56"
			>
				<div className="mb-4 flex min-h-10 items-center gap-2.5 px-3">
					<SykaBrandIcon />
					<div className="flex min-w-0 flex-col">
						<span className="text-[15px] font-semibold tracking-tight">
							{tc("app.name", "Syka Recorder")}
						</span>
					</div>
				</div>
				<RecordNewButton busy={busy} run={run} className="mb-5 w-full" />
				<nav className="space-y-1">
					<Button
						variant="ghost"
						className={navClass(section === "projects")}
						aria-current={section === "projects" ? "page" : undefined}
						onClick={() => setSection("projects")}
					>
						<House weight="fill" className="size-[18px]" />
						Home
					</Button>
					<Button
						variant="ghost"
						className={navClass(section === "raw")}
						aria-current={section === "raw" ? "page" : undefined}
						onClick={() => setSection("raw")}
					>
						<File
							weight={section === "raw" ? "fill" : "regular"}
							className="size-[18px]"
						/>
						Raw
					</Button>
				</nav>
				<div className="mb-2 mt-9 flex items-center justify-between pl-3">
					<h2 className="text-[13px] font-semibold tracking-tight text-foreground/80">
						Folders
					</h2>
					<Button
						variant="ghost"
						size="icon"
						className="size-7 min-w-7"
						aria-label="New folder"
						onClick={() => {
							let name = "Untitled folder",
								index = 1;
							while (folders.some((folder) => folder.name === name))
								name = `Untitled folder ${index++}`;
							save([
								...folders,
								{
									id: crypto.randomUUID(),
									name,
									color: FOLDER_COLORS[0],
									paths: [],
								},
							]);
						}}
					>
						<Plus className="size-3.5" />
					</Button>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto space-y-1">
					{folders.map((folder) => (
						<FolderRow
							key={folder.id}
							folder={folder}
							active={section === folder.id}
							onSelect={() => setSection(folder.id)}
							onChange={(next) =>
								save(folders.map((item) => (item.id === next.id ? next : item)))
							}
							onRemove={() => {
								save(folders.filter((item) => item.id !== folder.id));
								if (section === folder.id) setSection("projects");
							}}
							colors={metadata.colors}
							onColors={(colors) => update({ ...metadata, colors })}
						/>
					))}
				</div>
				<div className="space-y-1 pt-6">
					<SidebarCards />
					<Button
						variant="ghost"
						className={navClass(false)}
						onClick={() =>
							void openExternalLink(
								"https://discord.gg/Sy5dtySQG9",
								"No se pudo abrir Discord de Syka.",
							)
						}
					>
						<ChatCircle className="size-[18px]" />
						Discord de Syka
					</Button>
					<Button
						variant="ghost"
						className={navClass(section === "settings")}
						aria-current={section === "settings" ? "page" : undefined}
						onClick={() => setSection("settings")}
					>
						<GearSix
							weight={section === "settings" ? "fill" : "regular"}
							className="size-[18px]"
						/>
						Settings
					</Button>
					<Button variant="ghost" className={navClass(false)} onClick={onSignIn}>
						<AccountAvatar label={accountLabel} className="!size-[20px] text-[9px]" />
						<span className="truncate">{accountLabel || "Perfil local"}</span>
					</Button>
					<p className="px-3 pt-3 text-[10px] leading-relaxed text-muted-foreground">
						{tc("app.basedOn", "Based on Recordly by webadderall (AGPL-3.0)")}
					</p>
				</div>
			</aside>
		</>
	);
}
