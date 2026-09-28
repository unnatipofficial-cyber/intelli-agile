import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { safeGet } from "./helpers";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const results = await Promise.all(
      tasks.map(async (task) => {
        const assignee = task.assigneeId ? await safeGet(ctx, task.assigneeId) : null;
        const sprint = task.sprintId ? await safeGet(ctx, task.sprintId) : null;
        return { ...task, assignee, sprint };
      })
    );
    return results;
  },
});

/**
 * Workspace-wide task feed used by the Tasks page.
 *
 * Unlike `list`, this is not bound to a single project: it powers the
 * "all my work items" experience with search, filters and the Kanban board.
 * Each task is enriched with its assignee, project and sprint.
 */
export const listWorkspace = query({
  args: {
    projectId: v.optional(v.id("projects")),
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const projectId = args.projectId;
    const tasks = projectId
      ? await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect()
      : await ctx.db.query("tasks").collect();

    const filtered = args.assigneeId
      ? tasks.filter((task) => task.assigneeId === args.assigneeId)
      : tasks;

    return await Promise.all(
      filtered.map(async (task) => {
        const assignee = task.assigneeId
          ? await safeGet(ctx, task.assigneeId)
          : null;
        const project = await safeGet(ctx, task.projectId);
        const sprint = task.sprintId ? await safeGet(ctx, task.sprintId) : null;
        return { ...task, assignee, project, sprint };
      }),
    );
  },
});

export const listBySprint = query({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();
    const results = await Promise.all(
      tasks.map(async (task) => {
        const assignee = task.assigneeId ? await safeGet(ctx, task.assigneeId) : null;
        return { ...task, assignee };
      })
    );
    return results;
  },
});

export const listBacklog = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const backlog = tasks.filter((t) => !t.sprintId);
    const results = await Promise.all(
      backlog.map(async (task) => {
        const assignee = task.assigneeId ? await safeGet(ctx, task.assigneeId) : null;
        return { ...task, assignee };
      })
    );
    return results.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
});

export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    const assignee = task.assigneeId ? await safeGet(ctx, task.assigneeId) : null;
    const sprint = task.sprintId ? await safeGet(ctx, task.sprintId) : null;
    return { ...task, assignee, sprint };
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    type: v.union(v.literal("task"), v.literal("bug"), v.literal("subtask")),
    status: v.union(v.literal("todo"), v.literal("in-progress"), v.literal("review"), v.literal("done")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    storyPoints: v.optional(v.number()),
    assigneeId: v.optional(v.id("users")),
    sprintId: v.optional(v.id("sprints")),
    epicId: v.optional(v.id("epics")),
    labels: v.optional(v.array(v.string())),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const now = Date.now();
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const maxOrder = Math.max(0, ...tasks.map((t) => t.order ?? 0));
    return await ctx.db.insert("tasks", {
      ...args,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.union(v.literal("task"), v.literal("bug"), v.literal("subtask"))),
    status: v.optional(v.union(v.literal("todo"), v.literal("in-progress"), v.literal("review"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
    storyPoints: v.optional(v.number()),
    assigneeId: v.optional(v.id("users")),
    sprintId: v.optional(v.id("sprints")),
    epicId: v.optional(v.id("epics")),
    labels: v.optional(v.array(v.string())),
    dueDate: v.optional(v.number()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { taskId, ...updates } = args;
    await ctx.db.patch(taskId, { ...updates, updatedAt: Date.now() });
    return taskId;
  },
});

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.taskId);
    return args.taskId;
  },
});

export const moveToSprint = mutation({
  args: {
    taskId: v.id("tasks"),
    sprintId: v.optional(v.id("sprints")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { sprintId: args.sprintId, updatedAt: Date.now() });
    return args.taskId;
  },
});

export const updateStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(v.literal("todo"), v.literal("in-progress"), v.literal("review"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { status: args.status, updatedAt: Date.now() });
    return args.taskId;
  },
});

