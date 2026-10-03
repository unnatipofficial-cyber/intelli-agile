import { GenericQueryCtx } from "convex/server";
import { DataModel } from "./_generated/dataModel";

/**
 * True for a "Guest" session — someone who signed in through the Anonymous
 * provider purely to try the app.
 *
 * Convex Auth always materialises a `users` row for an anonymous sign-in, and
 * this version of the library has no `onEnd` hook to clean it up. That row
 * carries no name and no email, so if it is treated as a real teammate it
 * surfaces on the Team roster as a nameless "Unknown" seat. Guests are
 * temporary by definition, so they are excluded from every roster.
 */
export function isEphemeralGuest(
  user: { isAnonymous?: unknown } | null | undefined,
): boolean {
  return user?.isAnonymous === true;
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
