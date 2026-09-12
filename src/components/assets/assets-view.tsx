"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { ACCEPT_ATTR, ACCEPTED_SUMMARY } from "@/lib/media/mime";
import type { AssetCounts, AssetFilters, AssetFolder, AssetItem } from "@/lib/media/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
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
    <div className="relative grid min-h-0 flex-1 grid-cols-1 min-[900px]:grid-cols-[1fr_336px]">
      <div className="min-h-0 overflow-auto px-4 pt-4 pb-8 sm:px-6 sm:pt-5">
        <FilterBar
          workspaceId={p.workspaceId}
          basePath={basePath}
          filters={p.filters}
          counts={p.counts}
          folders={p.folders}
          tags={p.tags}
          canEdit={p.canEdit}
          onUpload={pickFiles}
          storageBytes={p.storageBytes}
        />

        {p.items.length > 0 ? (
          <>
            <AssetGrid items={p.items} selectedId={p.selectedId} onSelect={select} onOpen={open} />
            {p.canEdit && (
              <p className="m-0 mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-lg border border-dashed border-line px-4 py-3.5 text-[13px] text-ink-3">
                <Icon name="upload" size={14} />
                Drop files anywhere, paste an image, or
                <button
                  type="button"
                  onClick={pickFiles}
                  className="cursor-pointer rounded-r font-medium underline decoration-line underline-offset-[3px] transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  choose files
                </button>
              </p>
            )}
          </>
        ) : p.totalCount > 0 && filtered ? (
          <Empty
            icon="filter"
            title="Nothing matches these filters"
            hint="Try another chip, or clear the filters and start again."
            action={<Button icon="undo" onClick={() => router.replace(basePath, { scroll: false })}>Show everything</Button>}
          />
        ) : (
          <EmptyState canEdit={p.canEdit} onPick={pickFiles} />
        )}

        <p className="tnum m-0 mt-6 text-xs text-ink-3">Accepts {ACCEPTED_SUMMARY}, up to {p.maxUploadMb} MB each.</p>
      </div>

      <aside className="hidden min-h-0 flex-col overflow-auto border-l border-line bg-surface-2 p-4 min-[900px]:flex">
        {detail ?? (
          <span className="m-auto flex max-w-[30ch] flex-col items-center gap-2 text-center text-[13px] text-ink-3">
            <Icon name="eye" size={18} />
            {p.items.length ? "Select a file to see its details." : "File details show up here."}
          </span>
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
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-accent bg-surface px-8 py-7 text-center">
          <span className="mb-3 grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon name="upload" size={18} />
          </span>
          <p className="m-0 text-base font-medium">Drop to upload</p>
          <p className="m-0 mt-1 text-ink-2">{p.filters.folder ? "Into the current folder" : "Into this workspace"}</p>
        </div>
      </div>
    </div>
  );
}

/** The whole pane becomes the drop target while the workspace has no files. */
function EmptyState({ canEdit, onPick }: { canEdit: boolean; onPick: () => void }) {
  return (
    <div className="grid min-h-[52vh] [&>*]:justify-center">
      {canEdit ? (
        <Empty
          icon="upload"
          title="Drop files here, paste an image, or upload"
          hint="Photos, logos, video and PDFs for this site. Thumbnails, dimensions and a colour palette are worked out for you."
          action={<Button variant="primary" icon="upload" onClick={onPick}>Upload files</Button>}
        />
      ) : (
        <Empty icon="image" title="No files yet" hint="Anything an editor uploads will show up here." />
      )}
    </div>
  );
}
