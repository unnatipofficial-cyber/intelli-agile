import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * The transport for the agent's live progress.
 *
 * Convex actions can't push to the browser, but they can write rows and the
 * browser can subscribe to a query. So each chat turn gets a `runId`: the
 * action appends events (status, streamed answer tokens, tool calls) tagged
 * with that id, and the chat panel subscribes to `events` for it. The result
 * is a real, server-driven stream with no bespoke socket layer.
 */

/** Events for one run, oldest first. Only the run's owner can read them. */
export const events = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("agentEvents")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
    return rows.filter((row) => !row.userId || row.userId === userId);
  },
});

/** Append one event. Called from the agent action via `ctx.runMutation`. */
export const emit = internalMutation({
  args: {
    runId: v.string(),
    seq: v.number(),
    type: v.union(
      v.literal("status"),
      v.literal("token"),
      v.literal("tool"),
      v.literal("done"),
      v.literal("error")
    ),
    text: v.optional(v.string()),
    tool: v.optional(v.string()),
    label: v.optional(v.string()),
    ok: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await ctx.db.insert("agentEvents", {
      runId: args.runId,
      userId: userId ?? undefined,
      seq: args.seq,
      type: args.type,
      text: args.text,
      tool: args.tool,
      label: args.label,
      ok: args.ok,
      createdAt: Date.now(),
    });
  },
});
