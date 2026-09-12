import Link from "next/link";
import { clsx } from "@/lib/clsx";
import { Pill } from "@/components/ui/pill";
import { ContactLines, Stars, TagList } from "./bits";
import { formatMoneyRounded, type SupplierRow } from "./shared";

/**
 * One supplier in the directory grid. The name carries a stretched link so the whole card is
 * clickable without nesting anchors; the contact links sit above it.
 */
export function SupplierCard({ supplier }: { supplier: SupplierRow }) {
  const archived = supplier.archivedAt !== null;
  const used = supplier.projectCount;
  return (
    <li
      className={clsx(
        "relative flex flex-col gap-2.5 rounded-lg border p-4 transition-colors duration-150",
        archived ? "border-line-2 bg-surface-2 text-ink-2 hover:border-line" : "border-line bg-surface hover:border-ink-3",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="m-0 mb-0.5 truncate text-xs font-medium text-ink-3">{supplier.category ?? "Supplier"}</p>
          <h2 className="m-0 text-[15px] leading-tight font-semibold">
            <Link href={`/suppliers/${supplier.id}`} className="cursor-pointer after:absolute after:inset-0 after:content-['']">
              <span className="line-clamp-2">{supplier.name}</span>
            </Link>
          </h2>
        </div>
        {archived ? <Pill tone="draft">Archived</Pill> : <Stars value={supplier.rating} className="mt-0.5" />}
      </div>

      <ContactLines supplier={supplier} />
      <TagList tags={supplier.tags} />

      <p className="m-0 mt-auto flex flex-wrap items-center gap-x-1.5 pt-1 text-xs text-ink-3">
        {used === 0 ? (
          <span>Not on a project yet</span>
        ) : (
          <>
            <span className="tnum">
              Used on {used} project{used === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span className="tnum">{formatMoneyRounded(supplier.bookedTotal)} booked</span>
          </>
        )}
      </p>
    </li>
  );
}
