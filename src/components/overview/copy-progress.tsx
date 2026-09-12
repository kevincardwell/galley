import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Meter } from "@/components/ui/meter";

export type PageProgress = { id: string; slug: string; title: string; total: number; approved: number; review: number };

/** One row per page: how much of its copy is signed off, and what is waiting on whom. */
export function CopyProgress({ slug, pages }: { slug: string; pages: PageProgress[] }) {
  if (pages.length === 0) {
    return (
      <p className="m-0 flex items-center gap-2 rounded-r border border-line-2 bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">
        <Icon name="text" size={15} className="text-ink-3" />
        No pages yet.{" "}
        <Link href={`/w/${slug}/copy`} className="cursor-pointer underline underline-offset-[3px] hover:text-ink">
          Add the first one
        </Link>
      </p>
    );
  }
  return (
    <ul className="m-0 list-none divide-y divide-line-2 border-y border-line-2 p-0">
      {pages.map((p) => {
        const done = p.total > 0 && p.approved === p.total;
        return (
          <li key={p.id}>
            <Link
              href={`/w/${slug}/copy/${p.slug}`}
              className="flex cursor-pointer items-center gap-3 px-1 py-2 transition-colors duration-150 ease-out hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1 truncate text-[13px]">{p.title}</span>
              {p.total === 0 ? (
                <span className="text-xs text-ink-3">No sections yet</span>
              ) : (
                <>
                  {p.review > 0 && <span className="tnum shrink-0 text-xs font-medium text-review">{p.review} in review</span>}
                  <span className="w-20 shrink-0 max-sm:hidden">
                    <Meter value={p.approved} max={p.total} tone={done ? "done" : "accent"} label={`${p.title}: ${p.approved} of ${p.total} approved`} />
                  </span>
                  <span className={`tnum w-14 shrink-0 text-right text-xs ${done ? "text-done" : "text-ink-2"}`}>
                    {p.approved} of {p.total}
                  </span>
                </>
              )}
              <Icon name="chevron-right" size={14} className="text-ink-3" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
