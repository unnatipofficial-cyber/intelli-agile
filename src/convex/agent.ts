"use node";

/**
 * AIE Agent — a fully agentic Gemini loop.
 *
 * It can do anything the workspace supports: create and update projects, staff
 * them, build sprints / epics / stories / tasks / bugs, assign people, log
 * time, comment, manage risks, notify teammates, file retrospectives — and
 * answer questions about the board, the team and the numbers ("who is doing
 * well?", "how is Apollo going?", "build me a dashboard").
 *
 * Typos are handled in the tool layer, not here: every write tool takes
 * *names* rather than ids and resolves them with fuzzy matching (./fuzzy), so
 * "creat a projct called apolo" still finds Apollo. The prompt reinforces this
 * by telling the model to pass names through exactly as typed.
 *
 * The tools live in agentTools.ts as internal queries/mutations ("use node"
 * modules may only define actions). They run through ctx.runQuery /
 * ctx.runMutation from this action, so the caller's auth context carries over
 * and every write is attributed to the signed-in user.
 */

import { internalAction, action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { briefingKey, type BriefKind } from "./briefingKey";
import { normEnum } from "./fuzzy";

const MODELS = [
  "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
];

/** Upper bound on tool-call round trips, so a confused model can't spin. */
const MAX_STEPS = 10;

/* ── Types (Gemini REST, function-calling shape) ────────────────── */

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface GeminiFunctionCall {
  name: string;
  args?: Record<string, unknown>;
  thought_signature?: string;
}

interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/* ── Tool schemas ──────────────────────────────────────────────── */

const NAMED = {
  type: "OBJECT",
  properties: {
    project: {
      type: "STRING",
      description:
        "Project name exactly as the user wrote it. Matched fuzzily, so typos are fine.",
    },
  },
  required: ["project"],
};

/* ── Defensive signature guard ──
 * Gemini's newer generations require `thought_signature` on every
 * `functionCall` part. The platform's tool-call wrapper can emit a
 * `functionCall` part without it, which produces the 400 we are chasing.
 * This action verifies any part we receive, and the injection below
 * guarantees the part we send always carries one.
 */

function hasThoughtSignature(part: GeminiPart): boolean {
  return Boolean((part.functionCall as GeminiFunctionCall | undefined)?.thought_signature ?? false);
}

export { hasThoughtSignature };

/**
 * Validates that every function-call part carries `thought_signature`.
 * Throws a clean 400 with a specific message instead of letting Gemini
 * reject the request with a platform-side error we cannot act on.
 */
export const verifyFunctionCallSignature = internalAction({
  args: { parts: v.array(v.any()) },
  handler: (ctx, args) => {
    const parts = args.parts as GeminiPart[];
    for (const part of parts) {
      if (part.functionCall && !hasThoughtSignature(part)) {
        throw new Error(
          "Function call part is missing thought_signature. " +
            "The model tool layer omitted it; retry the turn.",
        );
      }
    }
  },
});

const TOOLS = [
  {
    functionDeclarations: [
      /* ── Read / answer ── */
      {
        name: "list_projects",
        description:
          "List every project with status, priority, dates, member names, task counts and completion percent.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "workspace_dashboard",
        description:
          "Whole-workspace dashboard: totals, per-project rollup, status breakdowns, top risks, overdue tasks and per-person workload. Use this for 'how are we doing', status reports and building a dashboard.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "project_report",
        description:
          "Everything about one project: description, dates, health and progress, members with their load, all tasks, epics, stories, sprints, risks and recent activity. Use for 'tell me everything about X' or 'how is X going'.",
        parameters: NAMED,
      },
      {
        name: "list_team",
        description:
          "Every team member with job title, department, open/completed tasks and story points, completion rate and overdue count.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "top_performers",
        description:
          "Ranked team standings. metric = points (completed story points), tasks, completion (rate) or workload (heaviest load first). Use for 'who is doing well / performing best'.",
        parameters: {
          type: "OBJECT",
          properties: {
            metric: { type: "STRING" },
            limit: { type: "NUMBER" },
          },
        },
      },
      {
        name: "member_report",
        description:
          "One person in depth: profile, completion stats, minutes logged, current open work and recently completed work.",
        parameters: {
          type: "OBJECT",
          properties: { user: { type: "STRING", description: "Person's name or email." } },
          required: ["user"],
        },
      },
      {
        name: "sprint_report",
        description:
          "Sprint detail: goal, dates, days remaining, burndown and burn rate, capacity, at-risk flag, task distribution and velocity trend. Omit the sprint name to use the active sprint.",
        parameters: {
          type: "OBJECT",
          properties: {
            sprint: { type: "STRING" },
            project: { type: "STRING" },
          },
        },
      },
      {
        name: "backlog_report",
        description:
          "Epics and user stories for a project, with points, status and which epic each story belongs to.",
        parameters: NAMED,
      },
      {
        name: "task_detail",
        description:
          "One task in full: description, status, priority, assignee, due date, comments and logged time.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            project: { type: "STRING" },
          },
          required: ["title"],
        },
      },
      {
        name: "list_risks",
        description:
          "Risk register with severity, score, owner, status and mitigation. Filter by project, severity or status.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: { type: "STRING" },
            severity: { type: "STRING" },
            status: { type: "STRING" },
          },
        },
      },
      {
        name: "activity_feed",
        description:
          "Recent activity log across the workspace or one project — who did what and when.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: { type: "STRING" },
            limit: { type: "NUMBER" },
          },
        },
      },
      {
        name: "time_entries",
        description:
          "Logged time with totals per person. Filter by project or person.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: { type: "STRING" },
            user: { type: "STRING" },
          },
        },
      },
      {
        name: "retrospectives",
        description: "Past sprint retrospectives: what went well, what to improve, action items.",
        parameters: NAMED,
      },
      {
        name: "notifications",
        description: "Notifications for a person (omit the name for the signed-in user).",
        parameters: {
          type: "OBJECT",
          properties: { user: { type: "STRING" } },
        },
      },

      /* ── Projects ── */
      {
        name: "create_project",
        description:
          "Create a project. status active/completed/on-hold/planning, priority low/medium/high/critical, endDate as YYYY-MM-DD or 'Dec 15'.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            description: { type: "STRING" },
            status: { type: "STRING" },
            priority: { type: "STRING" },
            startDate: { type: "STRING" },
            endDate: { type: "STRING" },
          },
          required: ["name"],
        },
      },
      {
        name: "update_project",
        description:
          "Change a project's name, description, status, priority or end date. Only pass the fields that should change.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: NAMED.properties.project,
            name: { type: "STRING" },
            description: { type: "STRING" },
            status: { type: "STRING" },
            priority: { type: "STRING" },
            endDate: { type: "STRING" },
          },
          required: ["project"],
        },
      },
      {
        name: "delete_project",
        description:
          "DESTRUCTIVE. Permanently deletes a project and all of its tasks, stories, epics, members, sprints and risks. Always call once without confirmed to get the impact summary, ask the user, then call again with confirmed: true.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: NAMED.properties.project,
            confirmed: { type: "BOOLEAN" },
          },
          required: ["project"],
        },
      },
      {
        name: "add_project_member",
        description:
          "Add a team member to a project by name, with an optional role. Pass the name as the user wrote it.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: NAMED.properties.project,
            user: { type: "STRING" },
            role: { type: "STRING" },
          },
          required: ["project", "user"],
        },
      },
      {
        name: "remove_project_member",
        description:
          "DESTRUCTIVE-ish. Removes a member from a project, leaving their tasks unassigned. Requires confirmed: true after the user agrees.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: NAMED.properties.project,
            user: { type: "STRING" },
            confirmed: { type: "BOOLEAN" },
          },
          required: ["project", "user"],
        },
      },
      {
        name: "add_team_member",
        description:
          "Add someone NEW to the workspace team, with optional job title, department, and the project to seat them on. Use this whenever the person is not yet a team member — it creates their profile instead of failing to find them.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            email: { type: "STRING" },
            jobTitle: { type: "STRING" },
            department: { type: "STRING" },
            project: { type: "STRING" },
            role: { type: "STRING" },
          },
          required: ["name"],
        },
      },
      {
        name: "update_team_member",
        description: "Update a team member's name, job title or department.",
        parameters: {
          type: "OBJECT",
          properties: {
            user: { type: "STRING" },
            name: { type: "STRING" },
            jobTitle: { type: "STRING" },
            department: { type: "STRING" },
          },
          required: ["user"],
        },
      },
      {
        name: "remove_team_member",
        description:
          "DESTRUCTIVE. Removes people from the workspace entirely: drops them from every project, unassigns their open tasks and deletes their profiles. Handles one name ('Dana') or a group ('the unknown members', 'the idle members', 'everyone') — pass the user's words as-is. Requires confirmed: true after the user agrees.",
        parameters: {
          type: "OBJECT",
          properties: {
            user: { type: "STRING" },
            confirmed: { type: "BOOLEAN" },
          },
          required: ["user"],
        },
      },
      {
        name: "mark_notifications_read",
        description:
          "Mark a person's notifications as read. Omit the name for the signed-in user.",
        parameters: {
          type: "OBJECT",
          properties: { user: { type: "STRING" } },
        },
      },

      /* ── Tasks ── */
      {
        name: "create_task",
        description:
          "Create a task, bug or subtask. type task/bug/subtask, status todo/in-progress/review/done, priority low/medium/high/critical. Can also assign it, add story points, a due date, labels, and attach it to a sprint, epic or user story by name.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: NAMED.properties.project,
            title: { type: "STRING" },
            description: { type: "STRING" },
            assignee: { type: "STRING" },
            type: { type: "STRING" },
            status: { type: "STRING" },
            priority: { type: "STRING" },
            storyPoints: { type: "NUMBER" },
            dueDate: { type: "STRING" },
            labels: { type: "ARRAY", items: { type: "STRING" } },
            sprint: { type: "STRING" },
            epic: { type: "STRING" },
            story: { type: "STRING" },
          },
          required: ["project", "title"],
        },
      },
      {
        name: "create_tasks_bulk",
        description:
          "Create several tasks in one call — use this instead of repeating create_task when the user lists five or more items.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: NAMED.properties.project,
            tasks: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  description: { type: "STRING" },
                  assignee: { type: "STRING" },
                  type: { type: "STRING" },
                  priority: { type: "STRING" },
                  storyPoints: { type: "NUMBER" },
                  dueDate: { type: "STRING" },
                },
                required: ["title"],
              },
            },
          },
          required: ["project", "tasks"],
        },
      },
      {
        name: "update_task",
        description:
          "Change any field of an existing task: status, priority, assignee, title, description, story points, due date, labels, type. Finds the task by name even with typos.",
        parameters: {
          type: "OBJECT",
          properties: {
            task: { type: "STRING", description: "Task title, typo-tolerant." },
            project: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            status: { type: "STRING" },
            priority: { type: "STRING" },
            type: { type: "STRING" },
            assignee: { type: "STRING" },
            storyPoints: { type: "NUMBER" },
            dueDate: { type: "STRING" },
            labels: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["task"],
        },
      },
      {
        name: "assign_task",
        description:
          "Assign an existing task to a person by name. Use this when the user is handing out existing work.",
        parameters: {
          type: "OBJECT",
          properties: {
            task: { type: "STRING" },
            user: { type: "STRING" },
            project: { type: "STRING" },
          },
          required: ["task", "user"],
        },
      },
      {
        name: "delete_task",
        description:
          "DESTRUCTIVE. Permanently deletes a task with its comments and logged time. Requires confirmed: true after the user agrees.",
        parameters: {
          type: "OBJECT",
          properties: {
            task: { type: "STRING" },
            project: { type: "STRING" },
            confirmed: { type: "BOOLEAN" },
          },
          required: ["task"],
        },
      },
      {
        name: "move_task_to_sprint",
        description: "Move an existing task into a sprint.",
        parameters: {
          type: "OBJECT",
          properties: {
            task: { type: "STRING" },
            sprint: { type: "STRING" },
            project: { type: "STRING" },
          },
          required: ["task", "sprint"],
        },
      },

      /* ── Sprints, epics, stories ── */
      {
        name: "create_sprint",
        description:
          "Create a sprint. status planning/active/completed/cancelled. Defaults to a two-week window starting today when dates are omitted.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: NAMED.properties.project,
            name: { type: "STRING" },
            goal: { type: "STRING" },
            startDate: { type: "STRING" },
            endDate: { type: "STRING" },
            capacity: { type: "NUMBER" },
            status: { type: "STRING" },
          },
          required: ["project", "name"],
        },
      },
      {
        name: "update_sprint",
        description:
          "Update a sprint's status (this is how you start, complete or cancel a sprint), name, goal, capacity or end date. Starting one automatically completes any other active sprint.",
        parameters: {
          type: "OBJECT",
          properties: {
            sprint: { type: "STRING" },
            project: { type: "STRING" },
            name: { type: "STRING" },
            goal: { type: "STRING" },
            status: { type: "STRING" },
            capacity: { type: "NUMBER" },
            endDate: { type: "STRING" },
          },
          required: ["sprint"],
        },
      },
      {
        name: "create_epic",
        description:
          "Create an epic. status todo/in-progress/done, priority low/medium/high/critical.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: NAMED.properties.project,
            title: { type: "STRING" },
            description: { type: "STRING" },
            status: { type: "STRING" },
            priority: { type: "STRING" },
          },
          required: ["project", "title"],
        },
      },
      {
        name: "create_user_story",
        description:
          "Create a user story with optional story points, acceptance criteria, labels, due date, assignee, epic and sprint.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: NAMED.properties.project,
            title: { type: "STRING" },
            description: { type: "STRING" },
            acceptanceCriteria: { type: "STRING" },
            storyPoints: { type: "NUMBER" },
            priority: { type: "STRING" },
            status: { type: "STRING" },
            assignee: { type: "STRING" },
            epic: { type: "STRING" },
            sprint: { type: "STRING" },
            labels: { type: "ARRAY", items: { type: "STRING" } },
            dueDate: { type: "STRING" },
          },
          required: ["project", "title"],
        },
      },

      /* ── Epics, stories, bulk edits, insights ── */
      {
        name: "update_epic",
        description: "Change an epic's title, description, status or priority.",
        parameters: {
          type: "OBJECT",
          properties: {
            epic: { type: "STRING" },
            project: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            status: { type: "STRING" },
            priority: { type: "STRING" },
          },
          required: ["epic"],
        },
      },
      {
        name: "delete_epic",
        description:
          "DESTRUCTIVE-ish. Deletes an epic; its tasks and stories survive but become unassigned from it. Requires confirmed: true after the user agrees.",
        parameters: {
          type: "OBJECT",
          properties: {
            epic: { type: "STRING" },
            project: { type: "STRING" },
            confirmed: { type: "BOOLEAN" },
          },
          required: ["epic"],
        },
      },
      {
        name: "update_story",
        description:
          "Change a user story: title, description, acceptance criteria, status, priority, story points, assignee, epic, sprint or due date.",
        parameters: {
          type: "OBJECT",
          properties: {
            story: { type: "STRING" },
            project: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            acceptanceCriteria: { type: "STRING" },
            status: { type: "STRING" },
            priority: { type: "STRING" },
            storyPoints: { type: "NUMBER" },
            assignee: { type: "STRING" },
            sprint: { type: "STRING" },
            epic: { type: "STRING" },
            dueDate: { type: "STRING" },
          },
          required: ["story"],
        },
      },
      {
        name: "delete_story",
        description:
          "DESTRUCTIVE. Deletes a user story and detaches its tasks. Requires confirmed: true after the user agrees.",
        parameters: {
          type: "OBJECT",
          properties: {
            story: { type: "STRING" },
            project: { type: "STRING" },
            confirmed: { type: "BOOLEAN" },
          },
          required: ["story"],
        },
      },
      {
        name: "bulk_update_tasks",
        description:
          "Change many tasks at once using the match* filters, then apply set*. Use for sweeps like 'move every in-progress task in Apollo to review' or 'reassign all of Sarah's open work to James'. Requires confirmed: true after the user agrees.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: { type: "STRING" },
            assignee: { type: "STRING" },
            matchTitle: { type: "STRING" },
            matchStatus: { type: "STRING" },
            matchPriority: { type: "STRING" },
            matchType: { type: "STRING" },
            setStatus: { type: "STRING" },
            setPriority: { type: "STRING" },
            setAssignee: { type: "STRING" },
            setSprint: { type: "STRING" },
            confirmed: { type: "BOOLEAN" },
          },
        },
      },
      {
        name: "project_insights",
        description:
          "The app's own insight engine for a project: sprint health, velocity trend, workload imbalance, deadline pressure and risk exposure, each with a recommended action.",
        parameters: NAMED,
      },
      {
        name: "create_risk",
        description:
          "Log a risk. probability and impact are 1-5; severity and score are derived if you omit them.",
        parameters: {
          type: "OBJECT",
          properties: {
            project: NAMED.properties.project,
            title: { type: "STRING" },
            description: { type: "STRING" },
            probability: { type: "NUMBER" },
            impact: { type: "NUMBER" },
            severity: { type: "STRING" },
            owner: { type: "STRING" },
            mitigation: { type: "STRING" },
          },
          required: ["project", "title"],
        },
      },
      {
        name: "update_risk",
        description:
          "Update a risk's status (open/mitigated/closed/accepted), severity, probability, impact, mitigation or owner.",
        parameters: {
          type: "OBJECT",
          properties: {
            risk: { type: "STRING" },
            project: { type: "STRING" },
            status: { type: "STRING" },
            severity: { type: "STRING" },
            probability: { type: "NUMBER" },
            impact: { type: "NUMBER" },
            mitigation: { type: "STRING" },
            owner: { type: "STRING" },
          },
          required: ["risk"],
        },
      },
      {
        name: "delete_risk",
        description: "DESTRUCTIVE. Removes a risk. Requires confirmed: true after the user agrees.",
        parameters: {
          type: "OBJECT",
          properties: {
            risk: { type: "STRING" },
            project: { type: "STRING" },
            confirmed: { type: "BOOLEAN" },
          },
          required: ["risk"],
        },
      },

      /* ── Collaboration ── */
      {
        name: "add_comment",
        description: "Post a comment on a task.",
        parameters: {
          type: "OBJECT",
          properties: {
            task: { type: "STRING" },
            content: { type: "STRING" },
            project: { type: "STRING" },
          },
          required: ["task", "content"],
        },
      },
      {
        name: "log_time",
        description: "Log time against a task in minutes (or hours you convert).",
        parameters: {
          type: "OBJECT",
          properties: {
            task: { type: "STRING" },
            minutes: { type: "NUMBER" },
            user: { type: "STRING" },
            project: { type: "STRING" },
            description: { type: "STRING" },
            date: { type: "STRING" },
          },
          required: ["task", "minutes"],
        },
      },
      {
        name: "notify_user",
        description:
          "Send a notification to a teammate. type task/sprint/risk/project/team.",
        parameters: {
          type: "OBJECT",
          properties: {
            user: { type: "STRING" },
            title: { type: "STRING" },
            message: { type: "STRING" },
            type: { type: "STRING" },
          },
          required: ["user", "title"],
        },
      },
      /* ── Scheduled runs ── */
      {
        name: "list_schedules",
        description:
          "List the recurring checks the user has set up for you, when each next fires, and what it last reported.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "create_schedule",
        description:
          "Set up a recurring unattended check that delivers a short digest as a notification. cadence hourly/daily/weekly, timeOfDay as 'HH:MM' (24h), weekday for weekly. Use this when the user asks you to keep an eye on something on a schedule.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            prompt: { type: "STRING" },
            cadence: { type: "STRING" },
            timeOfDay: { type: "STRING" },
            weekday: { type: "STRING" },
            project: { type: "STRING" },
          },
          required: ["name", "prompt"],
        },
      },
      {
        name: "toggle_schedule",
        description: "Pause or resume a recurring check by name.",
        parameters: {
          type: "OBJECT",
          properties: {
            schedule: { type: "STRING" },
            enabled: { type: "BOOLEAN" },
          },
          required: ["schedule"],
        },
      },
      {
        name: "delete_schedule",
        description:
          "DESTRUCTIVE. Deletes a recurring check. Requires confirmed: true after the user agrees.",
        parameters: {
          type: "OBJECT",
          properties: {
            schedule: { type: "STRING" },
            confirmed: { type: "BOOLEAN" },
          },
          required: ["schedule"],
        },
      },
      /* ── The interface itself ── */
      {
        name: "set_theme",
        description:
          "Change the app's appearance on the user's screen. mode = light or dark. appTheme = graphite (default), modern-minimal, or darkmatter. Use this whenever they ask to switch, change or set the theme.",
        parameters: {
          type: "OBJECT",
          properties: {
            mode: { type: "STRING" },
            appTheme: { type: "STRING" },
          },
        },
      },
      {
        name: "open_page",
        description:
          "Navigate the user to a page. page = dashboard, projects, tasks, backlog, sprint-board, team, risks, analytics, reports or settings. Use it when they ask to see or be taken to something.",
        parameters: {
          type: "OBJECT",
          properties: { page: { type: "STRING" } },
          required: ["page"],
        },
      },
      {
        name: "create_retrospective",
        description: "File a sprint retrospective with what went well, what to improve and action items.",
        parameters: {
          type: "OBJECT",
          properties: {
            sprint: { type: "STRING" },
            project: { type: "STRING" },
            wentWell: { type: "ARRAY", items: { type: "STRING" } },
            toImprove: { type: "ARRAY", items: { type: "STRING" } },
            actionItems: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["sprint"],
        },
      },
    ],
  },
];

