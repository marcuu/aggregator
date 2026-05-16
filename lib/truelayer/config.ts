/**
 * TrueLayer endpoints and OAuth configuration.
 *
 * The environment is selected by the TRUELAYER_ENV env var:
 *   - "live"    → production endpoints + real bank providers
 *   - "sandbox" → sandbox endpoints + mock providers (default)
 */

const TRUELAYER_ENVS = {
  sandbox: {
    authBase: "https://auth.truelayer-sandbox.com",
    tokenUrl: "https://auth.truelayer-sandbox.com/connect/token",
    apiBase: "https://api.truelayer-sandbox.com",
    /** Sandbox mock providers — covers the test banks. */
    providers: ["uk-cs-mock", "uk-ob-all", "uk-oauth-all"],
  },
  live: {
    authBase: "https://auth.truelayer.com",
    tokenUrl: "https://auth.truelayer.com/connect/token",
    apiBase: "https://api.truelayer.com",
    /** Production providers — real UK Open Banking + OAuth banks. */
    providers: ["uk-ob-all", "uk-oauth-all"],
  },
} as const;

function resolveEnv(): "sandbox" | "live" {
  return process.env.TRUELAYER_ENV === "live" ? "live" : "sandbox";
}

const selected = TRUELAYER_ENVS[resolveEnv()];

export const TRUELAYER = {
  ...selected,
  /** Data API scopes required for account + transaction aggregation. */
  scopes: ["info", "accounts", "balance", "transactions", "offline_access"],
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
