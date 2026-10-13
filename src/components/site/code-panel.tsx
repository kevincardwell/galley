"use client";
import { errorText } from "@/lib/user-error";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { clsx } from "@/lib/clsx";
import { readSiteFile, saveSiteFile, siteFiles } from "@/actions/site";

const langFor = (file: string) => (/\.html?$/i.test(file) ? html() : /\.css$/i.test(file) ? css() : /\.(m?js|json)$/i.test(file) ? javascript() : []);

// Galley's own colour tokens, so the editor follows light and dark like everything else.
const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "var(--surface)", color: "var(--ink)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", lineHeight: "1.55" },
  ".cm-gutters": { backgroundColor: "var(--surface-2)", color: "var(--ink-3)", borderRight: "1px solid var(--line)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--accent) 7%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "color-mix(in oklab, var(--accent) 12%, transparent)", color: "var(--ink)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "color-mix(in oklab, var(--accent) 25%, transparent) !important" },
  ".cm-cursor": { borderLeftColor: "var(--ink)" },
  ".cm-matchingBracket": { backgroundColor: "var(--accent-soft)", outline: "1px solid var(--accent-line)" },
});
const highlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.tagName, t.keyword, t.operatorKeyword], color: "var(--late)" },
    { tag: [t.attributeName, t.propertyName, t.number, t.unit], color: "var(--review)" },
    { tag: [t.string, t.attributeValue, t.className, t.regexp], color: "var(--done)" },
    { tag: [t.comment, t.meta, t.angleBracket, t.punctuation], color: "var(--ink-3)" },
    { tag: t.comment, fontStyle: "italic" },
    { tag: [t.variableName, t.function(t.variableName)], color: "var(--ink)" },
  ]),
);

export function CodePanel({ workspaceId, openFile, onSaved }: { workspaceId: string; openFile: string; onSaved: () => void }) {
  const [files, setFiles] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [file, setFile] = useState(openFile);
  const [hash, setHash] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [failed, setFailed] = useState<{ file: string; message: string } | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const save = useRef<() => void>(() => {});

  useEffect(() => {
    siteFiles(workspaceId).then(setFiles, (e) => setListError(errorText(e)));
  }, [workspaceId]);

  // Follow the preview to another page, unless there is unsaved work open.
  const [followed, setFollowed] = useState(openFile);
  if (openFile !== followed) {
    setFollowed(openFile);
    if (!dirty) setFile(openFile);
  }

  useEffect(() => {
    let cancelled = false;
    readSiteFile(workspaceId, file).then(
      ({ text, hash: h }) => {
        if (cancelled || !host.current) return;
        view.current?.destroy();
        view.current = new EditorView({
          parent: host.current,
          state: EditorState.create({
            doc: text,
            extensions: [
              basicSetup,
              langFor(file),
              theme,
              highlight,
              EditorView.lineWrapping,
              keymap.of([{ key: "Mod-s", preventDefault: true, run: () => (save.current(), true) }]),
              EditorView.updateListener.of((u) => u.docChanged && setDirty(true)),
            ],
          }),
        });
        setHash(h);
        setDirty(false);
        setFailed(null);
      },
      (e) => {
        if (cancelled) return;
        view.current?.destroy();
        view.current = null;
        setFailed({ file, message: errorText(e) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [workspaceId, file]);
  useEffect(() => () => view.current?.destroy(), []);

  // CodeMirror's Mod-s handler lives outside React, so it calls the latest save through a ref.
  useEffect(() => {
    save.current = () => {
      if (!view.current || hash === null) return;
      const text = view.current.state.doc.toString();
      start(async () => {
        try {
          const r = await saveSiteFile(workspaceId, file, text, hash);
          setHash(r.hash);
          setDirty(false);
          toast(`Saved ${file}`, { tone: "done" });
          onSaved();
        } catch (e) {
          toast(errorText(e), { tone: "late" });
        }
      });
    };
  });
  const error = listError ?? (failed?.file === file ? failed.message : null);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? files.filter((f) => f.toLowerCase().includes(q)) : files;
  }, [files, filter]);

  const pick = (f: string) => {
    if (f === file) return;
    if (dirty) return toast("Save this file first, or reload the preview to throw the changes away", { tone: "late" });
    setFile(f);
  };

  return (
    <div className="grid min-h-[60dvh] grid-cols-[minmax(150px,200px)_1fr] border-b border-line lg:min-h-0 lg:border-r lg:border-b-0">
      <div className="flex min-h-0 flex-col border-r border-line bg-surface-2">
        <div className="border-b border-line p-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find a file"
            aria-label="Find a file"
            className="w-full rounded-r border border-line bg-surface px-2 py-1 text-[13px] text-ink placeholder:text-ink-3 focus:ring-2 focus:ring-accent-text focus:outline-none"
          />
        </div>
        <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1" aria-label="Files">
          {shown.map((f) => (
            <li key={f}>
              <button
                type="button"
                onClick={() => pick(f)}
                aria-current={f === file ? "true" : undefined}
                title={f}
                className={clsx("flex w-full cursor-pointer items-center gap-1.5 truncate rounded-[4px] px-2 py-1 text-left font-mono text-xs", f === file ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-surface")}
              >
                <Icon name="file" size={12} className="text-ink-3" />
                <span className="truncate">{f}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
          <span className="truncate font-mono text-xs text-ink-2">{file}</span>
          {dirty && <span className="text-xs text-review">unsaved</span>}
          <Button size="sm" variant={dirty ? "primary" : "default"} icon="check" className="ml-auto" loading={saving} disabled={!dirty} onClick={() => save.current()}>
            Save
          </Button>
        </div>
        {error && <p className="m-0 px-3 py-2 text-[13px] text-late">{error}</p>}
        <div ref={host} className="relative min-h-0 flex-1 overflow-hidden [&_.cm-editor]:absolute [&_.cm-editor]:inset-0" />
      </div>
    </div>
  );
}
