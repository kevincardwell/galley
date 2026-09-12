import { requireAdmin } from "@/lib/auth/current";
import { listBackups, restoreNote } from "@/lib/backup";
import { listPersonOptions } from "@/lib/queries/admin";
import { getSettings } from "@/lib/settings";
import { formatBytes } from "@/lib/format";
import { Hint } from "@/components/admin/bits";
import { BackupNowButton, BackupScheduleForm, BackupsTable } from "@/components/admin/backups-panel";
import { Section } from "@/components/ui/page";

export const dynamic = "force-dynamic";

export default async function AdminBackupsPage() {
  await requireAdmin();
  const backups = listBackups();
  const people = Object.fromEntries(listPersonOptions().map((p) => [p.id, p.name]));
  const { backup } = getSettings();
  const total = backups.reduce((n, b) => n + b.bytes, 0);
  return (
    <div className="grid max-w-3xl gap-8 overflow-auto px-4 pt-4 pb-8 sm:px-6 sm:pt-5">
      <Section title="Backups" action={<BackupNowButton />}>
        <Hint small>
          A zip of the database, every upload and the cached favicons.
          {backups.length > 0 && <span className="tnum"> {backups.length} on disk, {formatBytes(total)}.</span>}
        </Hint>
        <BackupsTable backups={backups} people={people} />
      </Section>

      <Section title="Schedule">
        <Hint>{backup.enabled ? `Runs daily at ${String(backup.hour).padStart(2, "0")}:00 server time and keeps the newest ${backup.keep}.` : "Nightly backups are off."}</Hint>
        <BackupScheduleForm settings={backup} />
      </Section>

      <Section title="Restoring">
        <Hint>{restoreNote()}</Hint>
      </Section>
    </div>
  );
}
