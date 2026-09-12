"use client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDayLabel } from "@/lib/dates";
import { AgendaView } from "./agenda-view";
import type { DayGroup } from "./util";
import type { CalendarEntry } from "./types";

/** What "+2 more" opens: one day's agenda, nothing else. */
export function DayDialog({
  group, today, todayIso, showProject, onOpenItem, onClose, onAdd,
}: {
  group: DayGroup | null;
  today: Date;
  todayIso: string;
  showProject: boolean;
  onOpenItem?: (entry: CalendarEntry) => void;
  onClose: () => void;
  onAdd?: (iso: string) => void;
}) {
  return (
    <Dialog open={!!group} onClose={onClose} title={group ? formatDayLabel(group.date, today) : "Day"}>
      {group && (
        <div className="flex flex-col gap-4">
          <AgendaView
            groups={[group]}
            today={today}
            todayIso={todayIso}
            showProject={showProject}
            onOpenItem={onOpenItem}
            empty={null}
            headings={false}
          />
          <div className="flex justify-end gap-2">
            {onAdd && (
              <Button icon="plus" onClick={() => onAdd(group.iso)}>
                Add to schedule
              </Button>
            )}
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
