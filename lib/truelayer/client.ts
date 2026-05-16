import { TRUELAYER } from "./config";
import {
  accountSchema,
  balanceSchema,
  connectionMetadataSchema,
  dataEnvelopeSchema,
  transactionSchema,
  type Account,
  type Balance,
  type ConnectionMetadata,
  type Transaction,
} from "@/lib/validators/truelayer";

/** Error carrying the HTTP status of a failed TrueLayer data-API call. */
export class TrueLayerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TrueLayerApiError";
  }
}

async function trueLayerGet(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`${TRUELAYER.apiBase}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new TrueLayerApiError(
      `TrueLayer GET ${path} failed (${res.status}): ${await res.text()}`,
      res.status,
    );
  }

  return res.json();
}

/**
 * Parses a `{ results: [...] }` envelope, validating each row individually so
 * a single malformed record does not discard the whole page.
 */
function parseResults<T>(
  raw: unknown,
  itemParser: (item: unknown) => T | null,
): T[] {
  const envelope = dataEnvelopeSchema.parse(raw);
  const parsed: T[] = [];
  for (const item of envelope.results) {
    const value = itemParser(item);
    if (value !== null) parsed.push(value);
  }
  return parsed;
}

/** Connection metadata — credentials_id identifies the linked bank. */
export async function getConnectionMetadata(
  accessToken: string,
): Promise<ConnectionMetadata> {
  const raw = await trueLayerGet("/data/v1/me", accessToken);
  const [meta] = parseResults(raw, (item) => {
    const result = connectionMetadataSchema.safeParse(item);
    return result.success ? result.data : null;
  });
  if (!meta) {
    throw new Error("TrueLayer /data/v1/me returned no usable metadata");
  }
  return meta;
}

/** All accounts visible to the access token. */
export async function getAccounts(accessToken: string): Promise<Account[]> {
  const raw = await trueLayerGet("/data/v1/accounts", accessToken);
  return parseResults(raw, (item) => {
    const result = accountSchema.safeParse(item);
    return result.success ? result.data : null;
  });
}

/** Current/available balance for a single account. */
export async function getBalance(
  accessToken: string,
  accountId: string,
): Promise<Balance | null> {
  const raw = await trueLayerGet(
    `/data/v1/accounts/${accountId}/balance`,
    accessToken,
  );
  const [balance] = parseResults(raw, (item) => {
    const result = balanceSchema.safeParse(item);
    return result.success ? result.data : null;
  });
  return balance ?? null;
}

/** Transactions for a single account. */
export async function getTransactions(
  accessToken: string,
  accountId: string,
): Promise<Transaction[]> {
  const raw = await trueLayerGet(
    `/data/v1/accounts/${accountId}/transactions`,
    accessToken,
  );
  return parseResults(raw, (item) => {
    const result = transactionSchema.safeParse(item);
    return result.success ? result.data : null;
  });
}
