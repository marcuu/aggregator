import { describe, expect, it } from "vitest";

import { attributeSavingsToGoals, type FinancialState } from "@/lib/finance/state";
import { unsafePence } from "@/lib/money";
import { makeGoal } from "../trajectory/fixtures";

function state(savingsPence: number, liquidPence = savingsPence): FinancialState {
  return {
    savingsBalance: unsafePence(savingsPence),
    liquidBalance: unsafePence(liquidPence),
    monthlySurplus: unsafePence(0),
  };
}

describe("attributeSavingsToGoals", () => {
  it("returns an empty map for no goals", () => {
    expect(attributeSavingsToGoals([], state(500_000)).size).toBe(0);
  });

  it("attributes the whole pool to a single goal, capped at its target", () => {
    const goal = makeGoal({ id: "g1", type: "wedding", target_amount: 20_000 });
    // Pool below target → fully attributed.
    expect(attributeSavingsToGoals([goal], state(500_000)).get("g1")).toBe(500_000);
    // Pool above target → capped at the target (2,000,000 pence).
    expect(attributeSavingsToGoals([goal], state(9_000_000)).get("g1")).toBe(2_000_000);
  });

  it("fills the higher-priority goal first, then spills to the next", () => {
    // £4k home deposit (priority 0) + £10k wedding (priority 2), £5k pool.
    // Priority-fill funds the deposit fully and puts the £1k remainder on the
    // wedding — matching how the projection sequences the same goals.
    const home = makeGoal({ id: "home", type: "home", target_amount: 4_000 });
    const wedding = makeGoal({ id: "wedding", type: "wedding", target_amount: 10_000 });
    // Pass wedding first to prove ordering is by priority, not array order.
    const result = attributeSavingsToGoals([wedding, home], state(500_000)); // £5k pool

    expect(result.get("home")).toBe(400_000); // fully funded (£4k deposit)
    expect(result.get("wedding")).toBe(100_000); // remaining £1k
    // Nothing is stranded: the whole pool is attributed.
    expect((result.get("home") ?? 0) + (result.get("wedding") ?? 0)).toBe(500_000);
  });

  it("caps every goal at its target when the pool exceeds total need", () => {
    const a = makeGoal({ id: "a", type: "wedding", target_amount: 4_000 });
    const b = makeGoal({ id: "b", type: "emergency_fund", target_amount: 6_000 });
    const result = attributeSavingsToGoals([a, b], state(5_000_000)); // £50k pool
    expect(result.get("a")).toBe(400_000);
    expect(result.get("b")).toBe(600_000);
  });

  it("falls back to the liquid balance when there are no savings accounts", () => {
    const goal = makeGoal({ id: "g1", type: "wedding", target_amount: 20_000 });
    const result = attributeSavingsToGoals([goal], state(0, 300_000)); // £3k liquid
    expect(result.get("g1")).toBe(300_000);
  });
});
