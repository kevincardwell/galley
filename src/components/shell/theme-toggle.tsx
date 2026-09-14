"use client";
import { useSyncExternalStore } from "react";
import { IconButton } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";

const KEY = "galley-theme";
const listeners = new Set<() => void>();
function read() { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } }
function write(next: string) {
  try { if (next) localStorage.setItem(KEY, next); else localStorage.removeItem(KEY); } catch {}
  if (next) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

// "" is light: nothing stored means no data-theme attribute, which is the
// light palette. Following the operating system is a choice people make, not
// what they get before they have chosen anything.
const NAME: Record<string, string> = { "": "light", light: "light", dark: "dark", system: "system" };
const ICON: Record<string, "sun" | "moon" | "settings"> = { "": "sun", light: "sun", dark: "moon", system: "settings" };

/** Cycles light → dark → follow the system. The tooltip always names the mode you are in now. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "");
  const next = theme === "dark" ? "system" : theme === "system" ? "" : "dark";
  const label = `Theme: ${NAME[theme] ?? "light"}`;
  return (
    <Tooltip label={`${label} — switch to ${NAME[next] ?? "light"}`}>
      <IconButton
        name={ICON[theme] ?? "sun"}
        label={label}
        title={undefined}
        onClick={() => write(next)}
        className="hover:bg-surface"
      />
    </Tooltip>
  );
}
