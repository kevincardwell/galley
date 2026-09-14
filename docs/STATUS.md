# Where Galley stands (2026-09-14)

## Done
- Full app builds (`npm run build`) with zero type or lint errors.
- Unit tests pass (`npm test`): slugs, workspace permissions against a real SQLite db.
- E2E (`npm run build && npm run test:e2e`): fresh install → admin setup → two workspaces → invite an editor from /admin → invitee sees only their workspace, gets 404 on the other, is bounced from /admin; signed-out visitors go to /login.
- Features implemented: workspaces (grid, header, tabs, settings, members, archive/delete, share link), tasks (list/board, dnd, detail panel, checklist, comments, my tasks), copy (Tiptap editor, autosave with version guard, statuses, versions/restore, comments, copy as Markdown), assets (upload with progress, sharp thumbs/previews/palette, ffmpeg posters, tags, folders, lightbox, attach picker), admin (people, invites, workspaces, storage, settings, audit), client share view, zip export, Cmd-K search (FTS5).
- Docker: multi-stage `Dockerfile`, `compose.yml`, `docker/entrypoint.sh`, healthcheck. CI: `.github/workflows/ci.yml` (tsc, lint, vitest, build, docker build) and `release.yml` (multi-arch push to ghcr.io on main/tags).
- README covers Docker and local install.

## Browser check done 2026-09-11 (evening)
Clicked through home, overview, tasks (detail panel), copy (typed, autosaved, versions), assets (uploaded 3 images: thumbs, dimensions, palette all worked), admin, share link (copy + files pages), export zip, search API, file-route token checks. Fixed: base CSS was unlayered and beat Tailwind utilities (primary buttons had no fill); copy details pane overflowed sideways (status control); stray scrollbar on admin tabs.

## Quality pass done 2026-09-11 (late evening)
Dialogs centred (Tailwind preflight had zeroed dialog margin). Added: mobile top bar + slide-in drawer, horizontally scrolling tabs, /me/account (name + password change), error.tsx/global-error.tsx, loading skeletons, icon.svg/apple-icon/manifest, security headers, login throttling (8 fails / 15 min per ip+email), toast system, link popover in the copy toolbar, working Up-next checkbox on overview, stable dnd id (hydration warning gone), board no longer widens the page.

## Eight upgrades done 2026-09-11 (night)
1. Live collaboration: Yjs over SSE + POST (no websocket, single port). Rooms in src/lib/collab/hub.ts, compaction into sections.ydoc, snapshots keep version history. Editing hub.ts needs a dev-server restart.
2. Email: nodemailer via Admin → Settings SMTP; invites emailed; test-email button. Notifications: src/lib/notify.ts, inbox at /me/notifications, bell in sidebar; wired into task assignment, @mentions in task bodies and comments, copy comments, client review events.
3. Version diff dialog (word-level) from the Versions list.
4. Client review mode: share dialog checkbox; guests comment + approve per section; team notified.
5. Sample workspace on setup (checkbox, default on) via src/lib/seed/sample.ts.
6. `?` shortcut sheet, skip link, aria pass over ui/tasks/assets.
7. Backups: Admin → Backups (zip of db + uploads + favicons), daily schedule with retention, armed on boot via src/instrumentation.ts.
8. Uploads streamed to disk with busboy (src/lib/media/multipart.ts).
Verified in browser: collab save, share review, diff, backups, notifications inbox, shortcut sheet; upload via curl. e2e updated for the sample-workspace first run.

## Suppliers, calendar and design pass 2026-09-12
A collaborator's brief asked for tasks-against-an-event with deadlines and notes (already present), a supplier directory (missing) and calendar schedules (missing). Both built:
- **Suppliers**: instance-wide directory at /suppliers with a per-project tab (/w/<slug>/suppliers). Status shortlisted/enquired/booked/declined, cost in pence formatted as GBP, notes, tags, rating, archive. See src/components/suppliers/shared.ts for the one place currency lives.
- **Calendar**: /calendar (all projects) and /w/<slug>/calendar with month, week and agenda views, task due dates plus schedule_items, drag to reschedule, and an .ics feed at /api/calendar/<shareToken> (proxy.ts allows it through unauthenticated; the token guards it).
- **Design system**: docs/DESIGN.md is the direction. Lucide icons via src/components/ui/icon.tsx (never inline svg), plus page.tsx (Screen/PageHeader/Section), meter.tsx, stat.tsx, tooltip.tsx, upgraded button.tsx and empty.tsx. Every screen was restyled against it.
- **Bug found and fixed**: listWorkspacesFor interpolated a Drizzle column into a correlated subquery, which SQLite bound to the subquery's own table, so every workspace card count was 0. Regression test in tests/unit/workspace-counts.test.ts. Do not interpolate `${schema.x.y}` inside a raw `sql` subquery; name the table literally.
- Guidelines pass (web-design-guidelines skill) added overscroll containment, touch-action, theme-color meta and balanced headings; dnd-kit contexts now carry stable ids (hydration warnings gone).

