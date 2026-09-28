import { query } from "./_generated/server";

/**
 * Which optional auth providers are actually configured on this deployment.
 *
 * Lets the sign-in UI hide/disable providers that have no credentials set,
 * instead of sending users to a broken OAuth screen.
 */
export const enabled = query({
  args: {},
  handler: async () => {
    return {
      google: Boolean(
        process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
      ),
    };
  },
});
