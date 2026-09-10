import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("asc")
      .collect();

    const enriched = await Promise.all(
      comments.map(async (comment) => {
        let userName = "Unknown";
        let userImage: string | undefined;
        if (comment.userId) {
          const users = await ctx.db
            .query("users")
            .filter((q) => q.eq(q.field("_id"), comment.userId))
            .first();
          if (users) {
            userName = (users as any).name || "Unknown";
            userImage = (users as any).image;
          }
        }
        return {
          ...comment,
          userName,
          userImage,
        };
      })
    );

    // Build threaded structure: top-level comments with replies nested
    const topLevel = enriched.filter((c) => !c.parentId);
    const replies = enriched.filter((c) => c.parentId);

    return topLevel.map((comment) => ({
      ...comment,
      replies: replies.filter((r) => r.parentId === comment._id),
    }));
  },
});

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    content: v.string(),
    mentions: v.optional(v.array(v.id("users"))),
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject as any;
    const now = Date.now();

    const commentId = await ctx.db.insert("comments", {
      taskId: args.taskId,
      userId,
      content: args.content,
      mentions: args.mentions,
      parentId: args.parentId,
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    const task = await ctx.db.get(args.taskId);
    if (task) {
      await ctx.db.insert("activityLogs", {
        userId,
        projectId: task.projectId,
        action: "commented",
        entityType: "task",
        entityName: task.title,
        details: args.content.slice(0, 200),
        createdAt: now,
      });
    }

    // Create notifications for mentioned users
    if (args.mentions && args.mentions.length > 0) {
      for (const mentionedId of args.mentions) {
        if (mentionedId !== userId) {
          await ctx.db.insert("notifications", {
            userId: mentionedId,
            title: "You were mentioned",
            message: `Someone mentioned you in a comment on "${task?.title || "a task"}"`,
            type: "task",
            isRead: false,
            createdAt: now,
          });
        }
      }
    }

    return commentId;
  },
});

export const remove = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Delete replies first
    const replies = await ctx.db
      .query("comments")
      .withIndex("by_parent", (q) => q.eq("parentId", args.commentId))
      .collect();

    for (const reply of replies) {
      await ctx.db.delete(reply._id);
    }

    await ctx.db.delete(args.commentId);
  },
});
