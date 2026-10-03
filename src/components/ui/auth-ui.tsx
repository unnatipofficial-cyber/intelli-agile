"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  formatCountdown,
  readPendingOtp,
  remainingSeconds,
  writePendingOtp,
  type PendingOtp,
} from "@/lib/otp";
import { classifySignInIdentifier } from "@/lib/invite";
import { Slot } from "@radix-ui/react-slot";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { Eye, EyeOff, ArrowRight, Loader2, UserX } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TypewriterProps {
  text: string | string[];
  speed?: number;
  cursor?: string;
  loop?: boolean;
  deleteSpeed?: number;
  delay?: number;
  className?: string;
}

export function Typewriter({
  text,
  speed = 100,
  cursor = "|",
  loop = false,
  deleteSpeed = 50,
  delay = 1500,
  className,
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [textArrayIndex, setTextArrayIndex] = useState(0);

  const textArray = Array.isArray(text) ? text : [text];
  const currentText = textArray[textArrayIndex] || "";

  useEffect(() => {
    if (!currentText) return;

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (currentIndex < currentText.length) {
            setDisplayText((prev) => prev + currentText[currentIndex]);
            setCurrentIndex((prev) => prev + 1);
          } else if (loop) {
            setTimeout(() => setIsDeleting(true), delay);
          }
        } else {
          if (displayText.length > 0) {
            setDisplayText((prev) => prev.slice(0, -1));
          } else {
            setIsDeleting(false);
            setCurrentIndex(0);
            setTextArrayIndex((prev) => (prev + 1) % textArray.length);
          }
        }
      },
      isDeleting ? deleteSpeed : speed,
    );

    return () => clearTimeout(timeout);
  }, [
    currentIndex,
    isDeleting,
    currentText,
    loop,
    speed,
    deleteSpeed,
    delay,
    displayText,
    text,
  ]);

  return (
    <span className={className}>
      {displayText}
      <span className="animate-pulse">{cursor}</span>
    </span>
  );
}

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input dark:border-input/50 bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary-foreground/60 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-md px-6",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input dark:border-input/50 bg-background px-3 py-3 text-sm text-foreground shadow-sm transition-shadow placeholder:text-muted-foreground/70 focus-visible:bg-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(({ className, label, ...props }, ref) => {
  const id = React.useId();
  const [showPassword, setShowPassword] = useState(false);
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);
  return (
    <div className="grid w-full items-center gap-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          className={cn("pe-10", className)}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute inset-y-0 end-0 flex h-full w-10 items-center justify-center text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function AuthFormContainer({
  isSignIn,
  onToggle,
}: {
  isSignIn: boolean;
  onToggle: () => void;
}) {
  const { signIn, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"));
  const providerConfig = useQuery(api.authProviders.enabled);
  const googleEnabled = providerConfig?.google === true;

  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(() =>
    readPendingOtp(),
  );
  const [email, setEmail] = useState(pendingOtp?.email ?? "");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ticking clock for the countdown; the interval stops itself once the code
  // expires rather than re-rendering forever on a dead one.
  const [now, setNow] = useState(() => Date.now());
  // Token pasted into the email box, awaiting resolution by `preview`.
  const [inviteLookup, setInviteLookup] = useState<string | null>(null);
  const invitePreview = useQuery(
    api.invitations.preview,
    inviteLookup ? { token: inviteLookup } : "skip",
  );
  const acceptInvite = useMutation(api.invitations.accept);

  const secondsLeft = pendingOtp ? remainingSeconds(pendingOtp.sentAt, now) : 0;
  const otpExpired = !!pendingOtp && secondsLeft <= 0;
  const step: "email" | "code" = pendingOtp ? "code" : "email";

  const updatePendingOtp = (next: PendingOtp | null) => {
    setPendingOtp(next);
    writePendingOtp(next);
  };

  useEffect(() => {
    if (!pendingOtp) return;
    setNow(Date.now());
    const id = window.setInterval(() => {
      const current = Date.now();
      if (remainingSeconds(pendingOtp.sentAt, current) <= 0) {
        window.clearInterval(id);
        setNow(current);
        return;
      }
      setNow(current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [pendingOtp]);

  // Already signed in? Send them straight to the app.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  // `?guest=1` means "I just want to look around" — start the throwaway session
  // on arrival rather than making someone hunt for the guest button. Runs once
  // per mount: the ref guard matters because this screen is mounted inside a
  // StrictMode double-invoke in dev, and a second anonymous sign-in would race
  // the first and could produce two guest rows.
  const autoGuestStarted = useRef(false);
  const wantsGuest = searchParams.get("guest") === "1";
  useEffect(() => {
    if (!wantsGuest) return;
    if (authLoading || isAuthenticated) return;
    if (autoGuestStarted.current) return;
    autoGuestStarted.current = true;
    void handleGuest();
    // `handleGuest` is intentionally omitted: it is re-created on every render
    // and would re-fire this effect, defeating the ref guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsGuest, authLoading, isAuthenticated]);

  // Reset the flow whenever the user switches between sign in / sign up.
  // Guarded against the mount pass: this effect also fires on first render, and
  // an unguarded reset there would immediately wipe the code we just restored.
  const lastSignInMode = useRef(isSignIn);
  useEffect(() => {
    if (lastSignInMode.current === isSignIn) return;
    lastSignInMode.current = isSignIn;
    updatePendingOtp(null);
    setCode("");
    setError(null);
  }, [isSignIn]);

  // Resolve a pasted invite token into the address it was issued for, then send
  // that person their real sign-in code. This is what makes the emailed token
  // usable at all: the relay can only deliver the token as text, so people
  // paste it into the first field they see.
  const handledLookup = useRef<string | null>(null);
  useEffect(() => {
    if (!inviteLookup || !invitePreview) return;
    if (handledLookup.current === inviteLookup) return;
    handledLookup.current = inviteLookup;

    const resolved = inviteLookup.toUpperCase();
    setInviteLookup(null);

    if (!invitePreview.valid) {
      setError(
        invitePreview.expired
          ? "That invitation has expired. Ask for a new one."
          : invitePreview.used
            ? "That invitation has already been used."
            : "That invitation code isn't valid.",
      );
      return;
    }

    const invitedEmail = invitePreview.email;
    setEmail(invitedEmail);
    setIsPending(true);
    void (async () => {
      try {
        await signIn("email-otp", { email: invitedEmail, redirectTo: redirect });
        updatePendingOtp({
          email: invitedEmail,
          sentAt: Date.now(),
          inviteToken: resolved,
        });
        setCode("");
      } catch (err) {
        console.error("Invite sign-in error:", err);
        setError(
          err instanceof Error && err.message
            ? err.message
            : "We couldn't send a code to that address. Try again.",
        );
      } finally {
        setIsPending(false);
      }
    })();
  }, [inviteLookup, invitePreview, redirect, signIn]);

  const handleEmailSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);

    // An invite token pasted here is not an email; hand it to the lookup
    // instead of mailing a sign-in code to a non-existent address.
    const kind = classifySignInIdentifier(email);
    if (kind === "invite-token") {
      setInviteLookup(email.trim());
      return;
    }
    if (kind === "invalid") {
      setError("Enter a valid email address, or paste an invite code.");
      return;
    }
    // `noValidate` on the form means the browser no longer catches typos for
    // us, so restore that instant feedback before spending a round trip.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("That doesn't look like an email address.");
      return;
    }

    setIsPending(true);
    try {
      await signIn("email-otp", {
        email,
        ...(name.trim() && !isSignIn ? { name: name.trim() } : {}),
        redirectTo: redirect,
      });
      updatePendingOtp({ email, sentAt: Date.now() });
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "We couldn't send a code to that address. Check it and try again.",
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleCodeSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      await signIn("email-otp", { email, code, redirectTo: redirect });

      // Signed in first, so the invite has an identity to attach to. A failure
      // here must not trap someone who has already proved who they are — they
      // stay signed in and the invite can simply be re-sent.
      const inviteToken = pendingOtp?.inviteToken;
      if (inviteToken) {
        // The session token can land a beat after `signIn` resolves, so a
        // first "must be signed in" is treated as a race and retried once.
        // Without this the failure is silent: the person signs in and simply
        // never gets the role their invite promised.
        const acceptWithRetry = async (attempt: number): Promise<boolean> => {
          try {
            const accepted = await acceptInvite({ token: inviteToken });
            console.log("invitation accepted, role:", accepted.role);
            return true;
          } catch (err) {
            if (attempt === 0) {
              await new Promise((resolve) => setTimeout(resolve, 400));
              return acceptWithRetry(1);
            }
            console.error("Invitation acceptance failed:", err);
            return false;
          }
        };
        await acceptWithRetry(0);
      }

      updatePendingOtp(null);
      navigate(redirect, { replace: true });
    } catch (err) {
      console.error("Code verification error:", err);
      setError("That code didn't match. Check your inbox and try again.");
      setCode("");
    } finally {
      setIsPending(false);
    }
  };

  const handleResend = async () => {
    if (!pendingOtp) return;
    setIsPending(true);
    setError(null);
    try {
      await signIn("email-otp", {
        email: pendingOtp.email,
        redirectTo: redirect,
      });
      updatePendingOtp({ email: pendingOtp.email, sentAt: Date.now() });
      setCode("");
    } catch (err) {
      console.error("Resend error:", err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "We couldn't send another code. Try again.",
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleGuest = async () => {
    setIsPending(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect, { replace: true });
    } catch (err) {
      console.error("Guest sign-in error:", err);
      setError("We couldn't start a guest session. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  const handleGoogle = async () => {
    setIsPending(true);
    setError(null);
    try {
      const { redirect: oauthUrl } = await signIn("google", {
        redirectTo: redirect,
      });
      if (oauthUrl) {
        window.location.href = oauthUrl.toString();
        return;
      }
      setError("Google sign-in couldn't start. Please try again.");
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError(
        "Google sign-in isn't enabled yet. Use email or guest sign-in instead.",
      );
    } finally {
      setIsPending(false);
    }
  };

  const heading =
    step === "code"
      ? "Check your email"
      : isSignIn
        ? "Sign in to your account"
        : "Create your account";
  const subheading =
    step === "code"
      ? `We sent a 6-digit code to ${email}`
      : isSignIn
        ? "Enter your email and we'll send you a sign-in code"
        : "Enter your details and we'll send you a verification code";

  // Shown under the heading while the code is still inside its 2-minute
  // window, so it is obvious the code you are typing is still worth using.
  const countdownLine =
    step === "code" && !otpExpired ? (
      <span className="mt-1 block">
        Code expires in{" "}
        <span className="font-medium text-foreground tabular-nums">
          {formatCountdown(secondsLeft)}
        </span>
      </span>
    ) : null;

  return (
    <div className="mx-auto grid w-[350px] gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        <p className="text-balance text-sm text-muted-foreground">
          {subheading}
          {countdownLine}
        </p>
      </div>

      {step === "email" ? (
        <form
          onSubmit={handleEmailSubmit}
          autoComplete="on"
          // The invite token is 8 characters with no "@", which native email
          // validation rejects outright ("Please include an '@'...") before any
          // of our code runs. We validate ourselves so a pasted invite code is
          // a supported way in rather than a dead end.
          noValidate
          className="grid gap-4"
        >
          {!isSignIn && (
            <div className="grid gap-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Ada Lovelace"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isPending}
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isPending}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="mt-1" disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 size-4" />
            )}
            {isSignIn ? "Send sign-in code" : "Create account"}
          </Button>

          <div className="text-center text-sm">
            {isSignIn ? "Don't have an account?" : "Already have an account?"}{" "}
            <Button
              variant="link"
              type="button"
              className="h-auto p-0 pl-1 text-foreground"
              onClick={onToggle}
            >
              {isSignIn ? "Sign up" : "Sign in"}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleCodeSubmit} className="grid gap-4">
          <div className="flex justify-center">
            <InputOTP
              value={code}
              onChange={setCode}
              maxLength={6}
              disabled={isPending || otpExpired}
              autoFocus
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && (
            <p className="text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {otpExpired && !error && (
            <p className="text-center text-sm text-amber-600 dark:text-amber-500">
              This code has expired. Send a new one to continue.
            </p>
          )}

          <Button type="submit" disabled={isPending || otpExpired || code.length !== 6}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Verify code
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleResend}
            disabled={isPending}
          >
            {otpExpired ? "Send a new code" : "Resend code"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              updatePendingOtp(null);
              setCode("");
              setError(null);
            }}
            disabled={isPending}
          >
            Use a different email
          </Button>
        </form>
      )}

      <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
        <span className="relative z-10 bg-background px-2 text-muted-foreground">
          Or continue with
        </span>
      </div>

      <div className="grid gap-2">
        <Button
          variant="outline"
          type="button"
          onClick={handleGoogle}
          disabled={isPending || !googleEnabled}
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_%22G%22_Logo.svg/640px-Google_%22G%22_Logo.svg.png"
            alt=""
            className="mr-2 size-4"
          />
          Continue with Google
        </Button>
        {providerConfig && !providerConfig.google && (
          <p className="text-center text-xs text-muted-foreground">
            Google sign-in isn't configured for this deployment yet — use email
            or guest sign-in.
          </p>
        )}
        <Button
          variant="ghost"
          type="button"
          onClick={handleGuest}
          disabled={isPending}
        >
          <UserX className="mr-2 size-4" />
          Continue as guest
        </Button>
      </div>
    </div>
  );
}

interface AuthContentProps {
  image?: {
    src: string;
    alt: string;
  };
  quote?: {
    text: string;
    author: string;
  };
}

interface AuthUIProps {
  signInContent?: AuthContentProps;
  signUpContent?: AuthContentProps;
}

const defaultSignInContent = {
  image: {
    src:
      "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?auto=format&fit=crop&w=1200&q=80",
    alt: "A beautiful workspace for signing in",
  },
  quote: {
    text: "Welcome back. The journey continues.",
    author: "AIE",
  },
};

const defaultSignUpContent = {
  image: {
    src:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
    alt: "A bright modern office for new beginnings",
  },
  quote: {
    text: "Create an account. A new chapter awaits.",
    author: "AIE",
  },
};

export function AuthUI({
  signInContent = {},
  signUpContent = {},
}: AuthUIProps) {
  const [isSignIn, setIsSignIn] = useState(true);
  const toggleForm = () => setIsSignIn((prev) => !prev);

  const finalSignInContent = {
    image: { ...defaultSignInContent.image, ...signInContent.image },
    quote: { ...defaultSignInContent.quote, ...signInContent.quote },
  };
  const finalSignUpContent = {
    image: { ...defaultSignUpContent.image, ...signUpContent.image },
    quote: { ...defaultSignUpContent.quote, ...signUpContent.quote },
  };

  const currentContent = isSignIn ? finalSignInContent : finalSignUpContent;

  return (
    <div className="w-full min-h-screen md:grid md:grid-cols-2">
      <style>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none;
        }
      `}</style>
      <div className="flex min-h-screen items-center justify-center p-6 md:p-0 md:py-12">
        <AuthFormContainer isSignIn={isSignIn} onToggle={toggleForm} />
      </div>

      <div
        className="hidden md:block relative bg-cover bg-center transition-all duration-500 ease-in-out"
        style={{ backgroundImage: `url(${currentContent.image.src})` }}
        key={currentContent.image.src}
      >
        <div className="absolute inset-x-0 bottom-0 h-[100px] bg-gradient-to-t from-background to-transparent" />
        <div className="relative z-10 flex h-full flex-col items-center justify-end p-2 pb-6">
          <blockquote className="space-y-2 text-center text-foreground">
            <p className="text-lg font-medium">
              “<Typewriter
                key={currentContent.quote.text}
                text={currentContent.quote.text}
                speed={60}
              />”
            </p>
            <cite className="block text-sm font-light text-muted-foreground not-italic">
              — {currentContent.quote.author}
            </cite>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
