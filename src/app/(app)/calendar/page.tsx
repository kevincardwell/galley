import { requireUser } from "@/lib/auth/current";
import { editableWorkspaceIds, scheduleWindow, upcoming } from "@/lib/queries/schedule";
import { isoDate, parseIsoDate, startOfDay } from "@/lib/dates";
import { CalendarScreen } from "@/components/calendar/calendar-screen";
import { AGENDA_DAYS, calendarWindow } from "@/components/calendar/util";
import { CALENDAR_VIEWS, type CalendarView } from "@/components/calendar/types";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const asView = (v: string | undefined): CalendarView =>
  CALENDAR_VIEWS.includes(v as CalendarView) ? (v as CalendarView) : "month";

/** Everything the signed-in person can see, one colour per project. */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const view = asView(one(sp.view));
  const today = startOfDay(new Date());
  const anchor = parseIsoDate(one(sp.date)) ?? today;
  const { from, to } = calendarWindow(view, anchor);
  const entries =
    view === "agenda" && isoDate(anchor) === isoDate(today)
      ? upcoming({ user, days: AGENDA_DAYS })
      : scheduleWindow({ user, from, to });

  return (
    <CalendarScreen
      view={view}
      dateIso={isoDate(anchor)}
      todayIso={isoDate(today)}
      basePath="/calendar"
      entries={entries}
      workspace={null}
      members={[]}
      suppliers={[]}
      canEdit={false}
      canManage={false}
      editableWorkspaceIds={editableWorkspaceIds(user)}
      openItem={null}
      feedUrl={null}
    />
  );
}
