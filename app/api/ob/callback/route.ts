import { NextResponse, type NextRequest } from "next/server";

import { exchangeCode, saveTokens } from "@/lib/truelayer/auth";
import { getConnectionMetadata } from "@/lib/truelayer/client";
import { syncUser } from "@/lib/truelayer/sync";
import { createClient } from "@/lib/supabase/server";
import { OB_RETURN_TO_COOKIE, OB_STATE_COOKIE } from "../connect/route";

function redirectWithError(origin: string, reason: string) {
  const url = new URL("/dashboard/connect", origin);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

/**
 * TrueLayer consent callback: validates the CSRF state, exchanges the code
 * for tokens, records the connection, and persists the encrypted tokens.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const providerError = searchParams.get("error");

  if (providerError) {
    return redirectWithError(origin, providerError);
  }

  const expectedState = request.cookies.get(OB_STATE_COOKIE)?.value;
  if (!state || !expectedState || state !== expectedState) {
    return redirectWithError(origin, "invalid_state");
  }
  if (!code) {
    return redirectWithError(origin, "missing_code");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  try {
    const tokens = await exchangeCode(code);
    const metadata = await getConnectionMetadata(tokens.access_token);

    const { data: connection, error: connectionError } = await supabase
      .from("ob_connections")
      .upsert(
        {
          user_id: user.id,
          provider_connection_id: metadata.credentials_id,
          institution_name: metadata.provider?.display_name ?? null,
          status: "active",
        },
        { onConflict: "user_id,provider_connection_id" },
      )
      .select("id")
      .single();

    if (connectionError || !connection) {
      throw new Error(
        `Failed to record connection: ${connectionError?.message}`,
      );
    }

    await saveTokens(supabase, user.id, tokens, connection.id);

    // Pull an initial set of accounts + transactions. A sync failure here is
    // non-fatal — the user can retry from the dashboard.
    try {
      await syncUser(user.id, supabase);
    } catch (syncError) {
      console.error("Initial sync after connect failed:", syncError);
    }

    const returnTo = request.cookies.get(OB_RETURN_TO_COOKIE)?.value;
    const successPath =
      returnTo === "onboarding" ? "/onboarding/reveal" : "/dashboard/accounts";

    const response = NextResponse.redirect(new URL(successPath, origin));
    response.cookies.delete(OB_STATE_COOKIE);
    response.cookies.delete(OB_RETURN_TO_COOKIE);
    return response;
  } catch (error) {
    console.error("TrueLayer callback failed:", error);
    return redirectWithError(origin, "connection_failed");
  }
}