export const reorder = mutation({
  args: {
    taskId: v.id("tasks"),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { order: args.order, updatedAt: Date.now() });
    return args.taskId;
  },
});

export const bulkUpdate = mutation({
  args: {
    taskIds: v.array(v.id("tasks")),
    status: v.optional(v.union(v.literal("todo"), v.literal("in-progress"), v.literal("review"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
    assigneeId: v.optional(v.id("users")),
    sprintId: v.optional(v.id("sprints")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject as any;
    const now = Date.now();
    const updates: Record<string, any> = { updatedAt: now };
    if (args.status !== undefined) updates.status = args.status;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.assigneeId !== undefined) updates.assigneeId = args.assigneeId;
    if (args.sprintId !== undefined) updates.sprintId = args.sprintId;

    for (const taskId of args.taskIds) {
      await ctx.db.patch(taskId, updates);
    }

    // Log activity for the first task as representative
    if (args.taskIds.length > 0) {
      const task = await ctx.db.get(args.taskIds[0]);
      if (task) {
        const actionParts = [];
        if (args.status) actionParts.push(`status to ${args.status}`);
        if (args.priority) actionParts.push(`priority to ${args.priority}`);
        if (args.sprintId) actionParts.push(`to sprint`);
        await ctx.db.insert("activityLogs", {
          userId,
          projectId: task.projectId,
          action: `bulk updated ${actionParts.join(", ") || "tasks"}`,
          entityType: "task",
          entityName: `${args.taskIds.length} tasks`,
          createdAt: now,
        });
      }
    }

    return args.taskIds.length;
  },
});

export const bulkDelete = mutation({
  args: { taskIds: v.array(v.id("tasks")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    for (const taskId of args.taskIds) {
      await ctx.db.delete(taskId);
    }
    return args.taskIds.length;
  },
});

export const getBurndownData = query({
  args: { sprintId: v.id("sprints") },
  handler: async (ctx, args) => {
    const sprint = await ctx.db.get(args.sprintId);
    if (!sprint) return null;

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", args.sprintId))
      .collect();

    const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const now = Date.now();
    const sprintDuration = sprint.endDate - sprint.startDate;
    const elapsed = Math.max(0, now - sprint.startDate);
    const progress = Math.min(1, elapsed / sprintDuration);

    // Generate ideal burndown points
    const days = Math.ceil(sprintDuration / (1000 * 60 * 60 * 24));
    const idealPoints: { day: number; points: number }[] = [];
    for (let i = 0; i <= days; i++) {
      idealPoints.push({
        day: i,
        points: totalPoints - (totalPoints * i) / days,
      });
    }

    // Calculate actual remaining points
    const completedPoints = tasks
      .filter((t) => t.status === "done")
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const actualRemaining = totalPoints - completedPoints;

    // Estimate actual burndown based on completion pattern
    const actualPoints: { day: number; points: number }[] = [];
    const completedTasks = tasks
      .filter((t) => t.status === "done")
      .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));

    let cumulativeCompleted = 0;
    let taskIndex = 0;
    const sprintStart = sprint.startDate;

    for (let i = 0; i <= days; i++) {
      const dayTimestamp = sprintStart + i * 24 * 60 * 60 * 1000;
      while (
        taskIndex < completedTasks.length &&
        (completedTasks[taskIndex].updatedAt || 0) <= dayTimestamp
      ) {
        cumulativeCompleted += completedTasks[taskIndex].storyPoints || 0;
        taskIndex++;
      }
      actualPoints.push({
        day: i,
        points: totalPoints - cumulativeCompleted,
      });
    }

    // If we're partway through, only show up to current day
    const currentDay = Math.min(days, Math.floor(elapsed / (24 * 60 * 60 * 1000)));

    return {
      totalPoints,
      completedPoints,
      remainingPoints: actualRemaining,
      idealPoints,
      actualPoints,
      currentDay,
      totalDays: days,
      progress,
      taskCount: tasks.length,
      completedTaskCount: tasks.filter((t) => t.status === "done").length,
    };
  },
});
