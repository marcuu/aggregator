import { describe, expect, it } from "vitest";

import { rankActions } from "@/lib/trajectory/actions";
import { makeGoal, makeProfile } from "./fixtures";

const profile = makeProfile();
const homeGoal = makeGoal({ type: "home" });
const investGoal = makeGoal({ type: "invest_start", deposit_pct: null });

describe("rankActions", () => {
  it("ranks by impact-to-effort ratio, highest first", () => {
    const actions = rankActions(profile, [homeGoal], [], 28.4);
    const ratios = actions.map(
      (a) => Math.abs(a.yearsImpact) / { low: 1, medium: 2, high: 3 }[a.effort],
    );
    const sorted = [...ratios].sort((a, b) => b - a);
    expect(ratios).toEqual(sorted);
    // open_lisa has the best ratio (1.2 impact / low effort).
    expect(actions[0].id).toBe("open_lisa");
  });

  it("only returns actions that help — every impact is negative", () => {
    const actions = rankActions(profile, [homeGoal], [], 28.4);
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(action.yearsImpact).toBeLessThan(0);
    }
  });

  it("filters out actions that do not apply to the user's goals", () => {
    // stocks_isa applies to invest_start only — absent for a home-only user.
    const homeActions = rankActions(profile, [homeGoal], [], 28.4);
    expect(homeActions.map((a) => a.id)).not.toContain("stocks_isa");

    const investActions = rankActions(profile, [investGoal], [], 28.4);
    expect(investActions.map((a) => a.id)).toContain("stocks_isa");
  });

  it("includes 'all'-scoped actions regardless of goal type", () => {
    const actions = rankActions(profile, [investGoal], [], 28.4);
    expect(actions.map((a) => a.id)).toContain("pension_match");
  });

  it("excludes goal-specific actions when there are no goals", () => {
    const actions = rankActions(profile, [], [], 28.4);
    const ids = actions.map((a) => a.id);
    expect(ids).not.toContain("open_lisa");
    expect(ids).toContain("negotiate_salary");
  });
});
