"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ProjectContext {
  projectName: string;
  tasks: { title: string; status: string; priority: string; storyPoints: number; assignee?: string; dueDate?: number }[];
  sprints: { name: string; status: string; totalPoints: number; completedPoints: number }[];
  risks: { title: string; severity: string; probability: number; impact: number; score: number; status: string }[];
  teamWorkload: { name: string; activePoints: number; completedPoints: number }[];
}

export const generateInsights = action({
  args: {
    projectData: v.string(),
  },
  handler: async (ctx, args) => {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are AIE (Agile Intelligence Engine), an expert Agile project analyst. Analyze the following project data and provide 3-6 actionable insights.

For each insight, respond with a JSON array of objects, each with:
- "severity": "critical" | "high" | "medium" | "low"
- "title": Short headline (max 60 chars)
- "description": One sentence explaining the situation
- "recommendedAction": One specific action the team should take
- "category": "sprint" | "workload" | "velocity" | "risk" | "deadline"

Respond ONLY with valid JSON array. No markdown, no explanation text.

Project Data:
${args.projectData}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "[]";

    // Try to parse the JSON response
    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      const insights = JSON.parse(cleaned);
      return JSON.stringify(insights);
    } catch {
      // If JSON parsing fails, return a single insight with the raw text
      return JSON.stringify([
        {
          severity: "medium",
          title: "AIE Analysis",
          description: text.slice(0, 300),
          recommendedAction: "Review the analysis above and discuss with your team.",
          category: "sprint",
        },
      ]);
    }
  },
});

export const generateSprintSummary = action({
  args: {
    sprintName: v.string(),
    taskSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are AIE, an expert Agile analyst. Write a concise sprint summary (2-4 sentences) for "${args.sprintName}" based on this data:

${args.taskSummary}

Focus on: progress, risks, and what to watch next. Be direct and professional.`,
        },
      ],
    });

    return response.content[0].type === "text" ? response.content[0].text : "Summary unavailable.";
  },
});
