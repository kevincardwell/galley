"use client";
import { errorText } from "@/lib/user-error";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { clsx } from "@/lib/clsx";
import { saveTextEdit, siteStatus, updateSiteFromRemote, type SiteStatus } from "@/actions/site";
import { CodePanel } from "./code-panel";
import { ChangesDialog } from "./changes-dialog";

type Props = {
  workspaceId: string;
  previewUrl: string; // /api/site/<id>/<token>
  repoLabel: string;
  baseBranch: string;
};

type Page = { path: string; file: string; title: string; editable: number };

export function SiteScreen({ workspaceId, previewUrl, repoLabel, baseBranch }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [path, setPath] = useState("/");
  const pathRef = useRef("/");
  // The frame's src only changes on a deliberate reload: following a link inside it must not reload it twice.
  const [frameSrc, setFrameSrc] = useState(`${previewUrl}/`);
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState<Page | null>(null);
  const [editing, setEditing] = useState(true);
  const [code, setCode] = useState(false);
  const [status, setStatus] = useState<SiteStatus | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [updating, startUpdate] = useTransition();
  const scrollAfterLoad = useRef<number | null>(null);
  const lastScroll = useRef(0);

  const refresh = useCallback(
    async (fetch = false) => {
      try {
        setStatus(await siteStatus(workspaceId, { fetch }));
      } catch (e) {
        toast(errorText(e), { tone: "late" });
      }
    },
    [workspaceId],
  );
  useEffect(() => {
    let live = true;
    siteStatus(workspaceId).then(
      (s) => live && setStatus(s),
      (e) => toast(errorText(e), { tone: "late" }),
    );
    return () => {
      live = false;
    };
  }, [workspaceId]);
  // A running build is worth watching; nothing else changes on its own.
  useEffect(() => {
    if (status?.build?.state !== "running") return;
    const t = setInterval(() => void refresh(true), 15_000);
    return () => clearInterval(t);
  }, [status?.build?.state, refresh]);

  const post = useCallback((msg: unknown) => frame.current?.contentWindow?.postMessage(msg, "*"), []);
  useEffect(() => post({ type: "galley:mode", editing }), [editing, post, page]);

  /** Reloads the frame where it was, after the files under it changed. `fetch` also asks the remote what is new. */
  const redraw = useCallback((fetch = false) => {
    scrollAfterLoad.current ??= lastScroll.current;
    setFrameSrc(`${previewUrl}${pathRef.current}`);
    setReload((n) => n + 1);
    void refresh(fetch);
  }, [refresh, previewUrl]);

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      // The frame is sandboxed, so its origin is "null": who sent it is the check that matters.
      if (e.source !== frame.current?.contentWindow) return;
      const msg = e.data as { type?: string } & Record<string, unknown>;
      if (msg.type === "galley:page") {
        setPage({ path: String(msg.path), file: String(msg.file), title: String(msg.title ?? ""), editable: Number(msg.editable) || 0 });
        setPath(String(msg.path));
        pathRef.current = String(msg.path);
        if (scrollAfterLoad.current !== null) {
          post({ type: "galley:scroll", y: scrollAfterLoad.current });
          scrollAfterLoad.current = null;
        } else {
          lastScroll.current = 0; // a new page starts at the top
        }
      } else if (msg.type === "galley:scrolled") {
        lastScroll.current = Number(msg.y) || 0;
      } else if (msg.type === "galley:edit") {
        scrollAfterLoad.current = Number(msg.scrollY) || 0;
        try {
          await saveTextEdit(workspaceId, { file: String(msg.file), start: Number(msg.start), end: Number(msg.end), hash: String(msg.hash), html: String(msg.html) });
          toast("Saved. Send it for review when you are ready.", { tone: "done" });
        } catch (err) {
          toast(errorText(err), { tone: "late" });
        }
        redraw();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [workspaceId, post, redraw]);

  const n = status?.changes.length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
          <Icon name="globe" size={14} className="text-ink-3" />
          <span className="truncate font-medium text-ink">{page?.title || "Preview"}</span>
          <span className="truncate font-mono text-xs text-ink-3">{path}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div role="group" aria-label="Mode" className="flex rounded-r border border-line p-0.5">
            {[
              { on: !editing, label: "Browse", icon: "eye" as const, set: false },
              { on: editing, label: "Edit text", icon: "pencil" as const, set: true },
            ].map((m) => (
              <button
                key={m.label}
                type="button"
                aria-pressed={m.on}
                onClick={() => setEditing(m.set)}
                className={clsx("inline-flex cursor-pointer items-center gap-1.5 rounded-[4px] px-2 py-1 text-[13px] font-medium", m.on ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink")}
              >
                <Icon name={m.icon} size={13} />
                {m.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant={code ? "primary" : "default"} icon="code" aria-pressed={code} onClick={() => setCode((c) => !c)}>
            Code
          </Button>
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => redraw(true)} aria-label="Reload, and check for new work" title="Reload, and check for new work" />
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <ReviewPill status={status} />
          {!!status?.behind && (
            <Button size="sm" icon="download" loading={updating} onClick={() => startUpdate(async () => {
              try {
                const outcome = await updateSiteFromRemote(workspaceId);
                toast(outcome === "reset" ? `Up to date with ${baseBranch}. Ready for the next round of changes.` : `Brought in the latest from ${baseBranch}.`, { tone: "done" });
              } catch (e) {
                toast(errorText(e), { tone: "late", duration: 9000 });
              }
              redraw();
            })}>
              {status.behind} new on {baseBranch}
            </Button>
          )}
          <Button size="sm" variant={n ? "primary" : "default"} icon="pull-request" onClick={() => setChangesOpen(true)}>
            {n ? `Review ${n} change${n === 1 ? "" : "s"}` : "Changes"}
          </Button>
        </div>
      </div>

      {editing && page && page.editable === 0 && (
        <p className="m-0 border-b border-line bg-surface-2 px-4 py-1.5 text-xs text-ink-2">Nothing on this page can be edited by clicking. Open Code to change it.</p>
      )}
      {status?.error && <p className="m-0 border-b border-line bg-late-soft px-4 py-1.5 text-xs text-late">{status.error}</p>}

      <div className={clsx("grid min-h-0 flex-1", code ? "grid-cols-1 lg:grid-cols-[minmax(360px,46%)_1fr]" : "grid-cols-1")}>
        {code && <CodePanel workspaceId={workspaceId} openFile={page?.file ?? "index.html"} onSaved={() => redraw()} />}
        <div className="relative min-h-[60dvh] bg-surface-2 lg:min-h-0">
          <iframe
            key={reload}
            ref={frame}
            src={frameSrc}
            title={`Preview of ${repoLabel}`}
            // No allow-same-origin: the site's scripts must never run as the person looking at it.
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            className="absolute inset-0 h-full w-full border-0 bg-white"
          />
        </div>
      </div>

      <ChangesDialog
        open={changesOpen}
        onClose={() => setChangesOpen(false)}
        workspaceId={workspaceId}
        status={status}
        onChanged={() => redraw()}
      />
    </div>
  );
}

function ReviewPill({ status }: { status: SiteStatus | null }) {
  if (!status) return null;
  const { review, build } = status;
  if (!review) return status.unsent ? <Pill tone="draft">Not sent yet</Pill> : null;
  const tone = review.state === "merged" ? "done" : review.state === "closed" ? "neutral" : "review";
  const label = review.state === "merged" ? "merged" : review.state === "closed" ? "closed" : "in review";
  const buildText = build && build.state !== "none" ? ` · build ${build.state}` : "";
  return (
    <a href={build?.state === "failing" && build.url ? build.url : review.url} target="_blank" rel="noreferrer" className="no-underline">
      <Pill tone={build?.state === "failing" ? "late" : tone}>
        #{review.number} {label}
        {buildText}
      </Pill>
    </a>
  );
}
