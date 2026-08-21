import { v } from "convex/values";
import { query } from "./_generated/server";
import { safeGet } from "./helpers";

export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const users = await ctx.db.query("users").collect();
    return users;
  },
});

export const getWorkload = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const activeSprint = await ctx.db
      .query("sprints")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .first();

    const results = await Promise.all(
      members.map(async (member) => {
        const user = await safeGet(ctx, member.userId);
        const assignedTasks = allTasks.filter((t) => t.assigneeId === member.userId);
        const completedTasks = assignedTasks.filter((t) => t.status === "done");
        const activeTasks = activeSprint
          ? allTasks.filter((t) => t.assigneeId === member.userId && t.sprintId === activeSprint._id && t.status !== "done")
          : [];
        const totalPoints = assignedTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
        const completedPoints = completedTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
        const activePoints = activeTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);

        return {
          ...member,
          user,
          totalTasks: assignedTasks.length,
          completedTasks: completedTasks.length,
          activeTaskCount: activeTasks.length,
          totalPoints,
          completedPoints,
          activePoints,
        };
      })
    );
    return results;
  },
});
