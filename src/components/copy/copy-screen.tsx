"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { createSection } from "@/actions/copy";
import { tiptapToMarkdown } from "@/lib/copy/serialize";
import type { PageRow, SectionDetails, SectionRow } from "@/lib/copy/types";
import { Outline } from "./outline";
import { DetailsPane } from "./details-pane";
import { SectionEditor, type EditorHandle, type SaveState, type Stats } from "./section-editor";
import { Presence } from "./presence";
import { CollabConnection, type Peer } from "@/lib/collab/client";

type Props = {
  workspace: { id: string; slug: string };
  page: { id: string; title: string; slug: string };
  pages: PageRow[];
  sections: SectionRow[];
  details: Record<string, SectionDetails>;
  readOnly: boolean;
  selfName: string;
};

/** The copy editor: outline, the page itself, and the details of whichever section is active. */
export function CopyScreen({ workspace, page, pages, sections, details, readOnly, selfName }: Props) {
  const [chosenId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  // Fall back to the first section when the chosen one was deleted or nothing is chosen yet.
  const activeId = chosenId && sections.some((s) => s.id === chosenId) ? chosenId : (sections[0]?.id ?? null);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const editors = useRef(new Map<string, EditorHandle>());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [peersBySection, setPeersBySection] = useState<Record<string, Peer[]>>({});

  // One event stream for the whole page (see CollabConnection); every section editor shares it.
  // Constructing it opens nothing; editors subscribe (and add later sections) from their effects.
  const [connection] = useState(() => new CollabConnection(sections.map((s) => s.id)));
  useEffect(() => () => connection.close(), [connection]);

  // Deep links from search: /copy/<page>#s-<sectionId>
  useEffect(() => {
    const m = window.location.hash.match(/^#s-([a-z0-9]+)$/);
    if (!m || !sections.some((s) => s.id === m[1])) return;
    const id = m[1];
    const t = setTimeout(() => {
      setActiveId(id);
      document.getElementById(`s-${id}`)?.scrollIntoView({ block: "start" });
    }, 0);
    return () => clearTimeout(t);
    // Only on first mount; later navigation changes the page key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cmd/Ctrl+S saves the active section now instead of waiting for the debounce.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (activeId) void editors.current.get(activeId)?.saveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId]);

  const register = useCallback((id: string, handle: EditorHandle | null) => {
    if (handle) editors.current.set(id, handle);
    else editors.current.delete(id);
  }, []);
  const onState = useCallback((id: string, state: SaveState) => setSaveStates((m) => (m[id] === state ? m : { ...m, [id]: state })), []);
  const onStats = useCallback((id: string, s: Stats) => setStats((m) => (m[id]?.words === s.words && m[id]?.chars === s.chars ? m : { ...m, [id]: s })), []);
  const onActivate = useCallback((id: string) => setActiveId((cur) => (cur === id ? cur : id)), []);
  const onPeers = useCallback((id: string, peers: Peer[]) => setPeersBySection((m) => ({ ...m, [id]: peers })), []);

  // Everyone connected to any section of this page, one entry per person.
  const peers: Peer[] = [];
  const seen = new Set<string>();
  for (const s of sections) {
    for (const p of peersBySection[s.id] ?? []) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      peers.push(p);
    }
  }

  const onSectionCreated = (id: string) => {
    setFocusId(id);
    setActiveId(id);
  };

  const addFirstSection = () => {
    start(async () => {
      const { id } = await createSection(page.id, "Start writing");
      onSectionCreated(id);
    });
  };

  const active = sections.find((s) => s.id === activeId) ?? null;

  const copyMarkdown = async (): Promise<boolean> => {
    if (!active) return false;
    const doc = editors.current.get(active.id)?.getDoc() ?? active.content;
    const md = `## ${active.title}\n\n${tiptapToMarkdown(doc)}`.trim() + "\n";
    try {
      await navigator.clipboard.writeText(md);
      return true;
    } catch {
      return false;
    }
  };

  const saveNow = async () => {
    if (active) await editors.current.get(active.id)?.saveNow();
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 min-[900px]:grid-cols-[200px_1fr_280px] min-[900px]:overflow-hidden max-[899px]:overflow-y-auto">
      <Outline
        slug={workspace.slug}
        workspaceId={workspace.id}
        pages={pages}
        currentPageId={page.id}
        sections={sections}
        activeId={activeId}
        readOnly={readOnly}
        onSelect={(id) => {
          setActiveId(id);
          document.getElementById(`s-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          editors.current.get(id)?.focus();
        }}
        onSectionCreated={onSectionCreated}
      />

      <div className="page bg-surface px-4 pb-10 pt-6 min-[900px]:min-h-0 min-[900px]:overflow-y-auto min-[900px]:px-10 min-[900px]:pb-16 min-[900px]:pl-[150px] min-[900px]:pt-9">
        <article className="mx-auto max-w-[68ch]">
          <p className="tnum m-0 mb-7 flex items-baseline justify-between gap-3 text-[13px] font-semibold text-ink-3">
            <span className="flex min-w-0 items-center gap-3">
              <span className="truncate">{page.title}</span>
              <Presence peers={peers} />
            </span>
            <span className="shrink-0 font-medium">{sections.length === 1 ? "1 section" : `${sections.length} sections`}</span>
          </p>

          {sections.length === 0 ? (
            readOnly ? (
              <Empty title="No copy yet" hint="Nothing has been written for this page." />
            ) : (
              <Empty
                title="This page is blank"
                hint="Add a section for each block of the page: a hero, an intro, a call to action."
                action={
                  <Button variant="primary" disabled={pending} onClick={addFirstSection}>
                    Add a section
                  </Button>
                }
              />
            )
          ) : (
            <div>
              {sections.map((s) => (
                <SectionEditor
                  key={s.id}
                  section={s}
                  active={s.id === activeId}
                  readOnly={readOnly}
                  autoFocus={focusId === s.id}
                  selfName={selfName}
                  connection={connection}
                  onActivate={onActivate}
                  onState={onState}
                  onStats={onStats}
                  onPeers={onPeers}
                  register={register}
                />
              ))}
            </div>
          )}
        </article>
      </div>

      <DetailsPane
        workspaceId={workspace.id}
        section={active}
        details={active ? (details[active.id] ?? null) : null}
        saveState={active ? (saveStates[active.id] ?? "idle") : "idle"}
        stats={active ? (stats[active.id] ?? null) : null}
        readOnly={readOnly}
        selfName={selfName}
        onCopyMarkdown={copyMarkdown}
        onSaveNow={saveNow}
      />
    </div>
  );
}
