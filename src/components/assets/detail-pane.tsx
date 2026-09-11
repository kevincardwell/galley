"use client";
import Link from "next/link";
import { useState, useTransition, type KeyboardEvent } from "react";
import { clsx } from "@/lib/clsx";
import { formatBytes, timeAgo } from "@/lib/format";
import { formatDuration } from "@/lib/media/mime";
import type { AssetFolder, AssetItem } from "@/lib/media/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { deleteAsset, moveToFolder, renameAsset, setTags } from "@/actions/assets";
import { KindIcon } from "./asset-tile";
import { fileUrl, previewUrl } from "./urls";

type Props = { asset: AssetItem; folders: AssetFolder[]; shareToken: string | null; canEdit: boolean; onDeleted: () => void; onOpen: () => void };

const H = ({ children }: { children: React.ReactNode }) => <h3 className="m-0 mb-2 text-xs font-medium text-ink-3">{children}</h3>;

export function DetailPane({ asset, folders, shareToken, canEdit, onDeleted, onOpen }: Props) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const flash = (what: string) => { setCopied(what); setTimeout(() => setCopied(null), 1400); };
  const copy = (text: string, what: string) =>
    navigator.clipboard
      .writeText(text)
      .then(() => { flash(what); toast(what === "link" ? "Link copied" : `Copied ${what}`); })
      .catch(() => toast("Could not copy", { tone: "late" }));
  const link = () => {
    const base = `${window.location.origin}/api/file/${asset.id}/original`;
    return shareToken ? `${base}?share=${shareToken}` : base;
  };

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={onOpen} className="group relative block w-full overflow-hidden rounded-r border border-line-2 bg-surface" title="Open" aria-label="Open in viewer">
        <Preview asset={asset} />
      </button>

      <section>
        <H>File</H>
        <Filename asset={asset} canEdit={canEdit} />
        <dl className="tnum m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
          <dt className="text-ink-3">Size</dt><dd className="m-0">{formatBytes(asset.bytes)}</dd>
          {asset.width && asset.height && (<><dt className="text-ink-3">Dimensions</dt><dd className="m-0">{asset.width} × {asset.height}</dd></>)}
          {asset.durationMs != null && (<><dt className="text-ink-3">Duration</dt><dd className="m-0">{formatDuration(asset.durationMs)}</dd></>)}
          <dt className="text-ink-3">Uploaded</dt><dd className="m-0">{asset.uploadedByName ?? "Someone"}, {timeAgo(asset.createdAt)}</dd>
        </dl>
        {asset.processError && <p className="m-0 mt-2 text-xs text-late">{asset.processError}</p>}
        {!asset.processedAt && !asset.processError && <p className="m-0 mt-2 text-xs text-ink-3">Making thumbnails…</p>}
      </section>

      {asset.palette && asset.palette.length > 0 && (
        <section>
          <H>Palette</H>
          <div className="flex gap-1.5">
            {asset.palette.map((hex) => (
              <button
                key={hex}
                type="button"
                title={copied === hex ? "Copied" : hex}
                aria-label={`Copy ${hex}`}
                onClick={() => copy(hex, hex)}
                className={clsx("size-6 rounded border border-black/10 transition-transform duration-150 hover:scale-110", copied === hex && "ring-2 ring-accent ring-offset-1 ring-offset-surface-2")}
                style={{ background: hex }}
              />
            ))}
            <span aria-live="polite" className="ml-1 self-center text-[11px] text-ink-3">{copied && asset.palette.includes(copied) ? `${copied} copied` : "Click to copy"}</span>
          </div>
        </section>
      )}

      <section>
        <H>Tags</H>
        <TagsEditor asset={asset} canEdit={canEdit} />
      </section>

      {(folders.length > 0 || asset.folderId) && (
        <section>
          <H>Folder</H>
          <Select
            aria-label="Folder"
            value={asset.folderId ?? ""}
            disabled={!canEdit || pending}
            onChange={(e) => { const v = e.target.value || null; start(() => moveToFolder(asset.id, v)); }}
          >
            <option value="">No folder</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </section>
      )}

      <section>
        <H>Used in</H>
        {asset.usedIn.length === 0 ? (
          <p className="m-0 text-[13px] text-ink-3">Not attached to anything yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
            {asset.usedIn.map((u) => (
              <li key={`${u.type}-${u.id}`} className="flex gap-1.5 text-ink-2">
                <span className="shrink-0 text-ink-3">{u.type === "task" ? "Task:" : "Copy:"}</span>
                <Link href={u.href} className="min-w-0 truncate font-medium text-ink hover:underline">{u.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <a
            href={fileUrl(asset, "original", { download: "1" })}
            download={asset.filename}
            className="inline-flex flex-1 items-center justify-center rounded-r border border-line bg-surface px-3 py-1.5 font-medium transition-colors hover:bg-surface-2"
          >
            Download
          </a>
          <Button className="flex-1" onClick={() => copy(link(), "link")}>{copied === "link" ? "Copied" : "Copy link"}</Button>
        </div>
        {shareToken ? (
          <p className="m-0 text-[11px] text-ink-3">The link works for anyone with the client share link.</p>
        ) : (
          <p className="m-0 text-[11px] text-ink-3">The link works for workspace members. Turn on the client share link to make it public.</p>
        )}
        {canEdit && (
          <Button variant="danger" onClick={() => setConfirm(true)}>Delete</Button>
        )}
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete this file?">
        <p className="m-0 mb-4 text-ink-2">
          <b className="font-medium text-ink">{asset.filename}</b> will be removed from this workspace
          {asset.usedIn.length > 0 ? ` and detached from ${asset.usedIn.length} place${asset.usedIn.length === 1 ? "" : "s"}` : ""}. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { await deleteAsset(asset.id); setConfirm(false); onDeleted(); })}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}

function Preview({ asset }: { asset: AssetItem }) {
  const ratio = asset.width && asset.height ? `${asset.width} / ${asset.height}` : "4 / 3";
  if (asset.kind === "image" || (asset.kind === "video" && asset.processedAt && !asset.processError)) {
    return (
       
      <img src={asset.kind === "image" ? previewUrl(asset) : fileUrl(asset, "poster")} alt="" className="block w-full object-contain" style={{ aspectRatio: ratio, maxHeight: 260 }} />
    );
  }
  return (
    <div className="flex items-center justify-center text-ink-3" style={{ aspectRatio: "4 / 3" }}>
      <KindIcon kind={asset.kind} />
    </div>
  );
}

function Filename({ asset, canEdit }: { asset: AssetItem; canEdit: boolean }) {
  const [value, setValue] = useState(asset.filename);
  const [seen, setSeen] = useState(asset.filename);
  const [pending, start] = useTransition();
  if (seen !== asset.filename) {
    // Server-side rename (or another user's) landed: adopt it during render, not in an effect.
    setSeen(asset.filename);
    setValue(asset.filename);
  }
  if (!canEdit) return <div className="break-all font-medium">{asset.filename}</div>;
  const commit = () => {
    const v = value.trim();
    if (!v || v === asset.filename) { setValue(asset.filename); return; }
    start(() => renameAsset(asset.id, v));
  };
  return (
    <Input
      aria-label="Filename"
      value={value}
      disabled={pending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setValue(asset.filename); }}
      className="font-medium"
    />
  );
}

function TagsEditor({ asset, canEdit }: { asset: AssetItem; canEdit: boolean }) {
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const save = (tags: string[]) => start(() => setTags(asset.id, tags));
  const add = () => {
    const t = draft.trim().toLowerCase();
    if (!t) return;
    setDraft("");
    if (!asset.tags.includes(t)) save([...asset.tags, t]);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && draft === "" && asset.tags.length) save(asset.tags.slice(0, -1));
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {asset.tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-px text-xs text-ink-2">
          {t}
          {canEdit && (
            <button type="button" aria-label={`Remove tag ${t}`} disabled={pending} onClick={() => save(asset.tags.filter((x) => x !== t))} className="text-ink-3 hover:text-ink">×</button>
          )}
        </span>
      ))}
      {canEdit && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={asset.tags.length ? "Add tag" : "Add a tag, Enter to save"}
          aria-label="Add tag"
          className="min-w-24 flex-1 rounded bg-transparent px-1 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      )}
      {!canEdit && asset.tags.length === 0 && <span className="text-[13px] text-ink-3">No tags.</span>}
    </div>
  );
}
