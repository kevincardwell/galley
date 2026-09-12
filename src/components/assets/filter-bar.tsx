"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clsx } from "@/lib/clsx";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/field";
import { Icon, IconButton, type IconName } from "@/components/ui/icon";
import { Stat } from "@/components/ui/stat";
import { createFolder, deleteFolder, renameFolder } from "@/actions/assets";
import type { AssetCounts, AssetFilters, AssetFolder } from "@/lib/media/types";

function Chip({ href, on, icon, count, children }: { href: string; on: boolean; icon?: IconName; count?: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={clsx(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] whitespace-nowrap transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
        on ? "border-accent-line bg-accent-soft font-medium text-accent" : "border-line text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {icon && <Icon name={icon} size={13} className={on ? undefined : "text-ink-3"} />}
      <span className="truncate">{children}</span>
      {count !== undefined && <span className={clsx("tnum text-xs", on ? "opacity-80" : "text-ink-3")}>{count}</span>}
    </Link>
  );
}

type Props = {
  workspaceId: string;
  basePath: string;
  filters: AssetFilters;
  counts: AssetCounts;
  folders: AssetFolder[];
  tags: { tag: string; count: number }[];
  canEdit: boolean;
  onUpload: () => void;
  storageBytes: number;
};

export function FilterBar({ workspaceId, basePath, filters, counts, folders, tags, canEdit, onUpload, storageBytes }: Props) {
  const href = (f: AssetFilters) => {
    const q = new URLSearchParams();
    if (f.kind) q.set("kind", f.kind);
    if (f.tag) q.set("tag", f.tag);
    if (f.folder) q.set("folder", f.folder);
    if (f.unused) q.set("unused", "1");
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const none = !filters.kind && !filters.tag && !filters.folder && !filters.unused;
  const activeFolder = folders.find((f) => f.id === filters.folder);
  const secondRow = folders.length > 0 || tags.length > 0;

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Chip href={href({})} on={none} icon="board" count={counts.all}>All</Chip>
          <Chip href={href({ ...filters, kind: filters.kind === "image" ? undefined : "image" })} on={filters.kind === "image"} icon="image" count={counts.image}>Images</Chip>
          <Chip href={href({ ...filters, kind: filters.kind === "video" ? undefined : "video" })} on={filters.kind === "video"} icon="play" count={counts.video}>Video</Chip>
          <Chip href={href({ ...filters, kind: filters.kind === "pdf" ? undefined : "pdf" })} on={filters.kind === "pdf"} icon="file" count={counts.pdf}>PDF</Chip>
          <Chip href={href({ ...filters, unused: !filters.unused })} on={!!filters.unused} icon="inbox" count={counts.unused}>Not used yet</Chip>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <Stat className="tnum items-end" icon="storage" label="Storage" value={formatBytes(storageBytes)} hint={`${counts.all} ${counts.all === 1 ? "file" : "files"}`} />
          {canEdit && (
            <div className="flex items-center gap-2">
              <NewFolder workspaceId={workspaceId} />
              <Button variant="primary" icon="upload" onClick={onUpload}>Upload</Button>
            </div>
          )}
        </div>
      </div>

      {secondRow && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line-2 pt-3">
          {folders.map((f) => (
            <Chip key={f.id} href={href({ ...filters, folder: filters.folder === f.id ? undefined : f.id })} on={filters.folder === f.id} icon="folder" count={f.count}>
              {f.name}
            </Chip>
          ))}
          {canEdit && activeFolder && <FolderMenu folder={activeFolder} clearHref={href({ ...filters, folder: undefined })} />}
          {folders.length > 0 && tags.length > 0 && <span className="mx-1 h-4 w-px bg-line" aria-hidden />}
          {tags.map((t) => (
            <Chip key={t.tag} href={href({ ...filters, tag: filters.tag === t.tag ? undefined : t.tag })} on={filters.tag === t.tag} icon="tag" count={t.count}>
              {t.tag}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function NewFolder({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const submit = () => {
    const v = name.trim();
    if (!v) return;
    start(async () => { await createFolder(workspaceId, v); setName(""); setOpen(false); });
  };
  return (
    <>
      <Button variant="ghost" icon="folder" onClick={() => setOpen(true)}>New folder</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New folder">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Label htmlFor="new-folder-name">Folder name
            <Input id="new-folder-name" autoFocus placeholder="Folder name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Label>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={pending} disabled={!name.trim()}>Create</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function FolderMenu({ folder, clearHref }: { folder: AssetFolder; clearHref: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "rename" | "delete">("none");
  const [name, setName] = useState(folder.name);
  const [pending, start] = useTransition();
  const close = () => setMode("none");
  const remove = () => start(async () => { await deleteFolder(folder.id); close(); router.replace(clearHref, { scroll: false }); });
  return (
    <span className="ml-0.5 inline-flex items-center gap-0.5">
      <IconButton name="pencil" label={`Rename ${folder.name}`} size={14} onClick={() => { setName(folder.name); setMode("rename"); }} />
      <IconButton name="trash" tone="danger" label={`Delete ${folder.name}`} size={14} onClick={() => setMode("delete")} />
      <Dialog open={mode === "rename"} onClose={close} title="Rename folder">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); start(async () => { await renameFolder(folder.id, name); close(); }); }}>
          <Label htmlFor={`rename-folder-${folder.id}`}>Folder name
            <Input id={`rename-folder-${folder.id}`} autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Label>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={close}>Cancel</Button>
            <Button type="submit" variant="primary" loading={pending} disabled={!name.trim()}>Save</Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={mode === "delete"} onClose={close} title="Delete folder">
        <p className="m-0 mb-4 text-ink-2">The {folder.count} file{folder.count === 1 ? "" : "s"} inside will move back to the top level. Nothing is deleted.</p>
        <div className="flex justify-end gap-2">
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" loading={pending} onClick={remove}>Delete folder</Button>
        </div>
      </Dialog>
    </span>
  );
}
