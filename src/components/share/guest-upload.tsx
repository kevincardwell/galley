"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { clsx } from "@/lib/clsx";
import { useUploads } from "@/components/assets/upload-client";
import { askForName, useGuestName } from "./guest-name";
import { UploadProgress } from "@/components/assets/upload-progress";

export function GuestUpload({ token, maxUploadMb }: { token: string; maxUploadMb: number }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name] = useGuestName();
  const [dragging, setDragging] = useState(false);

  const { uploads, uploadFiles, dismiss } = useUploads({
    shareToken: token,
    guestName: name.trim(),
    maxUploadMb,
    onDone: () => router.refresh(),
  });

  const send = (files: File[]) => {
    if (files.length === 0) return;
    if (!name.trim()) return askForName();
    void uploadFiles(files);
  };

  return (
    <div className="mb-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); send(Array.from(e.dataTransfer.files)); }}
        className={clsx(
          "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-7 text-center transition-colors duration-150",
          dragging ? "border-accent bg-accent-soft" : "border-line bg-surface-2",
        )}
      >
        <Icon name="upload" size={20} className="text-ink-3" />
        <p className="m-0 text-[13px] font-medium">Send us a file</p>
        <p className="m-0 max-w-sm text-xs text-ink-2">
          Your logo, photographs, the old brochure — drop them here and they go straight to the studio. Up to {maxUploadMb} MB each.
        </p>
        <Button icon="upload" size="sm" className="mt-1" onClick={() => fileInput.current?.click()}>Choose files</Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { send(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
      </div>
      <UploadProgress uploads={uploads} onDismiss={dismiss} />
    </div>
  );
}
