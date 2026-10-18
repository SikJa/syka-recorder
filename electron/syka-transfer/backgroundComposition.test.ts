import { describe, expect, it } from "vitest";
import { backgroundComposition, gradientPaint } from "./backgroundComposition";
import type { TransferPlan } from "../../src/lib/sykaExport/contract";
import { recorderComposition } from "./composition";
const plan: TransferPlan = {
	name: "Appearance",
	canvas: { width: 1280, height: 720, frameRate: 30, durationMs: 2500 },
	clips: [{ id: "a", startMs: 0, endMs: 2500, sourceStartMs: 1000, speed: 2 }],
	audio: [],
	zooms: [],
	warnings: [],
};
describe("portable scene appearance", () => {
	it("loops animated backgrounds on timeline time, independently of source trims and zooms", () => {
		const code = backgroundComposition(
			{ ...plan, background: { kind: "video", assetId: "bg", durationMs: 1000, blur: 1 } },
			() => '{"media/bg.mp4"}',
		);
		expect(code.match(/<video /g)).toHaveLength(3);
		expect(code).toContain("start={2} end={2.5} sourceIn={0}");
		expect(code).toContain("x={-4} y={-4} width={1288} height={728}");
		expect(code).toContain('<effect type="blur" value={2}');
		expect(code).not.toContain("playbackRate={2}");
	});
	it("keeps CSS gradient direction, rgba colors, explicit and interpolated stops", () => {
		const code = gradientPaint("linear-gradient(90deg, rgba(15,2,2,1) 10%, #fff, #000 90%)");
		expect(code).toContain("rotation={0}");
		expect(code).toContain('color={"rgba(15,2,2,1)"} offset={0.1}');
		expect(code).toContain('color={"#fff"} offset={0.5}');
	});
	it("puts the background below the framed screen, with camera above zooms", () => {
		const code = recorderComposition({
			format: "syka-recorder-transfer",
			version: 1,
			createdAt: "",
			assets: ["screen", "screen-mask", "screen-shadow"].map((id) => ({
				id,
				path: `media/${id}`,
				role: id,
				size: 1,
				sha256: "",
			})),
			plan: {
				...plan,
				background: { kind: "color", value: "#abcdef", blur: 0 },
				screen: {
					x: 30,
					y: 20,
					width: 1220,
					height: 680,
					sourceWidth: 1280,
					sourceHeight: 720,
					cornerRadius: 40,
					shadow: 0.5,
					maskAssetId: "screen-mask",
					shadowAssetId: "screen-shadow",
					shadowPadding: 80,
				},
			},
		});
		expect(code.indexOf('id="background-track"')).toBeLessThan(
			code.indexOf('id="screen-track"'),
		);
		expect(code.indexOf('id="screen-track"')).toBeLessThan(code.indexOf('id="zoom-track"'));
		expect(code).toContain("x={30} y={20} width={1220} height={680}");
		expect(code).toContain('src={"media/screen-mask"}');
		expect(code).toContain("sourceIn={1} playbackRate={2} muted");
	});
});
