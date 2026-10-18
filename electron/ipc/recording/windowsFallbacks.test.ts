import { describe, expect, it } from "vitest";

import {
	shouldStartWindowsBrowserMicrophoneFallback,
	shouldUseWindowsBrowserMicrophoneFallback,
	supportsWindowsNativeMicrophoneFallback,
	WINDOWS_MIC_CAPTURE_MODE_ENV,
} from "./windowsFallbacks";

describe("shouldUseWindowsBrowserMicrophoneFallback", () => {
	it("uses the existing browser recorder with a helper older than Recordly's native mic fix", () => {
		const supported = supportsWindowsNativeMicrophoneFallback(
			Buffer.from("Recording started\0WASAPI: GetBuffer failed"),
		);
		expect(supported).toBe(false);
		expect(
			shouldStartWindowsBrowserMicrophoneFallback(
				{ capturesMicrophone: true },
				{},
				supported,
			),
		).toBe(true);
		expect(
			shouldStartWindowsBrowserMicrophoneFallback(
				{ capturesMicrophone: false },
				{},
				supported,
			),
		).toBe(false);
	});
	it("retains native mic capture for helpers with startup failure reporting", () => {
		const supported = supportsWindowsNativeMicrophoneFallback(
			Buffer.from("MICROPHONE_CAPTURE_UNAVAILABLE\0Recording started"),
		);
		expect(supported).toBe(true);
		expect(
			shouldStartWindowsBrowserMicrophoneFallback(
				{ capturesMicrophone: true },
				{},
				supported,
			),
		).toBe(false);
	});
	it("defaults Windows microphone capture to native WASAPI", () => {
		expect(shouldStartWindowsBrowserMicrophoneFallback({ capturesMicrophone: true }, {})).toBe(
			false,
		);
	});

	it("can be forced before native capture starts", () => {
		expect(
			shouldStartWindowsBrowserMicrophoneFallback(
				{ capturesMicrophone: true },
				{ [WINDOWS_MIC_CAPTURE_MODE_ENV]: "browser" },
			),
		).toBe(true);
	});

	it("keeps native WASAPI enabled when explicitly requested", () => {
		expect(
			shouldStartWindowsBrowserMicrophoneFallback(
				{ capturesMicrophone: true },
				{ [WINDOWS_MIC_CAPTURE_MODE_ENV]: "native" },
			),
		).toBe(false);
		expect(
			shouldStartWindowsBrowserMicrophoneFallback(
				{ capturesMicrophone: true },
				{ [WINDOWS_MIC_CAPTURE_MODE_ENV]: "wasapi" },
			),
		).toBe(false);
	});

	it("uses native WASAPI for unknown mode values", () => {
		expect(
			shouldStartWindowsBrowserMicrophoneFallback(
				{ capturesMicrophone: true },
				{ [WINDOWS_MIC_CAPTURE_MODE_ENV]: "typo" },
			),
		).toBe(false);
	});

	it("does not force fallback when microphone capture was not requested", () => {
		expect(
			shouldStartWindowsBrowserMicrophoneFallback(
				{ capturesMicrophone: false },
				{ [WINDOWS_MIC_CAPTURE_MODE_ENV]: "browser" },
			),
		).toBe(false);
	});

	it("returns true when native Windows mic initialization fails", () => {
		expect(
			shouldUseWindowsBrowserMicrophoneFallback(
				"WARNING: Failed to initialize WASAPI mic capture\nRecording started",
				{ capturesMicrophone: true },
			),
		).toBe(true);
	});

	it("returns true when the native helper reports its stable fallback marker", () => {
		expect(
			shouldUseWindowsBrowserMicrophoneFallback(
				"MICROPHONE_CAPTURE_UNAVAILABLE\nRecording started",
				{ capturesMicrophone: true },
			),
		).toBe(true);
	});

	it("returns false when microphone capture was not requested", () => {
		expect(
			shouldUseWindowsBrowserMicrophoneFallback(
				"WARNING: Failed to initialize WASAPI mic capture\nRecording started",
				{ capturesMicrophone: false },
			),
		).toBe(false);
	});

	it("returns false for a healthy native mic by default", () => {
		expect(
			shouldUseWindowsBrowserMicrophoneFallback(
				"Recording started",
				{ capturesMicrophone: true },
				{},
			),
		).toBe(false);
	});

	it("returns true when browser fallback is forced", () => {
		expect(
			shouldUseWindowsBrowserMicrophoneFallback(
				"Recording started",
				{ capturesMicrophone: true },
				{ [WINDOWS_MIC_CAPTURE_MODE_ENV]: "fallback" },
			),
		).toBe(true);
	});
});
