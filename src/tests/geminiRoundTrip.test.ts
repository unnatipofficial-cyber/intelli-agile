import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  requestParts,
  streamGemini,
  toFunctionCallParts,
} from "../convex/agent";

/**
 * Integration tests for the Gemini function-calling round-trip.
 *
 * A real API key is not reachable from tests, so `fetch` is mocked with a
 * stand-in that enforces the two rules the real endpoint enforced in the
 * field — reproducing both reported 400s without a live call:
 *
 *   1. `Function call is missing a thought_signature in functionCall parts`
 *      — sent back a `functionCall` part with no signature.
 *   2. `Unknown name "thought_signature"` — sent a signature we invented
 *      rather than one the model issued.
 *
 * The stand-in issues an opaque signature per call and only accepts it back
 * verbatim, which is exactly the contract the agent loop has to honour.
 */

const REAL_MISSING_SIG = `{"error":{"code":400,"message":"Function call is missing a thought_signature in functionCall parts. This is required for tools to work correctly.","status":"INVALID_ARGUMENT"}}`;
const REAL_UNKNOWN_NAME = `{"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \\"thought_signature\\" at 'contents[0].parts[1].functionCall'","status":"INVALID_ARGUMENT"}}`;

/** Opaque per-call signature, as the model would issue it. */
const SIGNATURE = "Ct8BdGhlAHdUaWNlbi1zaWduYXR1cmU=";
/** A signature we did not receive from the model — inventing one is a 400. */
const FABRICATED = "__generated__";

type AnyJson = Record<string, any>;

/** Rejects any unsigned functionCall part, exactly as the real API does. */
function assertSigned(contents: AnyJson[]): void {
  for (const c of contents) {
    for (const p of c.parts ?? []) {
      if (p && p.functionCall && !p.functionCall.thought_signature) {
        throw new ApiError(REAL_MISSING_SIG);
      }
    }
  }
}

/** Rejects a signature the model never issued, exactly as the real API does. */
function assertAuthentic(contents: AnyJson[]): void {
  for (const c of contents) {
    for (const p of c.parts ?? []) {
      if (
        p &&
        p.functionCall &&
        p.functionCall.thought_signature === FABRICATED
      ) {
        throw new ApiError(REAL_UNKNOWN_NAME);
      }
    }
  }
}

class ApiError extends Error {
  status: number;
  body: string;
  constructor(body: string, status = 400) {
    super(body);
    this.status = status;
    this.body = body;
  }
}

/** The model's reply: one signed function call. */
function modelReply(tool = "list_risks"): AnyJson {
  return {
    candidates: [
      {
        content: {
          role: "model",
          parts: [
            {
              functionCall: {
                name: tool,
                args: { project: "Apollo" },
                thought_signature: SIGNATURE,
              },
            },
          ],
        },
      },
    ],
  };
}

/** SSE wire format for a signed function call. */
function sseSigned(tool = "list_risks"): string {
  const chunk = JSON.stringify(modelReply(tool));
  return `data: ${chunk}\n\ndata: [DONE]\n`;
}

