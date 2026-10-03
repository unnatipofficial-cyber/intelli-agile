import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      jobTitle: v.optional(v.string()),
      department: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("email", ["email"])
      .index("by_role", ["role"]),

    /** Invitations let someone join the workspace without an account of their own. */
    invitations: defineTable({
      email: v.string(),
      token: v.string(),
      role: v.optional(roleValidator),
      projectRole: v.optional(v.string()),
      usedBy: v.optional(v.id("users")),
      usedAt: v.optional(v.number()),
      expiresAt: v.number(),
      createdAt: v.number(),
    }).index("by_token", ["token"]).index("by_email", ["email"]).index("by_expires", ["expiresAt"]),

    projects: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("completed"), v.literal("on-hold"), v.literal("planning")),
      priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.string()),
      ownerId: v.optional(v.id("users")),
      color: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_status", ["status"])
      .index("by_owner", ["ownerId"]),

    projectMembers: defineTable({
      projectId: v.id("projects"),
      userId: v.id("users"),
      role: v.optional(v.string()),
      joinedAt: v.number(),
    }).index("by_project", ["projectId"])
      .index("by_user", ["userId"])
      .index("by_project_user", ["projectId", "userId"]),

    epics: defineTable({
      projectId: v.id("projects"),
      title: v.string(),
      description: v.optional(v.string()),
      status: v.union(v.literal("todo"), v.literal("in-progress"), v.literal("done")),
      priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
      color: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_project", ["projectId"]),

    userStories: defineTable({
      projectId: v.id("projects"),
      epicId: v.optional(v.id("epics")),
      title: v.string(),
      description: v.optional(v.string()),
      acceptanceCriteria: v.optional(v.string()),
      storyPoints: v.optional(v.number()),
      priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
      status: v.union(v.literal("todo"), v.literal("in-progress"), v.literal("review"), v.literal("done")),
      assigneeId: v.optional(v.id("users")),
      sprintId: v.optional(v.id("sprints")),
      labels: v.optional(v.array(v.string())),
      dueDate: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_project", ["projectId"])
      .index("by_sprint", ["sprintId"])
      .index("by_assignee", ["assigneeId"])
      .index("by_status", ["status"])
      .index("by_epic", ["epicId"]),

    tasks: defineTable({
      projectId: v.id("projects"),
      storyId: v.optional(v.id("userStories")),
      epicId: v.optional(v.id("epics")),
      title: v.string(),
      description: v.optional(v.string()),
      type: v.union(v.literal("task"), v.literal("bug"), v.literal("subtask")),
      status: v.union(v.literal("todo"), v.literal("in-progress"), v.literal("review"), v.literal("done")),
      priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
      storyPoints: v.optional(v.number()),
      assigneeId: v.optional(v.id("users")),
      sprintId: v.optional(v.id("sprints")),
      labels: v.optional(v.array(v.string())),
      dueDate: v.optional(v.number()),
      order: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_project", ["projectId"])
      .index("by_sprint", ["sprintId"])
      .index("by_assignee", ["assigneeId"])
      .index("by_status", ["status"])
      .index("by_type", ["type"])
      .index("by_story", ["storyId"])
      .index("by_epic", ["epicId"]),

    sprints: defineTable({
      projectId: v.id("projects"),
      name: v.string(),
      goal: v.optional(v.string()),
      status: v.union(v.literal("planning"), v.literal("active"), v.literal("completed"), v.literal("cancelled")),
      startDate: v.number(),
      endDate: v.number(),
      capacity: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_project", ["projectId"])
      .index("by_status", ["status"]),

    risks: defineTable({
      projectId: v.id("projects"),
      title: v.string(),
      description: v.optional(v.string()),
      probability: v.number(),
      impact: v.number(),
      severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
      ownerId: v.optional(v.id("users")),
      status: v.union(v.literal("open"), v.literal("mitigated"), v.literal("closed"), v.literal("accepted")),
      mitigationStrategy: v.optional(v.string()),
      score: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_project", ["projectId"])
      .index("by_severity", ["severity"])
      .index("by_status", ["status"]),

    notifications: defineTable({
      userId: v.id("users"),
      title: v.string(),
      message: v.string(),
      type: v.union(v.literal("task"), v.literal("sprint"), v.literal("risk"), v.literal("project"), v.literal("team")),
      isRead: v.boolean(),
      link: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"])
      .index("by_user_read", ["userId", "isRead"]),

    activityLogs: defineTable({
      userId: v.id("users"),
      projectId: v.optional(v.id("projects")),
      action: v.string(),
      entityType: v.string(),
      entityName: v.optional(v.string()),
      details: v.optional(v.string()),
      createdAt: v.number(),
      undoKey: v.optional(v.string()),
      before: v.optional(v.string()),
    })
      .index("by_project", ["projectId"])
      .index("by_user", ["userId"])
      .index("by_project_time", ["projectId", "createdAt"])
      .index("by_undo", ["undoKey"]),

    comments: defineTable({
      taskId: v.id("tasks"),
      userId: v.id("users"),
      content: v.string(),
      mentions: v.optional(v.array(v.id("users"))),
      parentId: v.optional(v.id("comments")),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_task", ["taskId"])
      .index("by_parent", ["parentId"]),

    timeEntries: defineTable({
      taskId: v.id("tasks"),
      userId: v.id("users"),
      projectId: v.id("projects"),
      description: v.optional(v.string()),
      minutes: v.number(),
      date: v.number(),
      createdAt: v.number(),
    }).index("by_task", ["taskId"])
      .index("by_user", ["userId"])
      .index("by_project", ["projectId"]),

    retrospectives: defineTable({
      sprintId: v.id("sprints"),
      projectId: v.id("projects"),
      wentWell: v.array(v.string()),
      toImprove: v.array(v.string()),
      actionItems: v.array(v.string()),
      createdAt: v.number(),
    }).index("by_sprint", ["sprintId"])
      .index("by_project", ["projectId"]),

    /**
     * Ambient intelligence for the pages: the AI-written read-out attached to
     * a project or workspace view. Cached with a TTL so opening a page never
     * costs an API call after the first visit.
     */
    aiBriefings: defineTable({
      key: v.string(),
      kind: v.string(),
      text: v.string(),
      generatedAt: v.number(),
      expiresAt: v.number(),
    })
      .index("by_key", ["key"])
      .index("by_expiry", ["expiresAt"]),

    /**
     * Recurring jobs the user asked the AIE Agent to run without them being
     * present — "every weekday at 9am tell me what's at risk". `nextRunAt` is
     * what the hourly cron sweeps for, so pausing a schedule just means
     * pushing it far into the future.
     */
    agentSchedules: defineTable({
      userId: v.id("users"),
      name: v.string(),
      /** What the agent should look at and report on. */
      prompt: v.string(),
      cadence: v.union(
        v.literal("hourly"),
        v.literal("daily"),
        v.literal("weekly")
      ),
      /** "09:00" for daily/weekly schedules. */
      timeOfDay: v.optional(v.string()),
      weekday: v.optional(v.string()),
      /** Optional project scope, stored as a name for display. */
      project: v.optional(v.string()),
      nextRunAt: v.number(),
      lastRunAt: v.optional(v.number()),
      lastResult: v.optional(v.string()),
      enabled: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_due", ["nextRunAt"]),

    /**
     * Live progress events emitted while the AIE Agent is thinking and acting.
     * The chat panel subscribes to a run's events so the user watches tools run
     * and the answer form in real time, instead of a spinner over a black box.
     * Rows are append-only and keyed by a per-turn `runId`.
     */
    agentEvents: defineTable({
      runId: v.string(),
      userId: v.optional(v.id("users")),
      seq: v.number(),
      type: v.union(
        v.literal("status"),
        v.literal("token"),
        v.literal("tool"),
        v.literal("done"),
        v.literal("error")
      ),
      text: v.optional(v.string()),
      tool: v.optional(v.string()),
      label: v.optional(v.string()),
      ok: v.optional(v.boolean()),
      createdAt: v.number(),
    }).index("by_run", ["runId", "seq"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
