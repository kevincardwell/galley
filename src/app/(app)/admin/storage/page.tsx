import { requireAdmin } from "@/lib/auth/current";
import { listAdminWorkspaces } from "@/lib/queries/admin";
import { storage } from "@/lib/storage";
import { formatBytes } from "@/lib/format";
import { Hint, WsDot } from "@/components/admin/bits";
import { SweepButton } from "@/components/admin/sweep-button";
import { Empty } from "@/components/ui/empty";

export default async function AdminStoragePage() {
  await requireAdmin();
  const [total, workspaces] = await Promise.all([storage.usage(), listAdminWorkspaces()]);
  const rows = workspaces.filter((w) => w.bytes > 0).sort((a, b) => b.bytes - a.bytes);
  const max = rows[0]?.bytes ?? 1;
  const accounted = rows.reduce((n, w) => n + w.bytes, 0);
  const unaccounted = Math.max(0, total - accounted);
  return (
    <div className="grid max-w-3xl gap-8 overflow-auto px-6 pb-8 pt-5">
      <section>
        <h2 className="m-0 mb-1 text-sm font-semibold">Total used</h2>
        <p className="tnum m-0 text-2xl font-semibold tracking-tight">{formatBytes(total)}</p>
        <Hint small>Uploaded originals plus generated thumbnails, previews and posters on this volume.</Hint>
      </section>

      <section>
        <h2 className="m-0 mb-3 text-sm font-semibold">By workspace</h2>
        {rows.length === 0 ? (
          <Empty title="Nothing uploaded yet" hint="Storage shows up here once someone adds files to a workspace." />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {rows.map((w) => (
              <li key={w.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="flex min-w-0 items-center gap-2"><WsDot accent={w.accent} /><span className="truncate">{w.name}</span>{w.archivedAt && <span className="text-xs text-ink-3">archived</span>}</span>
                <span className="tnum text-right text-ink-2">{formatBytes(w.bytes)}</span>
                <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={w.bytes} aria-label={`${w.name} storage`}>
                  <span className="block h-full rounded-full transition-[width] duration-150 ease-out" style={{ width: `${Math.max(1, (w.bytes / max) * 100)}%`, background: w.accent }} />
                </span>
              </li>
            ))}
            {unaccounted > 0 && (
              <li className="flex items-center justify-between gap-3 text-ink-3">
                <span>Not linked to a workspace</span>
                <span className="tnum">{formatBytes(unaccounted)}</span>
              </li>
            )}
          </ul>
        )}
      </section>

      <section>
        <h2 className="m-0 mb-1 text-sm font-semibold">Orphaned files</h2>
        <p className="m-0 mb-3 text-ink-2">Folders on disk that no longer match an asset, usually left over from a failed upload or a deleted workspace. Sweeping removes them.</p>
        <SweepButton />
      </section>
    </div>
  );
}
