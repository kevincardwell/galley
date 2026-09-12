"use client";
import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { createScheduleItem, deleteScheduleItem, updateScheduleItem } from "@/actions/schedule";
import { toInputValue } from "@/lib/dates";
import type { CalendarPerson, CalendarSupplier, ScheduleItemDetail, ScheduleItemInput } from "./types";

type Props = {
  open: boolean;
  workspaceId: string;
  /** Null when adding. */
  item: ScheduleItemDetail | null;
  /** The day a new entry lands on. */
  defaultDateIso: string;
  members: CalendarPerson[];
  suppliers: CalendarSupplier[];
  /** Viewers can read an entry but not change it. */
  readOnly?: boolean;
  onClose: () => void;
};

type Form = {
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  location: string;
  ownerId: string;
  supplierId: string;
  notes: string;
};

function initial(item: ScheduleItemDetail | null, dateIso: string): Form {
  if (!item) {
    return { title: "", allDay: false, start: `${dateIso}T09:00`, end: `${dateIso}T10:00`, location: "", ownerId: "", supplierId: "", notes: "" };
  }
  return {
    title: item.title,
    allDay: item.allDay,
    start: toInputValue(item.start, item.allDay),
    end: item.end === null ? "" : toInputValue(item.end, item.allDay),
    location: item.location ?? "",
    ownerId: item.ownerId ?? "",
    supplierId: item.supplierId ?? "",
    notes: item.notes ?? "",
  };
}

/** Add or change one run-sheet entry. Mount with a `key` so it starts fresh for each entry. */
export function ItemDialog({ open, workspaceId, item, defaultDateIso, members, suppliers, readOnly = false, onClose }: Props) {
  const [form, setForm] = useState<Form>(() => initial(item, defaultDateIso));
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Switching all-day on or off rewrites the two time fields so the inputs stay valid.
  function setAllDay(allDay: boolean) {
    setForm((f) => ({
      ...f,
      allDay,
      start: allDay ? f.start.slice(0, 10) : f.start.length === 10 ? `${f.start}T09:00` : f.start,
      end: f.end === "" ? "" : allDay ? f.end.slice(0, 10) : f.end.length === 10 ? `${f.end}T10:00` : f.end,
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: ScheduleItemInput = {
      title: form.title,
      start: form.start,
      end: form.end || null,
      allDay: form.allDay,
      location: form.location || null,
      notes: form.notes || null,
      ownerId: form.ownerId || null,
      supplierId: form.supplierId || null,
    };
    start(async () => {
      setError(null);
      try {
        if (item) await updateScheduleItem(item.id, payload);
        else await createScheduleItem(workspaceId, payload);
        toast(item ? "Schedule updated" : "Added to the schedule", { tone: "done" });
        onClose();
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "That did not save. Try again.");
      }
    });
  }

  function remove() {
    if (!item) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    start(async () => {
      setError(null);
      try {
        await deleteScheduleItem(item.id);
        toast("Removed from the schedule");
        onClose();
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "That did not delete. Try again.");
      }
    });
  }

  const type = form.allDay ? "date" : "datetime-local";

  return (
    <Dialog open={open} onClose={onClose} title={item ? (readOnly ? "Schedule entry" : "Edit schedule entry") : "Add to schedule"}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0">
          <Label htmlFor="si-title">
            Title
            <Input
              id="si-title"
              value={form.title}
              autoFocus
              required
              maxLength={200}
              placeholder="Site visit"
              onChange={(e) => set("title", e.target.value)}
            />
          </Label>

          <label className="flex cursor-pointer items-center gap-2 text-ink-2">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="size-4 cursor-pointer accent-[var(--accent)]"
            />
            All day
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Label htmlFor="si-start">
              Starts
              <Input id="si-start" type={type} value={form.start} required onChange={(e) => set("start", e.target.value)} />
            </Label>
            <Label htmlFor="si-end">
              Ends (optional)
              <Input id="si-end" type={type} value={form.end} onChange={(e) => set("end", e.target.value)} />
            </Label>
          </div>

          <Label htmlFor="si-location">
            Location
            <Input id="si-location" value={form.location} maxLength={200} placeholder="Unit 4, Bank Quay" onChange={(e) => set("location", e.target.value)} />
          </Label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Label htmlFor="si-owner">
              Owner
              <Select id="si-owner" value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
                <option value="">Nobody</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </Label>
            {suppliers.length > 0 && (
              <Label htmlFor="si-supplier">
                Supplier
                <Select id="si-supplier" value={form.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
                  <option value="">None</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </Label>
            )}
          </div>

          <Label htmlFor="si-notes">
            Notes
            <Textarea id="si-notes" value={form.notes} maxLength={4000} onChange={(e) => set("notes", e.target.value)} />
          </Label>
        </fieldset>

        {error && <p className="m-0 text-[13px] text-late">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {item && !readOnly && (
            <Button type="button" variant="danger" icon="trash" onClick={remove} disabled={pending}>
              {confirming ? "Really delete" : "Delete"}
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant={readOnly ? "primary" : "ghost"} onClick={onClose} disabled={pending}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button type="submit" variant="primary" loading={pending}>
                {item ? "Save changes" : "Add entry"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
