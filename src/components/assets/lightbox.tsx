"use client";
import { useEffect, useRef } from "react";
import { formatBytes } from "@/lib/format";
import type { AssetItem } from "@/lib/media/types";
import { fileUrl, previewUrl } from "./urls";

type Props = { items: AssetItem[]; index: number; onIndex: (i: number) => void; onClose: () => void };

/** Full-screen viewer. Arrows / j k move, Esc closes. Renders inside a native dialog so focus is trapped. */
export function Lightbox({ items, index, onIndex, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const asset = items[index];
  const prev = () => onIndex((index - 1 + items.length) % items.length);
  const next = () => onIndex((index + 1) % items.length);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "k") { e.preventDefault(); prev(); }
      if (e.key === "ArrowRight" || e.key === "j") { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!asset) return null;
  const many = items.length > 1;
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      // Inline: globals.css styles `dialog` outside any layer, which would beat utility classes.
      style={{ width: "100vw", height: "100dvh", maxWidth: "none", maxHeight: "none", margin: 0, padding: 0, border: 0, borderRadius: 0, background: "rgba(8,8,8,0.94)", color: "#fff" }}
      aria-label={asset.filename}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-white/80">
          <span className="min-w-0 truncate font-medium text-white">{asset.filename}</span>
          <span className="tnum shrink-0">{asset.width && asset.height ? `${asset.width} × ${asset.height} · ` : ""}{formatBytes(asset.bytes)}</span>
          {many && <span className="tnum ml-auto shrink-0">{index + 1} / {items.length}</span>}
          <a href={fileUrl(asset, "original", { download: "1" })} className="rounded-r border border-white/25 px-2.5 py-1 hover:bg-white/10" download>Download</a>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-r border border-white/25 px-2.5 py-1 hover:bg-white/10">Esc</button>
        </header>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          {asset.kind === "image" && (
             
            <img key={asset.id} src={previewUrl(asset)} alt={asset.filename} className="max-h-full max-w-full object-contain" />
          )}
          {asset.kind === "video" && (
            <video key={asset.id} src={fileUrl(asset, "original")} poster={asset.processedAt ? fileUrl(asset, "poster") : undefined} controls autoPlay className="max-h-full max-w-full" />
          )}
          {asset.kind === "pdf" && <iframe key={asset.id} src={fileUrl(asset, "original")} title={asset.filename} className="h-full w-full max-w-5xl rounded-r border-0 bg-white" />}
          {many && (
            <>
              <button type="button" onClick={prev} aria-label="Previous" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/25 p-2 hover:bg-white/10">
                <Arrow dir="left" />
              </button>
              <button type="button" onClick={next} aria-label="Next" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/25 p-2 hover:bg-white/10">
                <Arrow dir="right" />
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}
