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
    }).index("email", ["email"]),

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
    }).index("by_project", ["projectId"])
      .index("by_user", ["userId"])
      .index("by_project_time", ["projectId", "createdAt"]),

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
  },
  {
    schemaValidation: false,
  },
);

export default schema;
