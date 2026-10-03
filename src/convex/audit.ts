import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { roleFromUser, ROLES } from "./rbac";

/**
 * Who changed what, in the workspace itself rather than in any one project.
 *
 * Reads are admin-only. Writes go through `record` (an internalMutation) so a
 * caller cannot forge an entry attributed to someone else: the actor is
 * resolved from the caller's own authenticated identity inside the mutation,
 * and only other Convex functions can reach it at all.
 *
 * The action vocabulary and its labels live in `src/lib/audit.ts` rather than
 * here, because the Settings panel renders them and importing this module from
 * React would drag `_generated/server` into the browser bundle.
 */

/**
 * Append one entry.
 *
 * Never throws. An audit write failing must not roll back the administrative
 * action it was recording — losing the row is bad, but failing a role change or
 * an invite acceptance because of it is worse.
 *
 * `actorName` is denormalised onto the row so the history still reads correctly
 * after the actor's own account is deleted, which for a guest purge is the
 * normal case rather than an edge case.
 */
export const record = internalMutation({
  args: {
    action: v.string(),
    targetType: v.string(),
    targetLabel: v.optional(v.string()),
    details: v.optional(v.string()),
    /** Set by the server from the caller; never trusted from args. */
    expectedActorId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    try {
      const actorId = await getAuthUserId(ctx);
      const actor =
        (actorId ? await ctx.db.get(actorId) : null) ??
        (args.expectedActorId ? await ctx.db.get(args.expectedActorId) : null);

      await ctx.db.insert("adminAuditLogs", {
        actorId: actorId ?? args.expectedActorId,
        actorName:
          typeof (actor as { name?: unknown } | null)?.name === "string" &&
          (actor as { name: string }).name.trim()
            ? (actor as { name: string }).name.trim()
            : actorId
              ? "Unknown user"
              : "System",
        action: args.action,
        targetType: args.targetType,
        targetLabel: args.targetLabel,
        details: args.details,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error("[audit] failed to record entry:", err);
    }
  },
});

/**
 * The audit trail, newest first. Admin-only; non-admins get an empty list
 * rather than an error, so a non-admin never learns the panel exists.
 */
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const me = await ctx.db.get(userId);
    if (roleFromUser(me) !== ROLES.ADMIN) return [];

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return ctx.db
      .query("adminAuditLogs")
      .withIndex("by_time")
      .order("desc")
      .take(limit);
  },
});