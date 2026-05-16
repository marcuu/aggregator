"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Triggers a manual sync via /api/ob/sync, then refreshes the page data. */
export function SyncButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "syncing" | "error">("idle");

  async function sync() {
    setState("syncing");
    try {
      const res = await fetch("/api/ob/sync", { method: "POST" });
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
      router.refresh();
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={sync} disabled={state === "syncing"}>
        {state === "syncing" ? "Syncing…" : "Sync now"}
      </Button>
      {state === "error" && (
        <span className="text-sm text-red-600">Sync failed</span>
      )}
    </div>
  );
}
