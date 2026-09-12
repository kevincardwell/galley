"use client";
import { clsx } from "@/lib/clsx";
import { Icon } from "@/components/ui/icon";

export function TaskCheckbox({ done, onToggle, disabled, label, className }: { done: boolean; onToggle: () => void; disabled?: boolean; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      onPointerDown={(e) => e.stopPropagation()}
      className={clsx(
        "grid size-4 shrink-0 cursor-pointer place-items-center rounded border-[1.5px] transition-colors duration-150 ease-out disabled:cursor-default",
        done ? "border-accent bg-accent text-accent-ink" : "border-ink-3 bg-transparent hover:border-ink",
        className,
      )}
    >
      {done && <Icon name="check" size={11} strokeWidth={3} />}
    </button>
  );
}