## Email providers and installable app 2026-09-12
- **Mail**: src/lib/email/providers.ts is the catalogue (SMTP + Resend, Postmark, SendGrid, Mailgun) and src/lib/email/index.ts does the sending. Settings live under `settings.mail`; the old `settings.smtp` shape is migrated on read in src/lib/settings.ts so existing installs keep working. Admin → Email has the picker, SMTP presets, a test send and the last 100 attempts (mail_log table). Invites email on create and can be resent from the Invites tab; invites.emailedAt records it. Verified end to end against a local SMTP sink, including the failure message.
- **PWA**: manifest.ts (icons 192/512 plus maskable, shortcuts), public/sw.js, /offline, install banner in src/components/shell/install-app.tsx, iOS meta tags and safe-area padding. The worker is network-first for pages and cache-first only for /_next/static.
  TRAP: it registers in production ONLY. Dev chunk URLs are not content-hashed, so a cache-first worker serves yesterday's JavaScript after a rebuild; that cost an hour chasing a phantom React error. The component also unregisters any stale worker when NODE_ENV is not production.
  Verified in a production build: worker activated and controlling, manifest valid, offline fallback renders with the server stopped.

## Security audit 2026-09-12 (before going public)
Three parallel audits: auth/authorisation, files/SSRF/tokens, injection/deps/headers. Fixed:
- CRITICAL: accepting an invite for an address that already had an account created a session for that account with no password check. Now only the signed-in owner can redeem it, and redemption is one conditional transaction (no TOCTOU). Regression test: tests/unit/invite-security.test.ts.
- HIGH: SMTP password and provider API key were serialised into the admin pages' client payload. Both pages now receive a non-secret projection (publicMailSettings). Verified by grepping the rendered HTML.
- HIGH: favicon fetch was a request-forgery hole (any signed-in user, redirects followed, no address checks). Now http(s) only, public addresses only via DNS resolution, redirect: manual, 256 KB streaming cap, and no SVG. Regression test: tests/unit/favicon-ssrf.test.ts.
- HIGH: login throttle trusted the leftmost X-Forwarded-For. Now counts back TRUSTED_PROXY_HOPS from the right, adds a per-address counter alongside the per-account one, and evicts oldest-first so the map is bounded.
- MEDIUM: /api/search returned 500 for a query of only punctuation. MEDIUM: session cookie lost Secure behind a TLS proxy unless GALLEY_URL was set; now secure by default in production. MEDIUM: the client share token also unlocked the whole calendar feed; the feed has its own calendarToken now, opt-in from the calendar screen. MEDIUM: added a Content-Security-Policy (unsafe-eval only in dev, for React's debug build). MEDIUM: multipart limits on fields/files/parts.
- LOW: supplier deletion is admin-only; last-admin lockout is refused on demote/deactivate/delete; expired sessions are reaped; share tokens compared in constant time; open redirect via /\ blocked; export used the filename extension instead of the stored one so renamed assets were silently skipped.
- Removed GALLEY_SECRET: it was documented as if it signed cookies but nothing read it. Session security is the 238-bit token.
- npm audit: 0 production vulnerabilities. Dev-only: 4 moderate in drizzle-kit's esbuild chain, not reachable at runtime.
Known and accepted: mail credentials are stored in plain text in the database (documented in the README, and backups are flagged as secrets); no per-workspace storage quota; CSP allows inline scripts until a nonce is threaded through the proxy.

## Tier 0 fixes 2026-09-14 (four review agents, then the blockers they found)

Four parallel agents reviewed the project (product gaps, code-vs-claims, self-host ops, adoption). Three
independently flagged that the advertised `docker compose up` had never once been executed. That is now done,
along with every "the app tells the user something untrue" bug they turned up.

**The image is built and verified.** `sudo docker build` + run against a bind mount: health `ok`, login renders,
`galley.db` created in the volume, no missing native modules in the standalone bundle. Clicked through setup,
sample workspace, copy editor, versions, restore. CI now does this on every push (`.github/workflows/ci.yml`):
`load: true`, run the container, poll `/api/health`, assert the database appears, grep the log for
`MODULE_NOT_FOUND`. Building an image only proves it compiles.

- **Version restore had never worked since collaboration shipped.** `restoreVersion` wrote `sections.content`,
  but `loadDoc` rebuilds a room from `sections.ydoc` and ignores the column, so the editor kept the newer text
  and the next idle persist wrote it straight back. Restore now goes through `replaceDoc` in
  `src/lib/collab/hub.ts`: it swaps the content inside the live Y.Doc, logs and broadcasts the diff, then
  persists. Verified in the browser — the editor changed from the new wording back to the restored one with no
  reload. Deleted the dead `recordVersion` in `src/actions/copy.ts` (a duplicate of `snapshot.ts`).
- **Client approval was never invalidated.** `clientApprovedAt` was set by `guestApprove` and cleared nowhere,
  so a section the client approved at v7 still read "Approved by Tom" at v12. `snapshotSection` now clears it
  whenever the content actually changes, and logs an `approvalLapsed` activity. Verified: the edited section
  lost its stamp, the four untouched approved sections kept theirs.
- **Editors saw a "Create feed link" button that threw.** `canManage` is now threaded from both calendar pages
  instead of being passed `canEdit`.
- **The supplier directory was writable by viewers.** It is instance-wide, so there is no workspace to check;
  `editsAnyWorkspace()` in `src/lib/permissions.ts` now gates the four directory writes. A viewer on one
  project could previously rename or archive every supplier the studio uses.
- **Unraid template ran as a uid that cannot write appdata.** The image runs as uid 1000 with no chown step.
  Since Unraid 6.10 appdata directories are created `0755` (they were `0777` on 6.9.2) owned `nobody:users`,
  so uid 1000 cannot write to one. Template now passes `--user 99:100`. The entrypoint also checked writability
  *after* `mkdir`, so its helpful message was unreachable — order swapped.
  CORRECTION to the commit message for this change, which says Unraid creates the mount `root:root`: that is
  what *plain* Docker does, and it is what the local reproduction hit (a `/tmp` bind mount, container exited
  immediately, friendly error confirmed). On Unraid the owner is `nobody:users`; the failure is the same but
  the mechanism stated in the commit is wrong. Severity is also unproven: Community Apps shows 587 downloads
  and no issues have been filed, so some installs are evidently working — likely pre-existing `0777` appdata
  from older Unraid versions. Treat this as a robustness fix, not a confirmed outage.
  NOTE: a Community Apps template update does **not** rewrite containers people have already installed; Unraid
  keeps each user's config in `templates-user`. Existing installs keep whatever they have.
- **A failed migration leaked a database handle per request.** `open()` had no try/finally, so every subsequent
  request opened another handle against a half-migrated file. Now closes and rethrows, and
  `src/instrumentation.ts` touches the database at boot so a bad upgrade crashes loudly instead of surfacing
  later as 500s on an apparently healthy container.
- **Upgrades had no rollback.** Migrations are forward-only with no down files. `src/db/client.ts` now does
  `VACUUM INTO backups/pre-migration-<date>.db` when migrations are pending, keeping 3. Verified end to end on
  a copy of a real database: pending detected, snapshot `integrity_check: ok`, self-contained.
  TRAP: drizzle's `__drizzle_migrations` declares `id SERIAL PRIMARY KEY`, which SQLite does not understand, so
  every `id` is NULL. Count rows, never trust those ids.
- **The README told people to back up in a way that loses data.** "Copying the data directory does the same
  job" is false in WAL mode. Now says stopped-only and explains why; the in-app restore note scopes its
  "delete the -wal" advice to zip restores, where it is correct. (Proved live: a hand-copy of the running dev
  database was missing its migrations table entirely.)
- `GALLEY_VERSION` build arg → real version in `/api/health` (it read `npm_package_version`, which `node
  server.js` never sets, so it was always "dev") and a startup log line. `TZ` documented.

Regression tests in `tests/unit/copy-restore.test.ts` (restore changes the live doc, survives a room reload,
reaches connected clients; approval lapses on edit but not on a no-op save). 102 unit tests pass.

## Not yet done (pick up here)
1. ~~Docker image not yet built.~~ **Done 2026-09-14** — built, run and clicked through (see above). `jasper` is now in the `docker` group, but that needs a fresh login to take effect; until then use `sudo docker`. Still unverified inside the container: ffmpeg video posters (only images were uploaded).
3. **GitHub**: pushed 2026-09-11 to https://github.com/kevincardwell/galley (private, default branch main). CI + image publish workflows run on main. The ghcr.io image stays private while the repo is private; make the package (and repo) public when ready so `docker compose pull` works for others.
4. E2E only covers access. Add task → copy → upload → export steps once the UI has been eyeballed (selectors unknown until then).
5. Small known gaps: page/section drag reorder not wired (actions exist); instance logo not implemented; upload accepts by extension/mime only (bad content fails at processing with a recorded error, not at upload); oversize uploads are drained before rejection (no client-side pre-check).
6. Git identity for this repo is Kevin Cardwell <57758314+kevincardwell@users.noreply.github.com> (all commits rewritten to it).

## Layout of the code
See `docs/AGENT-BRIEF.md` for conventions (server-action guard pattern, tokens, contracts) and `docs/PLAN.md` for intent.
