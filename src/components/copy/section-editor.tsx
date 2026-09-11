"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { clsx } from "@/lib/clsx";
import { saveSection } from "@/actions/copy";
import { copyExtensions } from "@/lib/collab/extensions";
import { createSseProvider, type CollabConnection, type CollabStatus, type Peer, type SseProvider } from "@/lib/collab/client";
import { colorFor } from "@/lib/collab/colors";
import { tiptapToText, wordCount, type TiptapDoc } from "@/lib/copy/serialize";
import { statusTone, type SectionRow } from "@/lib/copy/types";
import { StatusDot } from "./status-dot";
import { Toolbar } from "./toolbar";

// "conflict" no longer happens (Yjs merges concurrent edits) but stays in the
// union so the details pane's label table keeps compiling.
export type SaveState = "idle" | "dirty" | "saving" | "saved" | "conflict" | "error";
export type Stats = { words: number; chars: number };
export type EditorHandle = { getDoc: () => TiptapDoc; saveNow: () => Promise<void>; focus: () => void };

type Props = {
  section: SectionRow;
  active: boolean;
  readOnly: boolean;
  autoFocus: boolean;
  selfName: string;
  connection: CollabConnection;
  onActivate: (id: string) => void;
  onState: (id: string, state: SaveState) => void;
  onStats: (id: string, stats: Stats) => void;
  onPeers: (id: string, peers: Peer[]) => void;
  register: (id: string, handle: EditorHandle | null) => void;
};

function statsOf(doc: TiptapDoc): Stats {
  const text = tiptapToText(doc);
  return { words: wordCount(text), chars: text.length };
}

/** Caret for another person: a thin bar in their colour with their name above it. Styled inline so no global CSS is needed. */
function renderCaret(user: Record<string, unknown>): HTMLElement {
  const color = typeof user.color === "string" ? user.color : "#888";
  const name = typeof user.name === "string" ? user.name : "Someone";
  const caret = document.createElement("span");
  caret.style.cssText = `position:relative;border-left:2px solid ${color};margin-left:-1px;margin-right:-1px;pointer-events:none;word-break:normal;`;
  const label = document.createElement("span");
  label.style.cssText = `position:absolute;top:-1.35em;left:-2px;padding:1px 5px;border-radius:4px;background:${color};color:#fff;font:600 10px/1.4 var(--font-ui,system-ui);white-space:nowrap;user-select:none;`;
  label.textContent = name;
  caret.appendChild(label);
  return caret;
}

/**
 * One section of the page: margin label, floating toolbar and a Tiptap editor
 * bound to a shared Yjs document. Nothing is "saved" by the editor itself:
 * every keystroke becomes a Yjs update the provider ships to the server, which
 * appends it to a durable log and compacts it into the section on a timer.
 */
