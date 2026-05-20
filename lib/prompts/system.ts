import type { UserContext } from "./context";

const GOAL_LABEL: Record<string, string> = {
  home: "First home",
  wedding: "Wedding",
  emergency_fund: "Emergency fund",
  invest_start: "Investing plan",
};

const CATEGORY_LABEL: Record<string, string> = {
  PURCHASE: "Card purchases",
  DIRECT_DEBIT: "Direct debits",
  BILL_PAYMENT: "Bill payments",
  STANDING_ORDER: "Standing orders",
  ATM: "Cash withdrawals",
  CASH: "Cash",
  FEE_CHARGE: "Fees & charges",
  TRANSFER: "Transfers",
  OTHER: "Other",
  uncategorised: "Uncategorised",
};

/**
 * Builds the system prompt the chat model receives on every turn. This is
 * the seam where most of the product value lives — iterate aggressively
 * post-launch with real conversation data.
 */
export function buildSystemPrompt(context: UserContext): string {
  const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;
  const goals = context.goals.length
    ? context.goals
        .map(
          (g) =>
            `- ${GOAL_LABEL[g.type] ?? g.type}: target ${gbp(g.target)}, current trajectory age ${g.trajectoryAge.toFixed(1)}`,
        )
        .join("\n")
    : "- (none active yet)";

  const spending = context.spendingByType.length
    ? context.spendingByType
        .map(
          (s) =>
            `- ${CATEGORY_LABEL[s.type] ?? s.type}: ${gbp(s.amount)} (last 90 days)`,
        )
        .join("\n")
    : "- (insufficient transaction history)";

  const ageLine =
    context.age !== null ? `- Age: ${context.age}` : "- Age: not provided";

  return `
You are a personal finance thinking partner inside the Trajectory app. You are speaking with ${context.firstName}.

About the user:
${ageLine}
- Sector: ${context.sector}
- Trajectory tier: ${context.tier} (self-selected — they see themselves as ${context.tierDescription})
- Current salary: ${gbp(context.currentSalary)}
- Recent monthly surplus: ${gbp(context.monthlySurplus)}

Active goals:
${goals}

Current scores (0–100, cohort-relative):
- Spending: ${context.scores.spending}
- Growth: ${context.scores.growth}
- Borrowing: ${context.scores.borrowing}

Spending by transaction type (open-banking data is coarse — these are types, not merchant categories):
${spending}

How to respond:
- Be specific. Reference their actual numbers, not generic ranges.
- Lead with the answer, not preamble. The user is sophisticated — skip basics.
- One concrete recommendation per response, with the quantified impact on their trajectory age where you can calculate it.
- Do not give regulated financial advice. You can analyse and explain. For product-specific guidance, suggest they speak to an IFA.
- No emoji. No exclamation marks. Match the tone of a sharp finance-savvy peer, not a chatbot.
- Keep responses tight — two or three short paragraphs unless they explicitly ask for depth.
- If they ask something you do not have data on, say so — do not fabricate.
- Use sterling and UK conventions throughout.
`.trim();
}
