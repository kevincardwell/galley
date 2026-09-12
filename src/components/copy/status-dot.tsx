import { clsx } from "@/lib/clsx";

const tones = { done: "bg-done", review: "bg-review", draft: "bg-draft" } as const;

/** Status as a dot. Pass `title` so hovering (and a screen reader) names the status. */
export function StatusDot({ tone, className, title }: { tone: keyof typeof tones; className?: string; title?: string }) {
  return (
    <span
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      title={title}
      className={clsx("inline-block size-[7px] shrink-0 rounded-full", tones[tone], className)}
    />
  );
}
