// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import Google from "@auth/core/providers/google";
import { emailOtp } from "./auth/emailOtp";


export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    emailOtp,
    Anonymous,
    // Google OAuth sign-in. Requires AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in
    // this deployment's environment variables, plus the callback URL
    // `${CONVEX_SITE_URL}/api/auth/callback/google` registered as an
    // authorized redirect URI in Google Cloud Console.
    Google({
      clientId: process.env.AUTH_GOOGLE_ID as string,
      clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
    }),
  ],
});