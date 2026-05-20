"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  DashboardResponseSchema,
  type DashboardResponse,
  type AccountSummary,
} from "@/lib/validators/dashboard";
import { formatCurrency } from "@/lib/utils";
import { ScoreTrinity } from "./ScoreTrinity";
import { CollisionStrip } from "./CollisionStrip";
import { GoalCard } from "./GoalCard";
import { ActionCard } from "./ActionCard";
import { PromptCard } from "./PromptCard";
import { PromptCardList } from "./PromptCardList";

const SECTOR_LABEL: Record<string, string> = {
  banking: "Banking",
  law: "Law",
  stem: "STEM",
  consulting: "Consulting",
  other: "Other",
};
const TIER_LABEL: Record<string, string> = {
  steady: "Steady",
  fast: "Fast track",
  high: "High",
};

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: DashboardResponse };

export function HomeScreen() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const parsed = DashboardResponseSchema.safeParse(json);
        setState(
          parsed.success
            ? { status: "ready", data: parsed.data }
            : { status: "error" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-5 px-5 pb-12 pt-7">
      {state.status === "loading" && <LoadingState />}
      {state.status === "error" && <ErrorState />}
      {state.status === "ready" && (
        <Dashboard data={state.data} onRefresh={() => setRefreshKey((k) => k + 1)} />
      )}
    </main>
  );
}

function Dashboard({ data, onRefresh }: { data: DashboardResponse; onRefresh: () => void }) {
  return (
    <>
      <header>
        <p className="text-[22px] font-medium">Trajectory</p>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {SECTOR_LABEL[data.profile.sector]} ·{" "}
          {TIER_LABEL[data.profile.trajectory_tier]}
        </p>
      </header>

      {data.truelayerExpired && (
        <Link
          href="/dashboard/connect"
          className="rounded-xl border p-3.5 text-[13px]"
          style={{
            borderColor: "var(--score-spending)",
            color: "var(--text-secondary)",
          }}
        >
          A bank connection has expired. Reconnect it so your numbers stay
          accurate.
        </Link>
      )}

      <ScoreTrinity scores={data.scores} />

      {data.accounts.length > 0 && (
        <AccountsSection accounts={data.accounts} />
      )}

      {data.collision && (
        <CollisionStrip
          collision={data.collision}
          goals={data.goals.map((g) => g.goal)}
          onResolved={onRefresh}
        />
      )}

      <PromptCardList cards={data.promptCards} />

      {data.goals.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="section-label">Your goals</h2>
            <Link
              href="/trajectory"
              className="text-[12px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              View timeline →
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {data.goals.map((entry) => (
              <GoalCard
                key={entry.goal.id}
                entry={entry}
                snapshots={data.snapshots}
              />
            ))}
          </div>
        </section>
      )}

      {data.actions.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="section-label">Action plan</h2>
            {data.actionsTotal > data.actions.length && (
              <span
                className="text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                All {data.actionsTotal}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {data.actions.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        </section>
      )}

      <PromptCard institutionCount={data.institutionCount} />
    </>
  );
}

function AccountsSection({ accounts }: { accounts: AccountSummary[] }) {
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="section-label">Accounts</h2>
        <Link
          href="/dashboard/accounts"
          className="text-[12px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          View all
        </Link>
      </div>
      <div
        className="mt-3 overflow-hidden rounded-xl"
        style={{ background: "var(--surface-secondary)" }}
      >
        {accounts.map((account, i) => (
          <div
            key={account.id}
            className="flex items-center justify-between px-4 py-3"
            style={
              i < accounts.length - 1
                ? { borderBottom: "1px solid var(--border)" }
                : undefined
            }
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">
                {account.display_name ?? account.account_type ?? "Account"}
              </p>
              <p
                className="truncate text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {account.institution_name ?? account.account_type ?? "—"}
              </p>
            </div>
            <p className="ml-4 shrink-0 text-[15px] font-semibold tabular-nums">
              {formatCurrency(account.current_balance, account.currency)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="h-10 w-40 animate-pulse rounded-lg bg-[var(--surface-secondary)]" />
      <div className="h-28 animate-pulse rounded-xl bg-[var(--surface-secondary)]" />
      <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-secondary)]" />
      <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-secondary)]" />
    </div>
  );
}

function ErrorState() {
  return (
    <div className="mt-10 text-center">
      <p className="text-[15px] font-medium">We couldn&apos;t load your trajectory</p>
      <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Something went wrong fetching your numbers. Refresh to try again.
      </p>
    </div>
  );
}
