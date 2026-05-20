import { describe, expect, it } from "vitest";

import { generatePromptCards } from "@/lib/prompts/generator";
import type { Scores } from "@/lib/trajectory/types";

const baselineScores: Scores = {
  spending: 70,
  growth: 70,
  borrowing: 70,
  spendingDelta: 0,
  growthDelta: 0,
  borrowingDelta: 0,
};

describe("generatePromptCards", () => {
  it("returns no cards when the user is doing fine across the board", () => {
    expect(
      generatePromptCards({ scores: baselineScores, goals: [] }),
    ).toEqual([]);
  });

  it("surfaces a spending card when the spending score is weak", () => {
    const cards = generatePromptCards({
      scores: { ...baselineScores, spending: 42 },
      goals: [],
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].source).toBe("spending");
    expect(cards[0].observation).toContain("42");
  });

  it("surfaces the positive growth card on a meaningful jump", () => {
    const cards = generatePromptCards({
      scores: { ...baselineScores, growth: 78, growthDelta: 7 },
      goals: [],
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].source).toBe("growth");
    expect(cards[0].seedMessage.toLowerCase()).toContain("jumped 7");
  });

  it("caps the result at four cards even when many signals fire", () => {
    const cards = generatePromptCards({
      scores: {
        spending: 30,
        growth: 80,
        growthDelta: 8,
        borrowing: 30,
        spendingDelta: 0,
        borrowingDelta: 0,
      },
      goals: [
        { type: "home", trajectoryAge: 36.2 },
        { type: "wedding", trajectoryAge: 30.5 },
      ],
    });
    expect(cards.length).toBeLessThanOrEqual(4);
    expect(cards.length).toBeGreaterThan(0);
  });

  it("emits the same id for the same bucketed inputs (stable across small drifts)", () => {
    // Both round to the 40-bucket, so dismissal should persist.
    const a = generatePromptCards({
      scores: { ...baselineScores, spending: 41 },
      goals: [],
    });
    const b = generatePromptCards({
      scores: { ...baselineScores, spending: 42 },
      goals: [],
    });
    expect(a[0].id).toBe(b[0].id);
  });

  it("emits a different id when the bucketed value moves", () => {
    const a = generatePromptCards({
      scores: { ...baselineScores, spending: 41 },
      goals: [],
    });
    const c = generatePromptCards({
      scores: { ...baselineScores, spending: 30 },
      goals: [],
    });
    expect(a[0].id).not.toBe(c[0].id);
  });

  it("targets the highest-priority goal for the goal card", () => {
    const cards = generatePromptCards({
      scores: baselineScores,
      goals: [
        { type: "invest_start", trajectoryAge: 27 },
        { type: "home", trajectoryAge: 30 },
      ],
    });
    const goalCard = cards.find((c) => c.source === "goal");
    expect(goalCard).toBeDefined();
    expect(goalCard!.observation).toContain("first home");
  });
});
