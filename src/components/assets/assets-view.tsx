"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { formatBytes } from "@/lib/format";
import { ACCEPT_ATTR, ACCEPTED_SUMMARY } from "@/lib/media/mime";
import type { AssetCounts, AssetFilters, AssetFolder, AssetItem } from "@/lib/media/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AssetGrid } from "./asset-grid";
import { DetailPane } from "./detail-pane";
import { FilterBar } from "./filter-bar";
import { Lightbox } from "./lightbox";
import { UploadProgress } from "./upload-progress";
import { filesFromClipboard, useUploads } from "./upload-client";
import { useMediaQuery } from "./use-media-query";

type Props = {
  workspaceId: string;
  slug: string;
  items: AssetItem[];
  totalCount: number;
  counts: AssetCounts;
  folders: AssetFolder[];
  tags: { tag: string; count: number }[];
  filters: AssetFilters;
  selectedId: string | null;
  canEdit: boolean;
  shareToken: string | null;
  storageBytes: number;
  maxUploadMb: number;
};

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

export function AssetsView(p: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const narrow = useMediaQuery("(max-width: 899px)");
  const fileInput = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const basePath = `/w/${p.slug}/assets`;
  const selected = p.items.find((a) => a.id === p.selectedId) ?? null;

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const q = new URLSearchParams(search.toString());
      if (value) q.set(key, value);
      else q.delete(key);
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname, search],
  );
  const select = useCallback((id: string | null) => setParam("asset", id), [setParam]);
  const open = useCallback((id: string) => {
    const i = p.items.findIndex((a) => a.id === id);
    if (i >= 0) setLightbox(i);
  }, [p.items]);

  // Uploads: button, drop, paste.
  const { uploads, uploadFiles, dismiss } = useUploads({ workspaceId: p.workspaceId, folderId: p.filters.folder ?? null, onDone: () => router.refresh() });

  useEffect(() => {
    if (!p.canEdit) return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current++; setDragging(true); };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onLeave = (e: DragEvent) => { if (!hasFiles(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragging(false); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) void uploadFiles(files);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      const files = filesFromClipboard(e.clipboardData);
      if (files.length) { e.preventDefault(); void uploadFiles(files); }
    };
    document.addEventListener("dragenter", onEnter);
    document.addEventListener("dragover", onOver);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("drop", onDrop);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("dragenter", onEnter);
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("paste", onPaste);
    };
  }, [p.canEdit, uploadFiles]);

  // Poll while thumbnails are still being made.
  const processing = p.items.some((a) => !a.processedAt && !a.processError);
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(t);
  }, [processing, router]);

  // Keyboard: arrows move the selection in the grid when nothing else has focus.
  useEffect(() => {
    if (lightbox !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("dialog[open]")) return;
      const i = p.items.findIndex((a) => a.id === p.selectedId);
      if ((e.key === "ArrowRight" || e.key === "j") && p.items.length) { e.preventDefault(); select(p.items[Math.min(p.items.length - 1, i + 1)]!.id); }
      if ((e.key === "ArrowLeft" || e.key === "k") && p.items.length) { e.preventDefault(); select(p.items[Math.max(0, i - 1)]!.id); }
      if (e.key === "Enter" && i >= 0) { e.preventDefault(); setLightbox(i); }
      if (e.key === "Escape" && i >= 0) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, p.items, p.selectedId, select]);

  // Clamp rather than sync: the list can shrink underneath an open lightbox after a refresh.
  const lightboxIndex = lightbox === null || p.items.length === 0 ? null : Math.min(lightbox, p.items.length - 1);

  const pickFiles = () => fileInput.current?.click();
  const filtered = !!(p.filters.kind || p.filters.tag || p.filters.folder || p.filters.unused);

  const detail = selected && (
    <DetailPane
      key={selected.id}
      asset={selected}
      folders={p.folders}
      shareToken={p.shareToken}
      canEdit={p.canEdit}
      onDeleted={() => select(null)}
      onOpen={() => open(selected.id)}
    />
  );

  return (
    <div className="relative grid min-h-0 flex-1 grid-cols-1 min-[900px]:grid-cols-[1fr_260px]">
      <div className="min-h-0 overflow-auto px-6 pb-8 pt-5">
        <FilterBar workspaceId={p.workspaceId} basePath={basePath} filters={p.filters} counts={p.counts} folders={p.folders} tags={p.tags} canEdit={p.canEdit} onUpload={pickFiles} />

        {p.items.length > 0 ? (
          <>
            <AssetGrid items={p.items} selectedId={p.selectedId} onSelect={select} onOpen={open} />
            {p.canEdit && (
              <p className="m-0 mt-1.5 rounded-r border-[1.5px] border-dashed border-line px-4 py-4 text-center text-ink-3">
                Drop files anywhere, paste an image, or <button type="button" onClick={pickFiles} className="underline decoration-line underline-offset-[3px] hover:text-ink">choose files</button>
              </p>
            )}
          </>
        ) : p.totalCount > 0 && filtered ? (
          <div className="rounded-r border border-dashed border-line px-6 py-10 text-center">
            <p className="m-0 font-medium">Nothing matches these filters</p>
            <p className="m-0 mt-1 text-ink-2">Try another chip, or <button type="button" onClick={() => router.replace(basePath, { scroll: false })} className="underline underline-offset-[3px]">show everything</button>.</p>
          </div>
        ) : (
          <EmptyState canEdit={p.canEdit} onPick={pickFiles} />
        )}

        <p className="tnum m-0 mt-6 text-xs text-ink-3">
          {p.totalCount} file{p.totalCount === 1 ? "" : "s"} · {formatBytes(p.storageBytes)} · up to {p.maxUploadMb} MB each
        </p>
      </div>

      <aside className="hidden min-h-0 flex-col gap-5 overflow-auto border-l border-line bg-surface-2 p-4 min-[900px]:flex">
        {detail ?? (
          <p className="m-0 mt-2 text-center text-[13px] text-ink-3">{p.items.length ? "Select a file to see its details." : ""}</p>
        )}
      </aside>

      {narrow && selected && (
        <Dialog open onClose={() => select(null)} title={selected.filename}>
          {detail}
        </Dialog>
      )}

      {lightboxIndex !== null && (
        <Lightbox items={p.items} index={lightboxIndex} onIndex={setLightbox} onClose={() => setLightbox(null)} />
      )}

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void uploadFiles(files);
        }}
      />

      <UploadProgress uploads={uploads} onDismiss={dismiss} />

      <div
        aria-hidden
        className={clsx(
          "pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-accent-soft/80 backdrop-blur-[2px] transition-opacity duration-150",
          dragging ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="rounded-[10px] border-2 border-dashed border-accent bg-surface px-8 py-6 text-center">
          <p className="m-0 text-base font-medium">Drop to upload</p>
          <p className="m-0 mt-1 text-ink-2">{p.filters.folder ? "Into the current folder" : "Into this workspace"}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ canEdit, onPick }: { canEdit: boolean; onPick: () => void }) {
  return (
    <div className="flex min-h-[46vh] flex-col items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-line px-6 py-14 text-center">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-3" aria-hidden>
        <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </svg>
      {canEdit ? (
        <>
          <p className="m-0 mt-4 text-base font-medium">Drop files here, paste an image, or upload</p>
          <p className="m-0 mt-1 max-w-md text-ink-2">Photos, logos, video and PDFs for this site. Thumbnails, dimensions and a colour palette are worked out for you.</p>
          <Button variant="primary" className="mt-5" onClick={onPick}>Upload files</Button>
          <p className="m-0 mt-4 text-xs text-ink-3">Accepts {ACCEPTED_SUMMARY}.</p>
        </>
      ) : (
        <>
          <p className="m-0 mt-4 text-base font-medium">No files yet</p>
          <p className="m-0 mt-1 text-ink-2">Anything an editor uploads will show up here.</p>
        </>
      )}
    </div>
  );
}
