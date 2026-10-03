import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, ROLES } from "./rbac";
import { roleValidator } from "./schema";
import { isEphemeralGuest, buildFullName } from "./helpers";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      return null;
    }
    return user;
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx, args) => {
    await requireRole(ctx, ROLES.ADMIN);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("That team member no longer exists.");
    await ctx.db.patch(args.userId, { role: args.role, updatedAt: Date.now() });
    return { ok: true, role: args.role };
  },
});

/**
 * Tear down the throwaway account behind a Guest session.
 *
 * This version of Convex Auth has no `onEnd` hook on the Anonymous provider, so
 * the `users` row it creates for every guest sign-in would otherwise live
 * forever. We delete it (and the auth rows pointing at it) when the guest signs
 * out, so a Guest is genuinely temporary.
 *
 * The `isEphemeralGuest` guard is the safety property that matters: this runs
 * on *every* sign-out, and a real account must always keep its row.
 *
 * Only the identity is removed. Projects, tasks and comments a guest happened
 * to create are left alone — they are workspace content, not guest data.
 */
export const endGuestSession = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { purged: false, reason: "not-authenticated" as const };

    const user = await ctx.db.get(userId);
    if (!user) return { purged: false, reason: "no-record" as const };
    if (!isEphemeralGuest(user)) {
      return { purged: false, reason: "not-a-guest" as const };
    }

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) await ctx.db.delete(code._id);
    }

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of tokens) await ctx.db.delete(token._id);
    }

    // Accounts and sessions go first: they hold references to the user, and
    // Convex Auth's own signOut() runs straight after this and must not find
    // dangling rows.
    for (const account of accounts) await ctx.db.delete(account._id);
    for (const session of sessions) await ctx.db.delete(session._id);
    await ctx.db.delete(userId);

    return { purged: true, reason: "guest" as const };
  },
});

/**
 * Save the profile name.
 *
 * Serves both callers: the first-login prompt (which also stamps
 * `profileCompletedAt`, telling the prompt it has done its job) and the
 * Settings editor (which must not re-stamp, so the original onboarding date is
 * preserved on later edits).
 */
export const updateProfile = mutation({
  args: { firstName: v.string(), lastName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to update your profile.");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Your profile could not be found.");
    if (isEphemeralGuest(user)) {
      throw new Error("Guest sessions can't save a profile.");
    }

    const firstName = args.firstName.trim().replace(/\s+/g, " ");
    if (!firstName) throw new Error("Please enter your first name.");

    const name = buildFullName(firstName, args.lastName);
    const now = Date.now();
    await ctx.db.patch(userId, {
      name,
      // `??` keeps the original onboarding timestamp when Settings edits later.
      profileCompletedAt: user.profileCompletedAt ?? now,
      updatedAt: now,
    });
    return { ok: true, name };
  },
});

export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }
  const user = await ctx.db.get(userId);
  return user ?? null;
};
