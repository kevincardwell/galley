"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { Section } from "@/components/ui/page";
import { saveDigestSchedule, sendDigestNow } from "@/actions/admin";
import { useAdminAction } from "./use-action";
import type { DigestSettings } from "@/lib/settings";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function DigestForm({ settings, configured, projects }: { settings: DigestSettings; configured: boolean; projects: number }) {
  const { pending, error, run } = useAdminAction();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [weekday, setWeekday] = useState(settings.weekday);
  const [hour, setHour] = useState(settings.hour);
  const [saved, setSaved] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  return (
    <Section title="Weekly client digest" className="max-w-3xl">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(null);
          run(() => saveDigestSchedule({ enabled, weekday, hour }), () => setSaved(true));
        }}
      >
        <p className="m-0 max-w-[68ch] text-[13px] text-ink-2">
          One email a week to each client: what you changed, and what you are waiting on them for. Projects with no client email
          address, no share link, or nothing to report are skipped — an empty weekly email only teaches people to ignore it.
        </p>
        <label className="flex cursor-pointer items-start gap-2.5" htmlFor="dg-enabled">
          <input
            id="dg-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent"
          />
          <span className="text-[13px]">
            Send a weekly digest
            <span className="block text-xs text-ink-2">
              {configured ? `${projects} project${projects === 1 ? "" : "s"} would be included today.` : "Set up email above first — nothing sends until then."}
            </span>
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <Label htmlFor="dg-day">
            On
            <Select id="dg-day" value={weekday} onChange={(e) => { setWeekday(Number(e.target.value)); setSaved(false); }} disabled={!enabled}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </Select>
          </Label>
          <Label htmlFor="dg-hour">
            At (server time)
            <Select id="dg-hour" value={hour} onChange={(e) => { setHour(Number(e.target.value)); setSaved(false); }} disabled={!enabled}>
              {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </Select>
          </Label>
        </div>
        {error && <p role="alert" className="m-0 text-[13px] text-late">{error}</p>}
        {saved && !error && <p className="m-0 text-[13px] text-done">Saved.</p>}
        {sent !== null && <p className="m-0 text-[13px] text-done">{sent === 0 ? "Nothing to send — no project had news." : `Sent ${sent} digest${sent === 1 ? "" : "s"}.`}</p>}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" icon="check" loading={pending}>Save schedule</Button>
          <Button
            type="button"
            icon="mail"
            disabled={!configured || pending}
            onClick={() => { setSaved(false); run(() => sendDigestNow(), (d) => setSent(d.sent)); }}
            title="Send this week's digest to every eligible project now"
          >
            Send now
          </Button>
        </div>
      </form>
    </Section>
  );
}
