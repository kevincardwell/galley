"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Empty } from "@/components/ui/empty";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import { PROVIDER_LABELS } from "@/lib/email/providers";

export type MailLogRow = {
  id: number;
  to: string;
  subject: string;
  provider: string;
  ok: boolean;
  error: string | null;
  body: string | null;
  html: string | null;
  createdAt: number;
};

const providerLabel = (p: string) => PROVIDER_LABELS[p as keyof typeof PROVIDER_LABELS] ?? p;
const sentAt = (unix: number) => new Date(unix * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The last hundred attempts. Click one to read exactly what went out. */
export function MailLog({ rows }: { rows: MailLogRow[] }) {
  const [open, setOpen] = useState<MailLogRow | null>(null);
  const [asText, setAsText] = useState(false);

  if (rows.length === 0) {
    return <Empty icon="mail" title="Nothing sent yet" hint="Send a test email and it will show up here, along with anything that fails." />;
  }

  const show = (row: MailLogRow) => {
    setAsText(!row.html);
    setOpen(row);
  };

  return (
    <>
      <ul className="m-0 list-none divide-y divide-line-2 rounded-lg border border-line p-0">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => show(row)}
              className="flex w-full cursor-pointer items-start gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
              title="Read this email"
            >
              <Icon name={row.ok ? "check-circle" : "alert"} size={15} className={row.ok ? "mt-0.5 text-done" : "mt-0.5 text-late"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{row.subject}</span>
                <span className="block truncate text-xs text-ink-3">
                  {row.to} · {providerLabel(row.provider)}
                  {row.error ? ` · ${row.error}` : ""}
                </span>
              </span>
              <span className="shrink-0 self-center text-xs text-ink-3">{timeAgo(row.createdAt)}</span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.subject ?? "Email"}>
        {open && (
          <div className="flex flex-col gap-3">
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
              <dt className="text-ink-3">To</dt>
              <dd className="m-0 truncate">{open.to}</dd>
              <dt className="text-ink-3">Sent</dt>
              <dd className="m-0">{sentAt(open.createdAt)} · {providerLabel(open.provider)}</dd>
              <dt className="text-ink-3">Result</dt>
              <dd className="m-0">
                {open.ok ? <span className="text-done">Delivered to the provider</span> : <span className="text-late">Failed{open.error ? `: ${open.error}` : ""}</span>}
              </dd>
            </dl>

            {open.html && (
              <div className="flex gap-1 self-start rounded-r border border-line bg-surface-2 p-0.5" role="group" aria-label="Preview format">
                {[
                  { key: false, label: "Formatted" },
                  { key: true, label: "Plain text" },
                ].map(({ key, label }) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={asText === key}
                    onClick={() => setAsText(key)}
                    className={clsx(
                      "cursor-pointer rounded-r px-2 py-0.5 text-xs font-medium transition-colors duration-150",
                      asText === key ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {open.html && !asText ? (
              // Sandboxed: section titles, client names and guest names all end up
              // in this HTML, so it is rendered with no scripts and no same-origin.
              <iframe
                key={`${open.id}-html`}
                title={`Preview of “${open.subject}”`}
                srcDoc={open.html}
                sandbox=""
                className="h-[52vh] w-full rounded-lg border border-line bg-white"
              />
            ) : open.body ? (
              <pre className="m-0 max-h-[52vh] overflow-x-hidden overflow-y-auto rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                {open.body}
              </pre>
            ) : (
              <p className="m-0 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">
                This one was sent before Galley kept message bodies, so there is nothing to show.
              </p>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
