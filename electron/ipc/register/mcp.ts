import { ipcMain } from "electron";
import type { McpController } from "../../mcp/controller";

/** The Settings toggle: read the agent endpoint's state and turn it on or off. */
export function registerMcpHandlers(controller: McpController) {
	ipcMain.handle("mcp-server-status", () => controller.status());
	ipcMain.handle("mcp-server-set-enabled", (_event, enabled: unknown) => {
		if (typeof enabled !== "boolean") return controller.status();
		return controller.setEnabled(enabled);
	});
}
