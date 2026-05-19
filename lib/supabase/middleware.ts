import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/** Step the user is sent to when they haven't finished onboarding. */
function onboardingStep(step: number | null | undefined): number {
  return Math.min(4, Math.max(1, step ?? 1));
}

/**
 * Refreshes the Supabase session on every request, guards /dashboard/* and
 * /onboarding/*, and gates unfinished users into the onboarding flow.
 * Must run in middleware so refreshed auth cookies are written to the response.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isOnboarding = pathname.startsWith("/onboarding");
  const isProtected = pathname.startsWith("/dashboard") || isOnboarding;
  const isAuthRoute = pathname.startsWith("/login");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Onboarding gate: an authenticated user with an unfinished profile is
  // funnelled into the flow; a finished user cannot wander back into it.
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarding_complete, onboarding_step")
      .eq("user_id", user.id)
      .maybeSingle();

    const complete = profile?.onboarding_complete ?? false;
    const isReveal = pathname.startsWith("/onboarding/reveal");

    if (!complete && !isOnboarding) {
      const url = request.nextUrl.clone();
      url.pathname = `/onboarding/${onboardingStep(profile?.onboarding_step)}`;
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (complete && isOnboarding && !isReveal) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
