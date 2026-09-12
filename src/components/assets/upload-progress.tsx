"use client";
import { clsx } from "@/lib/clsx";
import { Icon, IconButton } from "@/components/ui/icon";
import { Meter } from "@/components/ui/meter";
import type { UploadEntry } from "./upload-client";

/** Bottom-right stack of in-flight uploads, one row and one meter each. Clears itself when the batch is done. */
export function UploadProgress({ uploads, onDismiss }: { uploads: UploadEntry[]; onDismiss: (id: string) => void }) {
  if (uploads.length === 0) return null;
  const active = uploads.filter((u) => u.status === "uploading").length;
  return (
    <div className="fixed right-4 bottom-4 z-40 flex w-[min(340px,calc(100vw-32px))] flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-panel" role="status" aria-live="polite">
      <p className="m-0 flex items-center gap-2 border-b border-line-2 px-3 py-2 text-xs font-medium text-ink-2">
        <Icon name="upload" size={13} className="text-ink-3" />
        {active > 0 ? <span className="tnum">Uploading {active} {active === 1 ? "file" : "files"}</span> : <span>Uploads</span>}
      </p>
      <ul className="m-0 flex max-h-[46vh] list-none flex-col overflow-auto p-0">
        {uploads.map((u) => (
          <li key={u.id} className="flex flex-col gap-1.5 border-b border-line-2 px-3 py-2.5 last:border-b-0">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              <span className={clsx("tnum shrink-0 text-xs", u.status === "error" ? "text-late" : u.status === "done" ? "text-done" : "text-ink-3")}>
                {u.status === "done" ? "Done" : u.status === "error" ? "Failed" : `${Math.round(u.progress * 100)}%`}
              </span>
              {u.status !== "uploading" && <IconButton name="x" size={13} label={`Dismiss ${u.name}`} className="-mr-1 size-5" onClick={() => onDismiss(u.id)} />}
            </div>
            {u.status === "error" ? (
              <p className="m-0 flex items-start gap-1.5 text-xs text-late"><Icon name="alert" size={12} className="mt-px" />{u.error}</p>
            ) : (
              <Meter value={u.status === "done" ? 1 : u.progress} max={1} tone={u.status === "done" ? "done" : "accent"} label={`${u.name} upload progress`} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