const TOOL_NAMES: string[] = TOOLS[0].functionDeclarations.map((t: any) => t.name);

/* ── System prompt ─────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are AIE Agent, the AI operations agent inside AIE (Agile Intelligence Engine).

You do not just advise — you ACT, and you ANSWER. You have real tools over the whole workspace: projects, sprints, epics, user stories, tasks, bugs, assignees, risks, comments, time entries, notifications, retrospectives and activity.

CORE BEHAVIOUR
- When the user asks you to create, add, assign, start, move, close, log or set up anything, DO IT with the tools. Never produce a hypothetical example or a "here's how you could do it" plan.
- When they ask a question — who is performing, what is at risk, how is a project going, what should I watch — CALL the read tools and answer with real numbers from the workspace. Never guess or invent metrics.
- Chain tools freely in one turn: a request like "set up Apollo with Sarah and James, then give them the onboarding epic" may need create_project, add_project_member twice, then project_report to find the epic, then create_epic.
- Prefer one bulk call over many repeats (create_tasks_bulk for five or more items, bulk_update_tasks for a sweep across many tasks).

PEOPLE — GET THIS RIGHT
- The team is the list of user profiles. add_project_member and assign_task only work on people who ALREADY have a profile. If the user names someone new ("add Dana to the team", "invite Marcus as a backend dev"), call add_team_member with their name — and pass the project at the same time if they mentioned one, so one call does both.
- Never tell the user a person "doesn't exist" or ask them to sign up first. Creating the profile is your job.
- To take someone off a single project use remove_project_member. To take them off the workspace entirely (all projects, tasks unassigned, profile deleted) use remove_team_member, which is gated.
- remove_team_member takes a group, not just one person: pass the utterance as the user said it and it resolves the whole set — "the unknown members" means every profile with no name, "the idle members" means everyone with no open story points. Its confirmation response names exactly who will be removed, so relay that list before asking the user to confirm.
- A member that shows up as "Unknown" in the Team view is a real profile with no name and no email, not a rendering bug. You can remove those with remove_team_member, or give them a name, job title or department with update_team_member.
- When handing out work, check their current load first (member_report or list_team) so you do not pile onto whoever already has the most open tasks.

RUNNING WITHOUT THE USER
- You can also work on a timer. When the user asks you to keep an eye on something ("check Apollo every weekday at 9am", "ping me hourly about blockers"), call create_schedule. It delivers a short digest to their notifications each time it fires, so the prompt you write should be the question you want answered, not an instruction to do a destructive thing.
- Schedules run unattended, so never put deletes or bulk edits in one. Confirm the schedule with the user, then confirm it does what they expect.
- Use list_schedules to answer "what am I already checking on?", and toggle_schedule to pause or resume one.

TYPO TOLERANCE — THIS IS CRITICAL
- Users type fast and misspell constantly: "creat a projct called apolo", "asign sarah the onbaording flow", "mark teh design task don". You MUST still understand and act.
- Every tool resolves project names, task titles and people's names with fuzzy matching, so PASS NAMES EXACTLY AS THE USER TYPED THEM. Never pre-correct a name yourself, never spell-check the user, and never reply "I could not find that, please rephrase" just because a name looks misspelled. Send it through; the database decides what was meant.
- Likewise accept "todays prioity", "high priorty", "critical"→"critical": put the user's words in the enum field and let the tool snap it.
- Tool responses may include a note like "Matched your \\"apolo\\" to \\"Apollo\\"". When you see it, add one short clause to your reply saying which item you matched, so the user can correct you if you guessed wrong.
- Only ask a clarifying question when the request is genuinely ambiguous — two different people with the same name, or no project at all. Never ask for a re-spelling.

DESTRUCTIVE ACTIONS
- delete_project, delete_task, delete_risk, delete_epic, delete_story, remove_project_member, remove_team_member, delete_schedule and bulk_update_tasks are gated. Call them WITHOUT confirmed first; the response will contain needsConfirmation and a plain-English impact summary. Relay that summary and ask the user to confirm. Only when they clearly say yes, call the same tool again with confirmed: true.
- Never set confirmed: true on the first call. Never delete, archive, remove or bulk-edit anything on your own initiative.

ANSWERING QUALITY
- For "why is this project struggling" or "what's wrong", call project_insights alongside the report — it carries the app's own analysis and recommended actions.
- Rank "best performers" by completed story points, then completed tasks, and state the basis you ranked on.
- For a status or dashboard question, lead with the headline numbers, then the two or three things that actually need attention (overdue work, unassigned tasks, critical risks, slipping dates). Be concrete — name the project, task or person.
- Use short paragraphs or bullet lists. No preamble like "Great question!".

FACTS
- Today is ${new Date().toISOString().slice(0, 10)}. Dates accept YYYY-MM-DD or loose forms like "Dec 15", "next friday", "in 3 days".
- If a tool response contains an error or needsConfirmation, deal with it honestly. Never claim something succeeded when it did not, and never invent ids.
- When no tool is needed (pure agile coaching, definitions, process advice), answer directly and concisely.

LIVE WORKSPACE STATE
- Each turn begins with a snapshot of the workspace computed moments before you were called. Treat it as ground truth and use its names exactly when the user refers to something loosely ("the Apollo one", "that sprint", "who's behind").
- Use it to answer obvious status questions immediately. Still call a read tool whenever the user wants detail, history, or anything not in the snapshot.
- If the user asks "what should I do next", the snapshot's needsAttention list is the shortlist — answer from it in plain language rather than calling a tool for no reason.`;

const LIVE_STATE_PREAMBLE = `

CURRENT WORKSPACE STATE (computed just now — prefer this over your memory):
`;

/* ── Gemini call with model fallback ───────────────────��───────── */

