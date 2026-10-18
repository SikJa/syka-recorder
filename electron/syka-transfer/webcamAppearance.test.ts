import { describe, expect, it } from "vitest";
import type { TransferPlan } from "../../src/lib/sykaExport/contract";
import { MaskFile } from "./studioMask";
import { webcamAppearance } from "./webcamAppearance";

const webcam: NonNullable<TransferPlan["webcam"]> = {
	assetId: "webcam",
	delayMs: 0,
	mirror: false,
	x: 0,
	y: 0,
	width: 80,
	height: 80,
	cornerRadius: 40,
	crop: { x: 0, y: 0, width: 1, height: 1 },
	shadow: 0.4,
};
describe("portable webcam appearance", () => {
	it("decodes the Recorder squircle as a native matte, including fractional overlay sizes", async () => {
		const result = await webcamAppearance({ ...webcam, width: 80.25, height: 80.25 });
		const mask = await MaskFile.read(new Blob([new Uint8Array(result.mask)]));
		expect(mask.frameCount).toBe(1);
		expect(mask.header.width).toBe(80 + result.maskPadding * 2);
		const field = new Int8Array(mask.header.gridWidth * mask.header.gridHeight);
		expect(mask.field(0, field)).toBe(true);
		expect(field[0]).toBeLessThan(0);
		expect(field[40 * mask.header.gridWidth + 40]).toBeGreaterThan(0);
		// Inside the approved squircle, but outside a circular mask of the same size.
		expect(field[10 * mask.header.gridWidth + 10]).toBeGreaterThan(0);
		expect(result.shadow?.match(/<feDropShadow /g)).toHaveLength(2);
		expect(result.padding).toBeGreaterThan(0);
	});
	it("keeps sharp corners and emits no shadow when those effects are disabled", async () => {
		const result = await webcamAppearance({ ...webcam, cornerRadius: 0, shadow: 0 });
		const mask = await MaskFile.read(new Blob([new Uint8Array(result.mask)]));
		const field = new Int8Array(mask.header.gridWidth * mask.header.gridHeight);
		mask.field(0, field);
		expect(field[0]).toBeLessThan(0);
		expect(field[40 * mask.header.gridWidth + 40]).toBeGreaterThan(0);
		// Coverage borders stay transparent even for a square camera, preventing
		// fractional-scale antialiasing from leaving a rectangular seam.
		for (let x = 0; x < mask.header.gridWidth; x++) {
			expect(field[x]).toBeLessThan(0);
			expect(field[(mask.header.gridHeight - 1) * mask.header.gridWidth + x]).toBeLessThan(0);
		}
		expect(result.shadow).toBeUndefined();
	});
});
