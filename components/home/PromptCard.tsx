import Link from "next/link";

/**
 * Placeholder for the Phase 5 AI prompt cards. For now it surfaces a single
 * static nudge when the user has linked at most one institution — a fuller
 * financial picture sharpens every projection.
 */
export function PromptCard({ institutionCount }: { institutionCount: number }) {
  if (institutionCount > 1) return null;

  return (
    <section>
      <h2 className="section-label">Sharpen your trajectory</h2>
      <Link
        href="/dashboard/connect"
        className="mt-3 flex items-center gap-3 rounded-2xl border p-4"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--surface-secondary)",
        }}
      >
        <i
          className="ti ti-building-bank text-xl"
          aria-hidden="true"
          style={{ color: "var(--text-secondary)" }}
        />
        <span className="flex-1">
          <span className="block text-[14px] font-medium">
            Connect more accounts
          </span>
          <span
            className="block text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Every account you link makes your surplus and scores more accurate.
          </span>
        </span>
        <i
          className="ti ti-chevron-right"
          aria-hidden="true"
          style={{ color: "var(--text-tertiary)" }}
        />
      </Link>
    </section>
  );
}
