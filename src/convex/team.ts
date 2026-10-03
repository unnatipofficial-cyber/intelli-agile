import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireRole, ROLES } from "./rbac";

export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const users = await ctx.db.query("users").collect();
    return users;
  },
});

/**
 * The team roster: one row per person in the workspace, not one row per
 * project seat. Members created by the AIE agent land in `users` without a
 * `projectMembers` row, so iterating projectMembers alone hid them from the
 * Team page entirely. Project membership (and its role) is left-joined so the
 * same query powers the workload view on Team, Analytics and Reports.
 */
export const getWorkload = query({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const projectId = args.projectId;

    const users = await ctx.db.query("users").collect();
    const memberships = projectId
      ? await ctx.db
          .query("projectMembers")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect()
      : [];
    const projectTasks = projectId
      ? await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect()
      : [];
    const activeSprint = projectId
      ? await ctx.db
          .query("sprints")
          .withIndex("by_status", (q) => q.eq("status", "active"))
          .filter((q) => q.eq(q.field("projectId"), projectId))
          .first()
      : null;

    const seatByUser = new Map<string, any>(
      (memberships as any[]).map((m) => [m.userId as string, m])
    );

    return users.map((user) => {
      const seat = seatByUser.get(user._id as string) ?? null;
      const assignedTasks = (projectTasks as any[]).filter(
        (t) => t.assigneeId === user._id
      );
      const completedTasks = assignedTasks.filter((t) => t.status === "done");
      const activeTasks = activeSprint
        ? assignedTasks.filter(
            (t) => t.sprintId === activeSprint._id && t.status !== "done"
          )
        : [];
      const totalPoints = assignedTasks.reduce(
        (s, t) => s + (t.storyPoints || 0),
        0
      );
      const completedPoints = completedTasks.reduce(
        (s, t) => s + (t.storyPoints || 0),
        0
      );
      const activePoints = activeTasks.reduce(
        (s, t) => s + (t.storyPoints || 0),
        0
      );

      return {
        _id: user._id,
        userId: user._id,
        user,
        projectMemberId: seat?._id ?? null,
        role: seat?.role ?? null,
        onProject: !!seat,
        totalTasks: assignedTasks.length,
        completedTasks: completedTasks.length,
        activeTaskCount: activeTasks.length,
        totalPoints,
        completedPoints,
        activePoints,
      };
    });
  },
});

/**
 * Public entry point for the Team page's "Add member" form. It mirrors the
 * agent's add_team_member tool so a member added by hand and one added by AIE
 * are created the same way (welcome notification, optional project seat,
 * activity log) and both show up in the roster immediately.
 */
export const addMember = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    project: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    ok: boolean;
    userName: string;
    alreadyExisted: boolean;
    email: string | null;
    project: string | null;
  }> => {
    const actor = await getAuthUserId(ctx as any);
    if (!actor) throw new Error("You must be signed in to add a team member.");
    // Invited members (MEMBER) cannot grow the roster; owners can.
    await requireRole(ctx as any, [ROLES.ADMIN, ROLES.USER]);

    const name = args.name.trim();
    if (!name) throw new Error("A name is required to add a team member.");
    const email = args.email?.trim().toLowerCase() || undefined;
    const now = Date.now();

    let projectDoc: any = null;
    if (args.project) {
      const candidates = await ctx.db.query("projects").collect();
      projectDoc =
        candidates.find(
          (p) => p.name.toLowerCase() === args.project!.trim().toLowerCase()
        ) ?? null;
      if (!projectDoc) throw new Error(`No project named "${args.project}".`);
    }

    // Enrich an existing person rather than creating a duplicate of them.
    let userId: any;
    let alreadyExisted = false;
    let existingUser: any = null;
    if (email) {
      const byEmail = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      if (byEmail) {
        userId = byEmail._id;
        existingUser = byEmail;
        alreadyExisted = true;
      }
    }
    if (!userId) {
      const users = await ctx.db.query("users").collect();
      const existing = users.find(
        (u) => (u.name ?? "").trim().toLowerCase() === name.toLowerCase()
      );
      if (existing) {
        userId = existing._id;
        existingUser = existing;
        alreadyExisted = true;
      }
    }

    if (userId) {
      const existing = existingUser;
      const patch: Record<string, unknown> = {};
      if (!existing?.jobTitle && args.jobTitle?.trim()) {
        patch.jobTitle = args.jobTitle.trim();
      }
      if (!existing?.department && args.department?.trim()) {
        patch.department = args.department.trim();
      }
      if (!existing?.email && email) patch.email = email;
      if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    } else {
      userId = await ctx.db.insert("users", {
        name,
        email,
        jobTitle: args.jobTitle?.trim() || undefined,
        department: args.department?.trim() || undefined,
        isAnonymous: false,
        role: ROLES.MEMBER,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("notifications", {
        userId,
        title: `Welcome to the team, ${name}`,
        message: args.jobTitle
          ? `You have been added to AIE as ${args.jobTitle}.`
          : "You have been added to the AIE workspace.",
        type: "team",
        isRead: false,
        createdAt: now,
      });
    }

    let seatedOn: string | null = null;
    if (projectDoc) {
      const seat = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) =>
          q.eq("projectId", projectDoc._id).eq("userId", userId)
        )
        .first();
      if (!seat) {
        await ctx.db.insert("projectMembers", {
          projectId: projectDoc._id,
          userId,
          role: args.role?.trim() || "member",
          joinedAt: now,
        });
        seatedOn = projectDoc.name;
        await ctx.db.insert("activityLogs", {
          userId: actor,
          projectId: projectDoc._id,
          action: `added ${name} to project ${projectDoc.name}`,
          entityType: "project",
          entityName: projectDoc.name,
          createdAt: now,
        });
      } else {
        seatedOn = `${projectDoc.name} (already a member)`;
      }
    }

    await ctx.db.insert("activityLogs", {
      userId: actor,
      projectId: projectDoc?._id,
      action: `${alreadyExisted ? "updated team member" : "added team member"} ${name}`,
      entityType: "team",
      entityName: name,
      createdAt: now,
    });

    return {
      ok: true,
      userName: name,
      alreadyExisted,
      email: email ?? null,
      project: seatedOn,
    };
  },
});