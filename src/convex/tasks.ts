import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const results = await Promise.all(
      tasks.map(async (task) => {
        const assignee = task.assigneeId ? await ctx.db.get(task.assigneeId) : null;
        const sprint = task.sprintId ? await ctx.db.get(task.sprintId) : null;
        return { ...task, assignee, sprint };
      })
    );
    return results;
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
        const assignee = task.assigneeId ? await ctx.db.get(task.assigneeId) : null;
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
        const assignee = task.assigneeId ? await ctx.db.get(task.assigneeId) : null;
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
    const assignee = task.assigneeId ? await ctx.db.get(task.assigneeId) : null;
    const sprint = task.sprintId ? await ctx.db.get(task.sprintId) : null;
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
