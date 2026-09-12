"use client";
import Link from "next/link";
import { clsx } from "@/lib/clsx";
import { Icon, type IconName } from "@/components/ui/icon";
import { isoDate } from "@/lib/dates";
import { CALENDAR_VIEWS, type CalendarView } from "./types";
import { calendarHref, stepAnchor } from "./util";

const VIEW_LABEL: Record<CalendarView, string> = { month: "Month", week: "Week", agenda: "Agenda" };
const STEP_LABEL: Record<CalendarView, string> = { month: "month", week: "week", agenda: "30 days" };

type Props = {
  basePath: string;
  view: CalendarView;
  anchor: Date;
  todayIso: string;
  label: string;
  eyebrow?: string;
  action?: React.ReactNode;
};

export function CalendarHeader({ basePath, view, anchor, todayIso, label, eyebrow, action }: Props) {
  const step = (direction: -1 | 1) => calendarHref(basePath, view, isoDate(stepAnchor(view, anchor, direction)));
  return (
    <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2.5">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="m-0 mb-0.5 text-xs font-medium text-ink-3">{eyebrow}</p>}
        <h1 className="m-0 truncate text-[22px] leading-tight font-semibold tracking-tight">{label}</h1>
      </div>
      <div className="flex items-center gap-1">
        <NavLink href={step(-1)} icon="chevron-left" label={`Previous ${STEP_LABEL[view]}`} />
        <Link
          href={calendarHref(basePath, view, todayIso)}
          className="inline-flex cursor-pointer items-center rounded-r border border-line bg-surface px-2.5 py-1 text-[13px] font-medium transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Today
        </Link>
        <NavLink href={step(1)} icon="chevron-right" label={`Next ${STEP_LABEL[view]}`} />
      </div>
      <div className="flex items-center gap-0.5 rounded-r border border-line p-0.5 max-[699px]:hidden" role="group" aria-label="Calendar view">
        {CALENDAR_VIEWS.map((v) => (
          <Link
            key={v}
            href={calendarHref(basePath, v, isoDate(anchor))}
            aria-current={v === view ? "page" : undefined}
            className={clsx(
              "cursor-pointer rounded-[4px] px-2.5 py-1 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              v === view ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            {VIEW_LABEL[v]}
          </Link>
        ))}
      </div>
      {action}
    </header>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-grid size-7 cursor-pointer place-items-center rounded-r text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent max-sm:size-10"
    >
      <Icon name={icon} />
    </Link>
  );
}
