# Shared brief for feature agents

Read docs/PLAN.md sections 1–4 for product intent and design. Do not read node_modules (blocked). Do not run `next dev` or `next build`; verify with `npx tsc --noEmit -p .` and `npx eslint <your files>` only.

## Stack facts (Next.js 16, React 19, Drizzle + better-sqlite3, Tailwind v4)
- App Router under `src/app`. `params` and `searchParams` are Promises: `const { slug } = await params`.
- `cookies()`/`headers()` are async. `src/proxy.ts` (not middleware) already redirects signed-out users.
- Server actions live in `src/actions/*.ts` with `"use server"` at the top. Every action starts with
  `const user = await requireUser();` then `const { workspace } = assertAccess(user, workspaceId, "edit" | "manage" | "view");`
  Non-members must get "Not found", never a 403. Pages use `requireAccess(user, slug, verb)` which 404s.
- DB: `import { db, schema, sqlite } from "@/db/client"`. Synchronous better-sqlite3 API: `.get()`, `.all()`, `.run()`, `db.transaction((tx) => {...})`.
  Schema is final in `src/db/schema.ts`; do not change it. If you truly need a column, stop and note it in your report.
- IDs: `newId()` from `@/lib/ids`. Activity: `logActivity({...})` from `@/lib/activity` on create/update/complete/approve/upload.
- After mutations call `revalidatePath(...)` for the affected route.
- Search FTS triggers already index tasks (title, body), sections (title, plain_text) and assets (filename).

## Design tokens (Tailwind classes via `@theme` in globals.css)
Colours: `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-2`, `text-ink-3`, `border-line`, `border-line-2`, `bg-accent text-accent-ink`, `bg-accent-soft`, `border-accent-line`,
semantic: `text-review bg-review-soft`, `text-done bg-done-soft`, `text-late bg-late-soft`, `text-draft`. Radius: `rounded-r` (6px). Fonts: `font-ui` (default), `font-serif` (Newsreader, copy only). Tabular numbers: class `tnum`.
Primitives in `src/components/ui`: `Button` (variant primary|default|ghost|danger, size sm|md), `Input`, `Select`, `Textarea`, `Label`, `Avatar`, `Pill` (tone accent|review|done|draft|late|neutral), `Dialog` (native dialog), `Empty`.
Style: borders over shadows, 14px base, one radius, no cards-inside-cards, motion 120–180ms ease-out, every list keyboard-navigable where practical. Empty states tell the user what to do. Copy in sentence case, plain verbs.

## Workspace routes
`src/app/(app)/w/[slug]/layout.tsx` renders the header and tabs and sets `--accent`. Tab pages live under that folder. The page content area is `flex-1` in a column flex; use `className="flex min-h-0 flex-1 ..."` for full-height panes.

## Attachments contract
`src/components/assets/attach-picker.tsx` exports `AttachPicker({ workspaceId, taskId?, sectionId?, attached: AttachedFile[], readOnly? })` and `src/actions/assets.ts` exports `attachAsset(assetId, { taskId? | sectionId? })` and `detachAsset(attachmentId)`. Tasks and copy render `<AttachPicker>` and pass the attachments they load from the `attachments` table joined to `assets`. The assets agent implements both; others only consume them.
File URLs: `/api/file/<assetId>/thumb|preview|poster|original` (assets agent implements; access = signed-in member, or `?share=<workspace.shareToken>`).

## Helpers
`@/lib/format`: `formatBytes`, `timeAgo(unixSeconds)`, `formatDue(iso) -> {label, tone}`, `initials`. `@/lib/slug`: `slugify`. `@/lib/clsx`.
