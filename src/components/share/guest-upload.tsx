"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input, Label } from "@/components/ui/field";
import { clsx } from "@/lib/clsx";
import { useUploads } from "@/components/assets/upload-client";
import { UploadProgress } from "@/components/assets/upload-progress";

const NAME_KEY = "galley-guest-name";

/**
 * Lets a client send files in through the share link.
 *
 * There is no account here, so we ask once for a name and keep it in this
 * browser — the same thing the comment box does. The name is a label on the
 * file, not a credential: the share token is what actually grants the upload.
 */
export function GuestUpload({ token, maxUploadMb }: { token: string; maxUploadMb: number }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [asked, setAsked] = useState(false);

  // localStorage can throw in a private window; a forgotten name is not worth a crash.
  const remembered = () => {
    try {
      return localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      return "";
    }
  };
  const [ready, setReady] = useState<string | null>(null);
  if (ready === null) setReady(remembered());

  const { uploads, uploadFiles, dismiss } = useUploads({
    shareToken: token,
    guestName: ready || name,
    maxUploadMb,
    onDone: () => router.refresh(),
  });

  const send = (files: File[]) => {
    if (files.length === 0) return;
    const who = (ready || name).trim();
    if (!who) {
      setAsked(true);
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, who);
    } catch {
      /* not worth telling anyone about */
    }
    setReady(who);
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
        {(asked || !ready) && (
          <Label htmlFor="guest-name" className="mt-1 w-full max-w-xs text-left">
            <span className="text-xs font-medium text-ink-2">Your name</span>
            <Input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tom Marlow"
              aria-invalid={asked && !name.trim()}
            />
            {asked && !name.trim() && <span className="text-xs text-late">Tell us who you are first.</span>}
          </Label>
        )}
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
