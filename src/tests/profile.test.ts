import { describe, expect, test } from "bun:test";
import {
  buildFullName,
  hasUsableName,
  needsProfileSetup,
  splitFullName,
} from "../convex/helpers";

describe("splitFullName", () => {
  test("splits a two-part name", () => {
    expect(splitFullName("Ada Lovelace")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });

  test("keeps middle names in the last name", () => {
    expect(splitFullName("Ada Byron King")).toEqual({
      firstName: "Ada",
      lastName: "Byron King",
    });
  });

  test("handles a single name with no last name", () => {
    expect(splitFullName("Prince")).toEqual({
      firstName: "Prince",
      lastName: "",
    });
  });

  test("collapses stray whitespace", () => {
    expect(splitFullName("  Ada   Lovelace  ")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });

  test("returns empty fields for a missing or blank name", () => {
    expect(splitFullName(undefined)).toEqual({ firstName: "", lastName: "" });
    expect(splitFullName(null)).toEqual({ firstName: "", lastName: "" });
    expect(splitFullName("   ")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("buildFullName", () => {
  test("joins both halves", () => {
    expect(buildFullName("Ada", "Lovelace")).toBe("Ada Lovelace");
  });

  test("omits a missing last name without leaving a trailing space", () => {
    expect(buildFullName("Ada")).toBe("Ada");
    expect(buildFullName("Ada", "")).toBe("Ada");
    expect(buildFullName("Ada", "   ")).toBe("Ada");
    expect(buildFullName("Ada", null)).toBe("Ada");
  });

  test("trims and collapses interior whitespace", () => {
    expect(buildFullName("  Ada  ", "  Byron   King ")).toBe(
      "Ada Byron King"
    );
  });

  test("round-trips with splitFullName", () => {
    for (const name of ["Ada Lovelace", "Prince", "Ada Byron King"]) {
      const { firstName, lastName } = splitFullName(name);
      expect(buildFullName(firstName, lastName)).toBe(name);
    }
  });
});

describe("hasUsableName", () => {
  test("accepts a real name", () => {
    expect(hasUsableName("Ada Lovelace")).toBe(true);
    expect(hasUsableName("Prince")).toBe(true);
  });

  test("rejects blank, whitespace and non-string values", () => {
    // Convex Auth can leave an empty string behind; treating that as "has a
    // name" would skip the prompt and leave a nameless seat on the roster.
    expect(hasUsableName("")).toBe(false);
    expect(hasUsableName("   ")).toBe(false);
    expect(hasUsableName(undefined)).toBe(false);
    expect(hasUsableName(null)).toBe(false);
    expect(hasUsableName(7)).toBe(false);
  });
});

describe("needsProfileSetup", () => {
  test("prompts an account that has never been onboarded and has no name", () => {
    expect(needsProfileSetup({})).toBe(true);
    expect(needsProfileSetup({ name: "" })).toBe(true);
    expect(needsProfileSetup({ name: "   " })).toBe(true);
  });

  test("does NOT prompt someone who already has a name", () => {
    // Google and OTP sign-ins usually arrive with a name, and accounts created
    // before this prompt existed already have one. They already answered the
    // question somewhere else, so blocking them behind a modal to re-type a
    // name the app is already displaying is pure friction.
    expect(needsProfileSetup({ name: "Ada Lovelace" })).toBe(false);
    expect(needsProfileSetup({ name: "Prince" })).toBe(false);
  });

  test("still prompts a guest even if it somehow has a name", () => {
    expect(needsProfileSetup({ isAnonymous: true, name: "Ghost" })).toBe(false);
  });

  test("stops prompting once completed", () => {
    expect(needsProfileSetup({ profileCompletedAt: 1700000000000 })).toBe(false);
  });

  test("never prompts a Guest session", () => {
    // Guest rows are deleted on sign-out, so prompting would be pointless and
    // would trap a temporary try-out behind an unskippable dialog.
    expect(needsProfileSetup({ isAnonymous: true })).toBe(false);
    expect(
      needsProfileSetup({ isAnonymous: true, profileCompletedAt: null })
    ).toBe(false);
  });

  test("treats an explicit 0 timestamp as already onboarded", () => {
    // `== null` (not a truthiness check) is what makes this false rather than
    // re-prompting: only a genuinely absent flag means "never asked".
    expect(needsProfileSetup({ profileCompletedAt: 0 })).toBe(false);
  });

  test("does nothing when there is no user yet", () => {
    expect(needsProfileSetup(null)).toBe(false);
    expect(needsProfileSetup(undefined)).toBe(false);
  });
});