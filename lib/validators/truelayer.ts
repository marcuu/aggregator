import { z } from "zod";

/**
 * Zod schemas for TrueLayer API responses. Every external payload is parsed
 * through these before it touches the database.
 */

/* OAuth token response ---------------------------------------------------- */

export const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string(),
  scope: z.string().optional(),
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;

/**
 * Refresh responses are identical except TrueLayer may omit refresh_token
 * when the existing one is still valid.
 */
export const refreshResponseSchema = tokenResponseSchema.extend({
  refresh_token: z.string().min(1).optional(),
});

export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

/* Accounts ---------------------------------------------------------------- */

export const accountSchema = z.object({
  account_id: z.string().min(1),
  account_type: z.string().optional(),
  display_name: z.string().optional(),
  currency: z.string().optional(),
  provider: z
    .object({
      display_name: z.string().optional(),
      provider_id: z.string().optional(),
    })
    .optional(),
});

export type Account = z.infer<typeof accountSchema>;

/* Balance ----------------------------------------------------------------- */

export const balanceSchema = z.object({
  currency: z.string().optional(),
  available: z.number().nullable().optional(),
  current: z.number().nullable().optional(),
});

export type Balance = z.infer<typeof balanceSchema>;

/* Connection metadata (/data/v1/me) --------------------------------------- */

export const connectionMetadataSchema = z.object({
  credentials_id: z.string().min(1),
  provider: z
    .object({
      display_name: z.string().optional(),
      provider_id: z.string().optional(),
    })
    .optional(),
});

export type ConnectionMetadata = z.infer<typeof connectionMetadataSchema>;

/* Transactions ------------------------------------------------------------ */

export const transactionSchema = z.object({
  transaction_id: z.string().min(1),
  /** Some pending transactions only expose a normalised id. */
  normalised_provider_transaction_id: z.string().optional(),
  timestamp: z.string(),
  description: z.string().optional(),
  amount: z.number(),
  currency: z.string().optional(),
  transaction_type: z.string().optional(),
  transaction_category: z.string().optional(),
  merchant_name: z.string().optional(),
});

export type Transaction = z.infer<typeof transactionSchema>;

/* Generic data-API envelope ----------------------------------------------- */

/**
 * TrueLayer data endpoints wrap results in `{ results: [...], status }`.
 * `results` is validated item-by-item by the caller so one bad row does not
 * discard the whole page.
 */
export const dataEnvelopeSchema = z.object({
  results: z.array(z.unknown()),
  status: z.string().optional(),
});

/* Webhook payload --------------------------------------------------------- */

export const webhookEventSchema = z.object({
  type: z.string(),
  event_id: z.string().optional(),
  connection_id: z.string().optional(),
  results_uri: z.string().optional(),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