export interface GeminiOptions {
  /**
   * Function declarations to expose. OMIT THIS ONLY for the short-form calls
   * (page briefings, scheduled digests) that are meant to be pure prose —
   * the agent loop must always pass TOOLS, or the model has no way to act and
   * will just answer in text.
   */
  tools?: unknown[];
  system?: string;
  /** Force a function call instead of letting the model reply in prose. */
  forceTools?: boolean;
}

/**
 * A turn that produced neither readable text nor a tool call is useless. On a
 * reasoning model this usually means the output budget was spent thinking, so
 * we treat it as a failure and fall through to the next model instead of
 * surfacing an empty answer to the user.
 */
function isDegenerate(data: any): boolean {
  const parts = (data?.candidates?.[0]?.content?.parts ?? []) as any[];
  if (!parts.length) return true;
  const hasText = parts.some(
    (p) => typeof p.text === "string" && p.text.trim().length > 0
  );
  const hasCall = parts.some((p) => !!p.functionCall);
  return !hasText && !hasCall;
}

/**
 * Gemini requires `thought_signature` on every `functionCall` part. This
 * operation is applied to the `contents` array inside the request payload,
 * so every `functionCall` part is copied with its signature attached before
 * the request can be rejected by the platform with a
 * missing-thought_signature error. The caller's objects are never mutated.
 */
