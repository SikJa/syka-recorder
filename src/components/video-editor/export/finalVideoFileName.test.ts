import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/exporter/mp4Support", () => ({}));
vi.mock("@/lib/sykaExport/renderTransfer", () => ({}));

import { finalVideoFileName } from "./useSykaTransfer";

describe("final video file name", () => {
	it("keeps the project name and makes it safe on Windows", () => {
		expect(finalVideoFileName("Mi grabación")).toBe("Mi grabación.mp4");
		expect(finalVideoFileName('Demo: "v2" / final?')).toBe("Demo_ _v2_ _ final_.mp4");
		expect(finalVideoFileName("Termina con punto. ")).toBe("Termina con punto.mp4");
		expect(finalVideoFileName("   ")).toBe("Video final.mp4");
	});
});
