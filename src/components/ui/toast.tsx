"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clsx } from "@/lib/clsx";
import { Icon } from "@/components/ui/icon";

export type ToastTone = "neutral" | "done" | "late";
export type ToastOptions = { tone?: ToastTone; duration?: number };
type Toast = { id: number; message: string; tone: ToastTone; duration: number };

// Tiny module-level store (same shape as the command palette) so any client
// component can call toast() without a provider.
const MAX = 3;
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const store = {
  subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
  get: () => toasts,
  dismiss: (id: number) => { toasts = toasts.filter((t) => t.id !== id); emit(); },
};
const EMPTY: Toast[] = [];

/** Show a short bottom-centre notice. Safe to call anywhere on the client. Errors linger. */
export function toast(message: string, opts: ToastOptions = {}) {
  const tone = opts.tone ?? "neutral";
  const item: Toast = { id: nextId++, message, tone, duration: opts.duration ?? (tone === "late" ? 6000 : 3200) };
  toasts = [...toasts, item].slice(-MAX);
  emit();
  return item.id;
}

const EXIT_MS = 150;

/** Mount once in the root layout. Renders nothing until a toast is shown. */
export function Toaster() {
  const items = useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => <Item key={t.id} toast={t} />)}
    </div>
  );
}

function Item({ toast: t }: { toast: Toast }) {
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<{ hide?: ReturnType<typeof setTimeout>; remove?: ReturnType<typeof setTimeout> }>({});

  const clear = () => {
    clearTimeout(timers.current.hide);
    clearTimeout(timers.current.remove);
  };
  const schedule = () => {
    clear();
    timers.current.hide = setTimeout(() => setLeaving(true), t.duration);
    timers.current.remove = setTimeout(() => store.dismiss(t.id), t.duration + EXIT_MS);
  };

  useEffect(() => {
    const enter = requestAnimationFrame(() => setShown(true));
    schedule();
    return () => { cancelAnimationFrame(enter); clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.id, t.duration]);

  const visible = shown && !leaving;
  return (
    <div
      role="status"
      // Hovering or focusing holds it open, so a message is never yanked away while being read.
      onMouseEnter={clear}
      onMouseLeave={schedule}
      onFocus={clear}
      onBlur={schedule}
      className={clsx(
        "pointer-events-auto flex items-center gap-2 rounded-r bg-ink px-3 py-1.5 text-[13px] text-surface shadow-[0_1px_2px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.12)]",
        "transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
      )}
    >
      {t.tone !== "neutral" && <span aria-hidden className={clsx("size-1.5 shrink-0 rounded-full", t.tone === "done" ? "bg-done" : "bg-late")} />}
      <span>{t.message}</span>
      <button
        type="button"
        onClick={() => store.dismiss(t.id)}
        aria-label="Dismiss"
        className="-mr-1 grid size-5 shrink-0 cursor-pointer place-items-center rounded text-surface/70 transition-colors hover:bg-surface/15 hover:text-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface"
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}
