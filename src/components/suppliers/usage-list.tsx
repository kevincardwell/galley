import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { Icon } from "@/components/ui/icon";
import { formatMoney, STATUS_LABEL, STATUS_TONE, type SupplierUsage } from "./shared";

/** Which projects use this supplier. Projects the reader is not on are counted, never named. */
export function UsageList({ usage, hidden }: { usage: SupplierUsage[]; hidden: number }) {
  if (usage.length === 0 && hidden === 0) {
    return <p className="m-0 text-[13px] text-ink-3">Not on a project yet. Open a project&rsquo;s Suppliers tab to add them.</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <ul className="m-0 flex list-none flex-col p-0">
        {usage.map((u) => (
          <li key={u.id} className="border-b border-line-2 last:border-b-0">
            <Link
              href={`/w/${u.workspaceSlug}/suppliers`}
              className="group flex cursor-pointer items-start gap-2 rounded-r px-2 py-2.5 transition-colors hover:bg-surface-2"
            >
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: u.accent }} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{u.workspaceName}</span>
                  <Pill tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</Pill>
                  {u.cost !== null && <span className="tnum ml-auto text-[13px] text-ink-2">{formatMoney(u.cost)}</span>}
                </span>
                {u.note && <span className="mt-0.5 block text-[13px] text-ink-3">{u.note}</span>}
              </span>
              <Icon name="chevron-right" size={14} className="mt-1 text-ink-3 transition-colors group-hover:text-ink" />
            </Link>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="m-0 px-2 pt-1 text-xs text-ink-3">
          <span className="tnum">{hidden}</span> more on {hidden === 1 ? "a project" : "projects"} you are not on.
        </p>
      )}
    </div>
  );
}
