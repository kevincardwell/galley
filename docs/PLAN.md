# Galley — implementation plan

**Name: Galley.** A galley proof is the first typeset pull of a page, the copy laid out so it can be checked and approved before it goes to print. That is exactly what this tool holds: the site's words, pictures and outstanding jobs, waiting for sign-off. One word, easy to say, and it reads well as a URL (`galley.yourstudio.uk`). Fallbacks if the name is taken where it matters: **Proof**, **Comp**, **Groundplan**.

One self-hosted Docker container that gives a web designer or project lead a calm home per website: what needs doing, what the site will say, and the pictures and video that go with it. Nothing else.

## 1. Product definition

**Who it is for.** Freelance web designers, small studios, and the person at a company who "owns the website". Not developers-only, not agencies with 40 staff.

**The pitch.** Every website project needs the same three things collected in one place: a to-do list, the copy, and the media. Today that is Trello + Google Docs + a Dropbox folder + a WhatsApp thread. Galley replaces those with one screen per project, installs with one `docker compose up`, and has no plans, seats, or integrations to configure.

**What it is not.** Not a CMS, not a site builder, not a client portal with invoicing, not Notion. Every feature request is tested against "does a solo designer building a 5-page brochure site need this on day one?"

### Core objects

| Object | Purpose |
|---|---|
| Workspace | One per website. Name, live URL, client, status, accent colour, auto-fetched favicon. |
| Task | To-do item inside a workspace. Grouped in sections, has status, assignee, due date, checklist, attachments. |
| Page → Section | The copy. A workspace has pages (Home, About, Contact); a page has ordered sections (Hero, Intro, CTA). Each section is a rich-text block with a status and version history. |
| Asset | Uploaded image or video. Thumbnails, dimensions, tags, folders. Can be attached to a task or a copy section. |
| Member | Owner, editor, or viewer on a workspace. Optional read-only share link for clients. |

### v1 feature list

**Workspaces**
- Create/rename/archive. Grid of cards on the home screen with favicon, status pill, task count, last activity.
- Overview tab per workspace: next 5 tasks, copy progress (sections approved / total), recent uploads, activity feed.

**Tasks**
- Sections (default: Design, Build, Content, Launch; editable). List view and board view of the same data.
- Fields: title, description (markdown), status (todo / doing / done), assignee, due date, checklist, linked assets, linked copy sections.
- Drag to reorder and to move between sections. Keyboard: `n` new task, `space` toggle done, `e` edit.
- "My tasks" across all workspaces.

**Copy**
- Pages with ordered sections. Each section is a Tiptap rich-text editor (headings, bold/italic, lists, links, quotes only; no colours or fonts).
- Per-section status: draft → in review → approved. Word and character count live.
- Version history per section (every save creates a version, diff view, restore).
- Comments per section with resolve.
- Copy whole page or section as Markdown or clean HTML in one click; export whole workspace's copy as a single Markdown file.
- Autosave, collaborative-safe (last-write-wins with version guard and a "someone else edited this" banner; no CRDT in v1).

**Assets**
- Drag-and-drop or paste upload, multi-file, progress bars. Images (jpg, png, webp, gif, svg, avif), video (mp4, webm, mov), plus pdf.
- Server-side thumbnails and web-size previews via sharp; video poster frame via ffmpeg.
- Metadata: dimensions, duration, file size, colour palette (images).
- Folders and tags. Grid with lightbox. Filter by type, tag, unlinked.
- Attach an asset to a task or a copy section from a picker.
- Direct download of original; copy public URL if the workspace share link is on.

**Access model (invite only)**
- There is no public sign-up. The first person to open a fresh install creates the admin account.
- Admins create users or send invite links. A user can only sign in if an admin created or invited them.
- A user sees only the workspaces they have been added to. Everyone else's workspaces do not exist as far as the UI, search, or URLs are concerned. Permission checks live in one `can(user, workspace, verb)` helper and every server action and route handler goes through it.
- Roles per workspace: manager (edit settings, add and remove members), editor, viewer. Instance admins see everything.
- Optional client share link per workspace: read-only view of copy and assets, tokenised URL, revocable by a manager or admin.

