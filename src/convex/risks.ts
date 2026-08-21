import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const risks = await ctx.db
      .query("risks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const results = await Promise.all(
      risks.map(async (risk) => {
        const owner = risk.ownerId ? await ctx.db.get(risk.ownerId) : null;
        return { ...risk, owner };
      })
    );
    return results;
  },
});

export const get = query({
  args: { riskId: v.id("risks") },
  handler: async (ctx, args) => {
    const risk = await ctx.db.get(args.riskId);
    if (!risk) return null;
    const owner = risk.ownerId ? await ctx.db.get(risk.ownerId) : null;
    return { ...risk, owner };
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    probability: v.number(),
    impact: v.number(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    ownerId: v.optional(v.id("users")),
    status: v.union(v.literal("open"), v.literal("mitigated"), v.literal("closed"), v.literal("accepted")),
    mitigationStrategy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("risks", {
      ...args,
      score: args.probability * args.impact,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    riskId: v.id("risks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    probability: v.optional(v.number()),
    impact: v.optional(v.number()),
    severity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
    ownerId: v.optional(v.id("users")),
    status: v.optional(v.union(v.literal("open"), v.literal("mitigated"), v.literal("closed"), v.literal("accepted"))),
    mitigationStrategy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { riskId, ...updates } = args;
    const patch: Record<string, any> = { ...updates, updatedAt: Date.now() };
    if (updates.probability !== undefined || updates.impact !== undefined) {
      const risk = await ctx.db.get(riskId);
      if (risk) {
        patch.score = (updates.probability ?? risk.probability) * (updates.impact ?? risk.impact);
      }
    }
    await ctx.db.patch(riskId, patch);
    return riskId;
  },
});

export const remove = mutation({
  args: { riskId: v.id("risks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.riskId);
    return args.riskId;
  },
});
