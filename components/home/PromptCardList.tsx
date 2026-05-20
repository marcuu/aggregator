"use client";

import { useState } from "react";

import { ChatSheet } from "@/components/chat/ChatSheet";
import type { DashboardPromptCard } from "@/lib/validators/dashboard";

const SOURCE_ICON: Record<DashboardPromptCard["source"], string> = {
  spending: "ti-wallet",
  growth: "ti-trending-up",
  borrowing: "ti-credit-card",
  goal: "ti-target",
};

const SOURCE_COLOUR: Record<DashboardPromptCard["source"], string> = {
  spending: "var(--score-spending)",
  growth: "var(--score-growth)",
  borrowing: "var(--score-borrowing)",
  goal: "var(--text-primary)",
};

export function PromptCardList({ cards }: { cards: DashboardPromptCard[] }) {
  const [visible, setVisible] = useState(cards);
  const [active, setActive] = useState<DashboardPromptCard | null>(null);

  if (visible.length === 0) return null;

  async function dismiss(card: DashboardPromptCard) {
    setVisible((current) => current.filter((c) => c.id !== card.id));
    // Fire-and-forget: a transient network failure isn't worth blocking
    // the dismissal; on next dashboard load it'll just reappear once.
    try {
      await fetch("/api/prompts/dismiss", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ promptId: card.id }),
      });
    } catch {
      // ignored — the card stays hidden for this session
    }
  }

  return (
    <section>
      <h2 className="section-label">For you</h2>
      <div className="mt-3 flex flex-col gap-3">
        {visible.map((card) => (
          <article
            key={card.id}
            className="rounded-2xl border p-4"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--surface-secondary)",
            }}
          >
            <div className="flex items-start gap-3">
              <i
                className={`ti ${SOURCE_ICON[card.source]} text-xl`}
                aria-hidden="true"
                style={{ color: SOURCE_COLOUR[card.source] }}
              />
              <p className="flex-1 text-[14px] leading-relaxed">
                {card.observation}
              </p>
              <button
                type="button"
                onClick={() => dismiss(card)}
                aria-label="Dismiss"
                className="-mr-1 -mt-1 rounded-md p-1 text-[14px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setActive(card)}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Ask me about this
              <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>

      <ChatSheet
        open={active !== null}
        seedMessage={active?.seedMessage ?? ""}
        observation={active?.observation ?? ""}
        onClose={() => setActive(null)}
      />
    </section>
  );
}
