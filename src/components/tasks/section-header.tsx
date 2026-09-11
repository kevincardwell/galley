"use client";
import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useBoard, isTempId } from "./board-context";
import { DotsIcon } from "./icons";
import type { SectionWithTasks } from "./types";

export function SectionHeader({ section, index, count, className }: { section: SectionWithTasks; index: number; count: number; className?: string }) {
  const board = useBoard();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const [confirm, setConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const done = section.tasks.filter((t) => t.status === "done").length;
  const total = section.tasks.length;
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
          className="-mx-1 rounded-[4px] border border-line bg-surface px-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-accent"
        />
      ) : (
        <button
          onClick={() => { if (!locked) { setName(section.name); setEditing(true); } }}
          disabled={locked}
          title={locked ? undefined : "Rename section"}
          className="-mx-1 truncate rounded-[4px] px-1 text-sm font-semibold hover:bg-surface-2 disabled:cursor-default disabled:hover:bg-transparent"
        >
          {section.name}
        </button>
      )}
      <span className="tnum text-xs text-ink-3">{done} of {total}</span>
      {!locked && (
        <details ref={menuRef} className="relative ml-auto">
          <summary className="grid size-6 cursor-pointer list-none place-items-center rounded text-ink-3 opacity-0 transition-opacity duration-150 hover:bg-surface-2 hover:text-ink group-hover/head:opacity-100 focus-visible:opacity-100 [[open]>&]:opacity-100 [&::-webkit-details-marker]:hidden" aria-label={`Section actions for ${section.name}`}>
            <DotsIcon />
          </summary>
          <div className="absolute right-0 z-20 mt-1 flex w-44 flex-col rounded-r border border-line bg-surface py-1 shadow-panel">
            <MenuItem onClick={() => { closeMenu(); setName(section.name); setEditing(true); }}>Rename</MenuItem>
            <MenuItem onClick={() => { closeMenu(); board.requestNewTask(section.id); }}>Add task</MenuItem>
            <MenuItem disabled={index === 0} onClick={() => { closeMenu(); board.moveSection(section.id, -1); }}>Move up</MenuItem>
            <MenuItem disabled={index === count - 1} onClick={() => { closeMenu(); board.moveSection(section.id, 1); }}>Move down</MenuItem>
            <MenuItem disabled={count <= 1} danger onClick={() => { closeMenu(); setConfirm(true); }}>Delete section</MenuItem>
          </div>
        </details>
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

function MenuItem({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx("px-3 py-1.5 text-left text-[13px] hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent", danger && "text-late")}
    >
      {children}
    </button>
  );
}
