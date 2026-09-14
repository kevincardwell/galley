"use client";
import { useState, useSyncExternalStore } from "react";

/**
 * The name a client gives on the share pages, remembered in this browser.
 *
 * One name for the whole share view — comments, approvals, files they send and
 * sections they write — so nobody is asked twice.
 */
const NAME_KEY = "galley.guestName";

function readName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function saveName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* private mode; the name still lives for this page load */
  }
  notify();
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === NAME_KEY) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** One name shared by every section on the page, remembered in localStorage. */
export function useGuestName() {
  const stored = useSyncExternalStore(subscribe, readName, () => "");
  // Typing is local until it is committed to storage, so a draft never fights the stored value.
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? stored;
  const update = (n: string) => {
    setDraft(n);
    saveName(n.trim());
  };
  const settle = () => setDraft(null);
  return [name, update, settle] as const;
}