export function SectionEditor({ section, active, readOnly, autoFocus, selfName, connection, onActivate, onState, onStats, onPeers, register }: Props) {
  const [doc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<SseProvider | null>(null);
  const [status, setStatus] = useState<CollabStatus>("connecting");
  const setState = useCallback((s: SaveState) => onState(section.id, s), [onState, section.id]);
  // Latest callbacks for the provider, which is created once and must not be rebuilt when they change.
  const optsRef = useRef({ setState, onPeers, sectionId: section.id });
  useEffect(() => {
    optsRef.current = { setState, onPeers, sectionId: section.id };
  }, [setState, onPeers, section.id]);

  // The provider touches window/EventSource, so it can only exist after mount.
  useEffect(() => {
    const p = createSseProvider({
      sectionId: section.id,
      doc,
      user: { name: selfName, color: colorFor(selfName) },
      readOnly,
      connection,
      onStatus: setStatus,
      onPending: (s) => optsRef.current.setState(s),
      onSaved: () => optsRef.current.setState("saved"),
      onPeers: (peers) => optsRef.current.onPeers(optsRef.current.sectionId, peers),
    });
    setProvider(p);
    return () => {
      p.destroy();
      setProvider(null);
    };
  }, [connection, doc, section.id, selfName, readOnly]);

  const editing = active && !readOnly;

  return (
    <section
      id={`s-${section.id}`}
      data-active={active || undefined}
      onMouseDown={() => onActivate(section.id)}
      className={clsx(
        "sec relative scroll-mt-6 border-t border-line-2 py-4 pb-[18px] transition-colors first:border-t-0",
        editing && "-mx-4 rounded-r border-t-0 bg-accent-soft px-4",
      )}
    >
      <div
        className={clsx(
          "mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-3",
          "min-[900px]:absolute min-[900px]:top-4 min-[900px]:mb-0 min-[900px]:w-[100px] min-[900px]:justify-end min-[900px]:text-right",
          editing ? "min-[900px]:-left-[102px]" : "min-[900px]:-left-[118px]",
        )}
      >
        <span className="truncate">{section.title}</span>
        <StatusDot tone={statusTone(section.status)} />
      </div>

      {status === "offline" && (
        <div className="mb-2 flex justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-px text-xs font-medium text-ink-2" role="status">
            <span className="size-1.5 rounded-full bg-late" />
            Offline, changes will sync
          </span>
        </div>
      )}

      {provider ? (
        <LiveEditor
          section={section}
          doc={doc}
          provider={provider}
          editing={editing}
          readOnly={readOnly}
          autoFocus={autoFocus}
          selfName={selfName}
          onActivate={onActivate}
          onStats={onStats}
          setState={setState}
          register={register}
        />
      ) : (
        // Server render and the first client frame: the last saved copy, read-only, so the page has its shape immediately.
        <StaticCopy content={section.content} />
      )}
    </section>
  );
}

type LiveProps = {
  section: SectionRow;
  doc: Y.Doc;
  provider: SseProvider;
  editing: boolean;
  readOnly: boolean;
  autoFocus: boolean;
  selfName: string;
  onActivate: (id: string) => void;
  onStats: (id: string, stats: Stats) => void;
  setState: (s: SaveState) => void;
  register: (id: string, handle: EditorHandle | null) => void;
};

function LiveEditor({ section, doc, provider, editing, readOnly, autoFocus, selfName, onActivate, onStats, setState, register }: LiveProps) {
  const editorRef = useRef<Editor | null>(null);
  // Collaboration fills the editor synchronously while it is being built, which
  // is still render time; parent state may only change once we are mounted.
  const mountedRef = useRef(false);

  const editor = useEditor(
    {
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editable: !readOnly,
      extensions: [
        ...copyExtensions(),
        Placeholder.configure({ placeholder: "Start writing" }),
        Collaboration.configure({ document: doc }),
        CollaborationCaret.configure({ provider, user: { name: selfName, color: colorFor(selfName) }, render: renderCaret }),
      ],
      editorProps: { attributes: { class: "prose-copy", "data-section": section.id } },
      // Fires for remote changes too, so the word count is live for everyone.
      onUpdate: ({ editor: e }) => {
        if (mountedRef.current) onStats(section.id, statsOf(e.getJSON() as TiptapDoc));
      },
      onFocus: () => onActivate(section.id),
    },
    [doc, provider],
  );
  // The editor is built synchronously during render (immediatelyRender), so
  // anything that updates parent state has to wait for an effect.
  useEffect(() => {
    editorRef.current = editor;
    mountedRef.current = true;
    if (!editor) return;
    onStats(section.id, statsOf(editor.getJSON() as TiptapDoc));
    if (autoFocus && !readOnly) editor.commands.focus("end");
  }, [editor, section.id, onStats, autoFocus, readOnly]);

  // Cmd+S / "Save now": push what is queued and ask the server to snapshot straight away.
  const saveNow = useCallback(async () => {
    if (readOnly) return;
    setState("saving");
    try {
      await provider.flush();
      await saveSection(section.id);
      setState("saved");
    } catch {
      setState("error");
    }
  }, [provider, readOnly, section.id, setState]);

  useEffect(() => {
    register(section.id, {
      getDoc: () => (editorRef.current?.getJSON() as TiptapDoc | undefined) ?? section.content,
      saveNow,
      focus: () => editorRef.current?.commands.focus(),
    });
    return () => register(section.id, null);
  }, [register, section.id, section.content, saveNow]);

  return (
    <>
      {editing && editor && (
        <div className="absolute right-2 top-0 z-10 -translate-y-1/2 max-[899px]:relative max-[899px]:right-auto max-[899px]:mb-2 max-[899px]:w-max max-[899px]:translate-y-0">
          <Toolbar editor={editor} />
        </div>
      )}
      <EditorContent editor={editor} />
    </>
  );
}

/** A non-interactive rendering of the last snapshot, used until the live editor takes over. */
function StaticCopy({ content }: { content: TiptapDoc }) {
  const text = tiptapToText(content);
  if (!text.trim()) return <div className="prose-copy min-h-[1.65em] text-ink-3">Start writing</div>;
  return (
    <div className="prose-copy" aria-busy="true">
      {text.split("\n").map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}