function jsonResponse(body: string, status = 200): any {
  return {
    ok: status < 400,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

function sseResponse(text: string): any {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body: stream,
    text: async () => "",
    json: async () => ({}),
  };
}

const realFetch = globalThis.fetch;
let sentBodies: AnyJson[] = [];
let mode: "ok" | "reject-unsigned" | "reject-fabricated" = "ok";

beforeEach(() => {
  sentBodies = [];
  mode = "ok";
  globalThis.fetch = (async (_url: any, init: any) => {
    const body = JSON.parse(init.body);
    sentBodies.push(body);
    if (mode === "reject-unsigned") assertSigned(body.contents);
    if (mode === "reject-fabricated") assertAuthentic(body.contents);
    const isStream = String(_url).includes("streamGenerateContent");
    return isStream ? sseResponse(sseSigned()) : jsonResponse(JSON.stringify(modelReply()));
  }) as any;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const KEY = "test-key";
const SYSTEM = "You are AIE.";
const OPENING: any[] = [{ role: "user", parts: [{ text: "log a risk" }] }];

describe("streamGemini", () => {
  test("preserves the model's thought_signature through the SSE parse", async () => {
    const parts = await streamGemini(KEY, OPENING, SYSTEM, {}, () => {});
    const call = parts.find((p) => p.functionCall);
    expect(call?.functionCall?.thought_signature).toBe(SIGNATURE);
  });

  test("sends a request envelope with an object root and contents", async () => {
    await streamGemini(KEY, OPENING, SYSTEM, {}, () => {});
    expect(sentBodies).toHaveLength(1);
    expect(Array.isArray(sentBodies[0])).toBe(false);
    expect(Array.isArray(sentBodies[0].contents)).toBe(true);
    expect(sentBodies[0].tools).toBeDefined();
  });

  test("reports text deltas to the caller", async () => {
    const seen: string[] = [];
    globalThis.fetch = (async () =>
      sseResponse(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "hello world" }] } }] })}\n\ndata: [DONE]\n`)) as any;
    const parts = await streamGemini(KEY, OPENING, SYSTEM, {}, (d) => seen.push(d));
    expect(seen.join("")).toBe("hello world");
    expect(parts.some((p) => p.text === "hello world")).toBe(true);
  });
});

describe("requestParts", () => {
  test("returns parts with the signature intact", async () => {
    const parts = await requestParts(KEY, OPENING, SYSTEM);
    const call = parts.find((p) => p.functionCall);
    expect(call?.functionCall?.thought_signature).toBe(SIGNATURE);
  });

  test("sends an envelope the API accepts (object root, tools present)", async () => {
    await requestParts(KEY, OPENING, SYSTEM);
    expect(Array.isArray(sentBodies[0])).toBe(false);
    expect(sentBodies[0].tools).toBeDefined();
    expect(sentBodies[0].systemInstruction).toBeDefined();
  });
});

describe("round-trip: what agentLoop echoes back", () => {
  test("turn 2 passes the stand-in's signed-vs-authentic validation", async () => {
    // Turn 1: model issues a signed call.
    const turn1 = await streamGemini(KEY, OPENING, SYSTEM, {}, () => {});
    expect(turn1.find((p) => p.functionCall)?.functionCall?.thought_signature)
      .toBe(SIGNATURE);

    // The agent loop echoes `parts` verbatim as the model turn.
    const contents = [...OPENING, { role: "model", parts: turn1 }];
    contents.push({
      role: "user",
      parts: [{ functionResponse: { name: "list_risks", response: { ok: true } } }],
    });

    mode = "reject-unsigned";
    await requestParts(KEY, contents, SYSTEM); // must not throw
    expect(sentBodies.length).toBeGreaterThan(0);
  });

  test("echoed turn carries the exact signature, not a stand-in", async () => {
    const turn1 = await streamGemini(KEY, OPENING, SYSTEM, {}, () => {});
    const contents = [...OPENING, { role: "model", parts: turn1 }];
    mode = "reject-fabricated";
    await requestParts(KEY, contents, SYSTEM); // must not throw
    const echo = sentBodies[sentBodies.length - 1].contents[1];
    expect(echo.role).toBe("model");
    expect(echo.parts[0].functionCall.thought_signature).toBe(SIGNATURE);
    expect(echo.parts[0].functionCall.thought_signature).not.toBe(FABRICATED);
  });

  // The stand-in rejects on every attempt, so `callGemini` walks all three
  // MODELS with backoff before surfacing the error. Give it room.
  test(
    "regression: a dropped signature is what caused the original 400",
    async () => {
      // Reproduce the pre-fix bug: rebuild the call without the signature.
      const dropped = toFunctionCallParts([
        { name: "list_risks", args: { project: "Apollo" } },
      ] as any);
      const contents = [...OPENING, { role: "model", parts: dropped }];
      mode = "reject-unsigned";
      await expect(requestParts(KEY, contents, SYSTEM)).rejects.toThrow(
        /missing a thought_signature/
      );
    },
    30000
  );

  test(
    "regression: an invented signature is what caused the second 400",
    async () => {
      const fake = [
        { functionCall: { name: "list_risks", args: {}, thought_signature: FABRICATED } },
      ];
      const contents = [...OPENING, { role: "model", parts: fake as any }];
      mode = "reject-fabricated";
      // The body quotes the field name with escaped quotes in JSON, so match
      // on the distinctive prefix rather than the exact quoting.
      await expect(requestParts(KEY, contents, SYSTEM)).rejects.toThrow(
        /Unknown name/
      );
    },
    30000
  );
});
