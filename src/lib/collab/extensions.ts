import StarterKit from "@tiptap/starter-kit";
import type { AnyExtension } from "@tiptap/core";

/**
 * The editor schema, shared by the browser (Tiptap editor) and the server
 * (seeding and reading Yjs documents). It must stay identical on both sides:
 * a Yjs document is only meaningful against the schema it was written with.
 *
 * Keep this module free of server-only and client-only imports.
 */
export function copyExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      horizontalRule: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      // Collaboration brings its own Yjs-aware undo stack.
      undoRedo: false,
    }),
  ];
}

/** The Y.XmlFragment name the editor binds to. */
export const Y_FIELD = "default";
