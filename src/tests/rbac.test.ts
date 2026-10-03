import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ROLE,
  ROLES,
  isRoleAllowed,
  roleDeniedMessage,
  roleFromUser,
} from "../convex/rbac";

describe("roleFromUser", () => {
  test("returns the recorded role", () => {
    expect(roleFromUser({ role: "admin" })).toBe(ROLES.ADMIN);
    expect(roleFromUser({ role: "user" })).toBe(ROLES.USER);
    expect(roleFromUser({ role: "member" })).toBe(ROLES.MEMBER);
  });

  test("defaults to USER for a missing or unknown role", () => {
    expect(roleFromUser(null)).toBe(ROLES.USER);
    expect(roleFromUser(undefined)).toBe(ROLES.USER);
    expect(roleFromUser({})).toBe(ROLES.USER);
    expect(roleFromUser({ role: "superuser" })).toBe(ROLES.USER);
    expect(DEFAULT_ROLE).toBe(ROLES.USER);
  });
});

describe("isRoleAllowed", () => {
  test("admins and users pass a destructive gate; members do not", () => {
    expect(isRoleAllowed(ROLES.ADMIN, [ROLES.ADMIN, ROLES.USER])).toBe(true);
    expect(isRoleAllowed(ROLES.USER, [ROLES.ADMIN, ROLES.USER])).toBe(true);
    expect(isRoleAllowed(ROLES.MEMBER, [ROLES.ADMIN, ROLES.USER])).toBe(false);
  });

  test("a single-role gate accepts only that role", () => {
    expect(isRoleAllowed(ROLES.ADMIN, ROLES.ADMIN)).toBe(true);
    expect(isRoleAllowed(ROLES.USER, ROLES.ADMIN)).toBe(false);
  });
});

describe("roleDeniedMessage", () => {
  test("names both the role and what was required", () => {
    const message = roleDeniedMessage(ROLES.MEMBER, [ROLES.ADMIN, ROLES.USER]);
    expect(message).toContain("member");
    expect(message).toContain("admin/user");
  });
});
