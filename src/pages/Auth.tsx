import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { useDarkSurface } from "@/hooks/use-theme";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import logo from "@/assets/logo.svg";
import { ArrowRight, CheckCircle2, Loader2, Mail, Ticket, UserX } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  formatCountdown,
  isOtpExpired,
  remainingSeconds,
} from "@/lib/otp";

/**
 * The pending code lives in sessionStorage rather than component state so that
 * stepping away to check email — in another tab, another window, or the same
 * tab after a refresh — lands you back on "enter your code" with the same code
 * still valid, instead of dumping you on the email screen to request another.
 *
 * sessionStorage (not localStorage) so the window does not outlive the tab: a
 * code generated yesterday should never be sitting there waiting to be reused.
 */
const PENDING_OTP_KEY = "aie.pending-otp";

interface PendingOtp {
  email: string;
  sentAt: number;
}

/** Restore a pending code, discarding one that has already aged out. */
function readPendingOtp(): PendingOtp | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_OTP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingOtp> | null;
    if (!parsed || typeof parsed.email !== "string") return null;
    if (typeof parsed.sentAt !== "number") return null;
    // Already past its 2 minutes: drop it rather than showing a dead form.
    if (isOtpExpired(parsed.sentAt)) return null;
    return { email: parsed.email, sentAt: parsed.sentAt };
  } catch {
    // Private-mode Safari and friends can throw on access; treat as "no code".
    return null;
  }
}

function writePendingOtp(pending: PendingOtp | null) {
  try {
    if (pending) {
      window.sessionStorage.setItem(PENDING_OTP_KEY, JSON.stringify(pending));
    } else {
      window.sessionStorage.removeItem(PENDING_OTP_KEY);
    }
  } catch {
    // Storage being unavailable must not break sign-in.
  }
}

interface AuthProps {
  redirectAfterAuth?: string;
}

/**
 * Right-side photo panel of the split sign-in layout. Same workspace image the
 * /auth/ui variant uses, so both sign-in pages read as one product.
 */
