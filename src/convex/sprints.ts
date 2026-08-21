import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const sprints = await ctx.db
      .query("sprints")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const results = await Promise.all(
      sprints.map(async (sprint) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_sprint", (q) => q.eq("sprintId", sprint._id))
          .collect();
        const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
        const completedPoints = tasks
          .filter((t) => t.status === "done")
          .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
        return { ...sprint, taskCount: tasks.length, totalPoints, completedPoints };
      })
    );
    return results;
  },
});

export const getActive = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db
      .query("sprints")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .first();
    if (!sprint) return null;
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", sprint._id))
      .collect();
    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const completedPoints = tasks
      .filter((t) => t.status === "done")
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    return { ...sprint, tasks, totalPoints, completedPoints };
  },
});

export const get = query({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) return null;
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();
    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const completedPoints = tasks
      .filter((t) => t.status === "done")
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    return { ...sprint, tasks, totalPoints, completedPoints };
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    goal: v.optional(v.string()),
    status: v.union(v.literal("planning"), v.literal("active"), v.literal("completed"), v.literal("cancelled")),
    startDate: v.number(),
    endDate: v.number(),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("sprints", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    sprintId: v.id("sprints"),
    name: v.optional(v.string()),
    goal: v.optional(v.string()),
    status: v.optional(v.union(v.literal("planning"), v.literal("active"), v.literal("completed"), v.literal("cancelled"))),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { sprintId, ...updates } = args;
    await ctx.db.patch(sprintId, { ...updates, updatedAt: Date.now() });
    return sprintId;
  },
});

export const remove = mutation({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    // Move tasks back to backlog
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();
    for (const task of tasks) {
      await ctx.db.patch(task._id, { sprintId: undefined, updatedAt: Date.now() });
    }
    await ctx.db.delete(args.sprintId);
    return args.sprintId;
  },
});

export const getVelocity = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const sprints = await ctx.db
      .query("sprints")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const completedSprints = sprints
      .filter((s) => s.status === "completed")
      .sort((a, b) => b.endDate - a.endDate)
      .slice(0, 6);
    
    const velocity = await Promise.all(
      completedSprints.map(async (sprint) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_sprint", (q) => q.eq("sprintId", sprint._id))
          .collect();
        const completedPoints = tasks
          .filter((t) => t.status === "done")
          .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
        return { sprintName: sprint.name, velocity: completedPoints };
      })
    );
    return velocity;
  },
});