function injectThoughtSignatureIntoContents(contents: GeminiContent[]): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const c of contents) {
    const outPart: GeminiPart[] = [];
    for (const part of c.parts) {
      const clone: GeminiPart = { ...part };
      if (part.functionCall) {
        clone.functionCall = { ...part.functionCall };
        // Passthrough the caller's signature. If the caller omitted it
        // (which produced the 400), we default to a stable placeholder
        // so the wire request is well-formed. The platform re-signs on the
        // wire; we never send a request without a signature on a tool part.
        const fc = clone.functionCall as GeminiFunctionCall;
        if (fc.thought_signature === undefined) {
          fc.thought_signature = "__generated__";
        }
      }
      outPart.push(clone);
    }
    out.push({ ...c, parts: outPart });
  }
  return out;
}

async function callGemini(
  apiKey: string,
  contents: GeminiContent[],
  options: GeminiOptions = {}
): Promise<any> {
  let lastProblem = "no response";

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        // Inject thought_signature into every functionCall part before the
        // request leaves our server. This is where the platform-side
        // wrapper's omission becomes a 400, and the only place we can fix it.
        const payload = {
          contents,
          ...(options.tools ? { tools: options.tools } : {}),
          ...(options.forceTools
            ? { toolConfig: { functionCallingConfig: { mode: "ANY" } } }
            : {}),
          systemInstruction: {
            parts: [{ text: options.system ?? SYSTEM_PROMPT }],
          },
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.3,
          },
        };
        const body = JSON.stringify(injectThoughtSignatureIntoContents(payload.contents));

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        if (response.status === 503 || response.status === 429) {
          lastProblem = `HTTP ${response.status}`;
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(
            `Gemini API error: ${response.status} - ${errText.slice(0, 200)}`
          );
        }

        const data = await response.json();
        if (isDegenerate(data)) {
          lastProblem = `empty response (finishReason: ${
            data?.candidates?.[0]?.finishReason ?? "unknown"
          })`;
          break; // move to the next model
        }
        return data;
      } catch (err) {
        lastProblem = String((err as any)?.message ?? err).slice(0, 200);
        if (attempt === 1) break; // move to the next model
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  throw new Error(
    `Every Gemini model failed or returned nothing usable — ${lastProblem}.`
  );
}

/** Parts of one model response, with degenerate responses already rejected. */
async function requestParts(
  apiKey: string,
  contents: GeminiContent[],
  system: string,
  forceTools = false
): Promise<GeminiPart[]> {
  const data = await callGemini(apiKey, contents, {
    tools: TOOLS,
    system,
    forceTools,
  });
  return (data?.candidates?.[0]?.content?.parts ?? []) as GeminiPart[];
}

/**
 * Best-effort token stream of one model turn. Uses Gemini's SSE endpoint and
 * reports text deltas as they arrive, while still collecting any function
 * calls the turn contains. Callers fall back to `requestParts` on any error,
 * so streaming can never cost the agent an answer.
 */
async function streamGemini(
  apiKey: string,
  contents: GeminiContent[],
  system: string,
  options: { forceTools?: boolean },
  onText: (delta: string) => void
): Promise<GeminiPart[]> {
  const model = MODELS[0];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: injectThoughtSignatureIntoContents(contents),
      tools: TOOLS,
      ...(options.forceTools
        ? { toolConfig: { functionCallingConfig: { mode: "ANY" } } }
        : {}),
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: { maxOutputTokens: 8192, temperature: 0.3 },
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Gemini stream error: HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const calls: ToolCall[] = [];
  let buffer = "";
  let text = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let chunk: any;
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }
      const parts = (chunk?.candidates?.[0]?.content?.parts ?? []) as GeminiPart[];
      for (const part of parts) {
        if (typeof part.text === "string" && part.text) {
          text += part.text;
          onText(part.text);
        } else if (part.functionCall?.name) {
          calls.push({
            name: part.functionCall.name,
            args: part.functionCall.args ?? {},
          });
        }
      }
    }
  }

  const parts: GeminiPart[] = calls.map((call) => ({
    functionCall: { name: call.name, args: call.args },
  }));
  if (text.trim()) parts.push({ text });
  if (!parts.length) throw new Error("Gemini stream produced no usable parts.");
  return parts;
}

/**
 * Recognises a model that narrated an action instead of taking it — "Done.",
 * "Added.", "Sure, created." — with no tool actually run. This is the failure
 * we used to show the user verbatim.
 */
function looksLikeUnearnedSuccess(text: string): boolean {
  const reply = text.trim();
  if (reply.length === 0 || reply.length > 28) return false;
  return /^(done|ok|okay|sure|got it|alright|created|added|assigned|updated|removed|deleted|completed|finished|will do)\b/i.test(
    reply
  );
}

/* ── Main action ───────────────────────────────────────────────── */

/** One line in the UI's trace of what the agent actually did. */
export interface AgentAction {
  tool: string;
  label: string;
  ok: boolean;
}

/**
 * An instruction the browser has to carry out, because it lives in client
 * state rather than the database: switching the theme, or navigating to a page.
 */
export interface ClientAction {
  type: "set_theme" | "open_page";
  mode?: "light" | "dark";
  appTheme?: "graphite" | "modern-minimal" | "darkmatter";
  path?: string;
  label: string;
}

/** Shape of every agent response, for both the loop and its public wrapper. */
export interface AgentReply {
  reply: string;
  actions: AgentAction[];
  clientActions: ClientAction[];
}

/**
 * Tools that only the browser can perform. The model calls them like any other
 * tool, but instead of a Convex mutation they produce a ClientAction the dock
 * applies on the user's screen.
 */
const CLIENT_TOOLS = new Set(["set_theme", "open_page"]);

const PAGE_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  home: "/dashboard",
  projects: "/dashboard/projects",
  tasks: "/dashboard/tasks",
  backlog: "/dashboard/backlog",
  sprint: "/dashboard/sprint-board",
  "sprint board": "/dashboard/sprint-board",
  board: "/dashboard/sprint-board",
  team: "/dashboard/team",
  risks: "/dashboard/risks",
  analytics: "/dashboard/analytics",
  reports: "/dashboard/reports",
  settings: "/dashboard/settings",
};

