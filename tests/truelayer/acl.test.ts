import { describe, expect, it } from "vitest";

import {
  normaliseTransactionCategory,
  reclassifyStoredCategory,
} from "@/lib/truelayer/acl";

describe("normaliseTransactionCategory", () => {
  it("maps the TRANSFER vendor category to the domain transfer category", () => {
    expect(
      normaliseTransactionCategory({
        transaction_category: "TRANSFER",
        amount: -500,
      }),
    ).toBe("transfer");
  });

  it("classifies a known grocer by merchant name", () => {
    expect(
      normaliseTransactionCategory({
        transaction_category: "PURCHASE",
        merchant_name: "TESCO STORES 3411",
        amount: -42.5,
      }),
    ).toBe("groceries");
  });

  it("classifies food delivery as dining", () => {
    expect(
      normaliseTransactionCategory({
        transaction_category: "PURCHASE",
        description: "DELIVEROO ORDER 8821",
        amount: -23.9,
      }),
    ).toBe("dining");
  });

  it("recognises a salary credit", () => {
    expect(
      normaliseTransactionCategory({
        transaction_category: "CREDIT",
        description: "ACME LTD SALARY",
        amount: 320000,
      }),
    ).toBe("salary");
  });

  it("falls back to uncategorised for unknown merchants", () => {
    expect(
      normaliseTransactionCategory({
        transaction_category: "PURCHASE",
        merchant_name: "SOME OBSCURE VENDOR",
        amount: -10,
      }),
    ).toBe("uncategorised");
  });

  it("uses classification hints when no keyword matches", () => {
    expect(
      normaliseTransactionCategory({
        transaction_category: "PURCHASE",
        merchant_name: "Local Shop",
        amount: -10,
        transaction_classification: ["Shopping", "Retail"],
      }),
    ).toBe("shopping");
  });
});

describe("reclassifyStoredCategory", () => {
  it("passes through values already in the domain set", () => {
    expect(reclassifyStoredCategory("groceries", null, null, -10)).toBe("groceries");
  });

  it("re-maps a legacy raw vendor enum", () => {
    expect(reclassifyStoredCategory("TRANSFER", null, null, -10)).toBe("transfer");
  });

  it("re-maps a legacy null using merchant keywords", () => {
    expect(reclassifyStoredCategory(null, "Netflix.com", "Netflix", -9.99)).toBe(
      "entertainment",
    );
  });
});
