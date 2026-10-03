import { describe, expect, test } from "bun:test";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  truncateAuditDetail,
} from "../lib/audit";

/**
 * The audit trail is the only answer to "who promoted this person?". These
 * tests pin the shape of that answer: a fixed vocabulary of actions, and a
 * panel that renders them without one field breaking the layout.
 */
describe("audit action labels", () => {
  test("every declared action has a human label", () => {
    // A missing label would render a raw dotted constant like "role.changed"
    // in the admin panel, which is not a sentence anyone can read.
    for (const action of Object.values(AUDIT_ACTIONS)) {
      expect(AUDIT_ACTION_LABELS[action]).toBeTruthy();
    }
  });

  test("labels read as past-tense verbs, not identifiers", () => {
    expect(AUDIT_ACTION_LABELS[AUDIT_ACTIONS.ROLE_CHANGED]).toBe(
      "changed a role",
    );
    expect(AUDIT_ACTION_LABELS[AUDIT_ACTIONS.GUEST_PURGED]).toBe(
      "purged a guest session",
    );
  });

  test("covers the actions the mutations actually emit", () => {
    // If someone adds a new audited action without a label, this fails.
    const emitted = new Set([
      AUDIT_ACTIONS.ROLE_CHANGED,
      AUDIT_ACTIONS.INVITE_CREATED,
      AUDIT_ACTIONS.INVITE_REVOKED,
      AUDIT_ACTIONS.INVITE_ACCEPTED,
      AUDIT_ACTIONS.GUEST_PURGED,
    ]);
    for (const action of emitted) {
      expect(AUDIT_ACTION_LABELS[action]).toBeDefined();
    }
  });
});

describe("truncateAuditDetail", () => {
  test("passes a short detail through untouched", () => {
    expect(truncateAuditDetail("Ada: user → admin")).toBe("Ada: user → admin");
  });

  test("trims surrounding whitespace", () => {
    expect(truncateAuditDetail("  padded  ")).toBe("padded");
  });

  test("elides an over-long detail instead of wrapping the panel", () => {
    const long = "x".repeat(400);
    const out = truncateAuditDetail(long);
    expect(out.length).toBe(160);
    expect(out.endsWith("…")).toBe(true);
  });

  test("handles a missing detail", () => {
    expect(truncateAuditDetail(undefined)).toBe("");
    expect(truncateAuditDetail("")).toBe("");
  });
});