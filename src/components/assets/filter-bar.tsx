"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clsx } from "@/lib/clsx";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { createFolder, deleteFolder, renameFolder } from "@/actions/assets";
import type { AssetCounts, AssetFilters, AssetFolder } from "@/lib/media/types";

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[13px] transition-colors duration-150",
        on ? "border-ink bg-ink text-surface" : "border-line text-ink-2 hover:border-line hover:bg-surface-2 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

const N = ({ n }: { n: number }) => <span className="tnum opacity-70">{n}</span>;

type Props = {
  workspaceId: string;
  basePath: string;
  filters: AssetFilters;
  counts: AssetCounts;
  folders: AssetFolder[];
  tags: { tag: string; count: number }[];
  canEdit: boolean;
  onUpload: () => void;
};

export function FilterBar({ workspaceId, basePath, filters, counts, folders, tags, canEdit, onUpload }: Props) {
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

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Chip href={href({})} on={none}>All <N n={counts.all} /></Chip>
      <Chip href={href({ ...filters, kind: filters.kind === "image" ? undefined : "image" })} on={filters.kind === "image"}>Images <N n={counts.image} /></Chip>
      <Chip href={href({ ...filters, kind: filters.kind === "video" ? undefined : "video" })} on={filters.kind === "video"}>Video <N n={counts.video} /></Chip>
      <Chip href={href({ ...filters, kind: filters.kind === "pdf" ? undefined : "pdf" })} on={filters.kind === "pdf"}>PDF <N n={counts.pdf} /></Chip>
      <Chip href={href({ ...filters, unused: !filters.unused })} on={!!filters.unused}>Not used yet <N n={counts.unused} /></Chip>
      {folders.length > 0 && <span className="mx-1 h-4 w-px bg-line" aria-hidden />}
      {folders.map((f) => (
        <Chip key={f.id} href={href({ ...filters, folder: filters.folder === f.id ? undefined : f.id })} on={filters.folder === f.id}>
          <FolderGlyph /> {f.name} <N n={f.count} />
        </Chip>
      ))}
      {tags.length > 0 && <span className="mx-1 h-4 w-px bg-line" aria-hidden />}
      {tags.map((t) => (
        <Chip key={t.tag} href={href({ ...filters, tag: filters.tag === t.tag ? undefined : t.tag })} on={filters.tag === t.tag}>
          #{t.tag} <N n={t.count} />
        </Chip>
      ))}
      {canEdit && (
        <div className="ml-auto flex items-center gap-2">
          {activeFolder && <FolderMenu folder={activeFolder} clearHref={href({ ...filters, folder: undefined })} />}
          <NewFolder workspaceId={workspaceId} />
          <Button variant="primary" onClick={onUpload}>Upload</Button>
        </div>
      )}
    </div>
  );
}

function FolderGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
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
      <Button variant="ghost" onClick={() => setOpen(true)}>New folder</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New folder">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Input autoFocus placeholder="Folder name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending || !name.trim()}>Create</Button>
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
    <>
      <Button variant="ghost" size="sm" onClick={() => { setName(folder.name); setMode("rename"); }}>Rename folder</Button>
      <Button variant="ghost" size="sm" onClick={() => setMode("delete")}>Delete folder</Button>
      <Dialog open={mode === "rename"} onClose={close} title="Rename folder">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); start(async () => { await renameFolder(folder.id, name); close(); }); }}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={close}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending || !name.trim()}>Save</Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={mode === "delete"} onClose={close} title="Delete folder">
        <p className="m-0 mb-4 text-ink-2">The {folder.count} file{folder.count === 1 ? "" : "s"} inside will move back to the top level. Nothing is deleted.</p>
        <div className="flex justify-end gap-2">
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" disabled={pending} onClick={remove}>Delete folder</Button>
        </div>
      </Dialog>
    </>
  );
}