**Admin panel** (instance admins only, under `/admin`)
- People: list of every user with role, last seen, workspaces they belong to. Create user, send invite link, reset password, deactivate. Deactivated users keep their history but cannot sign in.
- Workspaces: every workspace with owner, member count, storage used, status. Add or remove members and set their role from here. Archive or delete.
- Invites: pending links, who sent them, expiry, revoke.
- Storage: total usage on the volume, largest workspaces, orphaned files sweep.
- Settings: instance name and logo, base URL, upload cap, optional SMTP for invite emails, session lifetime.
- Audit log: sign-ins, invites, role changes, deletions.

**Global**
- Cmd-K palette: jump to workspace, task, page, asset; run actions.
- Light and dark themes.
- Full-text search across tasks, copy, asset names.
- Export workspace as a zip (copy.md + assets/ + tasks.csv). Import not in v1.

### Explicitly deferred (v2 candidates)
Real-time cursors, Slack/email notifications, time tracking, invoicing, custom fields, S3 storage backend, SSO, public API, mobile app, AI copy suggestions.

## 2. Architecture

**Single container, single process, single volume.** This is the whole self-hosting story and the main differentiator against Plane, Linear, and Notion clones that need Postgres + Redis + MinIO + workers.

```
┌─────────────────────────────────────────────┐
│  galley (node:22-slim + ffmpeg)               │
│                                              │
│  Next.js 15 (App Router)                     │
│    ├─ server components + server actions     │
│    ├─ route handlers  /api/upload, /api/file │
│    └─ React 19 client islands                │
│                                              │
│  Drizzle ORM ── better-sqlite3 (WAL mode)    │
│  FTS5 virtual tables for search              │
│  sharp / ffmpeg for media processing         │
│  in-process job queue (p-queue) for media    │
│                                              │
│  /data                                        │
│    ├─ galley.db                                │
│    ├─ uploads/<workspace>/<asset-id>/original │
│    └─ uploads/<workspace>/<asset-id>/{thumb,preview,poster}.webp
└─────────────────────────────────────────────┘
```

**Why these choices**
- **Next.js + server actions**: one codebase, forms work without hand-written REST, streaming for big lists. The maintainer already runs Next.js sites, so the mental model is shared.
- **SQLite via better-sqlite3**: zero-config, single-file backup, fast enough for tens of thousands of rows and a handful of concurrent users, which is this product's ceiling. WAL mode for concurrent readers. FTS5 gives search for free.
- **Drizzle**: typed schema, SQL-shaped, migrations checked into the repo and run on container start.
- **Tiptap**: ProseMirror-based, stores JSON, lets us restrict the mark set hard so copy stays clean for pasting into any CMS.
- **Local filesystem storage** behind a `Storage` interface so S3 can be added later without touching callers.
- **In-process queue** for thumbnails, not a worker container. Restarts requeue any asset whose `processed_at` is null.
- **Auth**: hand-rolled sessions (argon2 password hash, httpOnly cookie, sessions table). Lucia is deprecated; its recipe is ~150 lines and worth owning. Instance admin is a flag on the user, workspace roles live in memberships. Middleware redirects anyone unauthenticated to `/login`; there is no `/signup` route.