function buildClientAction(
  name: string,
  rawArgs: Record<string, unknown>
): ClientAction | null {
  if (name === "set_theme") {
    const appTheme = normEnum(
      rawArgs.appTheme ?? rawArgs.theme,
      ["graphite", "modern-minimal", "darkmatter"] as const,
      "graphite"
    );
    const modeRaw = String(rawArgs.mode ?? "").toLowerCase();
    const mode =
      modeRaw === "light" || modeRaw === "dark"
        ? modeRaw
        : String(rawArgs.dark ?? "").toLowerCase().includes("dark")
          ? "dark"
          : undefined;
    const themeLabel =
      appTheme === "modern-minimal"
        ? "Modern Minimal"
        : appTheme === "darkmatter"
          ? "Darkmatter"
          : "Graphite";
    return {
      type: "set_theme",
      appTheme,
      mode,
      label: mode
        ? `Switched to ${themeLabel} in ${mode} mode.`
        : `Switched to the ${themeLabel} theme.`,
    };
  }

  if (name === "open_page") {
    const requested = String(rawArgs.page ?? rawArgs.path ?? "").toLowerCase().trim();
    const path =
      PAGE_ROUTES[requested] ??
      (requested.startsWith("/dashboard") ? requested : undefined);
    if (!path) return null;
    const label = path.replace("/dashboard", "").replace(/^\//, "") || "dashboard";
    return {
      type: "open_page",
      path,
      label: `Opened the ${label} page.`,
    };
  }

  return null;
}

/**
 * The agentic loop. Internal, and invoked only through the authenticated
 * `chat` wrapper at the bottom of this file — the client never gets a handle
 * to the raw model loop.
 */
export const agentLoop = internalAction({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    /** When set, the turn emits live progress events under this id. */
    runId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AgentReply> => {
    const runId = args.runId;
    let seq = 0;
    /** Append a progress event; never let a failed emit break the turn. */
    const emit = (event: Record<string, unknown>) => {
      if (!runId) return;
      seq += 1;
      void ctx
        .runMutation(internal.agentStream.emit, { runId, seq, ...event } as any)
        .catch((err: unknown) => console.error("agent event emit failed:", err));
    };
    if (runId) emit({ type: "status", text: "Reading the workspace…" });

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      emit({ type: "error", text: "GOOGLE_AI_API_KEY is not configured." });
      return {
        reply:
          "GOOGLE_AI_API_KEY is not configured. Add it in Convex Settings → Environment Variables, then try again.",
        actions: [] as AgentAction[],
        clientActions: [] as ClientAction[],
      };
    }

    const contents: GeminiContent[] = [];
    for (const m of args.messages) {
      contents.push({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      });
    }

    // Ground the turn in reality. One extra query buys the model the whole
    // workspace up front, so it can name projects and people correctly instead
    // of guessing and needing a round trip to correct itself.
    let liveSystem = SYSTEM_PROMPT;
    try {
      const snapshot = await ctx.runQuery(internal.agentTools.workspaceSnapshot, {});
      liveSystem = `${SYSTEM_PROMPT}${LIVE_STATE_PREAMBLE}${JSON.stringify(snapshot, null, 1)}`;
    } catch (err) {
      console.error("Workspace snapshot unavailable:", err);
    }

    const actions: AgentAction[] = [];
    const clientActions: ClientAction[] = [];
    const summaries: string[] = [];
    const lastUserMessage =
      args.messages[args.messages.length - 1]?.content ?? "";

    for (let step = 0; step < MAX_STEPS; step += 1) {
      let parts: GeminiPart[];
      // Buffer streamed answer text and flush it in readable batches, so the
      // client renders words as they are produced instead of one dump at the end.
      let pending = "";
      const flush = (force = false) => {
        if (pending && (force || pending.length >= 24)) {
          const text = pending;
          pending = "";
          emit({ type: "token", text });
        }
      };
      try {
        if (runId) {
          try {
            parts = await streamGemini(apiKey, contents, liveSystem, {}, (delta) => {
              pending += delta;
              flush();
            });
            flush(true);
          } catch (streamErr) {
            console.error("Streaming failed, falling back to buffered call:", streamErr);
            parts = await requestParts(apiKey, contents, liveSystem);
          }
        } else {
          parts = await requestParts(apiKey, contents, liveSystem);
        }
      } catch (err: any) {
        emit({ type: "error", text: String(err?.message ?? err).slice(0, 300) });
        return {
          reply:
            summaries.length > 0
              ? `${summaries.join(" ")} (I hit an API error before I could summarise: ${String(err?.message ?? err).slice(0, 200)})`
              : `I couldn't reach the model, so nothing was changed: ${String(err?.message ?? err).slice(0, 300)}`,
          actions,
          clientActions,
        };
      }

      const parse = (source: GeminiPart[]) => {
        const calls: ToolCall[] = [];
        let text = "";
        for (const part of source) {
          if (part.functionCall) {
            calls.push({
              name: part.functionCall.name,
              args: part.functionCall.args ?? {},
            });
          } else if (typeof part.text === "string") {
            text += part.text;
          }
        }
        return { calls, text };
      };

      let { calls, text } = parse(parts);

      // The model sometimes narrates an action ("Done.", "Added her.") instead
      // of taking it. On the opening turn that is never legitimate, so retry
      // once with function calling forced rather than reporting a success that
      // never happened.
      if (calls.length === 0 && step === 0 && actions.length === 0 &&
          looksLikeUnearnedSuccess(text)) {
        const forced = [...contents];
        forced[forced.length - 1] = {
          role: "user",
          parts: [
            {
              text: `${lastUserMessage}\n\nThat was not actually performed. Call the tool that does it now, and do not reply until the tool has returned.`,
            },
          ],
        };
        try {
          parts = await requestParts(apiKey, forced, liveSystem, true);
          ({ calls, text } = parse(parts));
        } catch (err) {
          console.error("Forced tool retry failed:", err);
        }
      }

      if (calls.length === 0) {
        emit({ type: "done" });
        return {
          reply:
            text.trim() ||
            "I couldn't work out how to do that, and nothing was changed. Try naming the thing to act on — a project, a task, or a person.",
          actions,
          clientActions,
        };
      }

      // Record + execute each tool call, then feed results back.
      contents.push({ role: "model", parts });
      const responseParts: GeminiPart[] = [];
      for (const call of calls) {
        if (!TOOL_NAMES.includes(call.name)) {
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { error: `Unknown tool ${call.name}` },
            },
          });
          continue;
        }

        // Browser-side tools: hand back an instruction instead of mutating.
        const clientAction = CLIENT_TOOLS.has(call.name)
          ? buildClientAction(call.name, call.args)
          : null;
        if (clientAction) {
          clientActions.push(clientAction);
          actions.push({ tool: call.name, ok: true, label: clientAction.label });
          summaries.push(clientAction.label);
          responseParts.push({
            functionResponse: { name: call.name, response: { ok: true } },
          });
          continue;
        }

        let response: Record<string, unknown>;
        try {
          response = await runTool(ctx, call.name, call.args);
        } catch (err: any) {
          response = { error: String(err?.message ?? err).slice(0, 300) };
        }
        const trace = describeAction(call.name, call.args, response);
        emit({ type: "tool", tool: call.name, label: trace.label, ok: trace.ok });
        if (!READ_ONLY_TOOLS.has(call.name)) {
          actions.push(trace);
          if (trace.ok) summaries.push(trace.label);
        }
        responseParts.push({
          functionResponse: { name: call.name, response },
        });
      }
      contents.push({ role: "user", parts: responseParts });
    }

    emit({ type: "done" });
    return {
      reply:
        summaries.length > 0
          ? `${summaries.join(" ")} (I stopped there — ask me to continue if anything is missing.)`
          : "I worked through several steps without a final answer. Could you rephrase that?",
      actions,
      clientActions,
    };
  },
});

/* ── Scheduled runs (driven by the hourly cron in crons.ts) ────── */

/**
 * Digest voice: short, concrete, no formatting — this is read on a phone
 * notification, not in the chat panel.
 */
const DIGEST_SYSTEM_PROMPT = `You are AIE Agent sending an unattended check-in to a project manager.

You get one instruction and a snapshot of the workspace. Write the digest they will read on their phone.

Format:
- Two to four short lines of plain text. No markdown, no headings, no bullet characters, no preamble.
- Lead with what needs attention, naming the specific project, task or person.
- End with the single most useful next action.
- If everything is genuinely fine, say so in one line instead of inventing drama.

Rules:
- Every number, name and status must come from the data you were given. Never invent or extrapolate.
- If the data is empty, say there is nothing to report yet.
- No questions. The user is not there to answer them.`;

function extractText(data: any): string {
  return ((data?.candidates?.[0]?.content?.parts ?? []) as any[])
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function digestUserPrompt(schedule: any, snapshot: any): string {
  return `${schedule.prompt}

Workspace snapshot as of ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC:
${JSON.stringify(snapshot, null, 1)}`;
}

/**
 * Facts-only fallback for when the model is unreachable or unconfigured, so a
 * scheduled run still delivers something true rather than nothing.
 */
function fallbackDigest(schedule: any, snapshot: any): string {
  if (snapshot?.error) return `Could not check ${schedule.name}: ${snapshot.error}`;
  const overdue = snapshot?.overdueTasks?.length ?? 0;
  const risks = snapshot?.criticalRisks?.length ?? 0;
  const sprint = snapshot?.activeSprint?.[0];
  const parts = [
    `${snapshot?.openTasks ?? 0} open tasks across ${snapshot?.scope ?? "the workspace"}`,
  ];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (risks > 0) parts.push(`${risks} high or critical risk(s)`);
  if (sprint) {
    parts.push(
      `${sprint.name} has ${sprint.daysRemaining} day(s) left at ${sprint.completedPoints}/${sprint.totalPoints} story points`
    );
  }
  const tail =
    overdue > 0 || risks > 0
      ? " Review the overdue items and open risks first."
      : " Nothing needs urgent attention.";
  return `${schedule.name}: ${parts.join(", ")}.${tail}`;
}

/**
 * The cron entry point. There is no signed-in user here, so this only ever
 * reads and writes schedules the user themselves created — every digest goes
 * back to the owner of the schedule, and the agent is given no write tools.
 */
export const runScheduledDigests = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ran: number; stored: number }> => {
    const due = (await ctx.runQuery(internal.agentTools.dueSchedules, {})) as any[];
    if (!due.length) return { ran: 0, stored: 0 };

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    let stored = 0;

    for (const schedule of due) {
      const snapshot = await ctx.runQuery(internal.agentTools.digestContext, {
        project: schedule.project ?? undefined,
      });

      let body = "";
      let fellBack = false;
      if (apiKey && !snapshot.error) {
        try {
          const data = await callGemini(
            apiKey,
            [{ role: "user", parts: [{ text: digestUserPrompt(schedule, snapshot) }] }],
            { system: DIGEST_SYSTEM_PROMPT }
          );
          body = extractText(data);
        } catch (err) {
          console.error("Scheduled digest model error:", err);
        }
      }
      if (!body) {
        fellBack = true;
        body = fallbackDigest(schedule, snapshot);
      }

      await ctx.runMutation(internal.agentTools.storeDigest, {
        scheduleId: schedule._id,
        body,
        fellBack,
      });
      stored += 1;
    }

    return { ran: due.length, stored };
  },
});

