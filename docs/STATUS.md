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

## Not yet done (pick up here)
1. **Docker image not yet built.** `docker build` was refused: this user is not in the `docker` group. Run `sudo usermod -aG docker $USER` and log back in (or use `sudo docker compose up -d --build`), then click through inside the container (ffmpeg posters, volume permissions).
3. **Push to GitHub.** Repo name assumed `kevincardwell/galley` in README, compose.yml and package.json; change if different. `gh repo create galley --public --source=. --push`. The release workflow needs Packages write (default GITHUB_TOKEN is fine) and the ghcr package set to public once it exists.
4. E2E only covers access. Add task → copy → upload → export steps once the UI has been eyeballed (selectors unknown until then).
5. Small known gaps: no version diff view (only list + restore); toolbar link uses window.prompt; page/section drag reorder not wired (actions exist); SMTP stored but not sending; instance logo not implemented; `request.formData()` buffers uploads in memory.
6. Git identity for this repo is Kevin Cardwell <57758314+kevincardwell@users.noreply.github.com> (all commits rewritten to it).

## Layout of the code
See `docs/AGENT-BRIEF.md` for conventions (server-action guard pattern, tokens, contracts) and `docs/PLAN.md` for intent.
