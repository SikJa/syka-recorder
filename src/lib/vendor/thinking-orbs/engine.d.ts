/** Public engine subset used by the Syka brand. Implementation: thinking-orbs 0.3.1 (MIT). */
export function resolvePreset(
	state: "composing",
	size: 20,
): {
	mode: string;
	speed: number;
	opts: Record<string, unknown>;
};
export const MODE_DRAWS: Record<
	string,
	(
		context: CanvasRenderingContext2D,
		size: number,
		time: number,
		dark: boolean,
		options: Record<string, unknown>,
	) => void
>;