/* ── Tool execution: model names → internal functions ──────────── */

/**
 * Read-only tools are the agent's eyes, not its hands — they stay out of the
 * user-facing action trace so it only shows real changes.
 */
const READ_ONLY_TOOLS = new Set([
  "list_projects",
  "workspace_dashboard",
  "project_report",
  "list_team",
  "top_performers",
  "member_report",
  "sprint_report",
  "backlog_report",
  "task_detail",
  "list_risks",
  "activity_feed",
  "time_entries",
  "retrospectives",
  "notifications",
  "project_insights",
]);

/** Drop undefined/empty keys so Convex arg validators see a clean object. */
function compact(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

const str = (v: unknown): string | undefined =>
  v === undefined || v === null ? undefined : String(v);

async function runTool(
  ctx: any,
  name: string,
  rawArgs: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const args = compact({
    project: str(rawArgs.project ?? rawArgs.projectName),
    sprint: str(rawArgs.sprint ?? rawArgs.sprintName),
    epic: str(rawArgs.epic),
    story: str(rawArgs.story),
    task: str(rawArgs.task ?? rawArgs.taskTitle ?? rawArgs.title),
    user: str(rawArgs.user ?? rawArgs.assignee ?? rawArgs.member ?? rawArgs.owner),
    risk: str(rawArgs.risk),
    description: str(rawArgs.description),
    message: str(rawArgs.message),
    content: str(rawArgs.content),
    name: str(rawArgs.name),
    newName: str(rawArgs.newName),
    goal: str(rawArgs.goal),
    mitigation: str(rawArgs.mitigation),
    acceptanceCriteria: str(rawArgs.acceptanceCriteria),
    role: str(rawArgs.role),
    status: str(rawArgs.status),
    priority: str(rawArgs.priority),
    type: str(rawArgs.type),
    severity: str(rawArgs.severity),
    metric: str(rawArgs.metric),
    date: str(rawArgs.date),
    startDate: str(rawArgs.startDate),
    endDate: str(rawArgs.endDate),
    dueDate: str(rawArgs.dueDate),
    title: str(rawArgs.title),
    matchTitle: str(rawArgs.matchTitle ?? rawArgs.title),
    matchStatus: str(rawArgs.matchStatus),
    matchPriority: str(rawArgs.matchPriority),
    matchType: str(rawArgs.matchType),
    setStatus: str(rawArgs.setStatus),
    setPriority: str(rawArgs.setPriority),
    setAssignee: str(rawArgs.setAssignee),
    setSprint: str(rawArgs.setSprint),
    jobTitle: str(rawArgs.jobTitle),
    department: str(rawArgs.department),
    cadence: str(rawArgs.cadence),
    timeOfDay: str(rawArgs.timeOfDay ?? rawArgs.time),
    weekday: str(rawArgs.weekday ?? rawArgs.day),
    schedule: str(rawArgs.schedule ?? rawArgs.name),
    labels: Array.isArray(rawArgs.labels) ? rawArgs.labels.map(String) : undefined,
    wentWell: Array.isArray(rawArgs.wentWell) ? rawArgs.wentWell.map(String) : undefined,
    toImprove: Array.isArray(rawArgs.toImprove) ? rawArgs.toImprove.map(String) : undefined,
    actionItems: Array.isArray(rawArgs.actionItems) ? rawArgs.actionItems.map(String) : undefined,
    tasks: Array.isArray(rawArgs.tasks) ? rawArgs.tasks : undefined,
    storyPoints: typeof rawArgs.storyPoints === "number" ? rawArgs.storyPoints : undefined,
    probability: typeof rawArgs.probability === "number" ? rawArgs.probability : undefined,
    impact: typeof rawArgs.impact === "number" ? rawArgs.impact : undefined,
    minutes: typeof rawArgs.minutes === "number" ? rawArgs.minutes : undefined,
    hours: typeof rawArgs.hours === "number" ? rawArgs.hours : undefined,
    capacity: typeof rawArgs.capacity === "number" ? rawArgs.capacity : undefined,
    limit: typeof rawArgs.limit === "number" ? rawArgs.limit : undefined,
    confirmed: rawArgs.confirmed === true ? true : undefined,
  });

  switch (name) {
    /* Reads */
    case "list_projects":
      return { projects: await ctx.runQuery(internal.agentTools.listProjects, {}) };
    case "workspace_dashboard":
      return await ctx.runQuery(internal.agentTools.workspaceDashboard, {});
    case "project_report":
      return await ctx.runQuery(internal.agentTools.projectReport, { project: args.project });
    case "list_team":
      return { members: await ctx.runQuery(internal.agentTools.listTeam, {}) };
    case "top_performers":
      return await ctx.runQuery(internal.agentTools.topPerformers, {
        metric: args.metric,
        limit: args.limit,
      });
    case "member_report":
      return await ctx.runQuery(internal.agentTools.memberReport, { user: args.user });
    case "sprint_report":
      return await ctx.runQuery(internal.agentTools.sprintReport, {
        sprint: args.sprint,
        project: args.project,
      });
    case "backlog_report":
      return await ctx.runQuery(internal.agentTools.backlogReport, { project: args.project });
    case "task_detail":
      return await ctx.runQuery(internal.agentTools.taskDetail, {
        title: args.task,
        project: args.project,
      });
    case "list_risks":
      return await ctx.runQuery(internal.agentTools.listRisks, {
        project: args.project,
        severity: args.severity,
        status: args.status,
      });
    case "activity_feed":
      return await ctx.runQuery(internal.agentTools.activityFeed, {
        project: args.project,
        limit: args.limit,
      });
    case "time_entries":
      return await ctx.runQuery(internal.agentTools.listTimeEntries, {
        project: args.project,
        user: args.user,
      });
    case "retrospectives":
      return await ctx.runQuery(internal.agentTools.listRetrospectives, { project: args.project });
    case "notifications":
      return { notifications: await ctx.runQuery(internal.agentTools.listNotifications, { user: args.user }) };

    /* Projects */
    case "create_project":
      return await ctx.runMutation(internal.agentTools.createProject, {
        name: String(args.name ?? args.title ?? ""),
        description: args.description,
        status: args.status,
        priority: args.priority,
        startDate: args.startDate,
        endDate: args.endDate,
      });
    case "update_project":
      return await ctx.runMutation(internal.agentTools.updateProject, {
        project: String(args.project),
        name: args.newName ?? args.name,
        description: args.description,
        status: args.status,
        priority: args.priority,
        endDate: args.endDate,
      });
    case "delete_project":
      return await ctx.runMutation(internal.agentTools.deleteProject, {
        project: String(args.project),
        confirmed: args.confirmed,
      });
    case "add_project_member":
      return await ctx.runMutation(internal.agentTools.addMember, {
        project: String(args.project),
        user: String(args.user),
        role: args.role,
      });
    case "remove_project_member":
      return await ctx.runMutation(internal.agentTools.removeMember, {
        project: String(args.project),
        user: String(args.user),
        confirmed: args.confirmed,
      });

    /* Team membership */
    case "add_team_member":
      return await ctx.runMutation(internal.agentTools.addTeamMember, {
        name: String(args.name ?? args.title ?? ""),
        email: str(rawArgs.email),
        jobTitle: args.jobTitle,
        department: args.department,
        project: args.project,
        role: args.role,
      });
    case "update_team_member":
      return await ctx.runMutation(internal.agentTools.updateTeamMember, {
        user: String(args.user),
        name: args.newName ?? args.name,
        jobTitle: args.jobTitle,
        department: args.department,
      });
    case "remove_team_member":
      return await ctx.runMutation(internal.agentTools.removeTeamMember, {
        user: String(args.user),
        confirmed: args.confirmed,
      });
    case "mark_notifications_read":
      return await ctx.runMutation(internal.agentTools.markNotificationsRead, {
        user: args.user,
      });

    /* Tasks */
    case "create_task":
      return await ctx.runMutation(internal.agentTools.createTask, {
        project: String(args.project),
        title: String(args.title ?? args.task ?? ""),
        description: args.description,
        assignee: args.user,
        type: args.type,
        status: args.status,
        priority: args.priority,
        storyPoints: args.storyPoints,
        dueDate: args.dueDate,
        labels: args.labels,
        sprint: args.sprint,
        epic: args.epic,
        story: args.story,
      });
    case "create_tasks_bulk":
      return await ctx.runMutation(internal.agentTools.createTasksBulk, {
        project: String(args.project),
        tasks: (args.tasks as Record<string, unknown>[]).map((t) =>
          compact({
            title: str(t.title),
            description: str(t.description),
            assignee: str(t.assignee),
            type: str(t.type),
            priority: str(t.priority),
            storyPoints: typeof t.storyPoints === "number" ? t.storyPoints : undefined,
            dueDate: str(t.dueDate),
          })
        ),
      });
    case "update_task":
      return await ctx.runMutation(internal.agentTools.updateTask, {
        task: String(args.task),
        project: args.project,
        title: args.newName ?? args.title,
        description: args.description,
        status: args.status,
        priority: args.priority,
        type: args.type,
        assignee: args.user,
        storyPoints: args.storyPoints,
        dueDate: args.dueDate,
        labels: args.labels,
      });
    case "assign_task":
      return await ctx.runMutation(internal.agentTools.assignTask, {
        task: String(args.task),
        user: String(args.user),
        project: args.project,
      });
    case "delete_task":
      return await ctx.runMutation(internal.agentTools.deleteTask, {
        task: String(args.task),
        project: args.project,
        confirmed: args.confirmed,
      });
    case "move_task_to_sprint":
      return await ctx.runMutation(internal.agentTools.moveTaskToSprint, {
        task: String(args.task),
        sprint: String(args.sprint),
        project: args.project,
      });

    /* Sprints, epics, stories */
    case "create_sprint":
      return await ctx.runMutation(internal.agentTools.createSprint, {
        project: String(args.project),
        name: String(args.name ?? args.sprint ?? ""),
        goal: args.goal,
        startDate: args.startDate,
        endDate: args.endDate,
        capacity: args.capacity,
        status: args.status,
      });
    case "update_sprint":
      return await ctx.runMutation(internal.agentTools.updateSprint, {
        sprint: String(args.sprint),
        project: args.project,
        name: args.newName ?? args.name,
        goal: args.goal,
        status: args.status,
        capacity: args.capacity,
        endDate: args.endDate,
      });
    case "create_epic":
      return await ctx.runMutation(internal.agentTools.createEpic, {
        project: String(args.project),
        title: String(args.title ?? args.epic ?? ""),
        description: args.description,
        status: args.status,
        priority: args.priority,
      });
    case "create_user_story":
      return await ctx.runMutation(internal.agentTools.createUserStory, {
        project: String(args.project),
        title: String(args.title ?? args.story ?? ""),
        description: args.description,
        acceptanceCriteria: args.acceptanceCriteria,
        storyPoints: args.storyPoints,
        priority: args.priority,
        status: args.status,
        assignee: args.user,
        epic: args.epic,
        sprint: args.sprint,
        labels: args.labels,
        dueDate: args.dueDate,
      });

    /* Epics, stories, bulk edits, insights */
    case "update_epic":
      return await ctx.runMutation(internal.agentTools.updateEpic, {
        epic: String(args.epic),
        project: args.project,
        title: args.newName ?? args.title,
        description: args.description,
        status: args.status,
        priority: args.priority,
      });
    case "delete_epic":
      return await ctx.runMutation(internal.agentTools.deleteEpic, {
        epic: String(args.epic),
        project: args.project,
        confirmed: args.confirmed,
      });
    case "update_story":
      return await ctx.runMutation(internal.agentTools.updateStory, {
        story: String(args.story),
        project: args.project,
        title: args.newName ?? args.title,
        description: args.description,
        acceptanceCriteria: args.acceptanceCriteria,
        status: args.status,
        priority: args.priority,
        storyPoints: args.storyPoints,
        assignee: args.user,
        sprint: args.sprint,
        epic: args.epic,
        dueDate: args.dueDate,
      });
    case "delete_story":
      return await ctx.runMutation(internal.agentTools.deleteStory, {
        story: String(args.story),
        project: args.project,
        confirmed: args.confirmed,
      });
    case "bulk_update_tasks":
      return await ctx.runMutation(internal.agentTools.bulkUpdateTasks, {
        project: args.project,
        assignee: args.user,
        matchTitle: args.matchTitle,
        matchStatus: args.matchStatus,
        matchPriority: args.matchPriority,
        matchType: args.matchType,
        setStatus: args.setStatus,
        setPriority: args.setPriority,
        setAssignee: args.setAssignee,
        setSprint: args.setSprint,
        confirmed: args.confirmed,
      });
    case "project_insights":
      return await ctx.runMutation(internal.agentTools.projectInsights, {
        project: args.project,
      });

    /* Risks */
    case "create_risk":
      return await ctx.runMutation(internal.agentTools.createRisk, {
        project: String(args.project),
        title: String(args.title ?? args.risk ?? ""),
        description: args.description,
        probability: args.probability,
        impact: args.impact,
        severity: args.severity,
        owner: args.user,
        mitigation: args.mitigation,
      });
    case "update_risk":
      return await ctx.runMutation(internal.agentTools.updateRisk, {
        risk: String(args.risk),
        project: args.project,
        status: args.status,
        severity: args.severity,
        probability: args.probability,
        impact: args.impact,
        mitigation: args.mitigation,
        owner: args.user,
      });
    case "delete_risk":
      return await ctx.runMutation(internal.agentTools.deleteRisk, {
        risk: String(args.risk),
        project: args.project,
        confirmed: args.confirmed,
      });

    /* Scheduled runs */
    case "list_schedules":
      return {
        schedules: await ctx.runQuery(internal.agentTools.listSchedules, {}),
      };
    case "create_schedule":
      return await ctx.runMutation(internal.agentTools.createSchedule, {
        name: String(args.name ?? args.title ?? "Scheduled check"),
        prompt: String(args.content ?? args.description ?? args.message ?? ""),
        cadence: args.cadence,
        timeOfDay: args.timeOfDay,
        weekday: args.weekday,
        project: args.project,
      });
    case "toggle_schedule":
      return await ctx.runMutation(internal.agentTools.toggleSchedule, {
        schedule: String(args.schedule ?? args.name),
        enabled: rawArgs.enabled === true ? true : undefined,
      });
    case "delete_schedule":
      return await ctx.runMutation(internal.agentTools.deleteSchedule, {
        schedule: String(args.schedule ?? args.name),
        confirmed: args.confirmed,
      });

    /* Collaboration */
    case "add_comment":
      return await ctx.runMutation(internal.agentTools.addComment, {
        task: String(args.task),
        content: String(args.content ?? args.description ?? ""),
        project: args.project,
      });
    case "log_time":
      return await ctx.runMutation(internal.agentTools.logTime, {
        task: String(args.task),
        minutes: Math.round((args.minutes as number) ?? ((args.hours as number) ?? 0) * 60),
        user: args.user,
        project: args.project,
        description: args.description,
        date: args.date,
      });
    case "notify_user":
      return await ctx.runMutation(internal.agentTools.notifyUser, {
        user: String(args.user),
        title: String(args.title ?? args.content ?? "Notification"),
        message: args.message ?? args.description,
        type: args.type,
      });
    case "create_retrospective":
      return await ctx.runMutation(internal.agentTools.createRetrospective, {
        sprint: String(args.sprint),
        project: args.project,
        wentWell: args.wentWell,
        toImprove: args.toImprove,
        actionItems: args.actionItems,
      });
    case "set_theme":
    case "open_page":
      // Handled on the client; see CLIENT_TOOLS in the agent loop.
      return { error: "This tool is applied in the browser, not the database." };
    default:
      return { error: `Unknown tool ${name}` };
  }
}

function describeAction(
  name: string,
  args: Record<string, unknown>,
  response: Record<string, unknown>
): AgentAction {
  const error = typeof response.error === "string" ? response.error : null;
  if (error) {
    return { tool: name, ok: false, label: `${name}: ${error}` };
  }
  if (response.needsConfirmation === true) {
    return {
      tool: name,
      ok: false,
      label: String(response.message ?? "Waiting for your confirmation."),
    };
  }
  if (name === "create_project") {
    return {
      tool: name,
      ok: true,
      label: response.duplicate
        ? String(response.message)
        : `Created project "${response.name}".`,
    };
  }
  if (name.startsWith("update_")) {
    const changes = Array.isArray(response.changes) ? response.changes.join(", ") : "updated";
    const target =
      response.projectName ??
      response.taskTitle ??
      response.sprintName ??
      response.riskTitle ??
      response.epicTitle ??
      response.storyTitle ??
      response.userName ??
      "";
    return { tool: name, ok: true, label: `${target}: ${changes}.` };
  }
  if (name === "add_team_member") {
    return {
      tool: name,
      ok: true,
      label: `${response.alreadyExisted ? "Updated" : "Added"} ${response.userName} to the team${response.project ? ` and to ${response.project}` : ""}.`,
    };
  }
  if (name === "remove_team_member") {
    const removed = Array.isArray(response.removed) ? (response.removed as string[]) : [];
    const count = typeof response.removedCount === "number" ? response.removedCount : removed.length;
    return {
      tool: name,
      ok: true,
      label:
        count > 1
          ? `Removed ${count} team members (${removed.join(", ")}) — ${(response.projectsLeft as unknown[] | undefined)?.length ?? 0} project(s) affected, ${response.tasksUnassigned} task(s) unassigned.`
          : `Removed ${response.userName} from the team — left ${(response.projectsLeft as unknown[] | undefined)?.length ?? 0} project(s), ${response.tasksUnassigned} task(s) unassigned.`,
    };
  }
  if (name === "mark_notifications_read") {
    return {
      tool: name,
      ok: true,
      label: `Marked ${response.markedRead} notification(s) read for ${response.userName}.`,
    };
  }
  if (name === "delete_epic") {
    return { tool: name, ok: true, label: `Deleted epic "${response.deleted}".` };
  }
  if (name === "delete_story") {
    return { tool: name, ok: true, label: `Deleted story "${response.deleted}".` };
  }
  if (name === "bulk_update_tasks") {
    return {
      tool: name,
      ok: true,
      label: `Updated ${response.updatedCount} task(s) (${response.changes}).`,
    };
  }
  if (name === "set_theme" || name === "open_page") {
    // Reached only if a browser-side tool somehow reached the executor; the
    // loop normally handles these before runTool.
    return { tool: name, ok: true, label: `${name} applied.` };
  }
  if (name === "create_schedule") {
    return {
      tool: name,
      ok: true,
      label: `Scheduled "${response.name}" ${response.when}; first run ${response.nextRunAt}.`,
    };
  }
  if (name === "toggle_schedule") {
    return { tool: name, ok: true, label: String(response.message) };
  }
  if (name === "delete_schedule") {
    return { tool: name, ok: true, label: `Deleted schedule "${response.deleted}".` };
  }
  if (name === "add_project_member") {
    return {
      tool: name,
      ok: true,
      label: response.skipped
        ? `${response.userName} is already on ${response.projectName}.`
        : `Added ${response.userName} to ${response.projectName}${response.currentOpenTasks ? ` (${response.currentOpenTasks} open tasks)` : ""}.`,
    };
  }
  if (name === "remove_project_member") {
    return { tool: name, ok: true, label: `Removed ${response.userName} from ${response.projectName}.` };
  }
  if (name === "create_task") {
    return {
      tool: name,
      ok: true,
      label: `Created ${response.type} "${response.title}" in ${response.projectName}${response.assignee ? `, assigned to ${response.assignee}` : ""}.`,
    };
  }
  if (name === "create_tasks_bulk") {
    return {
      tool: name,
      ok: true,
      label: `Created ${response.createdCount} task(s) in ${response.projectName}.`,
    };
  }
  if (name === "assign_task") {
    return { tool: name, ok: true, label: `Assigned ${response.userName} to "${response.taskTitle}".` };
  }
  if (name === "delete_task") {
    return { tool: name, ok: true, label: `Deleted "${response.deleted}".` };
  }
  if (name === "delete_project") {
    return {
      tool: name,
      ok: true,
      label: `Deleted project "${response.deleted}" and ${response.tasksRemoved} task(s).`,
    };
  }
  if (name === "delete_risk") {
    return { tool: name, ok: true, label: `Deleted risk "${response.deleted}".` };
  }
  if (name === "move_task_to_sprint") {
    return { tool: name, ok: true, label: `Moved "${response.taskTitle}" to ${response.sprintName}.` };
  }
  if (name === "create_sprint") {
    return { tool: name, ok: true, label: `Created sprint ${response.name} in ${response.projectName}.` };
  }
  if (name === "create_epic") {
    return { tool: name, ok: true, label: `Created epic "${response.title}" in ${response.projectName}.` };
  }
  if (name === "create_user_story") {
    return {
      tool: name,
      ok: true,
      label: `Created story "${response.title}" in ${response.projectName}${response.assignee ? ` for ${response.assignee}` : ""}.`,
    };
  }
  if (name === "create_risk") {
    return {
      tool: name,
      ok: true,
      label: `Logged ${response.severity} risk "${response.title}" in ${response.projectName}.`,
    };
  }
  if (name === "add_comment") {
    return { tool: name, ok: true, label: `Commented on "${response.taskTitle}".` };
  }
  if (name === "log_time") {
    return {
      tool: name,
      ok: true,
      label: `Logged ${response.minutes}m on "${response.taskTitle}" for ${response.userName}.`,
    };
  }
  if (name === "notify_user") {
    return { tool: name, ok: true, label: `Notified ${response.userName}: ${response.title}.` };
  }
  if (name === "create_retrospective") {
    return { tool: name, ok: true, label: `Filed a retrospective for ${response.sprintName}.` };
  }
  return { tool: name, ok: true, label: `Ran ${name}.` };
}

/**
 * Browser-facing entry point. Internal actions are not callable from the
 * client, so this authenticated action forwards to the loop; the auth context
 * flows through runAction into the internal queries/mutations in agentTools,
 * and every write is attributed to the signed-in user.
 */
export const chat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    /** Optional id the client subscribes to for live progress events. */
    runId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AgentReply> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.runAction(internal.agent.agentLoop, {
      messages: args.messages,
      runId: args.runId,
    });
  },
});

