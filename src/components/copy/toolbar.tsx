"use client";
import { useRef, useState, type Ref } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { clsx } from "@/lib/clsx";
import { LinkPopover } from "./link-popover";

type Level = 1 | 2 | 3;

/** Small floating formatting bar shown above the section being edited. */
export function Toolbar({ editor }: { editor: Editor }) {
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
    }),
  });

  const chain = () => editor.chain().focus();
  const heading = (level: Level) => chain().toggleHeading({ level }).run();
  const [linkOpen, setLinkOpen] = useState(false);
  const linkBtn = useRef<HTMLButtonElement>(null);
  const currentHref = () => (editor.getAttributes("link").href as string | undefined) ?? "";
  const applyLink = (href: string) => { chain().extendMarkRange("link").setLink({ href }).run(); setLinkOpen(false); };
  const removeLink = () => { chain().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); };
  const closeLink = () => { setLinkOpen(false); editor.commands.focus(); };

  return (
    <div role="toolbar" aria-label="Formatting" className="relative flex items-center gap-px rounded-r border border-line bg-surface p-0.5 shadow-panel">
      <Btn on={st.bold} label="Bold" onClick={() => chain().toggleBold().run()}><span className="font-bold">B</span></Btn>
      <Btn on={st.italic} label="Italic" onClick={() => chain().toggleItalic().run()}><span className="font-serif italic">I</span></Btn>
      <Sep />
      <Btn on={st.h1} label="Heading 1" onClick={() => heading(1)}>H1</Btn>
      <Btn on={st.h2} label="Heading 2" onClick={() => heading(2)}>H2</Btn>
      <Btn on={st.h3} label="Heading 3" onClick={() => heading(3)}>H3</Btn>
      <Sep />
      <Btn on={st.bullet} label="Bullet list" onClick={() => chain().toggleBulletList().run()}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 3.5h7M5 7h7M5 10.5h7" /><circle cx="2" cy="3.5" r=".9" fill="currentColor" stroke="none" /><circle cx="2" cy="7" r=".9" fill="currentColor" stroke="none" /><circle cx="2" cy="10.5" r=".9" fill="currentColor" stroke="none" /></svg>
      </Btn>
      <Btn on={st.ordered} label="Numbered list" onClick={() => chain().toggleOrderedList().run()}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5.5 3.5h7M5.5 7h7M5.5 10.5h7" /><text x="0.5" y="5" fontSize="5" fill="currentColor" stroke="none" fontFamily="system-ui">1</text><text x="0.5" y="12" fontSize="5" fill="currentColor" stroke="none" fontFamily="system-ui">2</text></svg>
      </Btn>
      <Btn on={st.quote} label="Quote" onClick={() => chain().toggleBlockquote().run()}>
        <span className="font-serif text-base leading-none">“</span>
      </Btn>
      <Sep />
      <Btn ref={linkBtn} on={st.link || linkOpen} label="Link" onClick={() => setLinkOpen((o) => !o)}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6 8.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-1 1" /><path d="M8 5.5a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 6 11l1-1" /></svg>
      </Btn>
      {linkOpen && <LinkPopover anchor={linkBtn} initial={currentHref()} onApply={applyLink} onRemove={removeLink} onClose={closeLink} />}
    </div>
  );
}

function Btn({ on, label, onClick, children, ref }: { on: boolean; label: string; onClick: () => void; children: React.ReactNode; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx("grid h-6 min-w-6 place-items-center rounded-[4px] px-1 text-xs transition-colors", on ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span aria-hidden className="mx-0.5 h-4 w-px bg-line" />;
}
