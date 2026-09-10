import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getBySprint = query({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const retro = await ctx.db
      .query("retrospectives")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .first();
    return retro || null;
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const retros = await ctx.db
      .query("retrospectives")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    return Promise.all(
      retros.map(async (retro) => {
        const sprint = await ctx.db.get(retro.sprintId);
        return { ...retro, sprintName: sprint?.name || "Unknown Sprint" };
      })
    );
  },
});

export const upsert = mutation({
  args: {
    sprintId: v.id("sprints"),
    projectId: v.id("projects"),
    wentWell: v.array(v.string()),
    toImprove: v.array(v.string()),
    actionItems: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject as any;
    const now = Date.now();

    const existing = await ctx.db
      .query("retrospectives")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        wentWell: args.wentWell,
        toImprove: args.toImprove,
        actionItems: args.actionItems,
      });
      return existing._id;
    }

    const retroId = await ctx.db.insert("retrospectives", {
      sprintId: args.sprintId,
      projectId: args.projectId,
      wentWell: args.wentWell,
      toImprove: args.toImprove,
      actionItems: args.actionItems,
      createdAt: now,
    });

    // Log activity
    const sprint = await ctx.db.get(args.sprintId);
    await ctx.db.insert("activityLogs", {
      userId,
      projectId: args.projectId,
      action: "created retrospective",
      entityType: "retrospective",
      entityName: sprint?.name || "Sprint",
      createdAt: now,
    });

    return retroId;
  },
});

export const addItem = mutation({
  args: {
    sprintId: v.id("sprints"),
    category: v.union(v.literal("wentWell"), v.literal("toImprove"), v.literal("actionItems")),
    item: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const retro = await ctx.db
      .query("retrospectives")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .first();

    if (!retro) throw new Error("No retrospective found for this sprint");

    const field = args.category;
    const currentItems = retro[field] as string[];
    await ctx.db.patch(retro._id, {
      [field]: [...currentItems, args.item],
    });
  },
});

export const removeItem = mutation({
  args: {
    sprintId: v.id("sprints"),
    category: v.union(v.literal("wentWell"), v.literal("toImprove"), v.literal("actionItems")),
    index: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const retro = await ctx.db
      .query("retrospectives")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .first();

    if (!retro) throw new Error("No retrospective found");

    const field = args.category;
    const currentItems = [...(retro[field] as string[])];
    currentItems.splice(args.index, 1);
    await ctx.db.patch(retro._id, { [field]: currentItems });
  },
});
