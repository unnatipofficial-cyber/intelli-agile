import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { safeGet } from "./helpers";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const projects = await ctx.db.query("projects").collect();
    const results = await Promise.all(
      projects.map(async (project) => {
        const members = await ctx.db
          .query("projectMembers")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const memberDetails = await Promise.all(
          members.map(async (m) => {
            const user = await safeGet(ctx, m.userId);
            return { ...m, user };
          })
        );
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const sprints = await ctx.db
          .query("sprints")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        return { ...project, members: memberDetails, taskCount: tasks.length, sprintCount: sprints.length };
      })
    );
    return results;
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const memberDetails = await Promise.all(
      members.map(async (m) => {
        const user = await safeGet(ctx, m.userId);
        return { ...m, user };
      })
    );
    return { ...project, members: memberDetails };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("on-hold"), v.literal("planning")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      ...args,
      ownerId: identity.subject as any,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("projectMembers", {
      projectId,
      userId: identity.subject as any,
      role: "owner",
      joinedAt: now,
    });
    await ctx.db.insert("activityLogs", {
      userId: identity.subject as any,
      projectId,
      action: `created project ${args.name}`,
      entityType: "project",
      entityName: args.name,
      createdAt: now,
    });
    return projectId;
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("completed"), v.literal("on-hold"), v.literal("planning"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { projectId, ...updates } = args;
    await ctx.db.patch(projectId, { ...updates, updatedAt: Date.now() });
    return projectId;
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.projectId);
    return args.projectId;
  },
});

export const addMember = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId)
      )
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("projectMembers", {
      projectId: args.projectId,
      userId: args.userId,
      role: args.role || "member",
      joinedAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: { memberId: v.id("projectMembers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.memberId);
    return args.memberId;
  },
});
