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

const NAME: Record<string, string> = { "": "system", dark: "dark", light: "light" };

/** Cycles system → dark → light. The tooltip always names the mode you are in now. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "");
  const next = theme === "" ? "dark" : theme === "dark" ? "light" : "";
  const label = `Theme: ${NAME[theme] ?? "system"}`;
  return (
    <Tooltip label={`${label} — switch to ${NAME[next] ?? "system"}`}>
      <IconButton
        name={theme === "dark" ? "moon" : "sun"}
        label={label}
        title={undefined}
        onClick={() => write(next)}
        className="hover:bg-surface"
      />
    </Tooltip>
  );
}
