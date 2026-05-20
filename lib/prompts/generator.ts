/**
 * Contextual prompt cards for the home screen.
 *
 * Each card surfaces a real signal from the user's trajectory data
 * (scores or goal progress) and carries a seed message that opens the
 * chat sheet pre-loaded with the right question. Every card id is a
 * deterministic hash of its content — dismiss a card and it stays
 * dismissed until the underlying data changes meaningfully.
 */

import type { Scores } from "@/lib/trajectory/types";
import type { GoalType } from "@/lib/validators/goals";

export type PromptSource = "spending" | "growth" | "borrowing" | "goal";

export type PromptCard = {
  id: string;
  source: PromptSource;
  observation: string;
  seedMessage: string;
};

export type PromptGoalSignal = {
  type: GoalType;
  trajectoryAge: number;
};

export type PromptInput = {
  scores: Scores;
  goals: PromptGoalSignal[];
};

const MAX_CARDS = 4;
/** Round numbers into buckets so a 1-unit drift does not resurface a card. */
const SCORE_BUCKET = 5;
const AGE_BUCKET = 0.5;

const GOAL_LABEL: Record<GoalType, string> = {
  home: "first home",
  wedding: "wedding",
  emergency_fund: "emergency fund",
  invest_start: "investing plan",
};

const GOAL_PRIORITY: Record<GoalType, number> = {
  home: 0,
  wedding: 1,
  emergency_fund: 2,
  invest_start: 3,
};

export function generatePromptCards(input: PromptInput): PromptCard[] {
  const cards: PromptCard[] = [];

  // Spending — surface a leak when the cohort score is weak.
  if (input.scores.spending < 55) {
    const bucket = bucketScore(input.scores.spending);
    cards.push({
      id: hash(`spending-low-${bucket}`),
      source: "spending",
      observation: `Your spending score is ${input.scores.spending} — behind the typical peer. Want to find where it is leaking?`,
      seedMessage: `My spending score is ${input.scores.spending}. Walk me through which outflows are dragging it down and the single highest-impact cut I could make this month.`,
    });
  }

  // Growth — positive reinforcement when the savings rate is climbing.
  if (input.scores.growthDelta >= 5) {
    const bucket = bucketScore(input.scores.growth);
    cards.push({
      id: hash(`growth-up-${input.scores.growthDelta}-${bucket}`),
      source: "growth",
      observation: `You moved your growth score up ${input.scores.growthDelta} this week. What would it take to lock that in as your new floor?`,
      seedMessage: `My growth score jumped ${input.scores.growthDelta} points this week. Help me see what changed and how to make this the new normal rather than a one-off.`,
    });
  } else if (input.scores.growth < 45) {
    const bucket = bucketScore(input.scores.growth);
    cards.push({
      id: hash(`growth-low-${bucket}`),
      source: "growth",
      observation: `Your growth score is ${input.scores.growth}. Your monthly surplus is thinner than it could be — want to fix that?`,
      seedMessage: `My growth score is ${input.scores.growth} — I am not putting much aside each month. Where is the realistic ceiling for me, and what is the fastest way to get there?`,
    });
  }

  // Borrowing — flag when debt drag is heavy.
  if (input.scores.borrowing < 50) {
    const bucket = bucketScore(input.scores.borrowing);
    cards.push({
      id: hash(`borrowing-heavy-${bucket}`),
      source: "borrowing",
      observation: `Debt service is taking a meaningful slice of your income. Worth a look at the repayment order?`,
      seedMessage: `My borrowing score is ${input.scores.borrowing}. Talk me through which debts to prioritise repaying first and whether any should be left alone.`,
    });
  }

  // Goal — highlight the highest-priority goal's projected age.
  const primaryGoal = [...input.goals].sort(
    (a, b) => GOAL_PRIORITY[a.type] - GOAL_PRIORITY[b.type],
  )[0];
  if (primaryGoal) {
    const ageBucket = bucketAge(primaryGoal.trajectoryAge);
    const label = GOAL_LABEL[primaryGoal.type];
    cards.push({
      id: hash(`goal-${primaryGoal.type}-${ageBucket}`),
      source: "goal",
      observation: `Your ${label} lands at age ${primaryGoal.trajectoryAge.toFixed(1)} on your current trajectory. Want to pull that forward?`,
      seedMessage: `My ${label} is projected for age ${primaryGoal.trajectoryAge.toFixed(1)}. What single change would bring it forward the most, and by how many months?`,
    });
  }

  return cards.slice(0, MAX_CARDS);
}

function bucketScore(value: number): number {
  return Math.round(value / SCORE_BUCKET) * SCORE_BUCKET;
}

function bucketAge(age: number): number {
  return Math.round(age / AGE_BUCKET) * AGE_BUCKET;
}

/** Deterministic short hash (djb2-style → base36). */
function hash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
