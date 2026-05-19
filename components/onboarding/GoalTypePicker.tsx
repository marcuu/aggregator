"use client";

import { useState } from "react";

import { submitStep3 } from "@/app/onboarding/actions";
import type { GoalType } from "@/lib/validators/goals";

const GOALS: {
  type: GoalType;
  icon: string;
  title: string;
  subtitle: string;
}[] = [
  {
    type: "home",
    icon: "ti-home",
    title: "First home",
    subtitle: "Deposit target, region, timeline",
  },
  {
    type: "wedding",
    icon: "ti-heart",
    title: "Wedding",
    subtitle: "Budget, rough timeline",
  },
  {
    type: "emergency_fund",
    icon: "ti-shield",
    title: "Emergency fund",
    subtitle: "3–6 month runway",
  },
  {
    type: "invest_start",
    icon: "ti-chart-line",
    title: "Start investing",
    subtitle: "ISA, pension, stocks",
  },
];

const MAX_GOALS = 2;

export function GoalTypePicker() {
  const [selected, setSelected] = useState<GoalType[]>([]);

  function toggle(type: GoalType) {
    setSelected((current) => {
      if (current.includes(type)) return current.filter((t) => t !== type);
      if (current.length >= MAX_GOALS) return current;
      return [...current, type];
    });
  }

  return (
    <form action={submitStep3} className="mt-7 flex flex-col gap-5">
      <input type="hidden" name="goal_types" value={selected.join(",")} />

      <div className="flex flex-col gap-2.5">
        {GOALS.map((goal) => {
          const isSelected = selected.includes(goal.type);
          const atLimit = selected.length >= MAX_GOALS && !isSelected;
          return (
            <button
              key={goal.type}
              type="button"
              onClick={() => toggle(goal.type)}
              aria-pressed={isSelected}
              disabled={atLimit}
              className="flex items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-40"
              style={{
                borderColor: isSelected
                  ? "var(--text-primary)"
                  : "var(--border-subtle)",
                background: isSelected
                  ? "var(--surface-secondary)"
                  : "var(--surface-primary)",
              }}
            >
              <i
                className={`ti ${goal.icon} text-xl`}
                aria-hidden="true"
                style={{ color: "var(--text-secondary)" }}
              />
              <span className="flex-1">
                <span className="block text-[15px] font-medium">
                  {goal.title}
                </span>
                <span
                  className="block text-[13px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {goal.subtitle}
                </span>
              </span>
              <i
                className={isSelected ? "ti ti-circle-check" : "ti ti-circle"}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
        Pick one or two. Goals interact — we surface collisions on the next
        screen.
      </p>

      <button
        type="submit"
        disabled={selected.length === 0}
        className="rounded-lg px-4 py-3 text-[15px] font-medium disabled:opacity-40"
        style={{
          background: "var(--text-primary)",
          color: "var(--surface-primary)",
        }}
      >
        Continue
      </button>
    </form>
  );
}
