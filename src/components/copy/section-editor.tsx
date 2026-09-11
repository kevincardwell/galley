"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { clsx } from "@/lib/clsx";
import { Button } from "@/components/ui/button";
import { saveSection } from "@/actions/copy";
import { tiptapToText, wordCount, type TiptapDoc } from "@/lib/copy/serialize";
import { statusTone, type SectionRow } from "@/lib/copy/types";
import { StatusDot } from "./status-dot";
import { Toolbar } from "./toolbar";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "conflict" | "error";
export type Stats = { words: number; chars: number };
export type EditorHandle = { getDoc: () => TiptapDoc; saveNow: () => Promise<void>; focus: () => void };

type Conflict = { content: TiptapDoc; version: number; updatedByName: string | null };

type Props = {
  section: SectionRow;
  active: boolean;
  readOnly: boolean;
  autoFocus: boolean;
  onActivate: (id: string) => void;
  onState: (id: string, state: SaveState) => void;
  onStats: (id: string, stats: Stats) => void;
  register: (id: string, handle: EditorHandle | null) => void;
};

const AUTOSAVE_MS = 800;

function statsOf(doc: TiptapDoc): Stats {
  const text = tiptapToText(doc);
  return { words: wordCount(text), chars: text.length };
}

/** One section of the page: margin label, floating toolbar, Tiptap editor, autosave with a version guard. */
export function SectionEditor({ section, active, readOnly, autoFocus, onActivate, onState, onStats, register }: Props) {
  const versionRef = useRef(section.version);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [conflict, setConflictState] = useState<Conflict | null>(null);
  const conflictRef = useRef<Conflict | null>(null);
  const setConflict = useCallback((c: Conflict | null) => {
    conflictRef.current = c;
    setConflictState(c);
  }, []);

  const editorRef = useRef<Editor | null>(null);
  const setState = useCallback((s: SaveState) => onState(section.id, s), [onState, section.id]);

  const save = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || !dirtyRef.current || conflictRef.current || inFlightRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    inFlightRef.current = true;
    dirtyRef.current = false;
    setState("saving");
    const doc = editor.getJSON() as TiptapDoc;
    try {
      const res = await saveSection(section.id, doc, versionRef.current);
      if (res.conflict) {
        dirtyRef.current = true;
        setConflict({ content: res.current.content, version: res.current.version, updatedByName: res.current.updatedByName });
        setState("conflict");
      } else {
        versionRef.current = res.version;
        setState(dirtyRef.current ? "dirty" : "saved");
      }
    } catch {
      dirtyRef.current = true;
      setState("error");
    } finally {
      inFlightRef.current = false;
      // Edits that landed while the request was out get their own save.
      if (dirtyRef.current && !conflictRef.current) timerRef.current = setTimeout(() => void save(), AUTOSAVE_MS);
    }
  }, [section.id, setState, setConflict]);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [save]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder: "Start writing" }),
    ],
    content: section.content,
    editorProps: { attributes: { class: "prose-copy", "data-section": section.id } },
    onCreate: ({ editor: e }) => {
      editorRef.current = e;
      onStats(section.id, statsOf(e.getJSON() as TiptapDoc));
      if (autoFocus && !readOnly) e.commands.focus("end");
    },
    onUpdate: ({ editor: e }) => {
      if (readOnly) return;
      dirtyRef.current = true;
      onStats(section.id, statsOf(e.getJSON() as TiptapDoc));
      if (!conflictRef.current) {
        setState("dirty");
        schedule();
      }
    },
    onFocus: () => onActivate(section.id),
    onBlur: () => {
      if (dirtyRef.current) void save();
    },
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Expose save/copy hooks to the screen (Cmd+S, Copy as Markdown).
  useEffect(() => {
    register(section.id, {
      getDoc: () => (editorRef.current?.getJSON() as TiptapDoc | undefined) ?? section.content,
      saveNow: save,
      focus: () => editorRef.current?.commands.focus(),
    });
    return () => register(section.id, null);
  }, [register, section.id, section.content, save]);

  // Adopt a newer server copy (restore from the details pane, another tab) when we have nothing unsaved.
  useEffect(() => {
    if (!editor) return;
    if (section.version > versionRef.current && !dirtyRef.current && !conflictRef.current) {
      editor.commands.setContent(section.content, { emitUpdate: false });
      versionRef.current = section.version;
      onStats(section.id, statsOf(section.content));
    }
  }, [editor, section.version, section.content, section.id, onStats]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const reload = () => {
    if (!editor || !conflict) return;
    editor.commands.setContent(conflict.content, { emitUpdate: false });
    versionRef.current = conflict.version;
    dirtyRef.current = false;
    setConflict(null);
    onStats(section.id, statsOf(conflict.content));
    setState("saved");
  };

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

      {editing && editor && (
        <div className="absolute right-2 top-0 z-10 -translate-y-1/2 max-[899px]:relative max-[899px]:right-auto max-[899px]:mb-2 max-[899px]:w-max max-[899px]:translate-y-0">
          <Toolbar editor={editor} />
        </div>
      )}

      {conflict && (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-r border border-review bg-review-soft px-3 py-2 text-[13px] text-review">
          <span className="min-w-0 flex-1">
            {conflict.updatedByName ? `${conflict.updatedByName} edited this section.` : "Someone else edited this section."} Reload to see their version.
          </span>
          <Button size="sm" onClick={reload}>Reload</Button>
        </div>
      )}

      <EditorContent editor={editor} />
    </section>
  );
}
