import type { UserProfile } from "@/lib/validators/profile";
import type { Goal } from "@/lib/validators/goals";
import type { Transaction, Action, ActionEffort } from "./types";

/** Hardcoded action library for v1. Move to the DB when the partner list grows. */
const ACTION_LIBRARY: Omit<Action, "yearsImpact">[] = [
  {
    id: "open_lisa",
    name: "Open a Lifetime ISA",
    description:
      "Free £1,000/year from the government, up to age 40. Eligible for first home purchase up to £450k.",
    effort: "low",
    affiliateId: "moneybox_lisa",
    applicableTo: "home",
  },
  {
    id: "reduce_dining",
    name: "Cut dining to cohort median",
    description:
      "You're currently above peer median for your sector. A modest reduction compounds.",
    effort: "medium",
    affiliateId: null,
    applicableTo: "all",
  },
  {
    id: "negotiate_salary",
    name: "Negotiate to cohort 75th percentile",
    description:
      "Your salary is tracking below fast-track peers in your sector.",
    effort: "high",
    affiliateId: null,
    applicableTo: "all",
  },
  {
    id: "pension_match",
    name: "Capture full employer pension match",
    description: "Free money. Most grad schemes match up to 6%.",
    effort: "low",
    affiliateId: null,
    applicableTo: "all",
  },
  {
    id: "stocks_isa",
    name: "Open a Stocks & Shares ISA",
    description:
      "Once your emergency fund is built, get surplus into a diversified index fund.",
    effort: "low",
    affiliateId: "vanguard_isa",
    applicableTo: "invest_start",
  },
];

const EFFORT_WEIGHT: Record<ActionEffort, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Rank actions by impact-to-effort ratio. Only actions that help (negative
 * yearsImpact) and that apply to the user's goals are returned.
 */
export function rankActions(
  profile: UserProfile,
  goals: Goal[],
  transactions: Transaction[],
  baseTrajectoryAge: number,
): Action[] {
  return ACTION_LIBRARY.filter(
    (a) =>
      a.applicableTo === "all" ||
      goals.some((g) => g.type === a.applicableTo),
  )
    .map((a) => ({
      ...a,
      yearsImpact: estimateActionImpact(a.id, profile, goals, transactions),
    }))
    .filter((a) => a.yearsImpact < 0)
    .sort((a, b) => ratio(b) - ratio(a));
}

function ratio(action: Action): number {
  return Math.abs(action.yearsImpact) / EFFORT_WEIGHT[action.effort];
}

/**
 * Heuristic impact constants for v1. Calibrate from real user data later —
 * product credibility comes from the surrounding accuracy, not from each
 * action being correct to 0.1 years.
 */
function estimateActionImpact(
  actionId: string,
  profile: UserProfile,
  goals: Goal[],
  transactions: Transaction[],
): number {
  void profile;
  void goals;
  void transactions;

  switch (actionId) {
    case "open_lisa":
      return -1.2;
    case "reduce_dining":
      return -0.4;
    case "negotiate_salary":
      return -1.8;
    case "pension_match":
      return -0.6;
    case "stocks_isa":
      return -0.3;
    default:
      return 0;
  }
}
