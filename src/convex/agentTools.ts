/**
 * AIE Agent tools — the queries and mutations the agent's function-calling
 * loop executes. These cannot live in agent.ts: "use node" modules may only
 * define actions, and these must be regular Convex functions.
 *
 * They run through ctx.runQuery / ctx.runMutation from the agent action, so
 * the auth context carries over: getAuthUserId returns the signed-in user who
 * asked the agent to act, and every write is logged to activityLogs exactly
 * as if they had clicked the buttons themselves.
 */

import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listProjects = internalQuery({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    return await Promise.all(
      projects.map(async (p) => {
        const members = await ctx.db
          .query("projectMembers")
          .withIndex("by_project", (q) => q.eq("projectId", p._id))
          .collect();
        const names = await Promise.all(
          members.map(async (m) => {
            const u = await ctx.db.get(m.userId);
            return u?.name ?? u?.email ?? "Unknown";
          })
        );
        return {
          id: p._id,
          name: p.name,
          status: p.status,
          priority: p.priority,
          endDate: p.endDate ?? null,
          description: p.description ?? null,
          members: names,
        };
      })
    );
  },
});

export const listTeam = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return await Promise.all(
      users.map(async (u) => {
        const assigned = await ctx.db
          .query("tasks")
          .withIndex("by_assignee", (q) => q.eq("assigneeId", u._id))
          .collect();
        const completed = assigned.filter((t) => t.status === "done");
        return {
          id: u._id,
          name: u.name ?? u.email ?? "Unknown",
          email: u.email ?? null,
          jobTitle: u.jobTitle ?? null,
          department: u.department ?? null,
          isAnonymous: !!u.isAnonymous,
          completedTasks: completed.length,
          completedPoints: completed.reduce(
            (s, t) => s + (t.storyPoints ?? 0),
            0
          ),
          openTasks: assigned.length - completed.length,
          openPoints: assigned
            .filter((t) => t.status !== "done")
            .reduce((s, t) => s + (t.storyPoints ?? 0), 0),
        };
      })
    );
  },
});

export const memberPerformance = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const assigned = await ctx.db
      .query("tasks")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", args.userId))
      .collect();
    const completed = assigned.filter((t) => t.status === "done");
    return {
      id: user._id,
      name: user.name ?? user.email ?? "Unknown",
      completedTasks: completed.length,
      completedPoints: completed.reduce((s, t) => s + (t.storyPoints ?? 0), 0),
      openTasks: assigned.length - completed.length,
      completionRate:
        assigned.length === 0
          ? 0
          : Math.round((completed.length / assigned.length) * 100),
    };
  },
});

export const createProject = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("on-hold"),
      v.literal("planning")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      status: args.status,
      priority: args.priority,
      endDate: args.endDate,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("projectMembers", {
      projectId,
      userId,
      role: "owner",
      joinedAt: now,
    });
    await ctx.db.insert("activityLogs", {
      userId,
      projectId,
      action: `created project ${args.name} (via AIE Agent)`,
      entityType: "project",
      entityName: args.name,
      createdAt: now,
    });
    return projectId;
  },
});

export const addMember = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthUserId(ctx);
    if (!actor) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId)
      )
      .first();
    if (existing) {
      const already = await ctx.db.get(args.userId);
      return {
        ok: true,
        skipped: "already a member",
        userName: already?.name ?? already?.email ?? "member",
      };
    }
    const user = await ctx.db.get(args.userId);
    const project = await ctx.db.get(args.projectId);
    if (!project) return { error: "Project not found" };
    const userName = user?.name ?? user?.email ?? "member";
    await ctx.db.insert("projectMembers", {
      projectId: args.projectId,
      userId: args.userId,
      role: args.role ?? "member",
      joinedAt: Date.now(),
    });
    await ctx.db.insert("activityLogs", {
      userId: actor,
      projectId: args.projectId,
      action: `added ${userName} to project ${project.name} (via AIE Agent)`,
      entityType: "project",
      entityName: project.name,
      createdAt: Date.now(),
    });
    return { ok: true, userName };
  },
});

export const createTask = internalMutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    type: v.union(v.literal("task"), v.literal("bug"), v.literal("subtask")),
    status: v.union(
      v.literal("todo"),
      v.literal("in-progress"),
      v.literal("review"),
      v.literal("done")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    storyPoints: v.optional(v.number()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthUserId(ctx);
    if (!actor) throw new Error("Not authenticated");
    const now = Date.now();
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const maxOrder = Math.max(0, ...tasks.map((t) => t.order ?? 0));
    const taskId = await ctx.db.insert("tasks", {
      projectId: args.projectId,
      title: args.title,
      description: args.description,
      type: args.type,
      status: args.status,
      priority: args.priority,
      storyPoints: args.storyPoints,
      assigneeId: args.assigneeId,
      dueDate: args.dueDate ? Date.parse(args.dueDate) : undefined,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("activityLogs", {
      userId: actor,
      projectId: args.projectId,
      action: `created task ${args.title} (via AIE Agent)`,
      entityType: "task",
      entityName: args.title,
      createdAt: now,
    });
    return taskId;
  },
});

export const assignTask = internalMutation({
  args: {
    taskId: v.id("tasks"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthUserId(ctx);
    if (!actor) throw new Error("Not authenticated");
    const task = await ctx.db.get(args.taskId);
    if (!task) return { error: "Task not found" };
    const user = await ctx.db.get(args.userId);
    if (!user) return { error: "User not found" };
    const userName = user.name ?? user.email ?? "member";
    await ctx.db.patch(args.taskId, {
      assigneeId: args.userId,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("activityLogs", {
      userId: actor,
      projectId: task.projectId,
      action: `assigned ${userName} to task ${task.title} (via AIE Agent)`,
      entityType: "task",
      entityName: task.title,
      createdAt: Date.now(),
    });
    return { ok: true, userName, taskTitle: task.title };
  },
});
