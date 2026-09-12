"use client";
import { useCallback, useSyncExternalStore } from "react";

const KEY = "galley.tasks.collapsed";
const listeners = new Set<() => void>();
const EMPTY: string[] = [];

// Cached by the raw string so useSyncExternalStore keeps getting the same
// reference until the stored value actually changes.
let raw: string | null = null;
let parsed: string[] = EMPTY;

function read(): string[] {
  let next: string | null = null;
  try {
    next = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (next !== raw) {
    raw = next;
    try {
      const value = next ? JSON.parse(next) : null;
      parsed = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : EMPTY;
    } catch {
      parsed = EMPTY;
    }
  }
  return parsed;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

const serverSnapshot = () => EMPTY;

/** Which sections this device has collapsed. Remembered across visits. */
export function useCollapsed(): { isCollapsed: (id: string) => boolean; toggle: (id: string) => void } {
  const ids = useSyncExternalStore(subscribe, read, serverSnapshot);
  const isCollapsed = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => {
    const current = read();
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode or blocked storage */ }
    listeners.forEach((l) => l());
  }, []);
  return { isCollapsed, toggle };
}
