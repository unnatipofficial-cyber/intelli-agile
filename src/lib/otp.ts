/**
 * OTP window and countdown formatting for the email sign-in code.
 *
 * The code itself is issued by Convex Auth and stays valid server-side for far
 * longer than this (`emailOtp` sets `maxAge: 60 * 15`). Two minutes is the
 * *presented* window: long enough to go check another tab for the email, short
 * enough that the code on screen is never stale.
 */

/** How long a freshly generated code is presented as usable: 2 minutes. */
export const OTP_WINDOW_MS = 2 * 60 * 1000;

/**
 * Whole seconds left before the code expires. Ceiling division means a code
 * that still has any life left always shows at least "0:01" rather than
 * flashing "0:00" while it is technically still valid.
 */
export function remainingSeconds(
  sentAt: number,
  now: number = Date.now(),
): number {
  if (!Number.isFinite(sentAt)) return 0;
  const left = OTP_WINDOW_MS - (now - sentAt);
  if (left <= 0) return 0;
  return Math.ceil(left / 1000);
}

/** True once the 2-minute window has elapsed (or the timestamp was garbage). */
export function isOtpExpired(sentAt: number, now: number = Date.now()): boolean {
  return remainingSeconds(sentAt, now) <= 0;
}

/**
 * Render seconds as `m:ss`, e.g. 119 -> "1:59", 8 -> "0:08".
 *
 * Zero-padded so the label never changes width mid-countdown, which would
 * otherwise make the text jitter once a second.
 */
export function formatCountdown(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}