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
import { Icon, IconButton } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { deleteAsset, moveToFolder, renameAsset, setTags } from "@/actions/assets";
import { KIND_ICON, KIND_LABEL, KindIcon } from "./asset-tile";
import { fileUrl, previewUrl } from "./urls";

type Props = { asset: AssetItem; folders: AssetFolder[]; shareToken: string | null; canEdit: boolean; onDeleted: () => void; onOpen: () => void };

/** One labelled block of the inspector, hairline-separated from the one above it. */
function Block({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("border-t border-line-2 pt-4 first:border-t-0 first:pt-0", className)}>
      <h3 className="m-0 mb-2 text-xs font-medium text-ink-3">{label}</h3>
      {children}
    </section>
  );
}

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
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onOpen}
        className="group relative block w-full cursor-pointer overflow-hidden rounded-r border border-line-2 bg-surface transition-colors duration-150 hover:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        title="Open in viewer"
        aria-label={`Open ${asset.filename} in viewer`}
      >
        <Preview asset={asset} />
        <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-medium text-surface">
            <Icon name="eye" size={13} /> Open
          </span>
        </span>
      </button>

      <div className="flex items-center gap-0.5">
        <Tooltip label="Download">
          <a
            href={fileUrl(asset, "original", { download: "1" })}
            download={asset.filename}
            title=""
            aria-label={`Download ${asset.filename}`}
            className="inline-grid size-7 cursor-pointer place-items-center rounded-r text-ink-3 transition-colors duration-150 hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name="download" />
          </a>
        </Tooltip>
        <Tooltip label={copied === "link" ? "Copied" : "Copy link"}>
          <IconButton name="link" label="Copy link to this file" title="" className="hover:bg-surface" onClick={() => copy(link(), "link")} />
        </Tooltip>
        {canEdit && (
          <Tooltip label="Delete">
            <IconButton name="trash" tone="danger" label={`Delete ${asset.filename}`} title="" onClick={() => setConfirm(true)} />
          </Tooltip>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-3">
          <Icon name={KIND_ICON[asset.kind]} size={13} />
          {KIND_LABEL[asset.kind]}
        </span>
      </div>

      <Block label="File">
        <Filename asset={asset} canEdit={canEdit} />
        <dl className="tnum m-0 mt-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
          <dt className="text-ink-3">Size</dt><dd className="m-0">{formatBytes(asset.bytes)}</dd>
          {asset.width && asset.height && (<><dt className="text-ink-3">Dimensions</dt><dd className="m-0">{asset.width} × {asset.height}</dd></>)}
          {asset.durationMs != null && (<><dt className="text-ink-3">Duration</dt><dd className="m-0">{formatDuration(asset.durationMs)}</dd></>)}
          <dt className="text-ink-3">Uploaded</dt><dd className="m-0">{asset.uploadedByName ?? "Someone"}, {timeAgo(asset.createdAt)}</dd>
        </dl>
        {asset.processError && (
          <p className="m-0 mt-2 flex items-start gap-1.5 text-xs text-late"><Icon name="alert" size={13} className="mt-px" />{asset.processError}</p>
        )}
        {!asset.processedAt && !asset.processError && (
          <p className="m-0 mt-2 flex items-center gap-1.5 text-xs text-ink-3"><Icon name="spinner" size={13} className="animate-spin" />Making thumbnails…</p>
        )}
      </Block>

      {asset.palette && asset.palette.length > 0 && (
        <Block label="Palette">
          <div className="flex flex-wrap items-center gap-1.5">
            {asset.palette.map((hex) => (
              <button
                key={hex}
                type="button"
                title={copied === hex ? "Copied" : hex}
                aria-label={`Copy ${hex}`}
                onClick={() => copy(hex, hex)}
                className={clsx(
                  "size-6 cursor-pointer rounded border border-line-2 transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-2",
                  copied === hex && "ring-2 ring-accent ring-offset-1 ring-offset-surface-2",
                )}
                style={{ background: hex }}
              />
            ))}
            <span aria-live="polite" className="ml-1 text-[11px] text-ink-3">{copied && asset.palette.includes(copied) ? `${copied} copied` : "Click to copy"}</span>
          </div>
        </Block>
      )}

      <Block label="Tags">
        <TagsEditor asset={asset} canEdit={canEdit} />
      </Block>

      {(folders.length > 0 || asset.folderId) && (
        <Block label="Folder">
          <Select
            aria-label="Folder"
            value={asset.folderId ?? ""}
            disabled={!canEdit || pending}
            onChange={(e) => { const v = e.target.value || null; start(() => moveToFolder(asset.id, v)); }}
          >
            <option value="">No folder</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </Block>
      )}

      <Block label="Used in">
        {asset.usedIn.length === 0 ? (
          <p className="m-0 text-[13px] text-ink-3">Not attached to anything yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
            {asset.usedIn.map((u) => (
              <li key={`${u.type}-${u.id}`}>
                <Link href={u.href} className="group flex items-center gap-1.5 text-ink-2 hover:text-ink">
                  <Icon name={u.type === "task" ? "checklist" : "text"} size={13} className="text-ink-3" />
                  <span className="min-w-0 truncate font-medium text-ink group-hover:underline">{u.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <p className="m-0 border-t border-line-2 pt-3 text-[11px] text-ink-3">
        {shareToken ? "The copied link works for anyone with the client share link." : "The copied link works for workspace members. Turn on the client share link to make it public."}
      </p>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete this file?">
        <p className="m-0 mb-4 text-ink-2">
          <b className="font-medium text-ink">{asset.filename}</b> will be removed from this workspace
          {asset.usedIn.length > 0 ? ` and detached from ${asset.usedIn.length} place${asset.usedIn.length === 1 ? "" : "s"}` : ""}. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" icon="trash" loading={pending} onClick={() => start(async () => { await deleteAsset(asset.id); setConfirm(false); onDeleted(); })}>Delete</Button>
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
    <div className="flex flex-col items-center justify-center gap-2 bg-surface-2 text-ink-3" style={{ aspectRatio: "4 / 3" }}>
      <KindIcon kind={asset.kind} size={26} />
      <span className="text-xs">{KIND_LABEL[asset.kind]}</span>
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
    <div className="flex flex-wrap items-center gap-1.5">
      {asset.tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-px text-xs text-ink-2">
          <Icon name="tag" size={11} className="text-ink-3" />
          {t}
          {canEdit && (
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              title={`Remove tag ${t}`}
              disabled={pending}
              onClick={() => save(asset.tags.filter((x) => x !== t))}
              className="-mr-0.5 inline-grid size-4 cursor-pointer place-items-center rounded-full text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
            >
              <Icon name="x" size={11} />
            </button>
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
          className="min-w-24 flex-1 rounded-r bg-transparent px-1 py-0.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      )}
      {!canEdit && asset.tags.length === 0 && <span className="text-[13px] text-ink-3">No tags.</span>}
    </div>
  );
}
