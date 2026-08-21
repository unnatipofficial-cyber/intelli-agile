import { GenericQueryCtx } from "convex/server";
import { DataModel } from "./_generated/dataModel";

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
