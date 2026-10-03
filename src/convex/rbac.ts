import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Role-based access control for AIE.
 *
 * The workspace has three roles:
 *   ADMIN — full control: any destructive or admin action, plus workspace
 *           administration (roles, invitations).
 *   USER  — can manage their own projects, team, tasks and schedules,
 *           including deleting and bulk-editing work.
 *   MEMBER— same as USER but cannot delete or remove anything. Invited
 *           collaborators land here.
 *
 * `requireRole` is the single gate every destructive write mutation runs
 * through before touching the database. It throws on failure, so a caller can
 * just await it and continue assuming it passed.
 */

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Privilege granted to a signed-in person whose record has no role yet.
 * Owners and ordinary teammates keep full USER powers; only explicitly
 * invited collaborators are lowered to MEMBER.
 */
export const DEFAULT_ROLE: Role = ROLES.USER;

/** The role carried by a user row, falling back to the default privilege. */
export function roleFromUser(user: { role?: unknown } | null | undefined): Role {
  const role = user?.role;
  if (role === ROLES.ADMIN || role === ROLES.USER || role === ROLES.MEMBER) {
    return role;
  }
  return DEFAULT_ROLE;
}

/** Pure predicate: does `role` satisfy the `allowed` set? */
export function isRoleAllowed(role: Role, allowed: Role | Role[]): boolean {
  const set = new Set<Role>(Array.isArray(allowed) ? allowed : [allowed]);
  return set.has(role);
}

/** Human-readable refusal, shared by the gate and its tests. */
export function roleDeniedMessage(role: Role, allowed: Role | Role[]): string {
  const allowedList = Array.isArray(allowed) ? allowed.join("/") : allowed;
  return `Role-based access denied: this action needs ${allowedList} but user has ${role}.`;
}

/**
 * A gate the agent's write tools run through before mutating anything.
 *
 *   requireRole(ctx, ROLES.ADMIN)              // only fully-trusted people
 *   requireRole(ctx, [ROLES.ADMIN, ROLES.USER]) // everyone but members
 *
 * Returns the resolved role so callers can branch on it if needed.
 */
export async function requireRole(
  ctx: { db: { get: (id: any) => Promise<any> | any } },
  allowed: Role | Role[],
): Promise<Role> {
  const userId = await getAuthUserId(ctx as any);
  if (!userId) throw new Error("Not authenticated");

  const user = (await ctx.db.get(userId)) as { role?: unknown } | null;
  const role = roleFromUser(user);
  if (!isRoleAllowed(role, allowed)) {
    throw new Error(roleDeniedMessage(role, allowed));
  }
  return role;
}
