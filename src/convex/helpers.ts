// Type-only imports. This module is also imported directly by React components
// (the first-login prompt and RequireAuth), so `convex/server` must never end up
// in the browser bundle. `import type` makes that elision a guarantee for both
// tsc and the bundler rather than something that depends on emit settings.
import type { GenericQueryCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

/**
 * True for a "Guest" session — someone who signed in through the Anonymous
 * provider purely to try the app.
 *
 * Convex Auth always materialises a `users` row for an anonymous sign-in, and
 * this version of the library has no `onEnd` hook to clean it up. That row
 * carries no name and no email, so if it is treated as a real teammate it
 * surfaces on the Team roster as a nameless "Unknown" seat. Guests are
 * temporary by definition, so they are excluded from every roster.
 *
 * The `!email` clause is load-bearing, not decoration. Convex Auth reuses the
 * anonymous row when the same browser then completes an email sign-in: it
 * patches `email` onto that row but leaves `isAnonymous: true` on it. Purging
 * on `isAnonymous` alone deleted real, email-backed accounts on sign-out and
 * left their `authAccounts` rows pointing at nothing — which makes every later
 * sign-in with that address fail with "Could not update user document with ID
 * ...". Once a guest has an email it is a real account and must be kept.
 */
export function isEphemeralGuest(
  user: { isAnonymous?: unknown; email?: unknown } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.isAnonymous !== true) return false;
  const email = user.email;
  return typeof email !== "string" || email.trim() === "";
}

/**
 * Split a stored profile name into the two fields the onboarding form edits.
 *
 * Everything after the first token counts as the last name, so "Ada Byron King"
 * comes back as first "Ada" / last "Byron King" rather than losing the middle.
 */
export function splitFullName(
  name?: string | null,
): { firstName: string; lastName: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Join the onboarding form's two fields back into the single `name` the schema
 * stores. Interior whitespace is collapsed and each half trimmed, so a stray
 * space or a double space never gets persisted.
 */
export function buildFullName(firstName: string, lastName?: string | null): string {
  return [firstName, lastName]
    .map((part) => (part ?? "").trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(" ");
}

/**
 * True when a real (non-Guest) account still needs the name prompt.
 *
 * `profileCompletedAt` is the authoritative "asked and answered" flag, so the
 * prompt shows exactly once per account and never again on later sign-ins.
 *
 * The `name` clause is the fix for accounts created before the prompt existed
 * and for providers that already supplied a name. Those people do not need to be
 * asked — they already answered, just somewhere else — and blocking them behind
 * a modal to re-type a name the app is already displaying is pure friction.
 * A blank or whitespace-only name does not count as an answer.
 *
 * Guests are excluded on purpose: their row is deleted on sign-out, so a prompt
 * for them would be both unskippable and pointless.
 */
export function needsProfileSetup(
  user:
    | { profileCompletedAt?: unknown; isAnonymous?: unknown; name?: unknown }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  if (isEphemeralGuest(user)) return false;
  if (user.profileCompletedAt != null) return false;
  return !hasUsableName(user.name);
}

/**
 * True when a stored name is something we can actually show on the roster.
 * Guards against `""` and `"   "`, which Convex Auth can leave behind and which
 * would otherwise read as "has a name" while rendering as an empty seat.
 */
export function hasUsableName(name: unknown): boolean {
  return typeof name === "string" && name.trim().length > 0;
}

/**
 * Safely fetch a document by ID. Returns null if the ID is invalid or the document
 * doesn't exist, instead of throwing.
 */
export async function safeGet(
  ctx: { db: GenericQueryCtx<DataModel>["db"] },
  id: any,
): Promise<any> {
  if (!id || typeof id !== "string" || id.length < 10) return null;
  try {
    return await ctx.db.get(id as any);
  } catch {
    return null;
  }
}
