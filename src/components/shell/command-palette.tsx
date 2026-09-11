"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

// Tiny store so the sidebar button and the keyboard shortcut share one open state.
let isOpen = false;
const listeners = new Set<() => void>();
const store = {
  open: () => { isOpen = true; listeners.forEach((l) => l()); },
  close: () => { isOpen = false; listeners.forEach((l) => l()); },
  subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
  get: () => isOpen,
};
export function useCommandPalette<T>(sel: (s: typeof store) => T): T { return sel(store); }

type Hit = { kind: "workspace" | "task" | "section" | "asset" | "page"; title: string; subtitle?: string; href: string };

export function CommandPalette() {
  const open = useSyncExternalStore(store.subscribe, store.get, () => false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); isOpen ? store.close() : store.open(); }
      if (e.key === "Escape" && isOpen) store.close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) { setQ(""); setHits([]); setActive(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal }).catch(() => null);
      if (res?.ok) { setHits(await res.json()); setActive(0); }
    }, 120);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open]);

  if (!open) return null;
  function go(h: Hit) { store.close(); router.push(h.href); }
  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-[rgba(20,18,14,0.45)] pt-[12vh]" onClick={store.close}>
      <div className="w-[min(92vw,560px)] overflow-hidden rounded-[10px] border border-line bg-surface shadow-panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          id="palette-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && hits[active]) go(hits[active]);
          }}
          placeholder="Search tasks, copy, files, workspaces…"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-base outline-none placeholder:text-ink-3"
        />
        <ul className="m-0 max-h-[50vh] list-none overflow-auto p-1.5">
          {hits.map((h, i) => (
            <li key={h.href + i}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={`flex w-full items-center gap-3 rounded-r px-2.5 py-2 text-left ${i === active ? "bg-accent-soft" : ""}`}
              >
                <span className="w-16 shrink-0 text-xs text-ink-3">{h.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{h.title}</span>
                  {h.subtitle && <span className="block truncate text-xs text-ink-3">{h.subtitle}</span>}
                </span>
              </button>
            </li>
          ))}
          {hits.length === 0 && <li className="px-2.5 py-3 text-ink-3">{q ? "Nothing matches yet." : "Type to search across everything you can see."}</li>}
        </ul>
      </div>
    </div>
  );
}
