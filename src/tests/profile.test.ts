import { describe, expect, test } from "bun:test";
import {
  buildFullName,
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

describe("needsProfileSetup", () => {
  test("prompts an account that has never been onboarded", () => {
    expect(needsProfileSetup({})).toBe(true);
    expect(needsProfileSetup({ name: "Ada Lovelace" })).toBe(true);
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