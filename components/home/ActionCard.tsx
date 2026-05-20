"use client";

import { useState } from "react";

import type { DashboardAction } from "@/lib/validators/dashboard";
import { ChatSheet } from "@/components/chat/ChatSheet";

const EFFORT_LABEL: Record<DashboardAction["effort"], string> = {
  low: "Low effort",
  medium: "Medium effort",
  high: "High effort",
};

const PARTNER_LABEL: Record<string, string> = {
  moneybox_lisa: "Moneybox",
  vanguard_isa: "Vanguard",
};

export function ActionCard({ action }: { action: DashboardAction }) {
  const [chatOpen, setChatOpen] = useState(false);
  // yearsImpact is negative when an action pulls a goal closer.
  const yearsCloser = Math.abs(action.yearsImpact);

  return (
    <>
      <article
        className="rounded-2xl border p-4"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--surface-secondary)",
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-medium">{action.name}</p>
          <p
            className="shrink-0 text-[14px] font-medium tabular-nums"
            style={{ color: "var(--score-growth)" }}
          >
            −{yearsCloser.toFixed(1)} yrs
          </p>
        </div>
        <p
          className="mt-1.5 text-[13px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {action.description}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-[11px]"
              style={{
                background: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              {EFFORT_LABEL[action.effort]}
            </span>
            {action.affiliateId && (
              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                via {PARTNER_LABEL[action.affiliateId] ?? action.affiliateId}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-1 text-[13px] font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Ask me about this
            <i className="ti ti-arrow-right" aria-hidden="true" />
          </button>
        </div>
      </article>

      <ChatSheet
        open={chatOpen}
        seedMessage={`I'm considering this action to improve my financial trajectory: "${action.name}". ${action.description} Help me understand this action and how to get started.`}
        observation={action.name}
        onClose={() => setChatOpen(false)}
      />
    </>
  );
}
