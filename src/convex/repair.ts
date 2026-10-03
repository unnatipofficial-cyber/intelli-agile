import { mutation } from "./_generated/server";

/** Accounts scanned per page, and pages per sweep. Bounds transaction length. */
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

/**
 * Delete `authAccounts` rows whose `users` document no longer exists.
 *
 * Why this is needed: Convex Auth looks an account up by
 * (provider, providerAccountId) when issuing a sign-in code, then patches that
 * account's `userId`. If the user document is gone but the account survives,
 * every subsequent sign-in with that address throws
 *
 *   "Could not update user document with ID `...`, either the user has been
 *    deleted but their account has not..."
 *
 * and the user can never get back in.
 *
 * Safe by construction, and safe to run repeatedly: an account row is only
 * removed when the user document it points at is provably absent, so there is
 * no state in which a working sign-in is affected. Verification codes keyed to
 * a removed account go with it.
 */
export const removeOrphanedAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let scanned = 0;
    let removed = 0;

    // Paginate rather than `take(n)`: a fixed `take` re-reads the same oldest
    // rows on every run, so an orphan sitting past the cut-off would never be
    // reached — a safety net that silently never fires past its own head start.
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await ctx.db
        .query("authAccounts")
        .paginate({ numItems: PAGE_SIZE, cursor });

      for (const account of result.page) {
        scanned++;
        const user = await ctx.db.get(account.userId);
        if (user) continue;

        const codes = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", account._id))
          .collect();
        for (const code of codes) await ctx.db.delete(code._id);

        await ctx.db.delete(account._id);
        removed++;
      }

      if (result.isDone) return { scanned, removed, moreLikely: false };
      cursor = result.continueCursor;
    }

    // Out of pages before out of accounts. Because orphans are deleted as we
    // go, each subsequent run gets further into the table.
    return { scanned, removed, moreLikely: true };
  },
});