"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";

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

const KIND_ICON: Record<Hit["kind"], IconName> = { workspace: "board", task: "checklist", section: "text", asset: "image", page: "file" };

export function CommandPalette() {
  const open = useSyncExternalStore(store.subscribe, store.get, () => false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) store.close(); else store.open();
      }
      if (e.key === "Escape" && isOpen) store.close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return open ? <PaletteBody /> : null;
}

/** Mounted fresh on every open, so the query and results always start empty. */
function PaletteBody() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  // A native modal dialog: the browser handles the focus trap, Escape and the backdrop, which is
  // the part a hand-rolled overlay kept getting wrong.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    d.showModal();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      if (d.open) d.close();
    };
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal }).catch(() => null);
      if (res?.ok) { setHits(await res.json()); setActive(0); }
    }, 120);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  // The highlighted row is not focused (the input keeps focus), so bring it into view by hand.
  useEffect(() => {
    document.getElementById(`palette-hit-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(h: Hit) { store.close(); router.push(h.href); }
  const activeId = hits[active] ? `palette-hit-${active}` : undefined;

  return (
    <dialog
      ref={dialog}
      onClose={store.close}
      onCancel={store.close}
      onClick={(e) => { if (e.target === dialog.current) store.close(); }}
      aria-label="Search everything"
      className="mx-auto mt-[12vh] mb-auto w-[min(92vw,560px)] max-w-none max-h-none overflow-hidden rounded-[10px] border border-line bg-surface p-0 shadow-panel backdrop:bg-[rgba(20,18,14,0.45)]"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Icon name="search" size={17} className="text-ink-3" />
        <input
          ref={input}
          autoFocus
          id="palette-q"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="palette-list"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.max(0, hits.length - 1))); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && hits[active]) go(hits[active]);
          }}
          placeholder="Search tasks, copy, files, workspaces…"
          aria-label="Search everything"
          className="w-full bg-transparent py-3 text-base outline-none placeholder:text-ink-3"
        />
        <kbd className="shrink-0">Esc</kbd>
      </div>
      <ul id="palette-list" role="listbox" aria-label="Results" className="m-0 max-h-[50vh] list-none overflow-auto p-1.5">
        {hits.map((h, i) => (
          <li
            key={`${h.kind}:${h.href}`}
            id={`palette-hit-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(h)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-r px-2.5 py-2 text-left transition-colors duration-150 ease-out ${i === active ? "bg-accent-soft" : "hover:bg-surface-2"}`}
          >
            <span className={`grid size-6 shrink-0 place-items-center rounded-full ${i === active ? "text-accent-text" : "text-ink-3"}`}>
              <Icon name={KIND_ICON[h.kind] ?? "dot"} size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{h.title}</span>
              {h.subtitle && <span className="block truncate text-xs text-ink-3">{h.subtitle}</span>}
            </span>
            <span className="shrink-0 text-xs text-ink-3">{h.kind}</span>
          </li>
        ))}
      </ul>
      {hits.length === 0 && (
        <p role="status" className="m-0 px-4 pt-0.5 pb-3 text-ink-3">
          {q ? "Nothing matches yet." : "Type to search across everything you can see."}
        </p>
      )}
    </dialog>
  );
}
