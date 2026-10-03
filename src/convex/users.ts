import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, ROLES } from "./rbac";
import { roleValidator } from "./schema";

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

export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }
  const user = await ctx.db.get(userId);
  return user ?? null;
};
