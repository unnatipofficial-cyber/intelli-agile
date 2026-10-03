import { describe, expect, test } from "bun:test";
import { isEphemeralGuest } from "../convex/helpers";

/**
 * Guests are temporary try-outs. Convex Auth leaves a nameless `users` row
 * behind for every Anonymous sign-in, so `isEphemeralGuest` is what keeps that
 * row off the Team roster and out of any persisted profile.
 */
describe("isEphemeralGuest", () => {
  test("flags an anonymous sign-in", () => {
    expect(isEphemeralGuest({ isAnonymous: true })).toBe(true);
  });

  test("does not flag a real teammate", () => {
    expect(isEphemeralGuest({ isAnonymous: false })).toBe(false);
    expect(isEphemeralGuest({ name: "Alex Chen" })).toBe(false);
    expect(isEphemeralGuest({ name: "Alex Chen", isAnonymous: false })).toBe(false);
  });

  test("treats a missing flag as a real user, not a guest", () => {
    // Every non-guest path writes `isAnonymous: false` explicitly, so an absent
    // flag is ambiguous. Defaulting to "not a guest" keeps real accounts
    // visible rather than silently hiding people from the roster.
    expect(isEphemeralGuest({})).toBe(false);
  });

  test("only the literal boolean true counts", () => {
    // A truthy-but-not-true value must not be coerced: it would hide a real
    // teammate off the roster.
    expect(isEphemeralGuest({ isAnonymous: "true" })).toBe(false);
    expect(isEphemeralGuest({ isAnonymous: 1 })).toBe(false);
    expect(isEphemeralGuest({ isAnonymous: null })).toBe(false);
  });

  test("handles a missing user", () => {
    expect(isEphemeralGuest(null)).toBe(false);
    expect(isEphemeralGuest(undefined)).toBe(false);
  });
});
