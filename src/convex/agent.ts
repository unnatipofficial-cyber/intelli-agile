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
import { internal } from "./_generated/api";

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

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
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

      /* ── Risks ── */
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
- Prefer one bulk call over many repeats (create_tasks_bulk for five or more items).

TYPO TOLERANCE — THIS IS CRITICAL
- Users type fast and misspell constantly: "creat a projct called apolo", "asign sarah the onbaording flow", "mark teh design task don". You MUST still understand and act.
- Every tool resolves project names, task titles and people's names with fuzzy matching, so PASS NAMES EXACTLY AS THE USER TYPED THEM. Never pre-correct a name yourself, never spell-check the user, and never reply "I could not find that, please rephrase" just because a name looks misspelled. Send it through; the database decides what was meant.
- Likewise accept "todays prioity", "high priorty", "critical"→"critical": put the user's words in the enum field and let the tool snap it.
- Tool responses may include a note like "Matched your \\"apolo\\" to \\"Apollo\\"". When you see it, add one short clause to your reply saying which item you matched, so the user can correct you if you guessed wrong.
- Only ask a clarifying question when the request is genuinely ambiguous — two different people with the same name, or no project at all. Never ask for a re-spelling.

DESTRUCTIVE ACTIONS
- delete_project, delete_task, delete_risk and remove_project_member are gated. Call them WITHOUT confirmed first; the response will contain needsConfirmation and a plain-English impact summary. Relay that summary and ask the user to confirm. Only when they clearly say yes, call the same tool again with confirmed: true.
- Never set confirmed: true on the first call. Never delete or archive anything on your own initiative.

ANSWERING QUALITY
- Rank "best performers" by completed story points, then completed tasks, and state the basis you ranked on.
- For a status or dashboard question, lead with the headline numbers, then the two or three things that actually need attention (overdue work, unassigned tasks, critical risks, slipping dates). Be concrete — name the project, task or person.
- Use short paragraphs or bullet lists. No preamble like "Great question!".

FACTS
- Today is ${new Date().toISOString().slice(0, 10)}. Dates accept YYYY-MM-DD or loose forms like "Dec 15", "next friday", "in 3 days".
- If a tool response contains an error or needsConfirmation, deal with it honestly. Never claim something succeeded when it did not, and never invent ids.
- When no tool is needed (pure agile coaching, definitions, process advice), answer directly and concisely.`;

/* ── Gemini call with model fallback ───────────────────────────── */

async function callGemini(
  apiKey: string,
  contents: GeminiContent[]
): Promise<any> {
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            tools: TOOLS,
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: { maxOutputTokens: 4096, temperature: 0.3 },
          }),
        });

        if (response.status === 503 || response.status === 429) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(
            `Gemini API error: ${response.status} - ${errText.slice(0, 200)}`
          );
        }
        return await response.json();
      } catch (err) {
        if (attempt === 1) {
          if (model === MODELS[MODELS.length - 1]) throw err;
          break; // move to the next model
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  throw new Error("All Gemini models are temporarily unavailable.");
}

/* ── Main action ───────────────────────────────────────────────── */

/** One line in the UI's trace of what the agent actually did. */
export interface AgentAction {
  tool: string;
  label: string;
  ok: boolean;
}

/** Shape of every agent response, for both the loop and its public wrapper. */
export interface AgentReply {
  reply: string;
  actions: AgentAction[];
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
  },
  handler: async (ctx, args): Promise<AgentReply> => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return {
        reply:
          "GOOGLE_AI_API_KEY is not configured. Add it in Convex Settings → Environment Variables, then try again.",
        actions: [] as AgentAction[],
      };
    }

    const contents: GeminiContent[] = [];
    for (const m of args.messages) {
      contents.push({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      });
    }

    const actions: AgentAction[] = [];
    const summaries: string[] = [];

    for (let step = 0; step < MAX_STEPS; step += 1) {
      let data: any;
      try {
        data = await callGemini(apiKey, contents);
      } catch (err: any) {
        return {
          reply:
            summaries.length > 0
              ? `${summaries.join(" ")} (I hit an API error before I could summarise: ${String(err?.message ?? err).slice(0, 200)})`
              : `I hit an error talking to the model: ${String(err?.message ?? err).slice(0, 300)}`,
          actions,
        };
      }

      const candidate = data.candidates?.[0];
      const parts: GeminiPart[] = candidate?.content?.parts ?? [];

      const calls: ToolCall[] = [];
      let text = "";
      for (const part of parts) {
        if (part.functionCall) {
          calls.push({
            name: part.functionCall.name,
            args: part.functionCall.args ?? {},
          });
        } else if (typeof part.text === "string") {
          text += part.text;
        }
      }

      if (calls.length === 0) {
        return { reply: text.trim() || "Done.", actions };
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
        let response: Record<string, unknown>;
        try {
          response = await runTool(ctx, call.name, call.args);
        } catch (err: any) {
          response = { error: String(err?.message ?? err).slice(0, 300) };
        }
        const trace = describeAction(call.name, call.args, response);
        actions.push(trace);
        if (trace.ok) summaries.push(trace.label);
        responseParts.push({
          functionResponse: { name: call.name, response },
        });
      }
      contents.push({ role: "user", parts: responseParts });
    }

    return {
      reply:
        summaries.length > 0
          ? `${summaries.join(" ")} (I stopped there — ask me to continue if anything is missing.)`
          : "I worked through several steps without a final answer. Could you rephrase that?",
      actions,
    };
  },
});

/* ── Tool execution: model names → internal functions ──────────── */

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
  if (name === "update_project" || name === "update_task" || name === "update_sprint" || name === "update_risk") {
    const changes = Array.isArray(response.changes) ? response.changes.join(", ") : "updated";
    const target = response.projectName ?? response.taskTitle ?? response.sprintName ?? response.riskTitle ?? "";
    return { tool: name, ok: true, label: `${target}: ${changes}.` };
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
  },
  handler: async (ctx, args): Promise<AgentReply> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.runAction(internal.agent.agentLoop, {
      messages: args.messages,
    });
  },
});