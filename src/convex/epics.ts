import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("epics")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("todo"), v.literal("in-progress"), v.literal("done")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("epics", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    epicId: v.id("epics"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in-progress"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { epicId, ...updates } = args;
    await ctx.db.patch(epicId, { ...updates, updatedAt: Date.now() });
    return epicId;
  },
});

export const remove = mutation({
  args: { epicId: v.id("epics") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.epicId);
    return args.epicId;
  },
});
