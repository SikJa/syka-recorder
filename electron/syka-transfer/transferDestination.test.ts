import { describe, expect, it } from "vitest";
import { authorizeTransferDestination, takeTransferDestination } from "./transferDestination";

describe("agent-chosen transfer destination", () => {
	it("is absent unless an agent authorized it", () => {
		expect(takeTransferDestination(7)).toBeNull();
	});
	it("applies once, to the authorized window only", () => {
		authorizeTransferDestination(7, "C:\Packages");
		expect(takeTransferDestination(8)).toBeNull();
		expect(takeTransferDestination(7)).toBe("C:\Packages");
		expect(takeTransferDestination(7)).toBeNull();
	});
	it("expires and can be revoked", () => {
		authorizeTransferDestination(10, "C:\Old", 0);
		expect(takeTransferDestination(10, 120_000)).toBeNull();
		const revoke = authorizeTransferDestination(11, "C:\Packages");
		revoke();
		expect(takeTransferDestination(11)).toBeNull();
	});
});
