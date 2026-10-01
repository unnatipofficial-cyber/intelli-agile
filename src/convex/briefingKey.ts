/**
 * Shared briefing vocabulary.
 *
 * Deliberately dependency-free: `intelligence.ts` (a regular Convex module)
 * and `agent.ts` (a "use node" action) both need to agree on what a briefing
 * is called and how it is cached, and a pure module is safe to import from
 * either bundle.
 */

/** Which page a briefing belongs to. */
export type BriefKind =
  | "dashboard"
  | "project"
  | "sprint"
  | "team"
  | "risks"
  | "tasks";

/** Narratives are expensive to write and go stale slowly. */
export const BRIEFING_TTL_MS = 15 * 60_000;

export function briefingKey(kind: string, projectId?: string): string {
  return `${kind}:${projectId ?? "all"}`;
}