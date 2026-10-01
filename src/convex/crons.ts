import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

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

export default crons;