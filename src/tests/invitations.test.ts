import { describe, expect, test } from "bun:test";
import {
  INVITE_TTL_MS,
  isInviteExpired,
  makeInviteToken,
  normalizeInviteEmail,
  roleRank,
} from "../convex/invitations";
import { ROLES } from "../convex/rbac";

describe("normalizeInviteEmail", () => {
  test("trims and lowercases so invites match the signed-in address", () => {
    expect(normalizeInviteEmail("  Dana.Reyes@Example.COM ")).toBe(
      "dana.reyes@example.com"
    );
  });
});

describe("makeInviteToken", () => {
  test("is 8 characters and avoids look-alike glyphs", () => {
    const token = makeInviteToken(() => 0);
    expect(token).toHaveLength(8);
    expect(token).not.toMatch(/[01OI]/);
  });

  test("varies with the random source", () => {
    const a = makeInviteToken(() => 0.1);
    const b = makeInviteToken(() => 0.9);
    expect(a).toHaveLength(8);
    expect(a).not.toBe(b);
  });
});

describe("isInviteExpired", () => {
  test("compares against the given clock", () => {
    expect(isInviteExpired(1000, 1001)).toBe(true);
    expect(isInviteExpired(2000, 1001)).toBe(false);
  });

  test("a fresh invitation is valid for a week", () => {
    const now = Date.now();
    expect(isInviteExpired(now + INVITE_TTL_MS, now)).toBe(false);
    expect(INVITE_TTL_MS).toBeGreaterThan(0);
  });
});

describe("roleRank", () => {
  test("orders member < user < admin so an invite never demotes", () => {
    expect(roleRank(ROLES.MEMBER)).toBeLessThan(roleRank(ROLES.USER));
    expect(roleRank(ROLES.USER)).toBeLessThan(roleRank(ROLES.ADMIN));
  });
});
