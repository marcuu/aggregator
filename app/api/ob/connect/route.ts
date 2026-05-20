import { randomBytes } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { buildAuthUrl } from "@/lib/truelayer/auth";
import { createClient } from "@/lib/supabase/server";

export const OB_STATE_COOKIE = "ob_oauth_state";
export const OB_RETURN_TO_COOKIE = "ob_connect_return_to";

/**
 * Starts the TrueLayer consent flow: mints a CSRF state token, stores it in
 * an httpOnly cookie, and redirects the user to TrueLayer.
 *
 * Accepts ?from=onboarding to redirect back to /onboarding/reveal after
 * consent rather than the default /dashboard/accounts.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  const state = randomBytes(32).toString("hex");
  const response = NextResponse.redirect(buildAuthUrl(state));

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };

  response.cookies.set(OB_STATE_COOKIE, state, cookieOpts);

  const from = request.nextUrl.searchParams.get("from");
  if (from === "onboarding") {
    response.cookies.set(OB_RETURN_TO_COOKIE, "onboarding", cookieOpts);
  }

  return response;
}
