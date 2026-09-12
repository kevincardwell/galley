"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import { moveEntry } from "@/actions/schedule";
import { addDays, daysBetween, formatDayLabel, fromUnix, isoDate, monthGrid, parseIsoDate, toUnix, weekDays } from "@/lib/dates";
import { CalendarHeader } from "./calendar-header";
import { MonthView, DAY_DROP_PREFIX } from "./month-view";
import { WeekView } from "./week-view";
import { AgendaView } from "./agenda-view";
import { DayDialog } from "./day-dialog";
import { ItemDialog } from "./item-dialog";
import { ChipOverlay } from "./entry-chip";
import { FeedLink } from "./feed-link";
import { calendarHref, calendarWindow, dayGroups, entriesByDay, hourRange, periodLabel } from "./util";
import type { CalendarEntry, CalendarPerson, CalendarSupplier, CalendarView, ScheduleItemDetail } from "./types";

export type CalendarWorkspace = { id: string; slug: string; name: string };

type Props = {
  view: CalendarView;
  dateIso: string;
  todayIso: string;
  basePath: string;
  entries: CalendarEntry[];
  /** Set on a project calendar; null on the everything calendar. */
  workspace: CalendarWorkspace | null;
  members: CalendarPerson[];
  suppliers: CalendarSupplier[];
  canEdit: boolean;
  /** Workspaces the caller may edit, so a chip is only draggable when the move would be allowed. */
  editableWorkspaceIds: string[];
  /** The entry named by `?item=`, already loaded and access-checked on the server. */
  openItem: ScheduleItemDetail | null;
  feedUrl: string | null;
};

/** Shift a whole entry by `delta` days, keeping its clock time, for an optimistic drop. */
function shift(entry: CalendarEntry, delta: number): CalendarEntry {
  return {
    ...entry,
    start: toUnix(addDays(fromUnix(entry.start), delta)),
    end: entry.end === null ? null : toUnix(addDays(fromUnix(entry.end), delta)),
  };
}

