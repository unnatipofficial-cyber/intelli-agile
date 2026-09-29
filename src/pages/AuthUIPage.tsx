import { AuthUI } from "@/components/ui/auth-ui";
import { useDarkSurface } from "@/hooks/use-theme";
import { Suspense } from "react";

export default function AuthUIPage() {
  // Sign-in is dark-only across every appearance theme, matching the landing page.
  useDarkSurface();

  return (
    <Suspense fallback={null}>
      <AuthUI />
    </Suspense>
  );
}
