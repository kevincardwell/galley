"use client";
import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { useBoard } from "./board-context";
import { Icon } from "@/components/ui/icon";

export function AddSection({ className }: { className?: string }) {
  const board = useBoard();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!board.canEdit) return null;
  const close = () => { setOpen(false); setValue(""); };
  const submit = () => {
    const name = value.trim();
    if (name) board.createSection(name);
    close();
  };
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={clsx("inline-flex cursor-pointer items-center gap-1.5 rounded-r px-2 py-1.5 text-[13px] text-ink-3 transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-ink", className)}>
        <Icon name="plus" size={13} /> Add section
      </button>
    );
  }
  return (
    <input
      ref={ref}
      value={value}
      placeholder="Section name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { if (!value.trim()) close(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
        if (e.key === "Escape") { e.stopPropagation(); close(); }
      }}
      aria-label="New section name"
      className={clsx("rounded-r border border-line bg-surface px-2.5 py-1.5 placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent", className)}
    />
  );
}
