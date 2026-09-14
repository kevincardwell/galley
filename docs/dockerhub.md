<!--
  The Docker Hub page. Kept separate from README.md on purpose: Docker Hub's
  renderer strips raw HTML, so the README's centred hero, headings and badges
  come out as nothing. Everything here is plain markdown, which it does render.
-->

![Galley](https://raw.githubusercontent.com/kevincardwell/galley/main/public/icon-192.png)

# Galley

**Write your client's website copy, get it signed off, and keep the tasks and files next to it.**
Self-hosted, one container, one file to back up.

[Source and full documentation on GitHub](https://github.com/kevincardwell/galley)

![Galley showing a project overview](https://raw.githubusercontent.com/kevincardwell/galley/main/docs/media/hero.webp)

A galley proof is the first typeset pull of a page, laid out so the words can be checked before anything goes to print. Galley does that for a website: the copy is written page by page and section by section, it moves from draft to in review to approved, and the client signs it off through a link — no account, nothing to install.

Website projects rarely stall on the build. They stall waiting for the words, the logo and a decision. So the client's side of the link is not read-only: they can comment, approve, send files in, and write the sections you hand to them, and once a week they get a note saying what changed and what is still waiting on them.

The rest of the project lives in the same place — tasks, a calendar, the suppliers you book and the files you collect — because it is the same project.

## Start it

```bash
mkdir galley && cd galley
curl -O https://raw.githubusercontent.com/kevincardwell/galley/main/compose.yml
docker compose up -d
```

Open <http://localhost:3000>, create the admin account, and tick the box to load a worked example so nothing starts empty.

Or without compose:

```bash
docker run -d --name galley \
  -p 3000:3000 \
  -v /path/on/your/host:/data \
  ghcr.io/kevincardwell/galley:latest
```

Galley takes ownership of the data directory on start and then runs unprivileged, so the directory does not need to be chowned first.

## Settings

| Variable | Default | What it does |
|---|---|---|
| `GALLEY_URL` | none | Public address, used for invite links and to mark cookies secure. |
| `GALLEY_DATA_DIR` | `/data` | Where the database and uploads live. |
| `PUID` / `PGID` | `1000` / `1000` | Who Galley runs as. Unraid wants `99` / `100`. |
| `MAX_UPLOAD_MB` | `500` | Largest single upload. |
| `TRUSTED_PROXY_HOPS` | `1` | How many reverse proxies sit in front. |
| `TZ` | `UTC` | Server time zone. Decides when the nightly backup runs. |
| `PORT` | `3000` | Port to listen on. |

Email, the backup schedule and the weekly client digest are configured in the app under Admin, not with environment variables.

## Tags

- `latest` — the current release
- `1.0.0`, `1.0` — pinned versions
- `sha-<commit>` — a specific build

`linux/amd64` and `linux/arm64`.

## Storing your data

One SQLite file and one uploads folder, both under `/data`. Mount it somewhere you back up. Admin → Backups writes a zip of the database and every upload, on demand or nightly, and the database is copied aside before any upgrade migrates it.

Treat a backup as a secret: it holds mail credentials in plain text, along with password hashes, session tokens and share links.

## Unraid

There is a template in Community Applications — search for Galley. It sets `PUID=99` and `PGID=100`, the Unraid convention.

## Licence

MIT. Issues and discussion on [GitHub](https://github.com/kevincardwell/galley).
