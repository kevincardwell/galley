"use client";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<string>("");
  useEffect(() => { try { setTheme(localStorage.getItem("galley-theme") ?? ""); } catch {} }, []);
  function cycle() {
    const next = theme === "" ? "dark" : theme === "dark" ? "light" : "";
    setTheme(next);
    try { next ? localStorage.setItem("galley-theme", next) : localStorage.removeItem("galley-theme"); } catch {}
    if (next) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme;
  }
  return (
    <button onClick={cycle} className="rounded px-1.5 py-1 text-xs text-ink-3 hover:bg-surface hover:text-ink" title={`Theme: ${theme || "system"}`}>
      {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto"}
    </button>
  );
}
