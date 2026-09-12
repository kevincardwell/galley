"use client";
import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { useBoard } from "./board-context";
import { Icon } from "@/components/ui/icon";

/** "+ Add task" that turns into an input. Enter creates (and stays open for the next one), Esc cancels. */
export function AddTaskInput({ sectionId, className }: { sectionId: string; className?: string }) {
  const board = useBoard();
  const nonce = board.focusRequest?.sectionId === sectionId ? board.focusRequest.nonce : null;
  const [seen, setSeen] = useState(nonce);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  if (nonce !== seen) {
    setSeen(nonce);
    if (nonce !== null) setOpen(true);
  }
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open, nonce]);

  const close = () => { setOpen(false); setValue(""); board.cancelNewTask(); };
  const submit = () => {
    const title = value.trim();
    if (!title) { close(); return; }
    board.createTask(sectionId, title);
    setValue("");
  };

  if (!board.canEdit) return null;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={clsx("inline-flex cursor-pointer items-center gap-1.5 rounded-r px-2 py-1.5 text-[13px] text-ink-3 transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-ink", className)}>
        <Icon name="plus" size={13} /> Add task
      </button>
    );
  }
  return (
    <input
      ref={ref}
      value={value}
      placeholder="What needs doing?"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { if (!value.trim()) close(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
        if (e.key === "Escape") { e.stopPropagation(); close(); }
      }}
      aria-label="New task title"
      className={clsx("w-full rounded-r border border-line bg-surface px-2.5 py-1.5 placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent", className)}
    />
  );
}
