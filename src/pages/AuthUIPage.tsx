import { AuthUI } from "@/components/ui/auth-ui";
import { Suspense } from "react";

export default function AuthUIPage() {
  return (
    <Suspense fallback={null}>
      <AuthUI />
    </Suspense>
  );
}