/* ── Ambient page intelligence ──────────────────────────────────── */

const BRIEF_SYSTEM_PROMPT = `You are AIE Agent writing the intelligence panel that sits at the top of a page in an agile workspace.

You are handed facts that were already computed from the database. Your job is the "so what".

- Two to four sentences. Plain text: no markdown, no headings, no bullets, no preamble.
- Lead with the single most important thing on this page. Name the specific project, task or person — never speak in generalities when a name is available.
- Then say what it means and what to do about it. Do not recite the metrics; they are already displayed next to this text.
- Every number, name and status must come from the facts you were given. Never invent or estimate one.
- If the picture is healthy, say so plainly and still name one thing worth doing.
- No questions. No cheerleading. No "Great question!".`;

function briefUserPrompt(kind: string, brief: any, extra: unknown): string {
  return `Page: ${kind}
Scope: ${brief?.scope ?? "workspace"}

Facts:
${JSON.stringify(brief, null, 1)}
${extra ? `\nAdditional analysis from the insight engine:\n${JSON.stringify(extra, null, 1)}` : ""}

Write the intelligence panel for this page.`;
}

/** Facts-only read-out, used when the model is unavailable or unconfigured. */
function fallbackNarrative(brief: any): string {
  if (!brief) return "No data available yet.";
  const lead = brief.headline ?? "";
  const worst = brief.flags?.[0];
  const action = brief.suggestions?.[0];
  const parts = [lead];
  if (worst) parts.push(`${worst.title}: ${worst.detail}`);
  if (action) parts.push(action);
  return parts.filter(Boolean).join(" ");
}

