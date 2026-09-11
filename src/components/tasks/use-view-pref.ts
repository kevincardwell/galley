"use client";
import { useCallback, useSyncExternalStore } from "react";
import type { TaskView } from "./types";

const KEY = "galley.tasks.view";
const listeners = new Set<() => void>();

function read(): TaskView | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "board" || v === "list" ? v : null;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

const serverSnapshot = (): TaskView | null => null;

/** The view the user last picked on this device, or null before they have picked one. */
export function useViewPref(): [TaskView | null, (view: TaskView) => void] {
  const stored = useSyncExternalStore(subscribe, read, serverSnapshot);
  const set = useCallback((view: TaskView) => {
    try { window.localStorage.setItem(KEY, view); } catch { /* private mode or blocked storage */ }
    listeners.forEach((l) => l());
  }, []);
  return [stored, set];
}
