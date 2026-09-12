# Where Galley stands (2026-09-11)

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

## Not yet done (pick up here)
1. **Docker image not yet built.** `docker build` was refused: this user is not in the `docker` group. Run `sudo usermod -aG docker $USER` and log back in (or use `sudo docker compose up -d --build`), then click through inside the container (ffmpeg posters, volume permissions).
3. **GitHub**: pushed 2026-09-11 to https://github.com/kevincardwell/galley (private, default branch main). CI + image publish workflows run on main. The ghcr.io image stays private while the repo is private; make the package (and repo) public when ready so `docker compose pull` works for others.
4. E2E only covers access. Add task → copy → upload → export steps once the UI has been eyeballed (selectors unknown until then).
5. Small known gaps: page/section drag reorder not wired (actions exist); instance logo not implemented; upload accepts by extension/mime only (bad content fails at processing with a recorded error, not at upload); oversize uploads are drained before rejection (no client-side pre-check).
6. Git identity for this repo is Kevin Cardwell <57758314+kevincardwell@users.noreply.github.com> (all commits rewritten to it).

## Layout of the code
See `docs/AGENT-BRIEF.md` for conventions (server-action guard pattern, tokens, contracts) and `docs/PLAN.md` for intent.