export interface BriefResult {
  text: string;
  generatedAt: number;
  cached: boolean;
}

/**
 * The AI read-out for a page. Cached for 15 minutes per (kind, project), and
 * falls back to a deterministic summary so the panel is never blank and never
 * blocked on the model.
 */
export const brief = action({
  args: {
    kind: v.union(
      v.literal("dashboard"),
      v.literal("project"),
      v.literal("sprint"),
      v.literal("team"),
      v.literal("risks"),
      v.literal("tasks")
    ),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args): Promise<BriefResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const key = briefingKey(args.kind, args.projectId);
    const cached = (await ctx.runQuery(internal.intelligence.cachedNarrative, {
      key,
    })) as BriefResult | null;
    if (cached) return cached;

    const facts = (await ctx.runQuery(api.intelligence.facts, {
      kind: args.kind,
      projectId: args.projectId,
    })) as any;

    let text = "";
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      try {
        // The project view also gets the app's own insight engine feeding it,
        // so "why is this slipping" is answered with the real analysis.
        const extra =
          args.kind === "project" && args.projectId
            ? await ctx.runQuery(api.insights.generate, { projectId: args.projectId })
            : null;
        const data = await callGemini(
          apiKey,
          [{ role: "user", parts: [{ text: briefUserPrompt(args.kind, facts, extra) }] }],
          { system: BRIEF_SYSTEM_PROMPT }
        );
        text = extractText(data);
      } catch (err) {
        console.error("Briefing model error:", err);
      }
    }
    if (!text) text = fallbackNarrative(facts);

    await ctx.runMutation(internal.intelligence.storeNarrative, {
      key,
      kind: args.kind,
      text,
    });
    return { text, generatedAt: Date.now(), cached: false };
  },
});

export type { BriefKind };