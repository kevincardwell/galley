import Link from "next/link";
import { clsx } from "@/lib/clsx";
import { Icon } from "@/components/ui/icon";
import type { FacetCount } from "@/lib/queries/suppliers";

export type DirectoryFilters = { q: string; category: string; tag: string; archived: boolean };

export const DIRECTORY_PATH = "/suppliers";

/** Builds a directory URL, keeping the filters you did not change. */
export function directoryHref(f: Partial<DirectoryFilters>, base: DirectoryFilters): string {
  const next = { ...base, ...f };
  const p = new URLSearchParams();
  if (next.q) p.set("q", next.q);
  if (next.category) p.set("category", next.category);
  if (next.tag) p.set("tag", next.tag);
  if (next.archived) p.set("archived", "1");
  const s = p.toString();
  return s ? `${DIRECTORY_PATH}?${s}` : DIRECTORY_PATH;
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={clsx(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] whitespace-nowrap transition-colors duration-150",
        on ? "border-ink bg-ink text-surface" : "border-line text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

const N = ({ n }: { n: number }) => <span className="tnum opacity-70">{n}</span>;

/** Search, category chips, tag chips and the archived toggle. All links, so it works without JS. */
export function FilterBar({ filters, categories, tags, total }: { filters: DirectoryFilters; categories: FacetCount[]; tags: FacetCount[]; total: number }) {
  const href = (f: Partial<DirectoryFilters>) => directoryHref(f, filters);
  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={DIRECTORY_PATH} method="get" role="search" className="flex min-w-[200px] flex-1 items-center gap-2 rounded-r border border-line bg-surface px-2.5 py-1.5 transition-colors focus-within:ring-2 focus-within:ring-accent sm:max-w-[320px]">
          <Icon name="search" size={15} className="text-ink-3" />
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Search name, category or notes"
            aria-label="Search suppliers"
            className="w-full min-w-0 bg-transparent text-ink placeholder:text-ink-3 focus:outline-none"
          />
          {filters.category && <input type="hidden" name="category" value={filters.category} />}
          {filters.tag && <input type="hidden" name="tag" value={filters.tag} />}
          {filters.archived && <input type="hidden" name="archived" value="1" />}
        </form>
        {filters.q && (
          <Link href={href({ q: "" })} scroll={false} className="inline-flex cursor-pointer items-center gap-1 rounded-r px-2 py-1 text-[13px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
            <Icon name="x" size={13} />
            Clear search
          </Link>
        )}
        <Chip href={href({ archived: !filters.archived })} on={filters.archived}>
          <Icon name="archive" size={13} />
          Show archived
        </Chip>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip href={href({ category: "" })} on={!filters.category}>
            All <N n={total} />
          </Chip>
          {categories.map((c) => (
            <Chip key={c.value} href={href({ category: filters.category === c.value ? "" : c.value })} on={filters.category === c.value}>
              {c.value} <N n={c.count} />
            </Chip>
          ))}
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((t) => (
            <Chip key={t.value} href={href({ tag: filters.tag === t.value ? "" : t.value })} on={filters.tag === t.value}>
              #{t.value} <N n={t.count} />
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
