import Link from "next/link";
import { redirect } from "next/navigation";

import { getRequestUserId } from "@/lib/supabase/server";
import { ProgressDots } from "@/components/onboarding/ProgressDots";

export default async function StepOB() {
  const userId = await getRequestUserId();
  if (!userId) redirect("/login");

  return (
    <>
      <ProgressDots current={5} total={5} />
      <h1 className="mt-8 text-2xl font-medium">Ground your forecast in reality</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
        Connecting your bank lets us calculate your real monthly surplus and
        count savings balances you already have — so the trajectory you&apos;re
        about to see is built on your actual numbers, not estimates.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {[
          "Real monthly surplus from your spending",
          "Savings balances counted toward your goals",
          "Smarter emergency fund sizing",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[14px]">
            <span
              className="mt-0.5 h-4 w-4 shrink-0 rounded-full text-center text-[10px] font-semibold leading-4"
              style={{
                background: "var(--text-primary)",
                color: "var(--surface-primary)",
              }}
            >
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>

      <p
        className="mt-5 text-[12px] leading-relaxed"
        style={{ color: "var(--text-tertiary)" }}
      >
        Read-only access via TrueLayer. We never store your credentials and
        can&apos;t move money.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <a
          href="/api/ob/connect?from=onboarding"
          className="rounded-lg px-4 py-3 text-center text-[15px] font-medium"
          style={{
            background: "var(--text-primary)",
            color: "var(--surface-primary)",
          }}
        >
          Connect your bank
        </a>
        <Link
          href="/onboarding/reveal"
          className="rounded-lg px-4 py-3 text-center text-[15px]"
          style={{ color: "var(--text-secondary)" }}
        >
          Skip for now
        </Link>
      </div>
    </>
  );
}
