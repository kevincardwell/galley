"use client";
import { useState, useTransition } from "react";
import { removeBackup, runBackupNow, saveBackupSchedule } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Input, Label, Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import type { BackupRow } from "@/lib/backup";
import { formatBytes } from "@/lib/format";
import type { BackupSettings } from "@/lib/settings";
import { Hint, InlineError, Table, Td, Th } from "./bits";
import { useAdminAction } from "./use-action";

const when = (unix: number) => new Date(unix * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function BackupNowButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await runBackupNow();
          if (r.ok) toast(`Backed up: ${r.data.filename} (${formatBytes(r.data.bytes)})`, { tone: "done", duration: 3500 });
          else toast(r.error, { tone: "late", duration: 5000 });
        })
      }
    >
      {pending ? "Backing up…" : "Back up now"}
    </Button>
  );
}

export function BackupsTable({ backups, people }: { backups: BackupRow[]; people: Record<string, string> }) {
  const del = useAdminAction();
  const [busyId, setBusyId] = useState<string | null>(null);
  if (backups.length === 0) return <Empty title="No backups yet" hint="Use “Back up now”, or turn on the nightly schedule below." />;
  return (
    <>
      <Table>
        <thead>
          <tr><Th>File</Th><Th>Size</Th><Th>Kind</Th><Th>Created</Th><Th> </Th></tr>
        </thead>
        <tbody>
          {backups.map((b) => (
            <tr key={b.id}>
              <Td><code className="text-xs">{b.filename}</code></Td>
              <Td className="whitespace-nowrap text-ink-2">{formatBytes(b.bytes)}</Td>
              <Td>{b.kind === "scheduled" ? <Pill tone="neutral" dot={false}>Scheduled</Pill> : <Pill tone="accent" dot={false}>Manual</Pill>}</Td>
              <Td className="whitespace-nowrap text-ink-2">
                {when(b.createdAt)}
                {b.createdBy && people[b.createdBy] && <span className="ml-1.5 text-xs text-ink-3">by {people[b.createdBy]}</span>}
              </Td>
              <Td className="whitespace-nowrap text-right">
                <span className="inline-flex gap-1">
                  <a href={`/api/admin/backups/${b.id}`} download={b.filename} className="inline-flex items-center rounded-r px-2.5 py-1 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">Download</a>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={del.pending && busyId === b.id}
                    onClick={() => {
                      if (!window.confirm(`Delete ${b.filename}? This cannot be undone.`)) return;
                      setBusyId(b.id);
                      del.run(() => removeBackup(b.id), () => toast("Backup deleted"));
                    }}
                  >
                    {del.pending && busyId === b.id ? "Deleting…" : "Delete"}
                  </Button>
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <InlineError>{del.error}</InlineError>
    </>
  );
}

export function BackupScheduleForm({ settings }: { settings: BackupSettings }) {
  const { pending, error, run } = useAdminAction();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [hour, setHour] = useState(settings.hour);
  const [keep, setKeep] = useState(String(settings.keep));
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        run(() => saveBackupSchedule({ enabled, hour, keep }), () => setSaved(true));
      }}
    >
      <label className="flex items-center gap-2 text-[13px] text-ink" htmlFor="bk-enabled">
        <input id="bk-enabled" type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-accent" />
        Back up every day
      </label>
      <div className="grid max-w-sm gap-3 sm:grid-cols-2">
        <Label htmlFor="bk-hour">At (server time)
          <Select id="bk-hour" value={hour} onChange={(e) => setHour(Number(e.target.value))} disabled={!enabled}>
            {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </Select>
        </Label>
        <Label htmlFor="bk-keep">Keep the newest
          <Input id="bk-keep" type="number" min={1} max={365} step={1} value={keep} onChange={(e) => setKeep(e.target.value)} required />
        </Label>
      </div>
      <Hint small>Older backups are deleted once there are more than this, including manual ones.</Hint>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save schedule"}</Button>
        {saved && !error && <span className="text-sm text-done">Saved</span>}
        <InlineError>{error}</InlineError>
      </div>
    </form>
  );
}
