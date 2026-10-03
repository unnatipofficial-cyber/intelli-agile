import { describe, expect, test } from "bun:test";
import {
  hasThoughtSignature,
  injectThoughtSignatureIntoContents,
} from "../convex/agent";

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

describe("injectThoughtSignatureIntoContents", () => {
  test("returns a contents array, never the bare request payload", () => {
    // Regression: an earlier revision passed the *whole* payload through this
    // helper, so the request body was a bare array and Gemini rejected it with
    // `400 - Root element must be a message`. The helper must only ever be
    // applied to `contents`, with the caller keeping the envelope.
    const contents = [
      { role: "user" as const, parts: [{ text: "hello" }] },
    ];
    const out = injectThoughtSignatureIntoContents(contents as any);
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe("user");
  });

  test("attaches thought_signature to every functionCall part", () => {
    const contents = [
      {
        role: "model" as const,
        parts: [
          { text: "thinking" },
          { functionCall: { name: "list_risks", args: { project: "Apollo" } } },
        ],
      },
    ];
    const out = injectThoughtSignatureIntoContents(contents as any);
    const callPart = out[0].parts[1] as any;
    expect(typeof callPart.functionCall.thought_signature).toBe("string");
    expect(callPart.functionCall.thought_signature.length).toBeGreaterThan(0);
  });

  test("preserves an existing signature rather than overwriting it", () => {
    const contents = [
      {
        role: "model" as const,
        parts: [
          {
            functionCall: {
              name: "list_risks",
              args: {},
              thought_signature: "real-signature",
            },
          },
        ],
      },
    ];
    const out = injectThoughtSignatureIntoContents(contents as any);
    expect((out[0].parts[0] as any).functionCall.thought_signature).toBe(
      "real-signature"
    );
  });

  test("does not mutate the caller's objects", () => {
    const contents = [
      {
        role: "model" as const,
        parts: [{ functionCall: { name: "list_team", args: {} } }],
      },
    ];
    injectThoughtSignatureIntoContents(contents as any);
    expect(
      (contents[0].parts[0] as any).functionCall.thought_signature
    ).toBeUndefined();
  });

  test("serialises into a request envelope whose root is an object", () => {
    // The exact shape Gemini's generateContent endpoint requires.
    const contents = [{ role: "user" as const, parts: [{ text: "hi" }] }];
    const body = JSON.stringify({
      contents: injectThoughtSignatureIntoContents(contents as any),
      tools: [{ functionDeclarations: [] }],
      systemInstruction: { parts: [{ text: "sys" }] },
    });
    const parsed = JSON.parse(body);
    expect(Array.isArray(parsed)).toBe(false);
    expect(Array.isArray(parsed.contents)).toBe(true);
    expect(parsed.tools).toBeDefined();
    expect(parsed.systemInstruction).toBeDefined();
  });
});
