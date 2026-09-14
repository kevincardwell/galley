import { requireUser } from "@/lib/auth/current";
import { can, requireAccess } from "@/lib/permissions";
import { itemDetail, scheduleOptions, scheduleWindow, upcoming } from "@/lib/queries/schedule";
import { resolveBaseUrl } from "@/lib/queries/admin";
import { isoDate, parseIsoDate, startOfDay } from "@/lib/dates";
import { CalendarScreen } from "@/components/calendar/calendar-screen";
import { AGENDA_DAYS, calendarWindow } from "@/components/calendar/util";
import { CALENDAR_VIEWS, type CalendarView } from "@/components/calendar/types";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const asView = (v: string | undefined): CalendarView =>
  CALENDAR_VIEWS.includes(v as CalendarView) ? (v as CalendarView) : "month";

/** One project's run sheet: its schedule entries and every task due date in it. */
export default async function WorkspaceCalendarPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const access = requireAccess(user, slug);
  const ws = access.workspace;
  const canEdit = can(access, "edit");
  const canManage = can(access, "manage");

  const view = asView(one(sp.view));
  const today = startOfDay(new Date());
  const anchor = parseIsoDate(one(sp.date)) ?? today;
  const { from, to } = calendarWindow(view, anchor);
  const entries =
    view === "agenda" && isoDate(anchor) === isoDate(today)
      ? upcoming({ user, days: AGENDA_DAYS, workspaceId: ws.id })
      : scheduleWindow({ user, from, to, workspaceId: ws.id });

  const { members, suppliers } = scheduleOptions(ws.id);
  const detail = one(sp.item) ? itemDetail(one(sp.item)!) : null;
  const openItem = detail && detail.workspaceId === ws.id ? detail : null;
  const feedUrl = ws.calendarToken ? `${await resolveBaseUrl()}/api/calendar/${ws.calendarToken}` : null;

  return (
    <CalendarScreen
      view={view}
      dateIso={isoDate(anchor)}
      todayIso={isoDate(today)}
      basePath={`/w/${ws.slug}/calendar`}
      entries={entries}
      workspace={{ id: ws.id, slug: ws.slug, name: ws.name }}
      members={members}
      suppliers={suppliers}
      canEdit={canEdit}
      canManage={canManage}
      editableWorkspaceIds={canEdit ? [ws.id] : []}
      openItem={openItem}
      feedUrl={feedUrl}
    />
  );
}
