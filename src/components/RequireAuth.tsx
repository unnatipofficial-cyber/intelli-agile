import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { needsProfileSetup } from "@/convex/helpers";
import { ProfileSetupDialog } from "@/components/ProfileSetupDialog";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  // One-time profile capture for a brand new real account. Mounted here rather
  // than on a specific page so it is impossible to route around: whichever
  // protected page a new sign-in lands on, the prompt appears. Once the server
  // records profileCompletedAt this renders nothing again.
  //
  // The page renders *behind* the dialog rather than being replaced by it. An
  // earlier version returned the dialog alone, so a new user saw a modal floating
  // on an empty screen with no sense of the app they were signing in to.
  if (needsProfileSetup(user)) {
    return (
      <>
        {children}
        <ProfileSetupDialog />
      </>
    );
  }

  return children;
}
