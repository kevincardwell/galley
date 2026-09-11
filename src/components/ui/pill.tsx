import { clsx } from "@/lib/clsx";

type Tone = "accent" | "review" | "done" | "draft" | "late" | "neutral";
const tones: Record<Tone, string> = {
  accent: "border-accent-line text-accent bg-surface",
  review: "bg-review-soft text-review border-transparent",
  done: "bg-done-soft text-done border-transparent",
  draft: "bg-surface-2 text-ink-2 border-transparent",
  late: "bg-late-soft text-late border-transparent",
  neutral: "border-line text-ink-2 bg-surface",
};

export function Pill({ tone = "neutral", dot = true, children, className }: { tone?: Tone; dot?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-xs font-medium", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
