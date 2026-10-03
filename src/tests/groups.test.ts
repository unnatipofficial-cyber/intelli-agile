import { describe, expect, test } from "bun:test";
import { matchGroupKind } from "../convex/agentTools";

describe("matchGroupKind", () => {
  test("recognises profile-less placeholder members", () => {
    expect(matchGroupKind("remove the unknown members")).toBe("profileless");
    expect(matchGroupKind("the nameless ones")).toBe("profileless");
  });

  test("recognises a whole-team request", () => {
    expect(matchGroupKind("everyone except me")).toBe("everyone");
    expect(matchGroupKind("notify the entire team")).toBe("everyone");
  });

  test("recognises idle and overloaded people", () => {
    expect(matchGroupKind("who has no open tasks")).toBe("idle");
    expect(matchGroupKind("who is overloaded?")).toBe("overloaded");
  });

  test("recognises a self reference", () => {
    expect(matchGroupKind("assign it to me")).toBe("self");
  });

  test("returns null for a named person", () => {
    expect(matchGroupKind("Dana Reyes")).toBeNull();
    expect(matchGroupKind("Marcus")).toBeNull();
  });
});
