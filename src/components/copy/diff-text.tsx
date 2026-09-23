import { clsx } from "@/lib/clsx";
import { changedParagraphs, type PlainDiff } from "@/lib/copy/diff";

/** A word-level diff as running text: removed words struck through in red, added ones in green. */
export function DiffText({ diff, className }: { diff: PlainDiff; className?: string }) {
  return (
    <p className={clsx("m-0 whitespace-pre-wrap text-ink", className)}>
      {diff.parts.map((p, i) => (
        <span
          key={i}
          className={clsx(
            p.removed && "rounded-[3px] bg-late-soft text-late line-through decoration-late/60",
            p.added && "rounded-[3px] bg-done-soft text-done",
          )}
        >
          {p.value}
        </span>
      ))}
    </p>
  );
}

/** The paragraphs changed between two texts, each as its own diff. */
export function ChangedParagraphs({ from, to, className }: { from: string; to: string; className?: string }) {
  const diffs = changedParagraphs(from, to);
  return (
    <div className="flex flex-col gap-1.5">
      {diffs.map((d, i) => (
        <DiffText key={i} diff={d} className={className} />
      ))}
    </div>
  );
}
