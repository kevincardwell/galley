"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "@/lib/clsx";
import { useCommandPalette } from "./command-palette";

/**
 * Top bar shown below `md`, with a "Menu" button that slides the sidebar
 * content in from the left. Closes on backdrop click, Esc, or route change.
 */
export function MobileDrawer({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // The drawer remembers which route it was opened on, so a route change closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === path;
  const setOpen = (next: boolean) => setOpenedOn(next ? path : null);
  const openPalette = useCommandPalette((s) => s.open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpenedOn(null); }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-surface-2 px-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-drawer"
          className="rounded-r border border-line bg-surface px-2.5 py-1 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          Menu
        </button>
        <Link href="/" className="flex items-center gap-2 px-1 font-semibold tracking-tight">
          <span className="relative inline-block size-[18px] rounded bg-ink after:absolute after:inset-[5px] after:border-b-2 after:border-l-2 after:border-surface" />
          Galley
        </Link>
        <button
          type="button"
          onClick={openPalette}
          aria-label="Jump to"
          className="ml-auto flex items-center gap-1.5 rounded-r border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-3 hover:text-ink"
        >
          <span>Jump to…</span><kbd className="text-xs">⌘K</kbd>
        </button>
      </div>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={clsx(
          "fixed inset-0 z-40 bg-ink/40 transition-opacity duration-150 ease-out",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      {/* Panel */}
      <div
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        aria-hidden={!open}
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col gap-5 overflow-y-auto border-r border-line bg-surface-2 px-2.5 py-3.5 transition-transform duration-150 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="absolute right-2 top-2.5 grid size-7 place-items-center rounded text-ink-3 hover:bg-surface hover:text-ink"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
