import { useCallback, useEffect, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";

export type IntelligenceKind =
  | "dashboard"
  | "project"
  | "sprint"
  | "team"
  | "risks"
  | "tasks";

/**
 * Ambient intelligence for a page.
 *
 * Two requests on purpose:
 *  - `facts` is a reactive query, so the metrics and flags render instantly
 *    and stay live as the workspace changes.
 *  - `brief` is an action that writes the prose. It is cached server-side for
 *    15 minutes, so this only costs anything when the view is opened or the
 *    reader asks for a refresh — which is why the effect keys on the view
 *    rather than on every change to `facts`.
 */
export function useIntelligence(kind: IntelligenceKind, projectId?: string) {
  const facts = useQuery(api.intelligence.facts, {
    kind,
    projectId: projectId as any,
  });

  const getBrief = useAction(api.agent.brief);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [isNarrating, setIsNarrating] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsNarrating(true);

    getBrief({ kind, projectId: projectId as any })
      .then((result) => {
        if (cancelled) return;
        setNarrative(result.text);
        setGeneratedAt(result.generatedAt);
      })
      .catch((err) => {
        console.error("AIE briefing failed:", err);
      })
      .finally(() => {
        if (!cancelled) setIsNarrating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, projectId, refreshToken, getBrief]);

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  return { facts, narrative, generatedAt, isNarrating, refresh };
}