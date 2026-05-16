/**
 * TrueLayer endpoints and OAuth configuration. Defaults to the sandbox
 * environment used during development (Phases 3–5).
 */

export const TRUELAYER = {
  authBase: "https://auth.truelayer-sandbox.com",
  tokenUrl: "https://auth.truelayer-sandbox.com/connect/token",
  apiBase: "https://api.truelayer-sandbox.com",
  /** Data API scopes required for account + transaction aggregation. */
  scopes: ["info", "accounts", "balance", "transactions", "offline_access"],
  /** Sandbox mock providers — covers the test banks. */
  providers: ["uk-cs-mock", "uk-ob-all", "uk-oauth-all"],
} as const;

export function getTrueLayerEnv() {
  const clientId = process.env.TRUELAYER_CLIENT_ID;
  const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;
  const redirectUri = process.env.TRUELAYER_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing TrueLayer env vars (TRUELAYER_CLIENT_ID / _CLIENT_SECRET / _REDIRECT_URI)",
    );
  }

  return { clientId, clientSecret, redirectUri };
}
