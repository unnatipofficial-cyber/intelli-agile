/**
 * Recognising an invite token on the sign-in screen.
 *
 * The invitation email is sent through the OTP relay, which can only deliver
 * the token as text — there is no link in it. So the natural thing an invitee
 * does is open the app and paste that token into the first field they see, the
 * email box. Shared between the two sign-in screens so they behave the same.
 */

/** Must stay in sync with `TOKEN_ALPHABET` in `src/convex/invitations.ts`. */
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * True when the input looks like an invite token: exactly 8 characters drawn
 * from the alphabet, which deliberately excludes `I`, `O`, `0` and `1` so a
 * token can be read off a screen without ambiguity.
 *
 * Case-insensitive, since the token is generated uppercase but people type
 * lowercase.
 */
export function isInviteTokenShape(input: string): boolean {
  const value = (input ?? "").trim();
  if (value.length !== 8) return false;
  return [...value].every((char) => TOKEN_ALPHABET.includes(char.toUpperCase()));
}

/**
 * What to do with what the person typed in the email box: treat it as a normal
 * email, or as an invite token pasted into the wrong field.
 */
export function classifySignInIdentifier(
  input: string,
): "email" | "invite-token" | "invalid" {
  const value = (input ?? "").trim();
  if (!value) return "invalid";
  if (value.includes("@")) return "email";
  if (isInviteTokenShape(value)) return "invite-token";
  return "invalid";
}