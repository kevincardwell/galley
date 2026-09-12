"use client";
import { useState, useTransition } from "react";
import { removeBackup, runBackupNow, saveBackupSchedule } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Input, Label, Select } from "@/components/ui/field";
import { Icon, IconButton } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import type { BackupRow } from "@/lib/backup";
import { formatBytes } from "@/lib/format";
import type { BackupSettings } from "@/lib/settings";
import { Hint, InlineError, RowActions, Table, Td, Th, Tr } from "./bits";
import { useAdminAction } from "./use-action";

const when = (unix: number) => new Date(unix * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function BackupNowButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="primary"
      icon="database"
      loading={pending}
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
  if (backups.length === 0) return <Empty icon="database" title="No backups yet" hint="Use “Back up now”, or turn on the nightly schedule below." />;
  return (
    <>
      <Table>
        <thead>
          <tr><Th>File</Th><Th num>Size</Th><Th>Kind</Th><Th>Created</Th><Th num><span className="sr-only">Actions</span></Th></tr>
        </thead>
        <tbody>
          {backups.map((b) => (
            <Tr key={b.id}>
              <Td>
                <span className="flex items-center gap-2">
                  <Icon name="database" size={15} className="text-ink-3" />
                  <code className="truncate text-xs">{b.filename}</code>
                </span>
              </Td>
              <Td num className="text-ink-2">{formatBytes(b.bytes)}</Td>
              <Td>{b.kind === "scheduled" ? <Pill tone="neutral" dot={false}>Scheduled</Pill> : <Pill tone="accent" dot={false}>Manual</Pill>}</Td>
              <Td className="whitespace-nowrap text-ink-2">
                {when(b.createdAt)}
                {b.createdBy && people[b.createdBy] && <span className="ml-1.5 text-xs text-ink-3">by {people[b.createdBy]}</span>}
              </Td>
              <Td num>
                <RowActions>
                  <Tooltip label="Download">
                    <a
                      href={`/api/admin/backups/${b.id}`}
                      download={b.filename}
                      aria-label={`Download ${b.filename}`}
                      className="inline-grid size-7 cursor-pointer place-items-center rounded-r text-ink-3 transition-colors duration-150 hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Icon name="download" />
                    </a>
                  </Tooltip>
                  <Tooltip label="Delete">
                    <IconButton
                      name="trash"
                      tone="danger"
                      label={`Delete ${b.filename}`}
                      title=""
                      disabled={del.pending && busyId === b.id}
                      onClick={() => {
                        if (!window.confirm(`Delete ${b.filename}? This cannot be undone.`)) return;
                        setBusyId(b.id);
                        del.run(() => removeBackup(b.id), () => toast("Backup deleted"));
                      }}
                    />
                  </Tooltip>
                </RowActions>
              </Td>
            </Tr>
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
      className="flex max-w-xl flex-col gap-4 rounded-lg border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        run(() => saveBackupSchedule({ enabled, hour, keep }), () => setSaved(true));
      }}
    >
      <label className="flex cursor-pointer items-start gap-2.5" htmlFor="bk-enabled">
        <input id="bk-enabled" type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent" />
        <span>
          <span className="block font-medium">Back up every day</span>
          <span className="block text-xs text-ink-3">A zip is written to the backups folder on this server.</span>
        </span>
      </label>

      <div className="grid gap-3 border-t border-line-2 pt-4 sm:grid-cols-2">
        <Label htmlFor="bk-hour">At (server time)
          <Select id="bk-hour" value={hour} onChange={(e) => setHour(Number(e.target.value))} disabled={!enabled}>
            {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </Select>
        </Label>
        <Label htmlFor="bk-keep">Keep the newest
          <Input id="bk-keep" type="number" min={1} max={365} step={1} value={keep} onChange={(e) => setKeep(e.target.value)} required />
        </Label>
        <div className="sm:col-span-2"><Hint small>Older backups are deleted once there are more than this, including manual ones.</Hint></div>
      </div>

      <div className="flex items-center gap-3 border-t border-line-2 pt-4">
        <Button type="submit" icon="check" loading={pending}>{pending ? "Saving…" : "Save schedule"}</Button>
        {saved && !error && <span className="flex items-center gap-1.5 text-sm text-done"><Icon name="check-circle" size={14} />Saved</span>}
      </div>
      <InlineError>{error}</InlineError>
    </form>
  );
}
