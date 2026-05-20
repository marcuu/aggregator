"use client";

import { useState } from "react";

import type { DashboardCollision } from "@/lib/validators/dashboard";
import type { Goal } from "@/lib/validators/goals";
import { formatCurrency } from "@/lib/utils";
import { Sheet } from "./Sheet";

const GOAL_LABEL: Record<string, string> = {
  home: "House deposit",
  wedding: "Wedding",
  emergency_fund: "Emergency fund",
  invest_start: "Investment fund",
};

type Step =
  | { kind: "list" }
  | { kind: "sequence_confirm" }
  | { kind: "reduce_select" }
  | { kind: "reduce_amount"; goalId: string; goalType: string; amount: string }
  | { kind: "extend_select" }
  | { kind: "extend_date"; goalId: string; goalType: string; date: string }
  | { kind: "done" };

function addMonthsToToday(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

async function patchGoal(id: string, patch: Record<string, unknown>) {
  const res = await fetch(`/api/goals/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("update failed");
}

export function CollisionStrip({
  collision,
  goals,
  onResolved,
}: {
  collision: DashboardCollision;
  goals: Goal[];
  onResolved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "list" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!collision.collides) return null;

  const goalA = goals.find((g) => g.id === collision.goalAId);
  const goalB = goals.find((g) => g.id === collision.goalBId);

  function openSheet() {
    setStep({ kind: "list" });
    setError(null);
    setOpen(true);
  }

  function closeSheet() {
    setOpen(false);
    setStep({ kind: "list" });
    setError(null);
  }

  async function applySequence() {
    if (!collision.goalBId || collision.goalAMonthsToGoal == null || collision.goalBMonthsToGoal == null) return;
    setLoading(true);
    setError(null);
    try {
      const newDate = addMonthsToToday(collision.goalAMonthsToGoal + collision.goalBMonthsToGoal);
      await patchGoal(collision.goalBId, { rough_target_date: newDate });
      setStep({ kind: "done" });
      onResolved();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function applyReduceAmount(goalId: string, amountStr: string) {
    const amount = parseInt(amountStr, 10);
    if (!amount || amount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await patchGoal(goalId, { target_amount: amount });
      setStep({ kind: "done" });
      onResolved();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function applyExtendDate(goalId: string, date: string) {
    if (!date) {
      setError("Pick a date.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await patchGoal(goalId, { rough_target_date: date });
      setStep({ kind: "done" });
      onResolved();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const sheetTitle = (() => {
    switch (step.kind) {
      case "list": return "Resolve the collision";
      case "sequence_confirm": return "Sequence goals";
      case "reduce_select": return "Reduce a target";
      case "reduce_amount": return `New target — ${GOAL_LABEL[step.goalType] ?? step.goalType}`;
      case "extend_select": return "Extend a timeline";
      case "extend_date": return `New date — ${GOAL_LABEL[step.goalType] ?? step.goalType}`;
      case "done": return "Applied";
    }
  })();

  return (
    <section>
      <div
        className="flex items-center justify-between rounded-xl border p-4"
        style={{
          borderColor: "var(--score-spending)",
          background: "var(--surface-secondary)",
        }}
      >
        <div className="pr-3">
          <p className="text-[14px] font-medium">Your goals collide</p>
          <p
            className="mt-0.5 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            They overlap by {collision.overlapMonths} months — funding both at
            once stretches the same surplus.
          </p>
        </div>
        <button
          type="button"
          onClick={openSheet}
          className="shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium"
          style={{
            background: "var(--text-primary)",
            color: "var(--surface-primary)",
          }}
        >
          Fix it
        </button>
      </div>

      <Sheet open={open} onClose={closeSheet} title={sheetTitle}>
        {/* ── Option list ── */}
        {step.kind === "list" && (
          <ul className="mt-3 flex flex-col gap-2">
            {collision.resolutionOptions.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border p-3.5 text-left"
                  style={{ borderColor: "var(--border-subtle)" }}
                  onClick={() => {
                    setError(null);
                    if (option.id === "sequence") setStep({ kind: "sequence_confirm" });
                    else if (option.id === "reduce_target") setStep({ kind: "reduce_select" });
                    else if (option.id === "extend_timeline") setStep({ kind: "extend_select" });
                  }}
                >
                  <p className="text-[14px]">{option.description}</p>
                  {option.yearsImpact !== 0 && (
                    <p
                      className="mt-1 text-[12px] tabular-nums"
                      style={{ color: "var(--score-growth)" }}
                    >
                      {option.yearsImpact.toFixed(1)} yrs
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ── Sequence: confirm ── */}
        {step.kind === "sequence_confirm" && goalA && goalB && (
          <div className="mt-3">
            <div
              className="rounded-xl border p-3.5 text-[14px]"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <p>
                Complete{" "}
                <span className="font-medium">{GOAL_LABEL[goalA.type]}</span>{" "}
                first — ~{((collision.goalAMonthsToGoal ?? 0) / 12).toFixed(1)} yrs.
              </p>
              <p className="mt-2">
                Then{" "}
                <span className="font-medium">{GOAL_LABEL[goalB.type]}</span>{" "}
                target date moves to ~{((collision.goalBMonthsToGoal ?? 0) / 12).toFixed(1)} yrs
                after that.
              </p>
            </div>
            {error && (
              <p className="mt-2 text-[13px]" style={{ color: "var(--score-spending)" }}>
                {error}
              </p>
            )}
            <ActionRow
              onBack={() => setStep({ kind: "list" })}
              onApply={applySequence}
              loading={loading}
            />
          </div>
        )}

        {/* ── Reduce: pick goal ── */}
        {step.kind === "reduce_select" && goalA && goalB && (
          <div className="mt-3">
            <p className="mb-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Which goal's target would you like to reduce?
            </p>
            <div className="flex flex-col gap-2">
              {[goalA, goalB].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="w-full rounded-xl border p-3.5 text-left"
                  style={{ borderColor: "var(--border-subtle)" }}
                  onClick={() =>
                    setStep({
                      kind: "reduce_amount",
                      goalId: g.id,
                      goalType: g.type,
                      amount: String(g.target_amount),
                    })
                  }
                >
                  <p className="text-[14px] font-medium">{GOAL_LABEL[g.type]}</p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    Current target: {formatCurrency(g.target_amount, "GBP")}
                  </p>
                </button>
              ))}
            </div>
            <BackLink onClick={() => setStep({ kind: "list" })} />
          </div>
        )}

        {/* ── Reduce: enter amount ── */}
        {step.kind === "reduce_amount" && (
          <div className="mt-3">
            <label
              className="mb-1.5 block text-[13px]"
              style={{ color: "var(--text-secondary)" }}
            >
              New target (£)
            </label>
            <input
              type="number"
              value={step.amount}
              onChange={(e) => setStep({ ...step, amount: e.target.value })}
              className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-[15px]"
              style={{ borderColor: "var(--border-subtle)" }}
              min={1}
            />
            {error && (
              <p className="mt-2 text-[13px]" style={{ color: "var(--score-spending)" }}>
                {error}
              </p>
            )}
            <ActionRow
              onBack={() => setStep({ kind: "reduce_select" })}
              onApply={() => applyReduceAmount(step.goalId, step.amount)}
              loading={loading}
            />
          </div>
        )}

        {/* ── Extend: pick goal ── */}
        {step.kind === "extend_select" && goalA && goalB && (
          <div className="mt-3">
            <p className="mb-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Which goal's date would you like to push out?
            </p>
            <div className="flex flex-col gap-2">
              {[goalA, goalB].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="w-full rounded-xl border p-3.5 text-left"
                  style={{ borderColor: "var(--border-subtle)" }}
                  onClick={() =>
                    setStep({
                      kind: "extend_date",
                      goalId: g.id,
                      goalType: g.type,
                      date: g.rough_target_date ?? addMonthsToToday(36),
                    })
                  }
                >
                  <p className="text-[14px] font-medium">{GOAL_LABEL[g.type]}</p>
                  {g.rough_target_date && (
                    <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                      Current:{" "}
                      {new Date(g.rough_target_date).toLocaleDateString("en-GB", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </button>
              ))}
            </div>
            <BackLink onClick={() => setStep({ kind: "list" })} />
          </div>
        )}

        {/* ── Extend: enter date ── */}
        {step.kind === "extend_date" && (
          <div className="mt-3">
            <label
              className="mb-1.5 block text-[13px]"
              style={{ color: "var(--text-secondary)" }}
            >
              New target date
            </label>
            <input
              type="date"
              value={step.date}
              onChange={(e) => setStep({ ...step, date: e.target.value })}
              className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-[15px]"
              style={{ borderColor: "var(--border-subtle)" }}
              min={new Date().toISOString().slice(0, 10)}
            />
            {error && (
              <p className="mt-2 text-[13px]" style={{ color: "var(--score-spending)" }}>
                {error}
              </p>
            )}
            <ActionRow
              onBack={() => setStep({ kind: "extend_select" })}
              onApply={() => applyExtendDate(step.goalId, step.date)}
              loading={loading}
            />
          </div>
        )}

        {/* ── Done ── */}
        {step.kind === "done" && (
          <div className="mt-4 text-center">
            <p className="text-[32px]">✓</p>
            <p className="mt-2 text-[15px] font-medium">Goal updated</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Your trajectory is recalculating.
            </p>
            <button
              type="button"
              onClick={closeSheet}
              className="mt-5 w-full rounded-lg py-2.5 text-[14px] font-medium"
              style={{
                background: "var(--text-primary)",
                color: "var(--surface-primary)",
              }}
            >
              Close
            </button>
          </div>
        )}
      </Sheet>
    </section>
  );
}

function ActionRow({
  onBack,
  onApply,
  loading,
}: {
  onBack: () => void;
  onApply: () => void;
  loading: boolean;
}) {
  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        className="flex-1 rounded-lg border py-2.5 text-[14px]"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        Back
      </button>
      <button
        type="button"
        onClick={onApply}
        disabled={loading}
        className="flex-1 rounded-lg py-2.5 text-[14px] font-medium disabled:opacity-40"
        style={{
          background: "var(--text-primary)",
          color: "var(--surface-primary)",
        }}
      >
        {loading ? "Applying…" : "Apply"}
      </button>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 text-[13px]"
      style={{ color: "var(--text-secondary)" }}
    >
      ← Back
    </button>
  );
}
