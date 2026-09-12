"use client";
import { useId, useState } from "react";
import { clsx } from "@/lib/clsx";

/** Hover/focus label for a control whose meaning is not obvious from its shape. */
export function Tooltip({ label, children, side = "top" }: { label: string; children: React.ReactNode; side?: "top" | "bottom" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      <span aria-describedby={open ? id : undefined} className="inline-flex">{children}</span>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={clsx(
            "pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 rounded-r bg-ink px-2 py-1 text-xs whitespace-nowrap text-surface shadow-panel",
            side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
