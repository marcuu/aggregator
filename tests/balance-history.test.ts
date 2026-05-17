import { describe, expect, it } from "vitest";

import {
  buildBalanceSeries,
  buildBalanceTabs,
  classifyAccountType,
} from "@/lib/balance-history";

const TODAY = new Date("2026-03-23T12:00:00Z");

const account = {
  id: "acc-1",
  account_type: "CHECKING",
  currency: "GBP",
  current_balance: 1000,
};

describe("classifyAccountType", () => {
  it("buckets common account types", () => {
    expect(classifyAccountType("CHECKING")).toBe("checking");
    expect(classifyAccountType("current")).toBe("checking");
    expect(classifyAccountType("SAVINGS")).toBe("savings");
    expect(classifyAccountType("Money Market Savings")).toBe("savings");
    expect(classifyAccountType("CREDIT_CARD")).toBe("other");
    expect(classifyAccountType(null)).toBe("other");
  });
});

describe("buildBalanceSeries", () => {
  it("reconstructs end-of-day balances by walking transactions backward", () => {
    const txs = [
      // -200 today, so yesterday ended at 1200
      { account_id: "acc-1", amount: -200, timestamp: "2026-03-23T09:00:00Z" },
      // +500 yesterday, so the day before ended at 700
      { account_id: "acc-1", amount: 500, timestamp: "2026-03-22T09:00:00Z" },
    ];
    const series = buildBalanceSeries([account], txs, TODAY);
    const byDate = new Map(series.points.map((p) => [p.date, p.balance]));

    expect(byDate.get("2026-03-23")).toBe(1000);
    expect(byDate.get("2026-03-22")).toBe(1200);
    expect(byDate.get("2026-03-21")).toBe(700);
    expect(series.currentBalance).toBe(1000);
    expect(series.accountCount).toBe(1);
  });

  it("ignores transactions belonging to other accounts", () => {
    const txs = [
      { account_id: "other", amount: -999, timestamp: "2026-03-22T09:00:00Z" },
    ];
    const series = buildBalanceSeries([account], txs, TODAY);
    const byDate = new Map(series.points.map((p) => [p.date, p.balance]));
    expect(byDate.get("2026-03-22")).toBe(1000);
  });

  it("derives the daily rate from spend/income velocity", () => {
    // Net -£100 moved across a 10-day span → -£10/day velocity.
    const txs = [
      { account_id: "acc-1", amount: -40, timestamp: "2026-03-13T09:00:00Z" },
      { account_id: "acc-1", amount: -60, timestamp: "2026-03-23T09:00:00Z" },
    ];
    const series = buildBalanceSeries([account], txs, TODAY);
    expect(series.dailyRate).toBe(-10);
  });

  it("nets income against spend in the velocity", () => {
    // +£300 income and -£100 spend over a 10-day span → +£20/day.
    const txs = [
      { account_id: "acc-1", amount: 300, timestamp: "2026-03-13T09:00:00Z" },
      { account_id: "acc-1", amount: -100, timestamp: "2026-03-23T09:00:00Z" },
    ];
    const series = buildBalanceSeries([account], txs, TODAY);
    expect(series.dailyRate).toBe(20);
  });

  it("reports a zero rate when there is too little history", () => {
    const txs = [
      { account_id: "acc-1", amount: -50, timestamp: "2026-03-23T09:00:00Z" },
    ];
    expect(buildBalanceSeries([account], txs, TODAY).dailyRate).toBe(0);
  });
});

describe("buildBalanceTabs", () => {
  it("splits accounts into checking and savings series", () => {
    const accounts = [
      { ...account, id: "chk", account_type: "CHECKING", current_balance: 800 },
      {
        id: "sav",
        account_type: "SAVINGS",
        currency: "GBP",
        current_balance: 2000,
      },
    ];
    const tabs = buildBalanceTabs(accounts, [], TODAY);
    expect(tabs.all.currentBalance).toBe(2800);
    expect(tabs.checking.currentBalance).toBe(800);
    expect(tabs.savings.currentBalance).toBe(2000);
    expect(tabs.checking.accountCount).toBe(1);
  });
});
