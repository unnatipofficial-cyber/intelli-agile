import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut: authSignOut } = useAuthActions();
  const endGuestSession = useMutation(api.users.endGuestSession);

  /**
   * Signing out purges a Guest's throwaway account first, so a guest never
   * leaves a record behind. The mutation is a no-op for real accounts.
   *
   * Wrapping here rather than at each call site means the existing sign-out
   * buttons (AppLayout, LogoDropdown, Settings) all get the behaviour.
   *
   * Both steps are best-effort and independently guarded. A guest purge
   * deletes the session rows that Convex Auth's own signOut() then looks for,
   * so that call can legitimately fail on an already-torn-down session — and a
   * throw here would strand the caller before its `navigate("/")`, leaving
   * someone staring at a signed-in-looking app.
   */
  const signOut = useCallback(async () => {
    try {
      await endGuestSession();
    } catch (error) {
      console.warn("[auth] Guest session purge skipped:", error);
    }
    try {
      await authSignOut();
    } catch (error) {
      // The identity is already gone either way: either the purge removed the
      // user, or this sign-out revoked the session. Treat it as signed out.
      console.warn("[auth] signOut reported an error:", error);
    }
  }, [authSignOut, endGuestSession]);

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
