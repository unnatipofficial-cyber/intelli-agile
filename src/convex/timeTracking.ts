import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .collect();

    return Promise.all(
      entries.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return { ...entry, userName: user?.name || "Unknown" };
      })
    );
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("timeEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const getTaskTotal = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    return entries.reduce((sum, e) => sum + e.minutes, 0);
  },
});

export const addEntry = mutation({
  args: {
    taskId: v.id("tasks"),
    projectId: v.id("projects"),
    description: v.optional(v.string()),
    minutes: v.number(),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject as any;
    const now = Date.now();

    const entryId = await ctx.db.insert("timeEntries", {
      taskId: args.taskId,
      userId,
      projectId: args.projectId,
      description: args.description,
      minutes: args.minutes,
      date: args.date,
      createdAt: now,
    });

    // Log activity
    const task = await ctx.db.get(args.taskId);
    if (task) {
      await ctx.db.insert("activityLogs", {
        userId,
        projectId: args.projectId,
        action: "logged time",
        entityType: "task",
        entityName: task.title,
        details: `${args.minutes} minutes`,
        createdAt: now,
      });
    }

    return entryId;
  },
});

export const removeEntry = mutation({
  args: { entryId: v.id("timeEntries") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ctx.db.delete(args.entryId);
  },
});

export const getProjectSummary = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);

    // Group by user
    const byUser: Record<string, number> = {};
    for (const entry of entries) {
      byUser[entry.userId] = (byUser[entry.userId] || 0) + entry.minutes;
    }

    // Group by task
    const byTask: Record<string, number> = {};
    for (const entry of entries) {
      byTask[entry.taskId] = (byTask[entry.taskId] || 0) + entry.minutes;
    }

    return { totalMinutes, byUser, byTask, entryCount: entries.length };
  },
});
