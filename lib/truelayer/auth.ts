import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { TRUELAYER, getTrueLayerEnv } from "./config";
import { decrypt, encrypt } from "./crypto";
import {
  refreshResponseSchema,
  tokenResponseSchema,
  type TokenResponse,
} from "@/lib/validators/truelayer";

type Client = SupabaseClient<Database>;

/** Refresh access tokens this many seconds before they actually expire. */
const EXPIRY_SKEW_SECONDS = 60;

/**
 * Raised when a refresh token is rejected by TrueLayer (revoked/expired
 * consent). Callers use this to mark the connection as expired.
 */
export class TokenRefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenRefreshError";
  }
}

/**
 * Builds the TrueLayer authorization URL the user is redirected to in order
 * to grant consent. `state` is an opaque CSRF token validated on callback.
 */
export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = getTrueLayerEnv();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: TRUELAYER.scopes.join(" "),
    providers: TRUELAYER.providers.join(" "),
    state,
  });

  return `${TRUELAYER.authBase}/?${params.toString()}`;
}

/** Exchanges an authorization code for an access/refresh token pair. */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = getTrueLayerEnv();

  const res = await fetch(TRUELAYER.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `TrueLayer token exchange failed (${res.status}): ${await res.text()}`,
    );
  }

  return tokenResponseSchema.parse(await res.json());
}

/** Exchanges a refresh token for a fresh access token. */
async function requestRefresh(refreshToken: string) {
  const { clientId, clientSecret } = getTrueLayerEnv();

  const res = await fetch(TRUELAYER.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new TokenRefreshError(
      `TrueLayer token refresh failed (${res.status}): ${await res.text()}`,
    );
  }

  return refreshResponseSchema.parse(await res.json());
}

/**
 * Persists a token response for a user, encrypting both tokens at rest.
 * TrueLayer does not always return a new refresh_token on refresh, so the
 * caller may pass a fallback to retain the existing one.
 */
export async function saveTokens(
  client: Client,
  userId: string,
  tokens: TokenResponse,
  connectionId?: string | null,
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000,
  ).toISOString();

  const { error } = await client.from("ob_tokens").upsert(
    {
      user_id: userId,
      connection_id: connectionId ?? null,
      provider: "truelayer",
      access_token: encrypt(tokens.access_token),
      refresh_token: encrypt(tokens.refresh_token),
      expires_at: expiresAt,
    },
    { onConflict: "user_id,provider" },
  );

  if (error) {
    throw new Error(`Failed to save TrueLayer tokens: ${error.message}`);
  }
}

/**
 * Returns a valid access token for the user, refreshing and re-persisting it
 * first if it has expired (or is about to). Throws if the user has no token
 * row or the refresh is rejected.
 */
export async function refreshToken(
  userId: string,
  client: Client,
): Promise<string> {
  const { data: row, error } = await client
    .from("ob_tokens")
    .select("access_token, refresh_token, expires_at, connection_id")
    .eq("user_id", userId)
    .eq("provider", "truelayer")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load TrueLayer token: ${error.message}`);
  }
  if (!row) {
    throw new Error(`No TrueLayer token for user ${userId}`);
  }

  const expiresAtMs = new Date(row.expires_at).getTime();
  const stillValid = expiresAtMs - EXPIRY_SKEW_SECONDS * 1000 > Date.now();

  if (stillValid) {
    return decrypt(row.access_token);
  }

  const currentRefresh = decrypt(row.refresh_token);
  const refreshed = await requestRefresh(currentRefresh);

  // TrueLayer may omit refresh_token when it is unchanged.
  await saveTokens(
    client,
    userId,
    { ...refreshed, refresh_token: refreshed.refresh_token || currentRefresh },
    row.connection_id,
  );

  return refreshed.access_token;
}
