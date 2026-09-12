import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { formatDue } from "@/lib/format";
import { QuickToggle } from "./quick-toggle";

export type UpNextTask = { id: string; title: string; dueOn: string | null; assigneeName?: string | null };

/** The few tasks that come next, tickable without leaving the page. */
export function UpNext({ slug, tasks }: { slug: string; tasks: UpNextTask[] }) {
  if (tasks.length === 0) {
    return (
      <p className="m-0 flex items-center gap-2 rounded-r border border-line-2 bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">
        <Icon name="check-circle" size={15} className="text-done" />
        Nothing open. Everything on the list is done.
      </p>
    );
  }
  return (
    <ul className="m-0 list-none divide-y divide-line-2 border-y border-line-2 p-0">
      {tasks.map((t) => {
        const due = formatDue(t.dueOn);
        return (
          <li key={t.id} className="group flex items-center gap-2.5 px-1 py-2 transition-colors duration-150 ease-out hover:bg-surface-2">
            <QuickToggle taskId={t.id} title={t.title} />
            <Link href={`/w/${slug}/tasks?task=${t.id}`} className="min-w-0 flex-1 cursor-pointer truncate text-[13px] hover:underline">
              {t.title}
            </Link>
            {t.assigneeName && <span className="shrink-0 text-xs text-ink-3 max-sm:hidden">{t.assigneeName}</span>}
            {due.label && (
              <span
                className={`tnum shrink-0 text-xs ${due.tone === "late" ? "font-medium text-late" : due.tone === "soon" ? "font-medium text-review" : "text-ink-2"}`}
              >
                {due.label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