**Container**
- Multi-stage Dockerfile: `deps` → `build` (`next build`, standalone output) → `runtime` (node:22-slim, ffmpeg, sharp's prebuilt libvips). Target image under 350 MB.
- Runs as non-root uid 1000. `HEALTHCHECK` on `/api/health`.
- `compose.yml`: one service, one named volume mounted at `/data`, env: `GALLEY_SECRET`, `GALLEY_URL`, `PORT`, `MAX_UPLOAD_MB` (default 500).
- Migrations run on boot via an entrypoint script. Backup = copy `/data`.
- Reverse-proxy friendly: trusts `X-Forwarded-*`, no absolute URLs baked in at build time.

## 3. Data model (Drizzle, SQLite)

```
users            id, email, name, password_hash, avatar_asset_id, is_admin, deactivated_at, last_seen_at, created_at
sessions         id, user_id, expires_at
invites          id, email, workspace_id?, workspace_role?, token, invited_by, expires_at, accepted_at, revoked_at
audit_log        id, actor_id, action, subject_type, subject_id, meta_json, created_at
settings         key, value_json                      -- instance name, base url, smtp, upload cap

workspaces       id, name, slug, url, client_name, status(planning|building|review|live|archived),
                 accent, favicon_path, share_token?, created_by, created_at, archived_at
memberships      workspace_id, user_id, role(manager|editor|viewer), added_by, created_at

task_sections    id, workspace_id, name, position
tasks            id, workspace_id, section_id, title, body_md, status, assignee_id,
                 due_on, position, created_by, created_at, completed_at
task_checklist   id, task_id, text, done, position

pages            id, workspace_id, title, slug, position
sections         id, page_id, title, content_json, status(draft|review|approved),
                 word_count, position, updated_by, updated_at
section_versions id, section_id, content_json, word_count, created_by, created_at
comments         id, section_id?, task_id?, body, author_id, resolved_at, created_at

assets           id, workspace_id, folder_id?, kind(image|video|pdf), filename, mime, bytes,
                 width, height, duration_ms, palette_json, processed_at, uploaded_by, created_at
asset_folders    id, workspace_id, name, parent_id?, position
asset_tags       asset_id, tag
attachments      asset_id, task_id? | section_id?

activity         id, workspace_id, actor_id, verb, subject_type, subject_id, meta_json, created_at

search_fts       (FTS5: workspace_id, kind, subject_id, title, body)  -- maintained by triggers
```

Positions are floats with periodic renormalisation (simple, good enough at this scale).

## 4. Design brief

The bar is "the nicest tool a designer opens all day". Concretely:

- **One typeface, used well.** A humanist sans with real weights (Inter is the default everyone expects; pick something with more character such as Geist, Söhne-alike, or Instrument Sans) plus a tabular-figure mono for counts and dates.
- **Colour comes from the project.** The UI is near-monochrome (warm greys, not blue-greys). Each workspace's accent colour tints its header, status pills, focus rings, and selection. Switching workspaces should feel like walking into a different room.
- **Density like a good notebook.** 14px base, generous line-height in copy editor (1.7), tight in task lists. No cards-inside-cards. Borders over shadows. Radius 6px, one value everywhere.
- **Copy editor is the hero screen.** Centred 68ch column, section titles as small caps in the margin, status as a subtle dot, word count fixed bottom-right. Should look like a page, not a form.
- **Asset grid**: masonry with true aspect ratios, filenames only on hover, palette swatches on the detail pane.
- **Motion**: 120–180ms ease-out on everything, no bounce, `prefers-reduced-motion` respected. Drag uses a lifted shadow and a slot placeholder, not ghosting.
- **Empty states teach**: a new workspace shows a three-step nudge (add a task, add a page, drop an image) rather than blank panels.
- **Keyboard-first**: every list navigable with `j/k`, palette on `⌘K`, `?` shows shortcuts.

Tailwind v4 + a small set of hand-written components (no shadcn wholesale; borrow only Radix primitives for dialog, popover, dropdown, tooltip for accessibility). Build a `/styleguide` route early and keep it current.

## 5. Repository layout

```
galley/
  compose.yml  Dockerfile  entrypoint.sh
  package.json  next.config.ts  drizzle.config.ts  tailwind.css
  src/
    app/
      (auth)/login  (auth)/setup  (auth)/invite/[token]
      (admin)/admin/{people,workspaces,invites,storage,settings,audit}
      (app)/page.tsx                       -- workspace grid
      (app)/w/[slug]/page.tsx              -- overview
      (app)/w/[slug]/tasks
      (app)/w/[slug]/copy/[page]
      (app)/w/[slug]/assets
      (app)/w/[slug]/settings
      (app)/me/tasks
      share/[token]/...                    -- read-only client view
      api/upload  api/file/[id]/[variant]  api/health  api/export/[slug]
      styleguide
    db/     schema.ts  client.ts  migrations/
    lib/    auth/  storage/  media/  search/  activity/  export/
    actions/  workspaces.ts tasks.ts copy.ts assets.ts members.ts admin.ts
    components/  ui/ (primitives)  tasks/  copy/  assets/  shell/
  tests/   unit/  e2e/
```

## 6. Milestones

Each milestone ends with something you can `docker compose up` and use.

### M0 — Skeleton (½ week)
- Repo, Next.js 15, Tailwind v4, Drizzle + SQLite, Dockerfile, compose, entrypoint with migrations, health route.
- Auth: setup screen creates the admin, login, sessions, logout. No sign-up route.
- App shell: sidebar, top bar, theme toggle, `/styleguide`.
- Playwright smoke test: boot container, create owner, log in.

### M1 — Workspaces + tasks (1 week)
- Workspace CRUD, grid, accent colour, favicon fetch (server-side, cached to /data).
- Task sections, list + board views, drag reorder (dnd-kit), all fields, checklist, "My tasks".
- Activity feed writes.
- Cmd-K palette with workspace and task jump.

### M2 — Copy (1 week)
- Pages and sections, Tiptap editor with restricted schema, autosave with version guard.
- Statuses, word count, version history with diff (diff of plain-text render) and restore.
- Comments with resolve.
- Copy as Markdown/HTML, export workspace copy.

### M3 — Assets (1 week)
- Chunk-free multipart upload route with size cap, progress UI, paste-to-upload.
- Storage interface + local driver. sharp pipeline: thumb 320px, preview 1600px, palette. ffmpeg poster for video, duration probe.
- Folders, tags, grid, lightbox, detail pane, attach picker from tasks and copy sections.
- Requeue unprocessed assets on boot.

### M4 — Admin, access, sharing, search (1 week)
- Admin panel: people, workspaces, invites, storage, settings, audit log.
- Invites and workspace roles. Users see only their workspaces; permission checks in every action through the single `can()` helper, with a test that walks every action as a non-member and expects a 404.
- Client share link: read-only copy and assets pages under `/share/[token]`.
- FTS5 search across tasks, copy, asset names with results in the palette.
- Workspace zip export.

### M5 — Polish and release (1 week)
- Overview tab, empty states, keyboard shortcuts, reduced-motion.
- Performance pass: server components for lists, `next/image` off (we serve our own variants), virtualised asset grid above 200 items.
- Backup docs, upgrade path (migrations are forward-only, `galley.db` backed up before migrate).
- README with the 4-line install, screenshots, GitHub release with `ghcr.io` image, multi-arch (amd64 + arm64).

Roughly 5½ weeks solo at a steady pace. M1–M3 are independent enough to reorder if you want copy before tasks.

## 7. Testing

- **Unit** (vitest): permission helper, position renormalisation, Tiptap → Markdown/HTML serialisers, storage driver, media pipeline on fixture files.
- **E2E** (Playwright against the built container): setup admin → create user in admin panel → invite to one workspace → that user signs in and sees only that workspace → task → page → upload → share link → export. Runs in CI on every push; also the release gate.
- **Visual**: Playwright screenshots of `/styleguide` and each main screen in light and dark, diffed in CI. This is the check that keeps the design honest.
- Every screen is verified in a real browser before it is called done (see memory: never present visual work from spec).

## 8. Risks and how they are handled

| Risk | Mitigation |
|---|---|
| SQLite write contention with several editors | WAL mode, short transactions, `busy_timeout` 5s. Fine well past this product's intended team size. |
| Large video uploads through Next.js route handlers | Stream request body straight to disk, never buffer; cap via `MAX_UPLOAD_MB`; document reverse-proxy `client_max_body_size`. |
| sharp/ffmpeg binaries in the image | Pin versions, use sharp's prebuilt binaries, install ffmpeg from Debian; CI builds both arches. |
| Scope creep toward "project management tool" | The three tabs are the product. Anything else lands in a `v2.md` list, not the backlog. |
| Editor conflicts | Version guard on save; banner on conflict; version history means nothing is lost. Real-time is v2. |

## 9. Day-one commands

```bash
mkdir galley && cd galley
curl -O https://raw.githubusercontent.com/<you>/galley/main/compose.yml
docker compose up -d
# open http://localhost:3000, create the admin account, then invite your team from /admin
```

That is the entire install story, and it is the thing to protect above every feature.
