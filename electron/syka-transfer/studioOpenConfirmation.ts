import path from "node:path";

/**
 * Switching projects reloads Studio's window, and its CLI rejects a call that is
 * still waiting when the page reloads ("The app reloaded before replying"),
 * even though the project did open. Only that interruption is worth confirming.
 */
export function isReloadInterruption(error: unknown): boolean {
	const details = [
		error instanceof Error ? error.message : String(error),
		(error as { stderr?: unknown } | null)?.stderr,
	]
		.filter((value): value is string => typeof value === "string")
		.join("\n");
	return /reloaded before replying/i.test(details);
}

export function isSameProjectDirectory(left: string, right: string): boolean {
	const normalize = (value: string) => {
		const resolved = path.resolve(value).replace(/[\\/]+$/, "");
		return process.platform === "win32" ? resolved.toLowerCase() : resolved;
	};
	return normalize(left) === normalize(right);
}

/** Polls Studio's `context` until it reports `projectDirectory` as the open project. */
export async function confirmProjectOpened(
	readContext: () => Promise<string>,
	projectDirectory: string,
	options: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<boolean> {
	const attempts = options.attempts ?? 30;
	const delayMs = options.delayMs ?? 500;
	const sleep =
		options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

	for (let attempt = 0; attempt < attempts; attempt++) {
		try {
			const context = JSON.parse((await readContext()).trim()) as { projectDir?: unknown };
			if (
				typeof context?.projectDir === "string" &&
				isSameProjectDirectory(context.projectDir, projectDirectory)
			) {
				return true;
			}
		} catch {
			// The window may still be loading; ask again.
		}
		if (attempt < attempts - 1) await sleep(delayMs);
	}
	return false;
}
