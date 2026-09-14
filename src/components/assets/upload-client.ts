"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { describeFile } from "@/lib/media/mime";
import type { UploadResponse } from "@/lib/media/types";

export type UploadEntry = { id: string; name: string; progress: number; status: "uploading" | "done" | "error"; error?: string };

/**
 * Where the files are going. A signed-in editor uploads into a workspace; a
 * client with a share link sends them in with their name instead.
 */
export type UploadTarget =
  | { workspaceId: string; folderId?: string | null }
  | { shareToken: string; guestName: string };

function targetFields(form: FormData, target: UploadTarget) {
  if ("shareToken" in target) {
    form.set("shareToken", target.shareToken);
    form.set("guestName", target.guestName);
    return;
  }
  form.set("workspaceId", target.workspaceId);
  if (target.folderId) form.set("folderId", target.folderId);
}

let seq = 0;

/** One XHR per file so each gets an honest progress bar. */
export function uploadFile(file: File, target: UploadTarget, onProgress: (fraction: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    targetFields(form, target);
    form.append("files", file, file.name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onload = () => {
      const body = xhr.response as UploadResponse | { error?: string } | null;
      if (xhr.status === 201 && body && "assets" in body) return resolve(body);
      if (body && "errors" in body && body.errors[0]) return reject(new Error(body.errors[0].error));
      if (body && "error" in body && body.error) return reject(new Error(body.error));
      reject(new Error(xhr.status === 404 ? "You cannot upload here" : `Upload failed (${xhr.status})`));
    };
    xhr.send(form);
  });
}

/** Files from a paste event, renamed so they do not all arrive as "image.png". */
export function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    const f = item.getAsFile();
    if (!f || !f.type.startsWith("image/")) continue;
    const ext = f.type === "image/jpeg" ? "jpg" : f.type.split("/")[1] ?? "png";
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    out.push(new File([f], `pasted-${stamp}.${ext}`, { type: f.type }));
  }
  return out;
}

/** Tracks a batch of uploads with per-file progress. Calls `onDone` after each success so the page can refresh. */
export function useUploads(opts: UploadTarget & { maxUploadMb?: number; onDone?: (res: UploadResponse) => void }) {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  const patch = useCallback((id: string, p: Partial<UploadEntry>) => {
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...p } : u)));
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const target = optsRef.current;
      // Checked here as well as on the server: without it the whole file is sent
      // up a domestic connection before the server refuses it.
      const maxBytes = (target.maxUploadMb ?? 0) * 1024 * 1024;
      const entries: { id: string; file: File }[] = [];
      const rejected: UploadEntry[] = [];
      for (const file of files) {
        const id = `u${++seq}`;
        if (!describeFile(file.name)) rejected.push({ id, name: file.name, progress: 0, status: "error", error: "Not an accepted file type" });
        else if (maxBytes && file.size > maxBytes) rejected.push({ id, name: file.name, progress: 0, status: "error", error: `Larger than the ${target.maxUploadMb} MB limit` });
        else entries.push({ id, file });
      }
      setUploads((list) => [...list, ...rejected, ...entries.map(({ id, file }) => ({ id, name: file.name, progress: 0, status: "uploading" as const }))]);
      for (const { id } of rejected) setTimeout(() => setUploads((l) => l.filter((u) => u.id !== id)), 6000);
      // Three at a time keeps the UI responsive on slow links without serialising everything.
      const queue = [...entries];
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const { id, file } = next;
          try {
            const res = await uploadFile(file, target, (f) => patch(id, { progress: f }));
            patch(id, { progress: 1, status: "done" });
            optsRef.current.onDone?.(res);
            setTimeout(() => setUploads((l) => l.filter((u) => u.id !== id)), 1800);
          } catch (err) {
            patch(id, { status: "error", error: err instanceof Error ? err.message : "Upload failed" });
            setTimeout(() => setUploads((l) => l.filter((u) => u.id !== id)), 8000);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, entries.length) }, worker));
    },
    [patch],
  );

  const dismiss = useCallback((id: string) => setUploads((l) => l.filter((u) => u.id !== id)), []);

  return { uploads, uploadFiles, dismiss };
}
