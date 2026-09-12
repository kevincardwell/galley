import { clsx } from "@/lib/clsx";

const tones = { accent: "bg-accent", done: "bg-done", review: "bg-review", late: "bg-late", ink: "bg-ink-2" } as const;

/** Thin progress bar. Give it a label for anything a screen reader should hear. */
export function Meter({ value, max = 100, tone = "accent", label, className, height = 4 }: {
  value: number; max?: number; tone?: keyof typeof tones; label?: string; className?: string; height?: number;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={clsx("w-full overflow-hidden rounded-full bg-line-2", className)}
      style={{ height }}
    >
      <div className={clsx("h-full rounded-full transition-[width] duration-300", tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
