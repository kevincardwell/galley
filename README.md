# Galley

Tasks, copy and media for every website you build. One calm screen per project, self-hosted, one container.

A galley proof is the first typeset pull of a page, laid out so the words can be checked and approved before print. Galley holds the same three things for a website: what needs doing, what the site will say, and the images and video that go with it.

- **Workspaces**: one per website, with its own accent colour, client, status and favicon.
- **Tasks**: sections, list and board views, drag to reorder, due dates, checklists, comments, attachments.
- **Copy**: pages of ordered sections in a clean rich-text editor with draft → review → approved, version history with word-level diffs, comments, and one-click copy as Markdown or HTML.
- **Live collaboration**: several people can edit the same section at once with visible cursors. No websocket server or extra port needed.
- **Assets**: drag-and-drop images, video and PDFs with thumbnails, palettes, tags, folders, and links to the task or copy section they belong to.
- **Calendar**: month, week and agenda views of task deadlines and schedule items, drag to reschedule, and a subscribable feed for Google or Apple Calendar.
- **Suppliers**: a shared directory of the printers, photographers and freelancers you use, linked into the projects that book them with status, cost and notes.
- **Invite only**: no public sign-up. The first account is the admin; everyone else is invited and sees only the workspaces they are added to.
- **Client share link**: a read-only view of copy and files for the client, revocable at any time. Turn on review mode and the client can comment and approve sections without an account.
- **Notifications**: an in-app inbox for mentions, assignments and client feedback, with email when SMTP is set up.
- **Backups**: one-click zip of everything from Admin, plus a daily schedule with retention.
- **Export**: the whole workspace as a zip (Markdown copy, tasks CSV, original files).

Everything lives in one SQLite file and one uploads folder. Back up by copying the data directory.

## Run with Docker (recommended)

```bash
mkdir galley && cd galley
curl -O https://raw.githubusercontent.com/kevincardwell/galley/main/compose.yml
# edit GALLEY_URL and GALLEY_SECRET in compose.yml
docker compose up -d
```

Open http://localhost:3000, create the admin account, then invite your team from **Admin**.

Data is kept in the `galley-data` volume at `/data`. To use a folder on the host instead, change the volume line to `- ./data:/data` and make sure it is writable by uid 1000 (`chown -R 1000:1000 data`).

Behind a reverse proxy (Caddy, nginx, Nginx Proxy Manager, Traefik): forward to port 3000, set `GALLEY_URL` to the public https URL, and raise the proxy's request body limit to at least `MAX_UPLOAD_MB`.

To build the image yourself instead of pulling: uncomment `build: .` in compose.yml and run `docker compose up -d --build`.

## Run locally without Docker

Requirements: Node 22 or newer, and `ffmpeg` on your PATH if you want video posters (everything else works without it).

```bash
git clone https://github.com/kevincardwell/galley.git
cd galley
npm install
cp .env.example .env.local   # optional; defaults are fine for a laptop
npm run dev                   # http://localhost:3000
```

For a production run on a server without Docker:

```bash
npm ci
npm run build
GALLEY_DATA_DIR=/srv/galley PORT=3000 npm start
```

## Configuration

| Variable | Default | What it does |
|---|---|---|
| `GALLEY_URL` | (none) | Public URL, used to build invite links and to mark cookies secure over https. |
| `GALLEY_SECRET` | (none) | Any long random string. `openssl rand -hex 32`. |
| `GALLEY_DATA_DIR` | `./data` locally, `/data` in Docker | Where the SQLite file and uploads live. |
| `MAX_UPLOAD_MB` | `500` | Largest single upload. Can be changed later in Admin → Settings. |
| `PORT` | `3000` | Port to listen on. |

Email (SMTP) and the backup schedule are configured in the app under Admin → Settings and Admin → Backups, not with environment variables.

## Backup and upgrade

- **Backup**: Admin → Backups makes a consistent zip of the database and every upload, on demand or daily. Or copy the data directory yourself. That is everything.
- **Restore**: stop Galley, unzip a backup into an empty data directory, start it again.
- **Upgrade**: `docker compose pull && docker compose up -d`. Migrations run on start. Nothing else to do.

## Development

```bash
npm run dev          # Next.js dev server
npm test             # unit tests (vitest)
npm run test:e2e     # Playwright, needs a build first: npm run build
npm run lint
npm run db:generate  # after editing src/db/schema.ts
```

The implementation plan and the original mockup are in `docs/`.

## Licence

MIT
