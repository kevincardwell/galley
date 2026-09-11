import { requireAdmin } from "@/lib/auth/current";
import { listBackups, restoreNote } from "@/lib/backup";
import { listPersonOptions } from "@/lib/queries/admin";
import { getSettings } from "@/lib/settings";
import { formatBytes } from "@/lib/format";
import { Hint } from "@/components/admin/bits";
import { BackupNowButton, BackupScheduleForm, BackupsTable } from "@/components/admin/backups-panel";

export const dynamic = "force-dynamic";

export default async function AdminBackupsPage() {
  await requireAdmin();
  const backups = listBackups();
  const people = Object.fromEntries(listPersonOptions().map((p) => [p.id, p.name]));
  const { backup } = getSettings();
  const total = backups.reduce((n, b) => n + b.bytes, 0);
  return (
    <div className="grid max-w-3xl gap-8 overflow-auto px-6 pb-8 pt-5">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-sm font-semibold">Backups</h2>
            <Hint small>A zip of the database, every upload and the cached favicons. {backups.length > 0 && <>{backups.length} on disk, {formatBytes(total)}.</>}</Hint>
          </div>
          <BackupNowButton />
        </div>
        <BackupsTable backups={backups} people={people} />
      </section>

      <section>
        <h2 className="m-0 mb-1 text-sm font-semibold">Schedule</h2>
        <p className="m-0 mb-3 text-ink-2">{backup.enabled ? `Runs daily at ${String(backup.hour).padStart(2, "0")}:00 server time and keeps the newest ${backup.keep}.` : "Nightly backups are off."}</p>
        <BackupScheduleForm settings={backup} />
      </section>

      <section>
        <h2 className="m-0 mb-1 text-sm font-semibold">Restoring</h2>
        <p className="m-0 max-w-[70ch] text-ink-2">{restoreNote()}</p>
      </section>
    </div>
  );
}
