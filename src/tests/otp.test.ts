import { describe, expect, test } from "bun:test";
import {
  OTP_WINDOW_MS,
  formatCountdown,
  isOtpExpired,
  remainingSeconds,
} from "../lib/otp";

describe("OTP_WINDOW_MS", () => {
  test("is two minutes", () => {
    expect(OTP_WINDOW_MS).toBe(120_000);
  });
});

describe("remainingSeconds", () => {
  const t0 = 1_700_000_000_000;

  test("returns the full window immediately", () => {
    expect(remainingSeconds(t0, t0)).toBe(120);
  });

  test("counts down", () => {
    expect(remainingSeconds(t0, t0 + 1_000)).toBe(119);
    expect(remainingSeconds(t0, t0 + 60_000)).toBe(60);
    expect(remainingSeconds(t0, t0 + 119_000)).toBe(1);
  });

  test("rounds up so a nearly-expired code never shows 0:00", () => {
    // 1ms left should still read as "1" so the label doesn't flash 0:00 while
    // the code is technically still usable.
    expect(remainingSeconds(t0, t0 + 119_999)).toBe(1);
  });

  test("clamps to zero once past the window", () => {
    expect(remainingSeconds(t0, t0 + 120_000)).toBe(0);
    expect(remainingSeconds(t0, t0 + 500_000)).toBe(0);
  });

  test("treats a garbage timestamp as already expired", () => {
    expect(remainingSeconds(NaN, t0)).toBe(0);
    expect(remainingSeconds(undefined as unknown as number, t0)).toBe(0);
  });
});

describe("isOtpExpired", () => {
  const t0 = 1_700_000_000_000;

  test("is false inside the window and true at the boundary", () => {
    expect(isOtpExpired(t0, t0 + 119_999)).toBe(false);
    expect(isOtpExpired(t0, t0 + 120_000)).toBe(true);
    expect(isOtpExpired(t0, t0 + 120_001)).toBe(true);
  });
});

describe("formatCountdown", () => {
  test("renders m:ss", () => {
    expect(formatCountdown(120)).toBe("2:00");
    expect(formatCountdown(119)).toBe("1:59");
    expect(formatCountdown(61)).toBe("1:01");
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(8)).toBe("0:08");
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
  });

  test("never goes negative or renders odd widths", () => {
    expect(formatCountdown(-5)).toBe("0:00");
    expect(formatCountdown(NaN)).toBe("0:00");
    // Zero-padded seconds keep the label a constant width, so the countdown
    // does not jitter once a second.
    expect(formatCountdown(9).length).toBe(formatCountdown(10).length);
  });
});