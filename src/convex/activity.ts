import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_project_time", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(limit);

    return Promise.all(
      logs.map(async (log) => {
        const userDoc = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("_id"), log.userId))
          .first();
        return {
          ...log,
          userName: (userDoc as any)?.name || "Unknown",
          userImage: (userDoc as any)?.image,
        };
      })
    );
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 30;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject as any;
    // Get user's projects
    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projectIds = memberships.map((m) => m.projectId);

    // Also get projects owned by user
    const ownedProjects = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    const allProjectIds = [...new Set([...projectIds, ...ownedProjects.map((p) => p._id)])];

    if (allProjectIds.length === 0) return [];

    const allLogs = [];
    for (const projectId of allProjectIds) {
      const logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_project_time", (q) => q.eq("projectId", projectId))
        .order("desc")
        .take(10);
      allLogs.push(...logs);
    }

    // Sort by time and take top N
    allLogs.sort((a, b) => b.createdAt - a.createdAt);
    const topLogs = allLogs.slice(0, limit);

    return Promise.all(
      topLogs.map(async (log) => {
        const userDoc = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("_id"), log.userId))
          .first();
        const project = log.projectId ? await ctx.db.get(log.projectId) : null;
        return {
          ...log,
          userName: (userDoc as any)?.name || "Unknown",
          userImage: (userDoc as any)?.image,
          projectName: (project as any)?.name,
        };
      })
    );
  },
});

export const log = mutation({
  args: {
    projectId: v.optional(v.id("projects")),
    action: v.string(),
    entityType: v.string(),
    entityName: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const userId = identity.subject as any;

    await ctx.db.insert("activityLogs", {
      userId,
      projectId: args.projectId,
      action: args.action,
      entityType: args.entityType,
      entityName: args.entityName,
      details: args.details,
      createdAt: Date.now(),
    });
  },
});
