"use client";
import { useSyncExternalStore } from "react";

const KEY = "galley-theme";
const listeners = new Set<() => void>();
function read() { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } }
function write(next: string) {
  try { if (next) localStorage.setItem(KEY, next); else localStorage.removeItem(KEY); } catch {}
  if (next) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "");
  const next = theme === "" ? "dark" : theme === "dark" ? "light" : "";
  return (
    <button onClick={() => write(next)} className="rounded px-1.5 py-1 text-xs text-ink-3 hover:bg-surface hover:text-ink" title={`Theme: ${theme || "system"}`}>
      {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto"}
    </button>
  );
}
