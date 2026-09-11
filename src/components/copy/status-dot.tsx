import { clsx } from "@/lib/clsx";

const tones = { done: "bg-done", review: "bg-review", draft: "bg-draft" } as const;

export function StatusDot({ tone, className, title }: { tone: keyof typeof tones; className?: string; title?: string }) {
  return <span aria-hidden={!title} title={title} className={clsx("inline-block size-[7px] shrink-0 rounded-full", tones[tone], className)} />;
}