const AUTH_PHOTO =
  "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?auto=format&fit=crop&w=1200&q=80";

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(() =>
    readPendingOtp(),
  );
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Drives the countdown. Kept as a separate ticking value rather than
  // storing the seconds directly so the interval only forces one re-render per
  // second and never fights a stale closure over the sent timestamp.
  const [now, setNow] = useState(() => Date.now());

  const secondsLeft = pendingOtp ? remainingSeconds(pendingOtp.sentAt, now) : 0;
  const otpExpired = !!pendingOtp && secondsLeft <= 0;
  const step = pendingOtp ? ({ email: pendingOtp.email } as const) : ("signIn" as const);

  const updatePendingOtp = (next: PendingOtp | null) => {
    setPendingOtp(next);
    writePendingOtp(next);
  };

  useEffect(() => {
    if (!pendingOtp) return;
    // Re-sync immediately on resume: a backgrounded tab can have its timers
    // throttled hard enough to miss ticks entirely, so we never trust the
    // interval alone to keep the clock honest.
    setNow(Date.now());
    const id = window.setInterval(() => {
      const current = Date.now();
      // Stop ticking once the window closes. Left running, an expired code
      // would keep forcing a re-render every second forever.
      if (remainingSeconds(pendingOtp.sentAt, current) <= 0) {
        window.clearInterval(id);
        setNow(current);
        return;
      }
      setNow(current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [pendingOtp]);

  // A short invite link (`/auth?invite=<token>`) turns this page into a
  // passwordless acceptance screen: the address is pre-filled from the invite,
  // and signing in redeems it.
  const inviteToken = searchParams.get("invite") ?? searchParams.get("inviteToken");
  const invite = useQuery(
    api.invitations.preview,
    inviteToken ? { token: inviteToken } : "skip",
  );
  const acceptInvite = useMutation(api.invitations.accept);
  const acceptedRef = useRef(false);

  useEffect(() => {
    const invited = (invite as { email?: string } | undefined)?.email;
    if (invited) setEmail(invited);
  }, [invite]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      if (inviteToken && !acceptedRef.current) {
        acceptedRef.current = true;
        try {
          const result = await acceptInvite({ token: inviteToken });
          toast.success(`Invitation accepted — you joined as ${result.role}.`);
        } catch (err) {
          console.error("Invitation acceptance failed:", err);
        }
      }
      if (!cancelled) navigate(redirect);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, navigate, redirect, inviteToken, acceptInvite]);
  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      updatePendingOtp({
        email: formData.get("email") as string,
        sentAt: Date.now(),
      });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);

      console.log("signed in");

      // The code is spent; don't leave it waiting in storage to be replayed.
      updatePendingOtp(null);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);

      setError("The verification code you entered is incorrect.");
      setIsLoading(false);

      setOtp("");
    }
  };

  const handleResend = async () => {
    if (!pendingOtp) return;
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("email", pendingOtp.email);
      await signIn("email-otp", formData);
      updatePendingOtp({ email: pendingOtp.email, sentAt: Date.now() });
      setOtp("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send a new code. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Attempting anonymous sign in...");
      await signIn("anonymous");
      console.log("Anonymous sign in successful");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      setError(`Failed to sign in as guest: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen md:grid md:grid-cols-2">
      {/* Form column — the card is unchanged, it just sits in the left half. */}
      <div className="flex min-h-screen items-center justify-center p-6 md:p-0 md:py-12">
        <Card className="min-w-[350px] pb-0 border shadow-md">
          {step === "signIn" ? (
            <>
              <CardHeader className="text-center">
              <div className="flex justify-center">
                    <img
                      src={logo}
                      alt="Lock Icon"
                      width={64}
                      height={64}
                      className="rounded-lg mb-4 mt-4 cursor-pointer"
                      onClick={() => navigate("/")}
                    />
                  </div>
                <CardTitle className="text-xl">Welcome to AIE</CardTitle>
                <CardDescription>
                  Enter your email to sign in or create an account
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleEmailSubmit}>
                <CardContent>
                  {inviteToken && (
                    <div
                      className={
                        "mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs " +
                        ((invite as { valid?: boolean } | undefined)?.valid
                          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                          : "border-destructive/30 bg-destructive/5 text-destructive")
                      }
                    >
                      {(invite as { valid?: boolean } | undefined)?.valid ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>
                        {(invite as { valid?: boolean } | undefined)?.valid
                          ? `You've been invited to AIE${
                              (invite as { role?: string } | undefined)?.role
                                ? ` as ${(invite as { role?: string }).role}`
                                : ""
                            }. Sign in below to accept.`
                          : invite === undefined
                            ? "Checking your invitation…"
                            : "This invitation link is invalid, expired, or already used. You can still sign in normally."}
                      </span>
                    </div>
                  )}
                  
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        className="pl-9"
                        disabled={isLoading}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      size="icon"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-500">{error}</p>
                  )}
                  
                  <div className="mt-4">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full mt-4"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Explore as Guest
                    </Button>
                  </div>
                </CardContent>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="text-center mt-4">
                <CardTitle>Verify your email</CardTitle>
                <CardDescription>
                  We sent a verification code to {step.email}
                  {!otpExpired && (
                    <span className="mt-1 block">
                      Code expires in{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatCountdown(secondsLeft)}
                      </span>
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="pb-4">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading || otpExpired}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          otp.length === 6 &&
                          !isLoading &&
                          !otpExpired
                        ) {
                          // Find the closest form and submit it
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) {
                            form.requestSubmit();
                          }
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-500 text-center">
                      {error}
                    </p>
                  )}
                  {otpExpired && !error && (
                    <p className="mt-2 text-sm text-amber-600 dark:text-amber-500 text-center">
                      This code has expired. Send a new one to continue.
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Didn't receive a code?{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto"
                      onClick={handleResend}
                      disabled={isLoading}
                    >
                      {otpExpired ? "Send a new code" : "Resend code"}
                    </Button>
                  </p>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || otpExpired || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify code
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => updatePendingOtp(null)}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Use different email
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          <div className="py-4 px-6 text-xs text-center text-muted-foreground bg-muted border-t rounded-b-lg">
            Secured by{" "}
            <a
              href="https://freebuff.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary transition-colors"
            >
              freebuff.com
            </a>
          </div>
        </Card>
      </div>

      {/* Photo column — restored right-side panel, hidden below md. */}
      <div
        className="hidden md:block relative bg-cover bg-center"
        style={{ backgroundImage: `url(${AUTH_PHOTO})` }}
      >
        <div className="absolute inset-x-0 bottom-0 h-[100px] bg-gradient-to-t from-background to-transparent" />
        <div className="relative z-10 flex h-full flex-col items-center justify-end p-2 pb-6">
          <blockquote className="space-y-2 text-center text-foreground">
            <p className="text-lg font-medium">
              &ldquo;Welcome back. The journey continues.&rdquo;
            </p>
            <cite className="block text-sm font-light text-muted-foreground not-italic">
              &mdash; AIE
            </cite>
          </blockquote>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  // Sign-in is dark-only across every appearance theme, matching the landing page.
  useDarkSurface();

  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
