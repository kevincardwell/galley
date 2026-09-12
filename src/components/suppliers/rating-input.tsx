"use client";
import { clsx } from "@/lib/clsx";
import { Icon } from "@/components/ui/icon";

const STARS = [1, 2, 3, 4, 5] as const;

/** Five toggle stars. Clicking the star you are already on clears the rating. */
export function RatingInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex items-center gap-0.5">
      {STARS.map((n) => {
        const on = value !== null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of 5`}
            title={`${n} out of 5`}
            onClick={() => onChange(value === n ? null : n)}
            className="inline-grid size-7 cursor-pointer place-items-center rounded-r transition-colors hover:bg-surface-2"
          >
            <Icon name="star" size={16} className={clsx("transition-colors", on ? "fill-current text-accent" : "text-ink-3")} />
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onChange(null)}
        disabled={value === null}
        className="ml-1 cursor-pointer rounded-r px-1.5 py-1 text-xs text-ink-3 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        Clear
      </button>
    </div>
  );
}
