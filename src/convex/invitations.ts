import { v } from "convex/values";
import { action, mutation, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ROLES, requireRole, roleFromUser, type Role } from "./rbac";
import { AUDIT_ACTIONS } from "../lib/audit";
import { roleValidator } from "./schema";

/**
 * Passwordless invitations.
 *
 * An owner invites someone by email. We mint a short token, store it, and send
 * it through the same email-OTP relay the sign-in flow uses. The invitee opens
 * `/auth?invite=<token>`, signs in with their email (email-OTP — no password to
 * remember), and the invite is applied to their fresh account: the workspace
 * role it granted, and a record that it was used.
 */

/** Invitations are valid for a week. */
export const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

/** Role ordering, so accepting an invite never demotes someone. */
const ROLE_RANK: Record<Role, number> = {
  [ROLES.MEMBER]: 0,
  [ROLES.USER]: 1,
  [ROLES.ADMIN]: 2,
};

export function roleRank(role: Role): number {
  return ROLE_RANK[role];
}

/** Emails are matched case-insensitively and without surrounding whitespace. */
export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True once the invitation is past its expiry. */
export function isInviteExpired(expiresAt: number, now = Date.now()): boolean {
  return expiresAt <= now;
}

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function defaultRandom(): number {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(1);
    cryptoObj.getRandomValues(buf);
    return buf[0] / 0xffffffff;
  }
  return Math.random();
}

/** A short, unambiguous invite token (no 0/O/1/I lookalikes). */
export function makeInviteToken(random: () => number = defaultRandom): string {
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    const idx = Math.floor(random() * TOKEN_ALPHABET.length) % TOKEN_ALPHABET.length;
    out += TOKEN_ALPHABET[idx];
  }
  return out;
}

function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ── Reads ─────────────────────────────────────────────────────── */

/**
 * Public preview for the auth screen: which address is invited, and whether
 * the token is still usable. Deliberately reveals only the invited email —
 * never who sent it or any other workspace data.
 */
export const preview = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim().toUpperCase()))
      .first();
    if (!invite) return { valid: false as const };
    return {
      valid: !isInviteExpired(invite.expiresAt) && !invite.usedBy,
      email: invite.email,
      role: roleFromUser({ role: invite.role ?? ROLES.MEMBER }),
      expired: isInviteExpired(invite.expiresAt),
      used: Boolean(invite.usedBy),
    };
  },
});

/** Pending invitations for the admin panel. Non-admins get an empty list. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const me = await ctx.db.get(userId);
    if (roleFromUser(me) !== ROLES.ADMIN) return [];
    const invites = await ctx.db.query("invitations").collect();
    return invites
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((invite) => ({
        _id: invite._id,
        email: invite.email,
        token: invite.token,
        role: roleFromUser({ role: invite.role ?? ROLES.MEMBER }),
        projectRole: invite.projectRole ?? null,
        used: Boolean(invite.usedBy),
        expired: isInviteExpired(invite.expiresAt),
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      }));
  },
});

/* ── Writes ────────────────────────────────────────────────────── */

/**
 * Internal creator, run inside the `send` action. The role gate lives here
 * because only a mutation ctx has `ctx.db`.
 */
export const create = internalMutation({
  args: {
    email: v.string(),
    role: v.optional(roleValidator),
    projectRole: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ token: string; email: string; role: Role }> => {
    await requireRole(ctx, [ROLES.ADMIN, ROLES.USER]);
    const email = normalizeInviteEmail(args.email);
    if (!isEmail(email)) throw new Error(`"${args.email}" is not a valid email address.`);

    const now = Date.now();
    // Re-issue rather than pile up duplicate invitations for the same address.
    for (const existing of await ctx.db.query("invitations").collect()) {
      if (!existing.usedBy && existing.email === email && !isInviteExpired(existing.expiresAt, now)) {
        await ctx.db.delete(existing._id);
      }
    }

    const token = makeInviteToken();
    await ctx.db.insert("invitations", {
      email,
      token,
      role: args.role ?? ROLES.MEMBER,
      projectRole: args.projectRole?.trim() || undefined,
      expiresAt: now + INVITE_TTL_MS,
      createdAt: now,
    });

    await ctx.runMutation(internal.audit.record, {
      action: AUDIT_ACTIONS.INVITE_CREATED,
      targetType: "invitation",
      targetLabel: email,
      details: `${email} invited as ${args.role ?? ROLES.MEMBER}`,
    });

    return { token, email, role: args.role ?? ROLES.MEMBER };
  },
});

/**
 * Send an invitation email. The email relay is the same one the sign-in OTP
 * uses, so an invitee needs no new account system — just their inbox.
 */
export const send = action({
  args: {
    email: v.string(),
    role: v.optional(roleValidator),
    projectRole: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; email: string; token: string; emailed: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Role gate + insert happen in the mutation.
    const created: { token: string; email: string; role: Role } = await ctx.runMutation(
      internal.invitations.create,
      { email: args.email, role: args.role, projectRole: args.projectRole },
    );

    let emailed = false;
    try {
      const res = await fetch("https://auth.freebuff.app/send_otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "fb_email_2crN1hqIArZP2bEfvjp5Qik4",
        },
        body: JSON.stringify({
          to: created.email,
          otp: created.token,
          appName: process.env.VLY_APP_NAME || "a freebuff.com application",
        }),
      });
      emailed = res.ok;
      if (!res.ok) {
        console.error("Invite email relay returned", res.status);
      }
    } catch (err) {
      console.error("Invite email failed:", err);
    }

    return { ok: true, email: created.email, token: created.token, emailed };
  },
});

/** Withdraw a pending invitation (admin only). */
export const revoke = mutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    await requireRole(ctx, ROLES.ADMIN);
    // Read the row before deleting it: the label is the only thing left to
    // identify which invitation was withdrawn.
    const invite = await ctx.db.get(args.invitationId);
    await ctx.db.delete(args.invitationId);
    await ctx.runMutation(internal.audit.record, {
      action: AUDIT_ACTIONS.INVITE_REVOKED,
      targetType: "invitation",
      targetLabel: invite?.email,
    });
    return { ok: true };
  },
});

/**
 * Redeem an invitation for the signed-in person. Never demotes an existing
 * admin, and never grants more than the invite carried.
 */
export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; role: Role; email: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to accept this invitation.");

    const token = args.token.trim().toUpperCase();
    const invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!invite) throw new Error("This invitation link is not valid.");
    if (invite.usedBy) throw new Error("This invitation has already been used.");
    if (isInviteExpired(invite.expiresAt)) throw new Error("This invitation has expired.");

    const me = await ctx.db.get(userId);
    const explicit = (me as { role?: unknown } | null)?.role;
    const current = roleFromUser(me);
    const granted = roleFromUser({ role: invite.role ?? ROLES.MEMBER });
    // A newcomer with no recorded role takes exactly the invited role; someone
    // with an existing role is only ever upgraded, never demoted.
    const next =
      explicit === undefined
        ? granted
        : roleRank(granted) > roleRank(current)
          ? granted
          : current;

    await ctx.db.patch(userId, { role: next, updatedAt: Date.now() });
    await ctx.db.patch(invite._id, { usedBy: userId, usedAt: Date.now() });

    const who = (me as { name?: unknown } | null)?.name || invite.email;
    await ctx.runMutation(internal.audit.record, {
      action: AUDIT_ACTIONS.INVITE_ACCEPTED,
      targetType: "invitation",
      targetLabel: invite.email,
      details: `${who} joined as ${next}`,
    });

    return { ok: true, role: next, email: invite.email };
  },
});
