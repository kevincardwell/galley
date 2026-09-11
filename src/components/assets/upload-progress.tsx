"use client";
import { clsx } from "@/lib/clsx";
import type { UploadEntry } from "./upload-client";

/** Bottom-right stack of per-file progress bars. Disappears on its own when the batch is done. */
export function UploadProgress({ uploads, onDismiss }: { uploads: UploadEntry[]; onDismiss: (id: string) => void }) {
  if (uploads.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-40 flex w-[min(320px,calc(100vw-32px))] flex-col gap-1.5" role="status" aria-live="polite">
      {uploads.map((u) => (
        <div key={u.id} className="rounded-r border border-line bg-surface px-3 py-2 shadow-panel">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="min-w-0 flex-1 truncate">{u.name}</span>
            <span className={clsx("tnum shrink-0 text-xs", u.status === "error" ? "text-late" : "text-ink-3")}>
              {u.status === "done" ? "Done" : u.status === "error" ? "Failed" : `${Math.round(u.progress * 100)}%`}
            </span>
            {u.status !== "uploading" && (
              <button type="button" onClick={() => onDismiss(u.id)} aria-label="Dismiss" className="text-ink-3 hover:text-ink">×</button>
            )}
          </div>
          {u.status === "error" ? (
            <p className="m-0 mt-0.5 text-xs text-late">{u.error}</p>
          ) : (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
              <div className={clsx("h-full rounded-full transition-[width] duration-150 ease-out", u.status === "done" ? "bg-done" : "bg-accent")} style={{ width: `${Math.max(2, u.progress * 100)}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
