import { requireAdmin } from "@/lib/auth/current";
import { listAdminWorkspaces } from "@/lib/queries/admin";
import { storage } from "@/lib/storage";
import { formatBytes } from "@/lib/format";
import { Hint, WsDot } from "@/components/admin/bits";
import { SweepButton } from "@/components/admin/sweep-button";
import { Empty } from "@/components/ui/empty";
import { Meter } from "@/components/ui/meter";
import { Section } from "@/components/ui/page";
import { Stat } from "@/components/ui/stat";

export default async function AdminStoragePage() {
  await requireAdmin();
  const [total, workspaces] = await Promise.all([storage.usage(), listAdminWorkspaces()]);
  const rows = workspaces.filter((w) => w.bytes > 0).sort((a, b) => b.bytes - a.bytes);
  const max = rows[0]?.bytes ?? 1;
  const accounted = rows.reduce((n, w) => n + w.bytes, 0);
  const unaccounted = Math.max(0, total - accounted);
  return (
    <div className="grid max-w-3xl gap-8 overflow-auto px-4 pt-4 pb-8 sm:px-6 sm:pt-5">
      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
          <Stat icon="storage" label="Total used" value={formatBytes(total)} />
          <Stat icon="folder" label="Workspaces with files" value={rows.length} />
          {unaccounted > 0 && <Stat icon="info" label="Not linked to a workspace" value={formatBytes(unaccounted)} />}
        </div>
        <div className="mt-3 border-t border-line-2 pt-3">
          <Hint small>Uploaded originals plus generated thumbnails, previews and posters on this volume.</Hint>
        </div>
      </section>

      <Section title="By workspace">
        {rows.length === 0 ? (
          <Empty icon="storage" title="Nothing uploaded yet" hint="Storage shows up here once someone adds files to a workspace." />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {rows.map((w) => (
              <li key={w.id} className="flex flex-col gap-1.5" style={{ ["--accent" as string]: w.accent }}>
                <span className="flex items-baseline gap-2 text-[13px]">
                  <WsDot accent={w.accent} className="self-center" />
                  <span className="min-w-0 truncate font-medium">{w.name}</span>
                  {w.archivedAt && <span className="shrink-0 text-xs text-ink-3">archived</span>}
                  <span className="tnum ml-auto shrink-0 text-ink-2">{formatBytes(w.bytes)}</span>
                </span>
                <Meter value={w.bytes} max={max} label={`${w.name} storage`} height={6} />
              </li>
            ))}
            {unaccounted > 0 && (
              <li className="flex items-baseline gap-2 border-t border-line-2 pt-3 text-[13px] text-ink-3">
                <span>Not linked to a workspace</span>
                <span className="tnum ml-auto">{formatBytes(unaccounted)}</span>
              </li>
            )}
          </ul>
        )}
      </Section>

      <Section title="Orphaned files">
        <Hint>Folders on disk that no longer match an asset, usually left over from a failed upload or a deleted workspace. Sweeping removes them.</Hint>
        <SweepButton />
      </Section>
    </div>
  );
}
