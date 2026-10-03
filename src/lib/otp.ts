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

/**
 * Storage key for the in-flight code, shared by BOTH sign-in screens (`/auth`
 * and `/auth/ui`). One key on purpose: if the two pages ever disagree the code
 * you just requested silently disappears when you move between them.
 *
 * sessionStorage rather than localStorage so the code cannot outlive the tab.
 */
export const PENDING_OTP_KEY = "aie.pending-otp";

export interface PendingOtp {
  email: string;
  sentAt: number;
  /**
   * Invite token this sign-in is redeeming, when the person arrived by pasting
   * a token into the email box. Carried through the OTP step so the invite can
   * be accepted once they are authenticated, and stored alongside the code so a
   * mid-verification refresh does not lose it.
   */
  inviteToken?: string;
}

/**
 * Restore the in-flight code, or null if there is none or it has aged out.
 *
 * Storage is wrapped because private-mode Safari and hardened browser configs
 * throw on `sessionStorage` access, and failing to read must never break
 * sign-in — it just means the user asks for a new code.
 */
export function readPendingOtp(now: number = Date.now()): PendingOtp | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(PENDING_OTP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingOtp> | null;
    if (!parsed || typeof parsed.email !== "string") return null;
    if (typeof parsed.sentAt !== "number") return null;
    if (isOtpExpired(parsed.sentAt, now)) return null;
    return {
      email: parsed.email,
      sentAt: parsed.sentAt,
      ...(typeof parsed.inviteToken === "string"
        ? { inviteToken: parsed.inviteToken }
        : {}),
    };
  } catch {
    return null;
  }
}

/** Persist (or clear) the in-flight code. Never throws. */
export function writePendingOtp(pending: PendingOtp | null): void {
  try {
    if (typeof window === "undefined") return;
    if (pending) {
      window.sessionStorage.setItem(PENDING_OTP_KEY, JSON.stringify(pending));
    } else {
      window.sessionStorage.removeItem(PENDING_OTP_KEY);
    }
  } catch {
    // Storage unavailable: the in-memory state still drives this session.
  }
}