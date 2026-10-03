import { describe, expect, test } from "bun:test";
import {
  buildInviteLink,
  classifySignInIdentifier,
  INVITE_AUTH_ROUTE,
  isInviteTokenShape,
} from "../lib/invite";

describe("isInviteTokenShape", () => {
  test("accepts a real generated token", () => {
    // Exactly the shape that produced the dead end in the sign-in email box.
    expect(isInviteTokenShape("B9TWB3BV")).toBe(true);
    expect(isInviteTokenShape("K7M2PQ4X")).toBe(true);
  });

  test("is case-insensitive", () => {
    expect(isInviteTokenShape("b9twb3bv")).toBe(true);
    expect(isInviteTokenShape("b9TwB3bV")).toBe(true);
  });

  test("ignores surrounding whitespace", () => {
    expect(isInviteTokenShape("  B9TWB3BV  ")).toBe(true);
  });

  test("rejects the wrong length", () => {
    expect(isInviteTokenShape("B9TWB3B")).toBe(false);
    expect(isInviteTokenShape("B9TWB3BVV")).toBe(false);
    expect(isInviteTokenShape("")).toBe(false);
  });

  test("rejects letters the alphabet deliberately omits", () => {
    // I, O, 0 and 1 are excluded so a token is unambiguous on screen; a value
    // containing one was never minted by us.
    expect(isInviteTokenShape("B9TWB3BI")).toBe(false);
    expect(isInviteTokenShape("B9TWB3BO")).toBe(false);
    expect(isInviteTokenShape("B9TWB3B0")).toBe(false);
    expect(isInviteTokenShape("B9TWB3B1")).toBe(false);
  });

  test("rejects an email", () => {
    expect(isInviteTokenShape("ada@example.com")).toBe(false);
  });
});

describe("classifySignInIdentifier", () => {
  test("routes a normal email to the sign-in flow", () => {
    expect(classifySignInIdentifier("ada@example.com")).toBe("email");
  });

  test("routes a pasted token to the invite lookup", () => {
    expect(classifySignInIdentifier("B9TWB3BV")).toBe("invite-token");
    expect(classifySignInIdentifier(" b9twb3bv ")).toBe("invite-token");
  });

  test("rejects empty and malformed input", () => {
    expect(classifySignInIdentifier("")).toBe("invalid");
    expect(classifySignInIdentifier("   ")).toBe("invalid");
    // No "@" and not a token shape: neither a usable email nor a usable code.
    expect(classifySignInIdentifier("not-an-email")).toBe("invalid");
  });

  test("treats anything with an @ as an email, even if odd", () => {
    // Convex Auth owns email validation; we only need to route, not judge.
    expect(classifySignInIdentifier("a@b")).toBe("email");
  });
});

describe("buildInviteLink", () => {
  test("builds an absolute link the sign-in screens can open", () => {
    expect(buildInviteLink("https://aie.example.com", "B9TWB3BV")).toBe(
      "https://aie.example.com/auth?invite=B9TWB3BV",
    );
  });

  test("normalises the token to uppercase", () => {
    // Tokens are minted uppercase; normalising means a lowercase value from
    // anywhere still produces a link the server will resolve.
    expect(buildInviteLink("https://aie.example.com", "b9twb3bv")).toBe(
      "https://aie.example.com/auth?invite=B9TWB3BV",
    );
  });

  test("does not double up slashes on the origin", () => {
    expect(buildInviteLink("https://aie.example.com/", "B9TWB3BV")).toBe(
      "https://aie.example.com/auth?invite=B9TWB3BV",
    );
  });

  test("falls back to a relative link without an origin", () => {
    // Degrades to a usable relative path instead of "undefined/auth?...".
    expect(buildInviteLink(undefined, "B9TWB3BV")).toBe(
      "/auth?invite=B9TWB3BV",
    );
    expect(buildInviteLink("   ", "B9TWB3BV")).toBe("/auth?invite=B9TWB3BV");
  });

  test("points at the route the app actually registers", () => {
    // Guards the copy against a rename of the auth route: a link built to a
    // stale path looks fine in the admin panel and 404s for the invitee.
    expect(buildInviteLink("https://aie.example.com", "B9TWB3BV")).toContain(
      INVITE_AUTH_ROUTE,
    );
    expect(INVITE_AUTH_ROUTE).toBe("/auth");
  });
});