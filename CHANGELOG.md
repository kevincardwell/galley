# Changelog

What changed between releases, newest first. Anything that needs a hand on your side is marked **Upgrading**.

Galley applies database migrations when the container starts, and copies the database to
`backups/pre-migration-<date>.db` first, so an upgrade that goes wrong can be stepped back by putting that file
in place and running the previous tag.

## Unreleased

### Added

- **Clients can send files in.** A third share switch, separate from client review: their logo, photographs,
  the old brochure. Files land in the project's library labelled with who sent them, and the studio gets one
  notification per batch.
- **Clients can write the sections you hand over.** Tick "they write this one" on a section and a box appears
  on the share page for their words. Saves land in the version history like any other edit.
- **A weekly client digest.** What you changed and what is still waiting on them, with a link back. Off until
  you turn it on in Admin → Email, and never sent to a project with nothing to report.
- **Project templates.** Start a project from an existing one and keep the task list and page structure,
  without the previous client's content, dates, assignees or approvals.
- **Repeating tasks.** Weekly to yearly. Completing one creates the next with its checklist reset, which is how
  a care plan lives here alongside a build.
- **Read what was emailed.** Admin → Email lists recent deliveries and a row now opens the message itself.
- Pre-migration database snapshots, a real version on `/api/health`, and a line in the log at boot naming the
  version and data directory.

### Changed

- Every email — invite, notification, test and digest — goes through one redesigned template and sends both a
  plain-text and an HTML part.
- CI now runs the built container, waits for it to become healthy, and checks the database is created, rather
  than only building the image.

### Fixed

- **Restoring an old version of a section did nothing.** It had never worked since collaborative editing
  shipped: the restore wrote a column the editor does not read, and the next save put the newer text back.
- **A client's approval never lapsed.** A section approved at one wording still showed as approved after it was
  rewritten. Editing a signed-off section now drops the approval and says so in the activity feed.
- **The Unraid template ran as a user that cannot write appdata**, so a fresh install could stop immediately.
  The template now runs as `nobody:users`, and the error message when a data directory is not writable says
  which directory and which user id.
- Editors were shown a "Create feed link" button that only a manager could use, and it failed when clicked.
- The instance-wide supplier directory could be edited by anyone signed in, including someone invited as a
  viewer on a single project.
- A failed database migration leaked a connection on every subsequent request instead of failing the boot.
- Uploads are checked against the size limit before sending, instead of after a whole file has been uploaded.
- The README described a backup method that silently loses recent writes. Copying the data directory is only
  safe with Galley stopped; the backup zip is safe at any time.

### Upgrading

- Nothing to do. Six migrations apply on start.
- On Unraid, the `--user 99:100` fix reaches new installs only — Unraid keeps your container's settings when a
  template changes. If yours is running, it is fine; leave it alone.
- To use the weekly digest, set a client email address in each project's settings and turn the schedule on in
  Admin → Email.

## v0.1.0 — 2026-09-12

First public release: projects with tasks, a copy editor with draft/review/approved states and live
collaborative editing, a calendar, a supplier directory, an asset library with thumbnails and palettes, a
client share link, search, export, backups, and email through SMTP or Resend, Postmark, SendGrid or Mailgun.
Ships as one container with one SQLite file.
