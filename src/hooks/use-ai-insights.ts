import { useState, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

interface AiInsight {
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  recommendedAction: string;
  category: "sprint" | "workload" | "velocity" | "risk" | "deadline";
}

export function useAiInsights() {
  const generateInsights = useAction(api.ai.generateInsights);
  const [aiInsights, setAiInsights] = useState<AiInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeProject = useCallback(
    async (projectData: {
      projectName: string;
      tasks: any[];
      sprints: any[];
      risks: any[];
      teamWorkload: any[];
    }) => {
      setIsLoading(true);
      setError(null);
      try {
        const dataString = JSON.stringify(projectData, null, 2);
        const result = await generateInsights({ projectData: dataString });
        const parsed = JSON.parse(result);
        setAiInsights(parsed);
      } catch (err) {
        console.error("AI insights error:", err);
        setError(err instanceof Error ? err.message : "Failed to generate insights");
      } finally {
        setIsLoading(false);
      }
    },
    [generateInsights]
  );

  return { aiInsights, isLoading, error, analyzeProject };
}
