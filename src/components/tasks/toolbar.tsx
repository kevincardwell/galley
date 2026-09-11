"use client";
import { clsx } from "@/lib/clsx";
import { Button } from "@/components/ui/button";
import type { TaskView } from "./types";

const VIEWS: { value: TaskView; label: string }[] = [
  { value: "list", label: "List" },
  { value: "board", label: "Board" },
];

export function Toolbar({ view, onView, mine, onMine, canEdit, onNew }: {
  view: TaskView;
  onView: (v: TaskView) => void;
  mine: boolean;
  onMine: (v: boolean) => void;
  canEdit: boolean;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-2.5">
      <div role="radiogroup" aria-label="View" className="inline-flex rounded-r border border-line bg-surface-2 p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            role="radio"
            aria-checked={view === v.value}
            onClick={() => onView(v.value)}
            className={clsx(
              "rounded-[4px] px-2.5 py-0.5 text-[13px] font-medium transition-colors duration-150 ease-out",
              view === v.value ? "bg-surface text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <button
        aria-pressed={mine}
        onClick={() => onMine(!mine)}
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-medium transition-colors duration-150 ease-out",
          mine ? "border-accent-line bg-accent-soft text-accent" : "border-line text-ink-2 hover:text-ink",
        )}
      >
        <span className={clsx("size-1.5 rounded-full", mine ? "bg-accent" : "bg-ink-3")} />
        Assigned to me
      </button>
      <span className="ml-auto hidden items-center gap-1.5 text-xs text-ink-3 md:inline-flex">
        <kbd>n</kbd> new <span className="mx-0.5">·</span> <kbd>j</kbd><kbd>k</kbd> move <span className="mx-0.5">·</span> <kbd>space</kbd> done <span className="mx-0.5">·</span> <kbd>↵</kbd> open
      </span>
      {canEdit && <Button variant="primary" size="sm" onClick={onNew} className="ml-auto md:ml-0">New task</Button>}
    </div>
  );
}
