"use client";
import { clsx } from "@/lib/clsx";
import { Button } from "@/components/ui/button";
import { Icon, IconButton, type IconName } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import type { TaskView } from "./types";

const VIEWS: { value: TaskView; label: string; icon: IconName }[] = [
  { value: "list", label: "List", icon: "list" },
  { value: "board", label: "Board", icon: "board" },
];

type Props = {
  view: TaskView;
  onView: (v: TaskView) => void;
  mine: boolean;
  onMine: (v: boolean) => void;
  query: string;
  onQuery: (v: string) => void;
  canEdit: boolean;
  onNew: () => void;
};

/** Opens the app-wide shortcuts sheet, which owns the `?` key. */
const openShortcuts = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));

export function Toolbar({ view, onView, mine, onMine, query, onQuery, canEdit, onNew }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 sm:px-6">
      <div role="radiogroup" aria-label="View" className="inline-flex rounded-r border border-line bg-surface-2 p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            role="radio"
            aria-checked={view === v.value}
            title={`${v.label} view`}
            onClick={() => onView(v.value)}
            className={clsx(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[13px] font-medium transition-colors duration-150 ease-out",
              view === v.value ? "bg-surface text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink",
            )}
          >
            <Icon name={v.icon} size={14} />
            {v.label}
          </button>
        ))}
      </div>

      <button
        aria-pressed={mine}
        onClick={() => onMine(!mine)}
        className={clsx(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium transition-colors duration-150 ease-out",
          mine ? "border-accent-line bg-accent-soft text-accent" : "border-line text-ink-2 hover:bg-surface-2 hover:text-ink",
        )}
      >
        <Icon name="user" size={13} />
        Assigned to me
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon name="search" size={14} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape" && query) { e.stopPropagation(); onQuery(""); } }}
            placeholder="Search tasks"
            aria-label="Search tasks by title"
            className="w-40 rounded-r border border-line bg-surface py-1 pr-2.5 pl-7 text-[13px] placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent sm:w-52 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        <span className="hidden md:inline-flex">
          <Tooltip label="n new · j k move · space done · ↵ open">
            <IconButton name="info" title={undefined} label="Keyboard shortcuts" onClick={openShortcuts} />
          </Tooltip>
        </span>

        {canEdit && <Button variant="primary" size="sm" icon="plus" onClick={onNew}>New task</Button>}
      </div>
    </div>
  );
}
