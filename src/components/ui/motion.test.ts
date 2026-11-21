import { describe, expect, it, vi } from "vitest";

vi.mock("@/styles/transitions.css", () => ({}));

import { parseCssDuration } from "./motion";

describe("CSS duration tokens", () => {
	it("reads both units, as the minifier rewrites 150ms to .15s", () => {
		expect(parseCssDuration("150ms", 0)).toBe(150);
		expect(parseCssDuration(" .15s", 0)).toBe(150);
		expect(parseCssDuration("0.25s", 0)).toBe(250);
		expect(parseCssDuration("", 150)).toBe(150);
		expect(parseCssDuration("auto", 150)).toBe(150);
	});
});