export function CalendarScreen(props: Props) {
  const { view, dateIso, todayIso, basePath, workspace, members, suppliers, canEdit, openItem, feedUrl } = props;
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Server data is the source of truth; the local copy only absorbs a drag until it re-renders.
  const [prevEntries, setPrevEntries] = useState(props.entries);
  const [entries, setEntries] = useState(props.entries);
  if (prevEntries !== props.entries) {
    setPrevEntries(props.entries);
    setEntries(props.entries);
  }

  const [dragging, setDragging] = useState<CalendarEntry | null>(null);
  const [creatingOn, setCreatingOn] = useState<string | null>(null);
  const [dayIso, setDayIso] = useState<string | null>(null);

  const anchor = useMemo(() => parseIsoDate(dateIso) ?? new Date(), [dateIso]);
  const today = useMemo(() => parseIsoDate(todayIso) ?? new Date(), [todayIso]);
  const bounds = useMemo(() => calendarWindow(view, anchor), [view, anchor]);
  const byDay = useMemo(() => entriesByDay(entries, bounds.from, bounds.to), [entries, bounds]);
  const groups = useMemo(() => dayGroups(entries, bounds.from, bounds.to), [entries, bounds]);
  const weeks = useMemo(() => monthGrid(anchor.getFullYear(), anchor.getMonth(), today), [anchor, today]);
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const range = useMemo(() => hourRange(entries), [entries]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );

  const setParams = (extra?: Record<string, string>) => router.replace(calendarHref(basePath, view, dateIso, extra), { scroll: false });
  const openItemDialog = workspace ? (entry: CalendarEntry) => setParams({ item: entry.id }) : undefined;
  const closeItemDialog = () => setParams();

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { entry?: CalendarEntry } | undefined;
    setDragging(data?.entry ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const entry = dragging;
    setDragging(null);
    const over = event.over?.id;
    if (!entry || typeof over !== "string" || !over.startsWith(DAY_DROP_PREFIX)) return;
    const toIsoDate = over.slice(DAY_DROP_PREFIX.length);
    const target = parseIsoDate(toIsoDate);
    if (!target || toIsoDate === isoDate(fromUnix(entry.start))) return;

    const delta = daysBetween(fromUnix(entry.start), target);
    const snapshot = entries;
    setEntries((list) => list.map((e) => (e.kind === entry.kind && e.id === entry.id ? shift(e, delta) : e)));
    startTransition(async () => {
      try {
        await moveEntry({ kind: entry.kind, id: entry.id, toIsoDate, keepTime: true });
        toast(`Moved to ${formatDayLabel(target, today)}`, { tone: "done" });
      } catch (err) {
        setEntries(snapshot);
        toast(err instanceof Error && err.message ? err.message : "That did not move. Try again.", { tone: "late" });
        router.refresh();
      }
    });
  }

  const editable = useMemo(() => new Set(props.editableWorkspaceIds), [props.editableWorkspaceIds]);
  const canDrag = editable.size > 0;
  const showProject = !workspace;
  const dayGroup = dayIso ? (groups.find((g) => g.iso === dayIso) ?? { iso: dayIso, date: parseIsoDate(dayIso) ?? today, entries: [] }) : null;

  const empty = (
    <Empty
      icon="calendar"
      title={workspace ? "Nothing scheduled yet." : "Nothing on the calendar."}
      hint={
        workspace
          ? "Task due dates appear here automatically. Add site visits, deadlines and deliveries to fill in the rest."
          : "Due dates and schedule entries from every project you can see land here."
      }
      action={
        canEdit && workspace ? (
          <Button variant="primary" icon="plus" onClick={() => setCreatingOn(dateIso)}>
            Add to schedule
          </Button>
        ) : undefined
      }
    />
  );

  const grid =
    view === "week" ? (
      <WeekView days={days} byDay={byDay} range={range} todayIso={todayIso} onOpenItem={openItemDialog} />
    ) : (
      <MonthView
        weeks={weeks}
        byDay={byDay}
        editable={editable}
        canAdd={canEdit && !!workspace}
        onOpenItem={openItemDialog}
        onOpenDay={setDayIso}
        onAdd={workspace ? setCreatingOn : undefined}
      />
    );

  const agenda = (
    <AgendaView groups={groups} today={today} todayIso={todayIso} showProject={showProject} onOpenItem={openItemDialog} empty={empty} />
  );

  return (
    <div className="w-full px-4 py-4 sm:px-6 sm:py-5">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col">
        <CalendarHeader
          basePath={basePath}
          view={view}
          anchor={anchor}
          todayIso={todayIso}
          label={periodLabel(view, anchor, today)}
          eyebrow={workspace ? "Schedule" : "All projects"}
          action={
            canEdit && workspace ? (
              <Button variant="primary" icon="plus" onClick={() => setCreatingOn(dateIso)}>
                Add to schedule
              </Button>
            ) : undefined
          }
        />

        {workspace && canEdit && <FeedLink url={feedUrl} workspaceId={workspace.id} canManage={canEdit} />}

        {view === "agenda" ? (
          agenda
        ) : (
          <>
            <div className="max-[699px]:hidden">
              {canDrag ? (
                <DndContext id="galley-calendar" sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
                  {grid}
                  <DragOverlay dropAnimation={null}>{dragging && <ChipOverlay entry={dragging} />}</DragOverlay>
                </DndContext>
              ) : (
                grid
              )}
              {entries.length === 0 && <div className="mt-4">{empty}</div>}
            </div>
            <div className="min-[700px]:hidden">{agenda}</div>
          </>
        )}
      </div>

      <DayDialog
        group={dayGroup}
        today={today}
        todayIso={todayIso}
        showProject={showProject}
        onOpenItem={openItemDialog}
        onClose={() => setDayIso(null)}
        onAdd={canEdit && workspace ? (iso) => { setDayIso(null); setCreatingOn(iso); } : undefined}
      />

      {workspace && creatingOn && (
        <ItemDialog
          key={`new-${creatingOn}`}
          open
          workspaceId={workspace.id}
          item={null}
          defaultDateIso={creatingOn}
          members={members}
          suppliers={suppliers}
          onClose={() => setCreatingOn(null)}
        />
      )}

      {workspace && openItem && (
        <ItemDialog
          key={openItem.id}
          open
          workspaceId={workspace.id}
          item={openItem}
          defaultDateIso={isoDate(fromUnix(openItem.start))}
          members={members}
          suppliers={suppliers}
          readOnly={!canEdit}
          onClose={closeItemDialog}
        />
      )}
    </div>
  );
}
