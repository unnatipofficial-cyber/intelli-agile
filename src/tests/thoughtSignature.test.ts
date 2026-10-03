import { describe, expect, test } from "bun:test";
import { toFunctionCallParts } from "../convex/agent";

/**
 * `thought_signature` is an OUTPUT of the model, not an input we generate.
 *
 * Two failures motivated these tests:
 *
 *  1. Dropping it while rebuilding the model turn made Gemini reject the call
 *     with `400 - Function call is missing a thought_signature in functionCall
 *     parts`. The streamed path was the culprit: it captured only
 *     `{name, args}` and rebuilt the part without the signature.
 *  2. Fabricating a placeholder made Gemini reject the field *name* with
 *     `400 - Unknown name "thought_signature"`, because the REST API does not
 *     accept the field as something a caller may set.
 *
 * So the only correct behaviour is: echo exactly what the model returned, and
 * otherwise leave the part alone.
 */
describe("toFunctionCallParts", () => {
  test("echoes back the signature the model returned", () => {
    const parts = toFunctionCallParts([
      {
        name: "list_risks",
        args: { project: "Apollo" },
        thoughtSignature: "Cq0BdGh...",
      },
    ] as any);
    expect(parts[0].functionCall?.thought_signature).toBe("Cq0BdGh...");
  });

  test("preserves name and args alongside the signature", () => {
    const parts = toFunctionCallParts([
      {
        name: "list_risks",
        args: { project: "Apollo", status: "open" },
        thoughtSignature: "sig-123",
      },
    ] as any);
    expect(parts[0].functionCall?.name).toBe("list_risks");
    expect(parts[0].functionCall?.args).toEqual({
      project: "Apollo",
      status: "open",
    });
  });

  test("omits the field entirely when the model sent no signature", () => {
    // Fabricating a value here is what produced `Unknown name
    // "thought_signature"`, so the key must be absent, never invented.
    const parts = toFunctionCallParts([
      { name: "list_team", args: {} },
    ] as any);
    expect(parts[0].functionCall).not.toHaveProperty("thought_signature");
  });

  test("treats an empty signature as absent rather than echoing it", () => {
    const parts = toFunctionCallParts([
      { name: "list_team", args: {}, thoughtSignature: "" },
    ] as any);
    expect(parts[0].functionCall).not.toHaveProperty("thought_signature");
  });

  test("keeps every call in the turn, each with its own signature", () => {
    const parts = toFunctionCallParts([
      { name: "list_risks", args: { a: 1 }, thoughtSignature: "sig-a" },
      { name: "list_team", args: { b: 2 }, thoughtSignature: "sig-b" },
    ] as any);
    expect(parts).toHaveLength(2);
    expect((parts[0].functionCall as any).thought_signature).toBe("sig-a");
    expect((parts[1].functionCall as any).thought_signature).toBe("sig-b");
  });

  test("round-trips through JSON without altering the signature", () => {
    const opaque = "Ct8BdGhlAHdUaWNlbi1zaWduYXR1cmU=";
    const parts = toFunctionCallParts([
      { name: "create_risk", args: {}, thoughtSignature: opaque },
    ] as any);
    const parsed = JSON.parse(JSON.stringify(parts));
    expect(parsed[0].functionCall.thought_signature).toBe(opaque);
  });

  test("returns an empty turn when the model made no calls", () => {
    expect(toFunctionCallParts([] as any)).toEqual([]);
  });
});
