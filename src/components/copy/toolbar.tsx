"use client";
import { useRef, useState, type Ref } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { clsx } from "@/lib/clsx";
import { Icon } from "@/components/ui/icon";
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
    <div role="toolbar" aria-label="Formatting" className="relative flex items-center gap-px rounded-r border border-line bg-surface p-1 shadow-panel">
      <Btn on={st.bold} label="Bold" onClick={() => chain().toggleBold().run()}><span className="text-[13px] font-bold">B</span></Btn>
      <Btn on={st.italic} label="Italic" onClick={() => chain().toggleItalic().run()}><span className="font-serif text-[14px] italic">I</span></Btn>
      <Sep />
      <Btn on={st.h1} label="Heading 1" onClick={() => heading(1)}><span className="tnum text-[11px] font-semibold">H1</span></Btn>
      <Btn on={st.h2} label="Heading 2" onClick={() => heading(2)}><span className="tnum text-[11px] font-semibold">H2</span></Btn>
      <Btn on={st.h3} label="Heading 3" onClick={() => heading(3)}><span className="tnum text-[11px] font-semibold">H3</span></Btn>
      <Sep />
      <Btn on={st.bullet} label="Bullet list" onClick={() => chain().toggleBulletList().run()}><Icon name="list" size={14} /></Btn>
      <Btn on={st.ordered} label="Numbered list" onClick={() => chain().toggleOrderedList().run()}><span className="tnum text-[11px] font-semibold">1.</span></Btn>
      <Btn on={st.quote} label="Quote" onClick={() => chain().toggleBlockquote().run()}><span className="font-serif text-[17px] leading-none">“</span></Btn>
      <Sep />
      <Btn ref={linkBtn} on={st.link || linkOpen} label="Link" onClick={() => setLinkOpen((o) => !o)}><Icon name="link" size={14} /></Btn>
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
      className={clsx(
        "grid size-7 cursor-pointer place-items-center rounded-[4px] transition-colors duration-150 ease-out",
        on ? "bg-accent-soft font-semibold text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span aria-hidden className="mx-0.5 h-4 w-px bg-line" />;
}
