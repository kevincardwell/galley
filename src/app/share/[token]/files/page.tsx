import { notFound } from "next/navigation";
import { formatBytes } from "@/lib/format";
import { listAssets, workspaceByShareToken } from "@/lib/queries/copy";
import { Empty } from "@/components/ui/empty";
import { Icon, type IconName } from "@/components/ui/icon";
import { GuestUpload } from "@/components/share/guest-upload";
import { getSettings } from "@/lib/settings";

const KIND_ICON: Record<string, IconName> = { image: "image", video: "play", pdf: "file" };
const KIND_LABEL: Record<string, string> = { image: "Image", video: "Video", pdf: "PDF" };

export default async function ShareFiles({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ws = workspaceByShareToken(token);
  if (!ws) notFound();
  const assets = listAssets(ws.id);
  const q = `?share=${encodeURIComponent(token)}`;
  const { maxUploadMb } = getSettings();

  return (
    <div>
      <header className="mb-7">
        <p className="tnum m-0 text-xs font-medium text-ink-3">{assets.length === 1 ? "1 file" : `${assets.length} files`}</p>
        <h2 className="m-0 mt-1.5 font-serif text-[30px] leading-tight font-medium tracking-tight">Files</h2>
      </header>

      {ws.shareUploads && <GuestUpload token={token} maxUploadMb={maxUploadMb} />}

      {assets.length === 0 ? (
        <Empty
          icon="image"
          title="No files have been shared yet"
          hint={ws.shareUploads ? "Anything the studio uploads shows up here, alongside anything you send in." : "Anything the studio uploads for this project shows up here."}
        />
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-0">
          {assets.map((a) => (
            <li key={a.id} className="group min-w-0">
              <a
                href={`/api/file/${a.id}/original${q}`}
                target="_blank"
                rel="noreferrer"
                className="block cursor-pointer overflow-hidden rounded-lg border border-line bg-surface-2 transition-colors duration-150 hover:border-accent-line"
              >
                <span className="block aspect-[4/3] w-full overflow-hidden">
                  {a.kind === "pdf" ? (
                    <span className="flex size-full flex-col items-center justify-center gap-1.5 text-ink-3">
                      <Icon name="file" size={22} />
                      <span className="text-xs font-medium">PDF</span>
                    </span>
                  ) : (
                     
                    <img src={`/api/file/${a.id}/thumb${q}`} alt={a.filename} loading="lazy" className="size-full object-cover" />
                  )}
                </span>
                <span className="block border-t border-line-2 bg-surface px-2.5 py-2">
                  <span className="block truncate text-[13px] font-medium" title={a.filename}>{a.filename}</span>
                  <span className="tnum mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                    <Icon name={KIND_ICON[a.kind] ?? "file"} size={11} />
                    {KIND_LABEL[a.kind] ?? a.kind}
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
