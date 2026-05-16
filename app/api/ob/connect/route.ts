import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { buildAuthUrl } from "@/lib/truelayer/auth";
import { createClient } from "@/lib/supabase/server";

export const OB_STATE_COOKIE = "ob_oauth_state";

/**
 * Starts the TrueLayer consent flow: mints a CSRF state token, stores it in
 * an httpOnly cookie, and redirects the user to TrueLayer.
 */
export async function GET() {
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

  response.cookies.set(OB_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
