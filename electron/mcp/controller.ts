import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type BrowserWindow, ipcMain, type IpcMainEvent, type WebContents } from "electron";
import { readAppSetting, writeAppSetting } from "../appSettingsStore";
import {
	MCP_BRIDGE_READY,
	MCP_BRIDGE_REPLY,
	type McpServerStatus,
} from "../../src/lib/mcpBridge/contract";
import { McpHttpServer } from "./httpServer";
import { RendererBridge } from "./rendererBridge";
import {
	isMcpEnabled,
	MCP_ENABLED_SETTING,
	MCP_HOST,
	MCP_PATH,
	mcpEndpointUrl,
	resolveMcpPort,
} from "./settings";
import { McpTools } from "./tools";

export type McpControllerDeps = {
	version: string;
	hudWindow(): BrowserWindow | null;
	editorWindow(): BrowserWindow | null;
	openEditor(): BrowserWindow | null;
};

const INSTRUCTIONS =
	"Syka Recorder records the screen and edits recordings. Call status first. To record: list_sources and select_source if needed, start_recording, then stop_recording (it returns the saved video). To deliver: open_project, then export_mp4 or transfer_to_studio. The person sees everything happen in the app.";

/**
 * Owns the in-app MCP server: the HTTP endpoint, the bridge to the recorder
 * and editor windows, and the on/off setting. A busy port is reported, never
 * fatal: the app works the same without agents.
 */
export class McpController {
	private readonly deps: McpControllerDeps;
	private readonly bridge = new RendererBridge();
	private readonly http: McpHttpServer;
	private readonly tools: McpTools;
	private readonly port: number;
	private readonly observed = new WeakSet<WebContents>();
	private error: string | null = null;
	private starting: Promise<void> | null = null;

	constructor(deps: McpControllerDeps) {
		this.deps = deps;
		const { port, warning } = resolveMcpPort(process.env);
		if (warning) console.warn(`[mcp] ${warning}`);
		this.port = port;
		this.tools = new McpTools({
			version: deps.version,
			url: this.url,
			bridge: this.bridge,
			hudWindow: deps.hudWindow,
			editorWindow: deps.editorWindow,
			openEditor: deps.openEditor,
		});
		this.http = new McpHttpServer({
			host: MCP_HOST,
			port,
			path: MCP_PATH,
			createSession: () => this.createSession(),
		});
	}

	get url(): string {
		return mcpEndpointUrl(this.port);
	}

	/** Listens for the renderers' replies; then serves HTTP when the setting allows it. */
	async start(): Promise<void> {
		ipcMain.on(MCP_BRIDGE_READY, this.onReady);
		ipcMain.on(MCP_BRIDGE_REPLY, this.onReply);
		if (isMcpEnabled(readAppSetting)) await this.listen();
	}

	async setEnabled(enabled: boolean): Promise<McpServerStatus> {
		writeAppSetting(MCP_ENABLED_SETTING, enabled);
		if (enabled) await this.listen();
		else {
			this.error = null;
			await this.http.stop();
		}
		return this.status();
	}

	status(): McpServerStatus {
		return {
			enabled: isMcpEnabled(readAppSetting),
			running: this.http.listening,
			url: this.url,
			error: this.error,
		};
	}

	async stop(): Promise<void> {
		ipcMain.off(MCP_BRIDGE_READY, this.onReady);
		ipcMain.off(MCP_BRIDGE_REPLY, this.onReply);
		this.bridge.stop();
		await this.http.stop();
	}

	private listen(): Promise<void> {
		if (this.http.listening) return Promise.resolve();
		this.starting ??= this.http
			.start()
			.then(() => {
				this.error = null;
				console.log(`[mcp] Serving MCP at ${this.url}`);
			})
			.catch((error: NodeJS.ErrnoException) => {
				this.error =
					error.code === "EADDRINUSE"
						? `El puerto ${this.port} ya está ocupado por otro programa. Cerralo o elegí otro puerto con SYKA_RECORDER_MCP_PORT y reiniciá Recorder.`
						: `No se pudo iniciar el servidor MCP en ${this.url}: ${error.message}`;
				console.error(`[mcp] Cannot serve MCP at ${this.url}: ${error.message}`);
			})
			.finally(() => {
				this.starting = null;
			});
		return this.starting;
	}

	private createSession(): McpServer {
		const server = new McpServer(
			{ name: "syka-recorder", title: "Syka Recorder", version: this.deps.version },
			{ instructions: INSTRUCTIONS },
		);
		this.tools.register(server);
		return server;
	}

	private readonly onReady = (event: IpcMainEvent, commands: unknown) => {
		if (event.senderFrame !== event.sender.mainFrame) return;
		this.observe(event.sender);
		this.bridge.announce(event.sender.id, commands);
	};

	private readonly onReply = (event: IpcMainEvent, reply: unknown) => {
		if (event.senderFrame !== event.sender.mainFrame) return;
		this.bridge.reply(event.sender.id, reply);
	};

	private observe(contents: WebContents): void {
		if (this.observed.has(contents)) return;
		this.observed.add(contents);
		const id = contents.id;
		contents.on("did-start-navigation", (details) => {
			if (details.isMainFrame && !details.isSameDocument)
				this.bridge.forget(id, "The window reloaded before answering.");
		});
		contents.on("render-process-gone", () =>
			this.bridge.forget(id, "The window's renderer crashed."),
		);
		contents.once("destroyed", () =>
			this.bridge.forget(id, "The window closed before answering."),
		);
	}
}
