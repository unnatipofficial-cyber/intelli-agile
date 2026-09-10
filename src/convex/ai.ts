"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3-flash-preview"];

async function callGemini(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const parts: Array<{ text: string }> = [];
  if (systemPrompt) {
    parts.push({ text: systemPrompt + "\n\n" + prompt });
  } else {
    parts.push({ text: prompt });
  }

  // Try each model with retries
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              maxOutputTokens: 4096,
              temperature: 0.7,
            },
          }),
        });

        if (response.status === 503 || response.status === 429) {
          // Rate limited or overloaded — wait and retry
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`Gemini API error: ${response.status} - ${err}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (err: any) {
        if (attempt === 1) break; // Move to next model
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw new Error("All Gemini models are temporarily unavailable. Please try again in a moment.");
}

export const generateInsights = action({
  args: {
    projectData: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const text = await callGemini(
        `Analyze the following project data and provide 3-6 actionable insights.

For each insight, respond with a JSON array of objects, each with:
- "severity": "critical" | "high" | "medium" | "low"
- "title": Short headline (max 60 chars)
- "description": One sentence explaining the situation
- "recommendedAction": One specific action the team should take
- "category": "sprint" | "workload" | "velocity" | "risk" | "deadline"

Respond ONLY with valid JSON array. No markdown, no explanation text.

Project Data:
${args.projectData}`,
        "You are AIE (Agile Intelligence Engine), an expert Agile project analyst."
      );

      const cleaned = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      const insights = JSON.parse(cleaned);
      return JSON.stringify(insights);
    } catch (err: any) {
      if (err.message === "NO_API_KEY") {
        return JSON.stringify([
          {
            severity: "medium",
            title: "AI Insights Unavailable",
            description: "GOOGLE_AI_API_KEY is not configured.",
            recommendedAction: "Add GOOGLE_AI_API_KEY in Convex Settings → Environment Variables.",
            category: "sprint",
          },
        ]);
      }
      return JSON.stringify([
        {
          severity: "low",
          title: "AI Analysis Error",
          description: err.message?.slice(0, 200) || "Unknown error occurred.",
          recommendedAction: "Check that the API key is valid and try again.",
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
    try {
      return await callGemini(
        `Write a concise sprint summary (2-4 sentences) for "${args.sprintName}" based on this data:\n\n${args.taskSummary}\n\nFocus on: progress, risks, and what to watch next. Be direct and professional.`,
        "You are AIE, an expert Agile analyst."
      );
    } catch (err: any) {
      return `Summary unavailable: ${err.message}`;
    }
  },
});

export const chat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    projectContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const systemPrompt = `You are AIE Assistant, an expert AI assistant built into the AIE (Agile Intelligence Engine) platform. You help software teams with Agile project management.

You can help with:
- Sprint planning and management advice
- Task prioritization and estimation
- Risk assessment and mitigation strategies
- Team workload balancing
- Agile best practices and methodology
- Interpreting project metrics and analytics
- Writing user stories and acceptance criteria
- Retrospective facilitation

Be concise, professional, and actionable. Use bullet points for lists. When referring to data, be specific.
${args.projectContext ? `\nCurrent project context:\n${args.projectContext}` : ""}`;

      // Combine conversation history into one prompt for the simple HTTP API
      const conversationText = args.messages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      return await callGemini(conversationText, systemPrompt);
    } catch (err: any) {
      if (err.message === "NO_API_KEY") {
        return "GOOGLE_AI_API_KEY is not configured. Add it in Convex Settings → Environment Variables.";
      }
      return `Error: ${err.message?.slice(0, 300) || "Unknown error"}`;
    }
  },
});
