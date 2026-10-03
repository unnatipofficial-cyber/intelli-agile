import { describe, expect, test } from "bun:test";
import { hasThoughtSignature } from "../convex/agent";

/**
 * Tests for the pure `hasThoughtSignature` predicate. The companion
 * internal action `verifyFunctionCallSignature` runs the same predicate over
 * every part and is exercised at runtime by `bunx convex dev --once`.
 */
describe("hasThoughtSignature", () => {
  test("detects a part that carries thought_signature", () => {
    expect(
      hasThoughtSignature({
        functionCall: {
          name: "list_projects",
          args: {},
          thought_signature: "abc123",
        },
      } as any)
    ).toBe(true);
  });

  test("returns false for a functionCall part without thought_signature", () => {
    expect(
      hasThoughtSignature({
        functionCall: {
          name: "list_projects",
          args: {},
        },
      } as any)
    ).toBe(false);
  });

  test("returns false for a text-only part", () => {
    expect(
      hasThoughtSignature({ text: "hello" } as any)
    ).toBe(false);
  });

  test("returns false when functionCall is undefined", () => {
    expect(hasThoughtSignature({ text: "hello" } as any)).toBe(false);
  });

  test("returns false when functionCall.thought_signature is empty", () => {
    expect(
      hasThoughtSignature({
        functionCall: {
          name: "list_projects",
          args: {},
          thought_signature: "",
        },
      } as any)
    ).toBe(false);
  });
});
