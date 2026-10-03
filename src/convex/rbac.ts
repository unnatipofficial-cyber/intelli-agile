import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Role-based access control for AIE.
 *
 * The workspace has three roles:
 *   ADMIN — full control: any destructive or admin action.
 *   USER  — can manage their own projects, team, tasks and schedules;
 *           nothing that exposes another person's data or deletes it.
 *   MEMBER— same as USER but can also be assigned work, comment, and leave.
 *
 * `requireRole` is the single gate every write mutation runs through before
 * touching the database. It throws on failure, so a caller can just await it
 * and continue assuming it passed. The helper is defined in the project that
 * defines the mutations so the whole agent writes are gated uniformly.
 */

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export type Role =
  | typeof ROLES.ADMIN
  | typeof ROLES.USER
  | typeof ROLES.MEMBER;

/**
 * A gate the agent's write tools run through before mutating anything.
 *
 *   requireRole(ctx, ROLES.ADMIN)       // only fully-trusted people
 *   requireRole(ctx, ROLES.USER)        // everyone else
 *
 * The first non-matching role wins: an admin is not blocked by a USER gate,
 * but a user is rejected by an ADMIN gate. Anonymous users (isAnonymous) are
 * treated as MEMBER so the product's "guest" flows keep working.
 */
export async function requireRole(
  ctx: { db: { get: (id: unknown) => unknown } },
  allowed: Role | Role[],
): Promise<void> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  const user = await ctx.db.get(userId);
  const role = (user?.role ?? ROLES.MEMBER) as Role;

  const set = new Set<Role>(Array.isArray(allowed) ? allowed : [allowed]);
  if (!set.has(role)) {
    const allowedList = Array.isArray(allowed)
      ? allowed.join("/")
      : allowed;
    throw new Error(
      `Role-based access denied: this action needs ${allowedList} but user has ${role}.`,
    );
  }
}
