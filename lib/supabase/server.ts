import { cookies, headers } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * The authenticated user id, as validated by middleware and forwarded on the
 * `x-user-id` request header. Returns null when there is no authenticated
 * user. Lets server actions and pages skip a redundant auth round-trip.
 */
export async function getRequestUserId(): Promise<string | null> {
  return (await headers()).get("x-user-id");
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — middleware refreshes the session.
          }
        },
      },
    },
  );
}

/**
 * Service-role client — bypasses RLS. Use ONLY in trusted server contexts
 * (webhooks, cron) where there is no authenticated user to scope queries to.
 */
export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );
}
