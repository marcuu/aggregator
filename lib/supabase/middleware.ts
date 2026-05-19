import { NextResponse, type NextRequest } from "next/server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "@/types/database";

/** Step the user is sent to when they haven't finished onboarding. */
function onboardingStep(step: number | null | undefined): number {
  return Math.min(4, Math.max(1, step ?? 1));
}

/**
 * Refreshes the Supabase session on every request, guards /dashboard/* and
 * /onboarding/*, and gates unfinished users into the onboarding flow.
 *
 * The authenticated user is validated here once and the id is forwarded to
 * route handlers on the `x-user-id` request header — so server actions and
 * pages do not each repeat the auth round-trip. Must run in middleware so
 * refreshed auth cookies are written to the response.
 */
export async function updateSession(request: NextRequest) {
  let pendingCookies: { name: string; value: string; options: CookieOptions }[] =
    [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          pendingCookies = cookiesToSet;
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Built after getUser so the cookie header reflects any token refresh.
  // Middleware is the only writer of x-user-id — drop any inbound value.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");
  if (user) requestHeaders.set("x-user-id", user.id);

  // Carries refreshed auth cookies onto whatever response we return.
  function withCookies<T extends NextResponse>(res: T): T {
    for (const { name, value, options } of pendingCookies) {
      res.cookies.set(name, value, options);
    }
    return res;
  }

  const { pathname } = request.nextUrl;
  const isOnboarding = pathname.startsWith("/onboarding");
  const isProtected = pathname.startsWith("/dashboard") || isOnboarding;
  const isAuthRoute = pathname.startsWith("/login");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return withCookies(NextResponse.redirect(url));
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return withCookies(NextResponse.redirect(url));
  }

  // Onboarding gate. The user_profiles lookup runs only for /dashboard — it
  // is skipped on /onboarding/* so each step transition stays a single
  // round-trip; the onboarding pages handle their own intra-flow routing.
  if (user && isProtected && !isOnboarding) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarding_complete, onboarding_step")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.onboarding_complete) {
      const url = request.nextUrl.clone();
      url.pathname = `/onboarding/${onboardingStep(profile?.onboarding_step)}`;
      url.search = "";
      return withCookies(NextResponse.redirect(url));
    }
  }

  return withCookies(
    NextResponse.next({ request: { headers: requestHeaders } }),
  );
}
