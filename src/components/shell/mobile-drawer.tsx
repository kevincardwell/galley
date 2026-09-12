"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "@/lib/clsx";
import { Icon, IconButton } from "@/components/ui/icon";
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
        <IconButton
          name="menu"
          label="Menu"
          size={18}
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-drawer"
          className="size-9 border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
        />
        <Link href="/" className="flex cursor-pointer items-center gap-2 px-1 font-semibold tracking-tight">
          <span className="relative inline-block size-[18px] rounded bg-ink after:absolute after:inset-[5px] after:border-b-2 after:border-l-2 after:border-surface" />
          Galley
        </Link>
        <button
          type="button"
          onClick={openPalette}
          aria-keyshortcuts="Meta+K Control+K"
          className="ml-auto flex h-9 cursor-pointer items-center gap-1.5 rounded-r border border-line bg-surface px-2.5 text-[13px] text-ink-3 transition-colors duration-150 ease-out hover:border-ink-3 hover:text-ink-2"
        >
          <Icon name="search" size={15} />
          <span>Search</span>
          <kbd className="tnum text-xs">⌘K</kbd>
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
          "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col gap-5 overflow-y-auto border-r border-line bg-surface-2 px-2.5 py-3.5 shadow-panel transition-transform duration-150 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <IconButton
          name="x"
          label="Close menu"
          onClick={() => setOpen(false)}
          className="absolute top-2.5 right-2 hover:bg-surface"
        />
        {children}
      </div>
    </div>
  );
}
