"use client";

import { useState } from "react";

import type { DashboardCollision, ResolutionOption } from "@/lib/validators/dashboard";
import { ChatSheet } from "@/components/chat/ChatSheet";
import { Sheet } from "./Sheet";

export function CollisionStrip({
  collision,
}: {
  collision: DashboardCollision;
}) {
  const [open, setOpen] = useState(false);
  const [activeOption, setActiveOption] = useState<ResolutionOption | null>(null);

  if (!collision.collides) return null;

  function selectOption(option: ResolutionOption) {
    setOpen(false);
    setActiveOption(option);
  }

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
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium"
          style={{
            background: "var(--text-primary)",
            color: "var(--surface-primary)",
          }}
        >
          Fix it
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Resolve the collision">
        <ul className="mt-3 flex flex-col gap-2">
          {collision.resolutionOptions.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => selectOption(option)}
                className="w-full rounded-xl border p-3.5 text-left"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <p className="text-[14px]">{option.description}</p>
                {option.yearsImpact !== 0 && (
                  <p
                    className="mt-1 text-[12px] tabular-nums"
                    style={{ color: "var(--score-growth)" }}
                  >
                    {option.yearsImpact.toFixed(1)} years
                  </p>
                )}
                <p
                  className="mt-2 flex items-center gap-1 text-[13px] font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  Ask me about this
                  <i className="ti ti-arrow-right" aria-hidden="true" />
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <ChatSheet
        open={activeOption !== null}
        seedMessage={
          activeOption
            ? `I'm considering this resolution to my goal collision: "${activeOption.description}". Help me understand this approach and whether it makes sense for my situation.`
            : ""
        }
        observation={activeOption?.description ?? ""}
        onClose={() => setActiveOption(null)}
      />
    </section>
  );
}
