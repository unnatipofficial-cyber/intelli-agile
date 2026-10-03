/**
 * The audit trail's vocabulary and formatting, in a module that is safe to
 * import from React.
 *
 * This deliberately does NOT live next to the Convex functions. `convex/audit.ts`
 * imports `_generated/server`, which imports `convex/server` — pulling that into
 * the browser bundle is the same hazard `convex/helpers.ts` documents, so the
 * shared, runtime-agnostic parts live here and the mutations import from here
 * too. One source of truth, no server code in the client.
 */

export const AUDIT_ACTIONS = {
  ROLE_CHANGED: "role.changed",
  INVITE_CREATED: "invite.created",
  INVITE_REVOKED: "invite.revoked",
  INVITE_ACCEPTED: "invite.accepted",
  GUEST_PURGED: "guest.purged",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Human phrasing for the audit panel. Kept as data rather than inline strings so
 * the panel stays declarative and every action reads in the same voice.
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  [AUDIT_ACTIONS.ROLE_CHANGED]: "changed a role",
  [AUDIT_ACTIONS.INVITE_CREATED]: "sent an invitation",
  [AUDIT_ACTIONS.INVITE_REVOKED]: "revoked an invitation",
  [AUDIT_ACTIONS.INVITE_ACCEPTED]: "accepted an invitation",
  [AUDIT_ACTIONS.GUEST_PURGED]: "purged a guest session",
};

/**
 * Trim a detail to a readable length so one unusually long field cannot wreck
 * the panel layout.
 */
export function truncateAuditDetail(
  detail: string | undefined,
  max = 160,
): string {
  if (!detail) return "";
  const trimmed = detail.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}