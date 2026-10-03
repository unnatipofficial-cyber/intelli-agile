import { describe, expect, test } from "bun:test";
import {
  findAllFuzzy,
  findFuzzy,
  normEnum,
  normalizeText,
} from "../convex/fuzzy";

describe("normalizeText", () => {
  test("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normalizeText("  Project  Nebula!! ")).toBe("project nebula");
    expect(normalizeText("R&D")).toBe("r and d");
  });

  test("strips accents", () => {
    expect(normalizeText("Café Déjà")).toBe("cafe deja");
  });
});

describe("findFuzzy", () => {
  const projects = [
    { value: "p1", label: "Apollo" },
    { value: "p2", label: "Project Nebula" },
  ];

  test("matches despite a typo and reports the correction", () => {
    const match = findFuzzy("Apolllo", projects);
    expect(match?.item.value).toBe("p1");
    expect(match?.corrected).toBe(true);
  });

  test("returns null when nothing is close enough", () => {
    expect(findFuzzy("zzyzx", projects)).toBeNull();
  });

  test("findAllFuzzy ranks matches best-first", () => {
    const results = findAllFuzzy("nebula", projects);
    expect(results[0]?.item.value).toBe("p2");
  });
});

describe("normEnum", () => {
  const STATUS = ["todo", "in-progress", "review", "done"] as const;
  const PRIORITY = ["low", "medium", "high", "critical"] as const;

  test("passes through exact values, including hyphenated ones", () => {
    expect(normEnum("in-progress", STATUS, "todo")).toBe("in-progress");
    expect(normEnum("In Progress", STATUS, "todo")).toBe("in-progress");
  });

  test("snaps typos to the closest option", () => {
    expect(normEnum("hgh", PRIORITY, "medium")).toBe("high");
    expect(normEnum("reviw", STATUS, "todo")).toBe("review");
  });

  test("falls back for empty or unrecognisable input", () => {
    expect(normEnum(undefined, STATUS, "todo")).toBe("todo");
    expect(normEnum("", PRIORITY, "medium")).toBe("medium");
  });
});
