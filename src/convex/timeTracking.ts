import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

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

/**
 * Time logged against the tasks of one sprint.
 *
 * `getProjectSummary` answers "how long has this project taken so far", which
 * is the wrong question for a retrospective: a retro is about *one* sprint, so
 * comparing its actuals against that sprint's committed points is only
 * honest if the entries are scoped the same way. Entries carry no sprintId —
 * they hang off the task — so the sprint's tasks are collected first and used
 * as the filter.
 *
 * Names are resolved here rather than left as ids so the retro page can label
 * a chart without a second round trip.
 */
export const getSprintSummary = query({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();

    const entries: Doc<"timeEntries">[] = [];
    for (const task of tasks) {
      const taskEntries = await ctx.db
        .query("timeEntries")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .collect();
      entries.push(...taskEntries);
    }

    const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);

    // One pass over the entries, then one read per distinct person/task, so the
    // number of database reads does not grow with the number of entries.
    const minutesByUser = new Map<Id<"users">, number>();
    const minutesByTask = new Map<Id<"tasks">, number>();
    for (const entry of entries) {
      minutesByUser.set(entry.userId, (minutesByUser.get(entry.userId) ?? 0) + entry.minutes);
      minutesByTask.set(entry.taskId, (minutesByTask.get(entry.taskId) ?? 0) + entry.minutes);
    }

    const byUser = await Promise.all(
      [...minutesByUser.entries()].map(async ([userId, minutes]) => {
        const user = await ctx.db.get(userId);
        return { userId, userName: user?.name || "Unknown", minutes };
      }),
    );

    const byTask = await Promise.all(
      [...minutesByTask.entries()].map(async ([taskId, minutes]) => {
        const task = await ctx.db.get(taskId);
        return {
          taskId,
          title: task?.title || "Deleted task",
          minutes,
          status: task?.status ?? "todo",
        };
      }),
    );

    byUser.sort((a, b) => b.minutes - a.minutes);
    byTask.sort((a, b) => b.minutes - a.minutes);

    return { totalMinutes, entryCount: entries.length, byUser, byTask };
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
