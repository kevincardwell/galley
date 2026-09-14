"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { guestWriteSection } from "@/actions/share";
import { useGuestName } from "./guest-name";

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message && !/server/i.test(e.message) ? e.message : fallback);

/**
 * A section the studio has handed to the client to write.
 *
 * A plain textarea, not the rich editor: a client has no account, and the words
 * matter more than the formatting. Blank lines become paragraphs, and the
 * studio can style it afterwards.
 */
export function GuestWrite({ token, sectionId, title, initialText }: { token: string; sectionId: string; title: string; initialText: string }) {
  const router = useRouter();
  const [name] = useGuestName();
  const [text, setText] = useState(initialText);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const dirty = text !== initialText;

  const save = () => {
    if (!text.trim()) {
      toast("Write something first", { tone: "late" });
      return;
    }
    if (!name.trim()) {
      toast("Add your name below first", { tone: "late" });
      document.getElementById(`name-${sectionId}`)?.focus();
      return;
    }
    start(async () => {
      try {
        await guestWriteSection(token, sectionId, name.trim(), text);
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
        toast("Sent to the studio", { tone: "done" });
        router.refresh();
      } catch (err) {
        toast(message(err, "Could not save your words"), { tone: "late" });
      }
    });
  };

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-accent-line bg-accent-soft p-4 font-ui text-[13px]">
      <p className="m-0 flex items-center gap-1.5 text-xs font-medium text-ink-2">
        <Icon name="pencil" size={13} />
        Over to you — write {title} here
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={20000}
        placeholder="Type or paste your words. Leave a blank line between paragraphs."
        aria-label={`Write ${title}`}
        className="min-h-40 bg-surface text-[14px] leading-relaxed"
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* The name field lives once per section, in the feedback box below. */}
        {saved && !dirty && <span className="mr-auto text-xs text-done">Sent to the studio</span>}
        <Button size="sm" variant="primary" icon="check" loading={pending} disabled={!text.trim()} onClick={save}>
          {pending ? "Sending…" : dirty ? "Send to the studio" : "Send again"}
        </Button>
      </div>
    </div>
  );
}
