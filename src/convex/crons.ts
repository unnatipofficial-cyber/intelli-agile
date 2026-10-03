import { cronJobs } from "convex/server";
import { internal, api } from "./_generated/api";

/**
 * The AIE Agent's heartbeat.
 *
 * Once an hour this asks the agent to catch up on any schedule the user set
 * up — "every weekday at 9am tell me what's at risk", "every hour flag new
 * blockers". Each due schedule becomes a short digest notification, then the
 * schedule is pushed to its next firing time.
 *
 * Hourly granularity is deliberate: the schedule's own cadence decides when it
 * actually fires, so a daily 09:00 briefing simply isn't due until 09:00.
 */
const crons = cronJobs();

crons.cron("AIE agent scheduled runs", "0 * * * *", internal.agent.runScheduledDigests);

/**
 * Housekeeping for auth rows left behind by deleted users.
 *
 * An `authAccounts` row whose user document is gone makes every later sign-in
 * with that address fail, so sweep them daily. See `repair.removeOrphanedAccounts`.
 */
crons.cron(
  "Prune orphaned auth accounts",
  "30 4 * * *",
  api.repair.removeOrphanedAccounts,
);

export default crons;