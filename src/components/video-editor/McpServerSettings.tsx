import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import type { McpServerStatus } from "@/lib/mcpBridge/contract";
import { useScopedT } from "../../contexts/I18nContext";
import { SettingsRow } from "./SettingsRow";

/** The agent endpoint: on/off, and the URL to paste into an agent's MCP config. */
export function McpServerSettings() {
	const t = useScopedT("settings");
	const [status, setStatus] = useState<McpServerStatus | null>(null);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		let active = true;
		void window.electronAPI
			?.getMcpServerStatus?.()
			.then((next) => {
				if (active) setStatus(next);
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, []);

	if (!status) return null;

	const toggle = async (enabled: boolean) => {
		setBusy(true);
		try {
			setStatus(await window.electronAPI.setMcpServerEnabled(enabled));
		} catch (error) {
			toast.error(String(error));
		} finally {
			setBusy(false);
		}
	};
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(status.url);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error(t("mcp.copyFailed", "Could not copy the address."));
		}
	};
	const title = t("mcp.title", "Agent control (MCP)");

	return (
		<SettingsRow
			title={title}
			description={
				<span className="flex flex-col gap-1">
					<span>
						{t(
							"mcp.description",
							"Lets AI agents on this computer record, open, export and send projects to Studio.",
						)}
					</span>
					{status.enabled && (
						<span className="flex items-center gap-2">
							<code className="truncate font-mono text-[11px]" title={status.url}>
								{status.url}
							</code>
							<Button
								variant="secondary"
								size="sm"
								className="h-6 shrink-0 px-2 text-[11px]"
								onClick={() => void copy()}
							>
								{copied ? t("mcp.copied", "Copied") : t("mcp.copy", "Copy")}
							</Button>
						</span>
					)}
					{status.enabled && status.error && (
						<span className="text-danger">{status.error}</span>
					)}
				</span>
			}
		>
			<Switch
				aria-label={title}
				checked={status.enabled}
				disabled={busy}
				onCheckedChange={(enabled) => void toggle(enabled)}
			/>
		</SettingsRow>
	);
}
