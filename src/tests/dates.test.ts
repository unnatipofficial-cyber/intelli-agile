import { describe, expect, test } from "bun:test";
import { parseDateInput } from "../convex/fuzzy";

describe("parseDateInput", () => {
  test("parses ISO dates", () => {
    expect(parseDateInput("2026-12-15")).toBe("2026-12-15");
  });

  test("parses relative day/week/month expressions from a fixed now", () => {
    const now = new Date(Date.UTC(2026, 0, 1));
    expect(parseDateInput("today", now)).toBe("2026-01-01");
    expect(parseDateInput("tomorrow", now)).toBe("2026-01-02");
    expect(parseDateInput("in 3 days", now)).toBe("2026-01-04");
    expect(parseDateInput("2 weeks", now)).toBe("2026-01-15");
  });

  test("parses a month and day, rolling a past date into next year", () => {
    const now = new Date(Date.UTC(2026, 11, 20)); // Dec 20, 2026
    expect(parseDateInput("Dec 25", now)).toBe("2026-12-25");
    expect(parseDateInput("Dec 15", now)).toBe("2027-12-15");
  });

  test("parses an explicit year", () => {
    expect(parseDateInput("15 December 2030")).toBe("2030-12-15");
  });

  test("returns undefined for gibberish", () => {
    expect(parseDateInput("not a date")).toBeUndefined();
    expect(parseDateInput("")).toBeUndefined();
  });
});
