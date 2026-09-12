"use client";
import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon, IconButton } from "@/components/ui/icon";
import { Meter } from "@/components/ui/meter";
import { useBoard, isTempId } from "./board-context";
import type { SectionWithTasks } from "./types";

type Props = {
  section: SectionWithTasks;
  index: number;
  count: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
};

export function SectionHeader({ section, index, count, collapsed, onToggleCollapse, className }: Props) {
  const board = useBoard();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const [confirm, setConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const done = section.tasks.filter((t) => t.status === "done").length;
  const total = section.tasks.length;
  const complete = total > 0 && done === total;
  const locked = !board.canEdit || isTempId(section.id);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Native <details> stays open until told otherwise; close it on any press outside.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && e.target instanceof Node && !menu.contains(e.target)) menu.open = false;
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const commit = () => {
    const next = name.trim();
    setEditing(false);
    if (!next || next === section.name) { setName(section.name); return; }
    board.renameSection(section.id, next);
  };
  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };

  return (
    <div className={clsx("group/head flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${section.name}` : `Collapse ${section.name}`}
        title={collapsed ? "Expand section" : "Collapse section"}
        className="-ml-1 grid size-6 shrink-0 cursor-pointer place-items-center rounded-r text-ink-3 transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-ink"
      >
        <Icon name="chevron-down" size={14} className={clsx("transition-transform duration-150 ease-out", collapsed && "-rotate-90")} />
      </button>

      {editing ? (
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { e.stopPropagation(); setName(section.name); setEditing(false); }
          }}
          aria-label="Section name"
          className="-mx-1 min-w-0 rounded-[4px] border border-line bg-surface px-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-accent"
        />
      ) : (
        <button
          onClick={() => { if (!locked) { setName(section.name); setEditing(true); } }}
          disabled={locked}
          title={locked ? undefined : "Rename section"}
          className="-mx-1 min-w-0 cursor-pointer truncate rounded-[4px] px-1 text-sm font-semibold transition-colors duration-150 ease-out hover:bg-surface-2 disabled:cursor-default disabled:hover:bg-transparent"
        >
          {section.name}
        </button>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden w-12 shrink-0 sm:block">
          <Meter value={done} max={total} tone={complete ? "done" : "accent"} label={`${section.name}: ${done} of ${total} done`} />
        </span>
        <span className="tnum text-xs whitespace-nowrap text-ink-3">{done} of {total}</span>
      </div>

      {!locked && (
        <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 ease-out group-hover/head:opacity-100 focus-within:opacity-100">
          <IconButton name="plus" label={`Add task to ${section.name}`} title="Add task" size={15} onClick={() => board.requestNewTask(section.id)} />
          <IconButton name="pencil" label={`Rename ${section.name}`} title="Rename section" size={14} onClick={() => { setName(section.name); setEditing(true); }} />
          <details ref={menuRef} className="relative">
            <summary
              aria-label={`Move ${section.name}`}
              title="Move section"
              className="inline-grid size-7 cursor-pointer list-none place-items-center rounded-r text-ink-3 transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-ink [&::-webkit-details-marker]:hidden"
            >
              <Icon name="more" size={15} />
            </summary>
            <div className="absolute right-0 z-20 mt-1 flex w-40 flex-col rounded-r border border-line bg-surface py-1 shadow-panel">
              <MenuItem disabled={index === 0} onClick={() => { closeMenu(); board.moveSection(section.id, -1); }}>Move up</MenuItem>
              <MenuItem disabled={index === count - 1} onClick={() => { closeMenu(); board.moveSection(section.id, 1); }}>Move down</MenuItem>
            </div>
          </details>
          <IconButton name="trash" tone="danger" label={`Delete ${section.name}`} title="Delete section" size={14} disabled={count <= 1} onClick={() => setConfirm(true)} />
        </div>
      )}

      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`Delete “${section.name}”?`}>
        <p className="m-0 text-ink-2">
          {total === 0 ? "The section is empty, so nothing else changes." : `Its ${total} ${total === 1 ? "task moves" : "tasks move"} to the first remaining section.`}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setConfirm(false); board.deleteSection(section.id); }}>Delete section</Button>
        </div>
      </Dialog>
    </div>
  );
}

function MenuItem({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer px-3 py-1.5 text-left text-[13px] transition-colors duration-150 ease-out hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
