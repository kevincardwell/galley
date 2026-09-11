# Where Galley stands (2026-09-11)

## Done
- Full app builds (`npm run build`) with zero type or lint errors.
- Unit tests pass (`npm test`): slugs, workspace permissions against a real SQLite db.
- E2E (`npm run build && npm run test:e2e`): fresh install → admin setup → two workspaces → invite an editor from /admin → invitee sees only their workspace, gets 404 on the other, is bounced from /admin; signed-out visitors go to /login.
- Features implemented: workspaces (grid, header, tabs, settings, members, archive/delete, share link), tasks (list/board, dnd, detail panel, checklist, comments, my tasks), copy (Tiptap editor, autosave with version guard, statuses, versions/restore, comments, copy as Markdown), assets (upload with progress, sharp thumbs/previews/palette, ffmpeg posters, tags, folders, lightbox, attach picker), admin (people, invites, workspaces, storage, settings, audit), client share view, zip export, Cmd-K search (FTS5).
- Docker: multi-stage `Dockerfile`, `compose.yml`, `docker/entrypoint.sh`, healthcheck. CI: `.github/workflows/ci.yml` (tsc, lint, vitest, build, docker build) and `release.yml` (multi-arch push to ghcr.io on main/tags).
- README covers Docker and local install.

## Not yet done (pick up here)
1. **Nothing has been looked at in a browser yet.** Run `npm run dev`, create the admin, click through Tasks, Copy, Assets, Admin. Expect layout rough edges; the agents built from spec.
2. **Docker image not yet built or run locally.** `docker compose up -d --build` then repeat the click-through inside the container (ffmpeg posters, volume permissions).
3. **Push to GitHub.** Repo name assumed `kevincardwell/galley` in README, compose.yml and package.json; change if different. `gh repo create galley --public --source=. --push`. The release workflow needs Packages write (default GITHUB_TOKEN is fine) and the ghcr package set to public once it exists.
4. E2E only covers access. Add task → copy → upload → export steps once the UI has been eyeballed (selectors unknown until then).
5. Small known gaps: no version diff view (only list + restore); toolbar link uses window.prompt; page/section drag reorder not wired (actions exist); SMTP stored but not sending; instance logo not implemented; `request.formData()` buffers uploads in memory.
6. Git identity for this repo is set locally to Kevin Cardwell <57758314+kevincardwell@users.noreply.github.com>; change if commits should carry a different name.

## Layout of the code
See `docs/AGENT-BRIEF.md` for conventions (server-action guard pattern, tokens, contracts) and `docs/PLAN.md` for intent.
