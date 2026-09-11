import { notFound } from "next/navigation";
import { formatBytes } from "@/lib/format";
import { listAssets, workspaceByShareToken } from "@/lib/queries/copy";

export default async function ShareFiles({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ws = workspaceByShareToken(token);
  if (!ws) notFound();
  const assets = listAssets(ws.id);
  const q = `?share=${encodeURIComponent(token)}`;

  return (
    <div>
      <p className="tnum m-0 mb-5 flex items-baseline justify-between gap-3 text-[13px] font-semibold text-ink-3">
        <span>Files</span>
        <span className="font-medium">{assets.length === 1 ? "1 file" : `${assets.length} files`}</span>
      </p>
      {assets.length === 0 ? (
        <p className="m-0 text-ink-3">No files have been shared yet.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-0">
          {assets.map((a) => (
            <li key={a.id} className="group min-w-0">
              <a href={`/api/file/${a.id}/original${q}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-r border border-line bg-surface-2 transition-colors hover:border-accent-line">
                <span className="block aspect-[4/3] w-full overflow-hidden">
                  {a.kind === "pdf" ? (
                    <span className="grid size-full place-items-center text-xs font-medium text-ink-3">PDF</span>
                  ) : (
                     
                    <img src={`/api/file/${a.id}/thumb${q}`} alt={a.filename} loading="lazy" className="size-full object-cover" />
                  )}
                </span>
                <span className="block border-t border-line-2 px-2.5 py-2">
                  <span className="block truncate text-[13px]" title={a.filename}>{a.filename}</span>
                  <span className="tnum block text-xs text-ink-3">
                    {a.kind}
                    {a.width && a.height ? ` · ${a.width}×${a.height}` : ""} · {formatBytes(a.bytes)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
