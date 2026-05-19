"use client";

import { useEffect } from "react";

/** A bottom sheet for drill-downs. Closes on backdrop click or Escape. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[440px] rounded-t-2xl border-t px-5 pb-9 pt-3"
        style={{
          background: "var(--surface-primary)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div
          className="mx-auto mb-4 h-1 w-9 rounded-full"
          style={{ background: "var(--border-subtle)" }}
        />
        {title && <h2 className="text-lg font-medium">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
