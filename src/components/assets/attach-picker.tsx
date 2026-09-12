"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { ACCEPT_ATTR } from "@/lib/media/mime";
import type { AssetSummary } from "@/lib/media/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Empty } from "@/components/ui/empty";
import { attachAsset, detachAsset, listAssetsForPicker } from "@/actions/assets";
import { KindIcon } from "./asset-tile";
import { fileUrl } from "./urls";
import { UploadProgress } from "./upload-progress";
import { useUploads } from "./upload-client";

export type AttachedFile = { attachmentId: string; assetId: string; filename: string; kind: "image" | "video" | "pdf" };

type Props = { workspaceId: string; taskId?: string; sectionId?: string; attached: AttachedFile[]; readOnly?: boolean };

/** Attached files as 48px thumbnails plus a picker that lists (and uploads into) the workspace's assets. */
export function AttachPicker({ workspaceId, taskId, sectionId, attached, readOnly }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const target = useMemo(() => (taskId ? { taskId } : { sectionId }), [taskId, sectionId]);

  const remove = (attachmentId: string) => start(async () => { await detachAsset(attachmentId); router.refresh(); });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {attached.map((f) => (
        <span key={f.attachmentId} className="group relative">
          <a href={fileUrl({ id: f.assetId, processedAt: null }, "original")} target="_blank" rel="noreferrer" title={f.filename} aria-label={`Open ${f.filename}`} className="block size-12 cursor-pointer overflow-hidden rounded-r border border-line bg-surface-2 transition-colors duration-150 hover:border-accent-line">
            <Thumb id={f.assetId} kind={f.kind} />
          </a>
          {!readOnly && (
            <button
              type="button"
              aria-label={`Remove ${f.filename}`}
              disabled={pending}
              onClick={() => remove(f.attachmentId)}
              title={`Remove ${f.filename}`}
              className="absolute -top-1.5 -right-1.5 hidden size-4 cursor-pointer items-center justify-center rounded-full border border-line bg-surface leading-none text-ink-2 shadow-panel transition-colors duration-150 group-hover:flex group-focus-within:flex hover:text-ink"
            >
              <Icon name="x" size={10} />
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <Button variant="ghost" size="sm" icon="paperclip" onClick={() => setOpen(true)}>Attach file</Button>
      )}
      {open && (
        <PickerDialog
          workspaceId={workspaceId}
          attachedIds={new Set(attached.map((a) => a.assetId))}
          onClose={() => setOpen(false)}
          onPick={(assetId) => start(async () => { await attachAsset(assetId, target); router.refresh(); })}
        />
      )}
    </div>
  );
}

function Thumb({ id, kind, processedAt = null }: { id: string; kind: "image" | "video" | "pdf"; processedAt?: number | null }) {
  if (kind === "pdf") return <span className="flex size-full items-center justify-center text-ink-3"><KindIcon kind="pdf" className="size-5" /></span>;
   
  return <img src={fileUrl({ id, processedAt }, "thumb")} alt="" loading="lazy" className="size-full object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />;
}

function PickerDialog({ workspaceId, attachedIds, onClose, onPick }: { workspaceId: string; attachedIds: Set<string>; onClose: () => void; onPick: (assetId: string) => void }) {
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () => listAssetsForPicker(workspaceId).then(setAssets).catch(() => setAssets([]));
  useEffect(() => { void listAssetsForPicker(workspaceId).then(setAssets).catch(() => setAssets([])); }, [workspaceId]);

  const { uploads, uploadFiles, dismiss } = useUploads({
    workspaceId,
    onDone: (res) => {
      void load();
      for (const a of res.assets) onPick(a.id);
    },
  });

  const q = query.trim().toLowerCase();
  const shown = (assets ?? []).filter((a) => !q || a.filename.toLowerCase().includes(q));

  return (
    <Dialog open onClose={onClose} title="Attach a file">
      <div className="flex gap-2">
        <Input autoFocus placeholder="Search by filename" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search files" />
        <Button icon="upload" onClick={() => fileInput.current?.click()} className="shrink-0">Upload</Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) void uploadFiles(files); }}
        />
      </div>
      <div className="mt-3 max-h-[52vh] overflow-auto">
        {assets === null ? (
          <p className="m-0 py-6 text-center text-ink-3">Loading…</p>
        ) : shown.length === 0 ? (
          assets.length === 0
            ? <Empty icon="upload" title="No files here yet" hint="Upload one and it is attached straight away." />
            : <Empty icon="search" title="Nothing matches" hint="Try a shorter search." />
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2 p-0" role="list" aria-label="Files">
            {shown.map((a) => {
              const done = attachedIds.has(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={done}
                    aria-label={done ? `${a.filename} (already attached)` : `Attach ${a.filename}`}
                    title={done ? `${a.filename} (already attached)` : a.filename}
                    onClick={() => { onPick(a.id); onClose(); }}
                    className={clsx(
                      "flex w-full flex-col gap-1 rounded-r border p-1 text-left transition-colors duration-150",
                      done ? "cursor-default border-accent-line bg-accent-soft" : "border-line-2 hover:border-line hover:bg-surface-2",
                    )}
                  >
                    <span className="block aspect-square w-full overflow-hidden rounded bg-surface-2">
                      <Thumb id={a.id} kind={a.kind} processedAt={a.processedAt} />
                    </span>
                    <span className="block truncate text-[11px] text-ink-2">{a.filename}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
      <UploadProgress uploads={uploads} onDismiss={dismiss} />
    </Dialog>
  );
}
