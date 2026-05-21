/**
 * Anti-corruption layer over TrueLayer's transaction taxonomy.
 *
 * TrueLayer emits `transaction_category` (a coarse enum: PURCHASE, TRANSFER,
 * DIRECT_DEBIT, FEE_CHARGE, …) and `transaction_classification` (an array of
 * merchant-type hints). Neither maps directly to the lowercase merchant-type
 * strings the trajectory engine and scoring code key on. Without this
 * mapping, every synced transaction lands as `uncategorised` and the
 * essential / discretionary / investment sub-scores collapse to neutral.
 *
 * This module is the *only* place vendor strings turn into domain
 * categories. Run it at sync time so the DB stores normalised values, and
 * apply it again on read as a safety net for older rows.
 */

import type { Transaction as VendorTransaction } from "@/lib/validators/truelayer";

/**
 * Closed set of categories the engine and scoring code branch on. Keep
 * additions here in sync with the sets in `lib/trajectory/scores.ts` and
 * `lib/trajectory/surplus.ts`.
 */
export const DOMAIN_CATEGORIES = [
  "salary",
  "transfer",
  "savings_transfer",
  "investment",
  "pension",
  "loan_repayment",
  "rent",
  "utilities",
  "groceries",
  "transport",
  "dining",
  "entertainment",
  "shopping",
  "travel",
  "uncategorised",
] as const;

export type DomainCategory = (typeof DOMAIN_CATEGORIES)[number];

const RAW_KEYWORD_RULES: { category: DomainCategory; words: string[] }[] = [
  { category: "savings_transfer", words: ["isa", "savings", "moneybox", "chip", "plum"] },
  { category: "investment", words: ["vanguard", "trading 212", "freetrade", "etoro", "hl.co", "hargreaves"] },
  { category: "pension", words: ["pension", "nest", "aviva pension", "scottish widows", "smart pension"] },
  { category: "loan_repayment", words: ["loan", "klarna", "clearpay", "monzo flex", "credit card", "amex"] },
  { category: "rent", words: ["rent", "landlord", "letting"] },
  { category: "utilities", words: ["british gas", "octopus", "edf", "eon", "edison", "thames water", "council tax", "bt ", "virgin media", "vodafone", "ee ", "o2 ", "sky "] },
  { category: "groceries", words: ["tesco", "sainsbury", "asda", "morrisons", "aldi", "lidl", "waitrose", "co-op", "ocado", "iceland", "marks & spencer"] },
  { category: "transport", words: ["tfl", "uber", "bolt", "lyft", "trainline", "national rail", "lner", "gwr", "stagecoach", "shell", "bp ", "esso"] },
  { category: "dining", words: ["restaurant", "deliveroo", "ubereats", "uber eats", "just eat", "starbucks", "pret", "greggs", "mcdonald", "kfc", "nando", "wagamama", "cafe", "coffee"] },
  { category: "entertainment", words: ["netflix", "spotify", "disney+", "cinema", "odeon", "vue", "playstation", "xbox", "steam"] },
  { category: "shopping", words: ["amazon", "ebay", "asos", "zara", "h&m", "boots", "argos", "ikea", "john lewis", "next "] },
  { category: "travel", words: ["airbnb", "booking.com", "ryanair", "easyjet", "british airways", "ba.com", "expedia", "hotel"] },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compiled rules. Each keyword is matched on word boundaries so short tokens
 * (e.g. "tfl", "bp") don't trigger inside unrelated words ("ne[tfl]ix").
 */
const KEYWORD_RULES = RAW_KEYWORD_RULES.map((rule) => ({
  category: rule.category,
  patterns: rule.words.map(
    (w) => new RegExp(`\\b${escapeRegex(w.trim())}`, "i"),
  ),
}));

/**
 * Normalise a TrueLayer transaction into a closed domain category.
 *
 * Strategy (in order):
 *   1. TRANSFER vendor category → domain "transfer" (filtered out of income/spend).
 *   2. Keyword match on merchant_name + description.
 *   3. Vendor classification hint → best-effort domain mapping.
 *   4. Fall back to "uncategorised".
 */
export function normaliseTransactionCategory(
  tx: Pick<VendorTransaction, "transaction_category" | "merchant_name" | "description" | "amount"> & {
    transaction_classification?: string[];
  },
): DomainCategory {
  if (tx.transaction_category === "TRANSFER") return "transfer";
  if (tx.transaction_category === "CREDIT" && (tx.amount ?? 0) > 0) {
    // Recurring large credits are most likely salary.
    if (looksLikeSalary(tx.description, tx.merchant_name)) return "salary";
  }

  const haystack = `${tx.merchant_name ?? ""} ${tx.description ?? ""}`.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((p) => p.test(haystack))) return rule.category;
  }

  const classification = (tx.transaction_classification ?? []).map((c) => c.toLowerCase());
  for (const c of classification) {
    if (c.includes("food") || c.includes("restaurant")) return "dining";
    if (c.includes("groceries") || c.includes("supermarket")) return "groceries";
    if (c.includes("transport") || c.includes("travel")) return "transport";
    if (c.includes("entertainment")) return "entertainment";
    if (c.includes("shopping") || c.includes("retail")) return "shopping";
    if (c.includes("utilities") || c.includes("bills")) return "utilities";
    if (c.includes("rent") || c.includes("housing")) return "rent";
    if (c.includes("savings")) return "savings_transfer";
    if (c.includes("investment")) return "investment";
    if (c.includes("loan") || c.includes("debt")) return "loan_repayment";
  }

  return "uncategorised";
}

function looksLikeSalary(description: string | undefined, merchant: string | undefined): boolean {
  const text = `${merchant ?? ""} ${description ?? ""}`.toLowerCase();
  return /salary|payroll|wages|stipend/.test(text);
}

/**
 * Re-classify a possibly-legacy stored category. Older rows hold raw
 * TrueLayer enum values (e.g. PURCHASE, DIRECT_DEBIT) or nulls; this maps
 * them to the domain set so the engine never sees vendor strings.
 *
 * Use at read time as a safety net behind the sync-time normaliser.
 */
export function reclassifyStoredCategory(
  stored: string | null,
  description: string | null | undefined,
  merchant: string | null | undefined,
  amount: number,
): DomainCategory {
  if (stored && (DOMAIN_CATEGORIES as readonly string[]).includes(stored)) {
    return stored as DomainCategory;
  }
  return normaliseTransactionCategory({
    transaction_category: stored ?? undefined,
    description: description ?? undefined,
    merchant_name: merchant ?? undefined,
    amount,
  });
}
