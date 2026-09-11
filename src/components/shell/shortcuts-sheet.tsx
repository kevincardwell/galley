"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

type Row = { keys: string[]; label: string };
type Group = { title: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    title: "Global",
    rows: [
      { keys: ["⌘", "K"], label: "Jump to anything" },
      { keys: ["?"], label: "This sheet" },
      { keys: ["Esc"], label: "Close" },
    ],
  },
  {
    title: "Tasks",
    rows: [
      { keys: ["n"], label: "New task" },
      { keys: ["j", "k"], label: "Move down, up" },
      { keys: ["space"], label: "Mark done" },
      { keys: ["↵"], label: "Open task" },
    ],
  },
  {
    title: "Copy",
    rows: [
      { keys: ["⌘", "S"], label: "Save now" },
      { keys: ["⌘", "B"], label: "Bold" },
      { keys: ["⌘", "I"], label: "Italic" },
    ],
  },
  {
    title: "Files",
    rows: [
      { keys: ["←", "→"], label: "Move between files" },
      { keys: ["↵"], label: "Open viewer" },
      { keys: ["Esc"], label: "Close viewer" },
    ],
  },
];

/** Mounted once in the app layout. `?` opens it when nothing editable has focus. */
export function ShortcutsSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      // Another modal (task delete, lightbox…) owns the keyboard; leave it alone.
      if (!open && document.querySelector("dialog[open]")) return;
      e.preventDefault();
      setOpen((v) => !v);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts">
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={`shortcuts-${g.title}`}>
            <h3 id={`shortcuts-${g.title}`} className="m-0 mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-2">{g.title}</h3>
            <dl className="m-0 flex flex-col gap-1">
              {g.rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-4 text-[13px]">
                  <dt className="text-ink-2">{r.label}</dt>
                  <dd className="m-0 flex items-center gap-1">
                    {r.keys.map((k, i) => (
                      <Key key={i}>{k}</Key>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="m-0 mt-5 text-xs text-ink-3">On Windows and Linux, ⌘ is Ctrl.</p>
    </Dialog>
  );
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="min-w-5 text-center">{children}</kbd>;
}
