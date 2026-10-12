# Changelog

What changed between releases, newest first. Anything that needs a hand on your side is marked **Upgrading**.

Galley applies database migrations when the container starts, and copies the database to
`backups/pre-migration-<date>.db` first, so an upgrade that goes wrong can be stepped back by putting that file
in place and running the previous tag.

## v1.3.0 — 2026-10-12

### Added

- **The Site tab: edit the website itself.** Connect a project to its git repository, when you create it or
  later, and everyone on the project gets a live preview of the site. Click text in the preview to change
  it, or open the code editor beside it. **Send for review** commits as the sender (with Co-authored-by lines
  for everyone else who edited), pushes a `galley` branch and opens or updates a pull request, and the
  toolbar shows the GitHub Actions build for it. After the merge, **N new on main** brings the working copy
  up to date and starts the next round.
- **Commit email** on your account page, for when your sign-in address should not appear on public commits.

### Security

- The preview is served with `Content-Security-Policy: sandbox`, so the site's own scripts run in an opaque
  origin and cannot use the viewer's Galley session. Members cannot read or write `.git/` or `.github/`, so
  editing a file can neither run code on the server nor change the workflows that hold the repository's
  secrets. Repository addresses are https only, and the token never touches `.git/config` or a command line.

### Upgrading

- The image now includes `git`. Migration `0013` adds the `sites` table and `users.git_email`.
- Backups include `sites/` (the working copies, which hold edits nobody has sent yet).

## v1.2.0 — 2026-09-23

### Added

- **Clients can suggest wording.** Every section on the share page has "Suggest wording": the client edits the
  words, sees their changes highlighted as they type, and sends it with an optional reason. In the editor it
  arrives as a comment showing only the paragraphs they changed, with **Accept** and **Dismiss**. Accepting
  puts their words into the live section — anyone editing sees it at once — keeps its headings and lists, and
  leaves the previous wording in the version history.
- **The share page says what is waiting on the client.** A list at the top links to every section in review
  that they have not approved yet, the page tabs carry a count, and a page with more than one such section
  has **Approve all**. It is the same list the weekly digest sends, so the email and the page agree.

### Changed

- **New share links let the client comment, suggest and approve** from the start. That is what the link is
  for; the box is still there to untick. Existing links keep whatever they had.
- **The client gives their name once**, in the page header, instead of in a form under every section. The
  per-section form is now three buttons — Approve, Suggest wording, Comment — and draft sections no longer
  offer Approve.
- **Sections a client writes keep their headings and lists** when the paragraph count is unchanged; only
  the paragraphs they reworded lose bold, italic and links.

### Fixed

- **The details pane showed 0 characters** until the section's editor had reported in.
- **Replacing words that had never been saved lost them.** Sample-project sections, and anything else with no
  version history yet, now get their current wording recorded as a version before a restore, an accepted
  suggestion or a client's write replaces it.
- **On a phone, the share page cut the project and client names** to a few letters.

### Upgrading

- Migration `0012` adds two columns to `comments`. It runs on start, after the usual pre-migration backup.

## v1.1.0 — 2026-09-17

### Added

- **Two-factor authentication.** Account → Two-factor turns on a six-digit code from any authenticator app
  (Google Authenticator, 1Password, Aegis). Scan the QR or type the key, confirm one code, and ten one-shot
  recovery codes are shown — the only time they are shown. Sign-in then asks for a code after the password,
  including when a reverse proxy signed the person in. A code cannot be used twice, and the code step is
  throttled the same way the password step is. Any account can use it; admins are who it is for.
- **Invite links last as long as you say.** The invite form now has "Link expires": after 1, 7, 30 or 90 days,
  or never. Seven days stays the default, so nothing changes unless you pick something else, and the invite
  email names the date rather than counting days from whenever it was sent.

### Fixed

- **Two-factor codes could be spent twice by two requests arriving together**, and a simultaneous pair of
  recovery codes could undo each other's removal — a spent code came back. The check and the write are now
  one guarded update, so exactly one request can spend a code.
- **The code step's rate limit was reset by signing in again.** With the password known, an attacker could
  sign in, try seven codes, sign in again, and repeat for as long as they liked. The second factor now has
  its own counter that only a correct code clears, and a successful password no longer wipes the address-wide
  counter either.
- **Login throttling could be evaded with a forged header.** `TRUSTED_PROXY_HOPS=0`, documented for setups
  with no proxy, fell back to the last `X-Forwarded-For` entry — precisely the one a client can set. Zero now
  ignores forwarded headers, a chain shorter than the configured depth is ignored too, and the compose file
  binds the port to `127.0.0.1` so a default install is not reachable directly.
- **A collaborator's tab left in the background silently stopped receiving edits.** The sweep that clears
  clients whose stream close went unobserved now probes the stream first: a live-but-quiet tab keeps its
  place, and only a genuinely dead connection is dropped.
- **The workspace favicon fetch could be pointed at the local network with DNS rebinding.** The address was
  checked and then resolved again by the fetch. It is now fetched from the address that was checked, the
  IPv6 private/loopback ranges the check missed (link-local, unique-local, multicast, NAT64 and
  IPv4-compatible forms) are covered, and a name that resolves to any private address is refused.
- **Signed-in users who were not managers could read a project's share token** out of the page data and
  hand out a link that lets guests comment, approve and upload. The token is now only sent to members who
  can manage the share link.
- **Enabling or disabling two-factor did not sign out other sessions**, so a session opened with a possibly
  leaked password survived the exact change made to contain it. Both now sign out every session but the one
  making the change, as changing a password already did.
- **An archived project still served its share link, its files and its calendar feed** to anyone holding the
  old URL. Archiving now closes those for reading as well as writing; unarchiving brings the same links back.
- **Forward-auth had no way to prove a request came from the proxy.** With `GALLEY_AUTH_HEADERS` on, any
  request that could reach the port with a `Remote-Email` header signed in as that person. `GALLEY_AUTH_SECRET`
  now makes the proxy send `x-galley-auth`, checked in constant time, and without it the first (admin) account
  can no longer be created through the proxy — so an accidentally exposed port is not a way to claim a fresh
  instance. Galley logs a warning at startup when headers are on with no secret.
- **`GALLEY_URL` and `MAX_UPLOAD_MB` silently stopped working after the settings page had been saved once.**
  The stored copy shadowed the environment variable, so changing it in compose or the Unraid template did
  nothing on restart. The environment now wins over the stored value, always.
- **A nightly backup that failed was invisible.** Failures only reached the container log, and a container
  that was down when the chosen hour passed skipped that day entirely. The schedule now catches up after the
  hour, retries failed runs at a slower cadence, and Admin → Backups shows when the last attempt ran and
  whether it worked. Backup zips are written under a `.part` name and renamed when complete, so a crash
  cannot leave a truncated file that looks restorable, and the zips and pre-migration snapshots are created
  `0600` — they hold the mail password and every session token.
- **A local `npm run build` packaged the working copy's `data/` directory** (database, WAL and backup zips)
  into `.next/standalone`. The published image was never affected, but a locally built one could have been.
  The build now removes it, and the route traces exclude it.
- **The container healthcheck called a full or read-only data volume healthy**, because it only proved the
  database answered. It now also checks the data directory is writable with room to spare.
- **The entrypoint only checked the top-level owner**, so a hand-restored backup or an interrupted chown that
  left some files root-owned produced permission errors with no explanation. It now probes the database and
  uploads directory too, and a read-only `/data` gets a plain message instead of a `mkdir` trace and a crash
  loop.
- **A pre-migration snapshot could collide with an earlier one** on a crash-looping boot and abort the
  upgrade, and generated SQLite table rebuilds relied on a pragma that does nothing inside a migration
  transaction. Both fixed.
- **The mobile navigation drawer kept its links in the tab order while closed**, trapped no focus when open,
  and the contrast palette failed WCAG AA in both themes (secondary text, status colours, and the dark-theme
  accent). The drawer is now `inert` until opened and moves focus in and back out; the palette meets AA.
- **The command palette was a plain `div`**: no dialog semantics, no focus trap, and arrow-key results were
  invisible to screen readers. It is now a native modal dialog with combobox/listbox semantics.
- **Toasts vanished after 2.2 seconds with no way to keep or dismiss them**, including errors. They now last
  longer, pause while hovered or focused, and can be dismissed.
- **Cmd+S could report "Saved" over edits that had not reached the server.** The flush now says whether the
  bytes landed; a failed flush keeps the dirty state and says so.
- **Smaller ones**: upload progress no longer floods the live region with every percent; each main screen has
  a skeleton that matches the layout it is about to show instead of the workspace grid; tab rows are links
  with `aria-current` rather than pretending to be ARIA tabs; icon buttons are 40px on touch screens; the
  lightbox no longer re-adds its key listener on every render; `?` no longer opens the shortcut sheet over
  the task inspector; role, member and calendar actions say so when they fail; the theme toggle updates the
  installed-app chrome colour; `/api/search` responses are marked private; and the release workflow now runs
  the type, lint and test gates before publishing `:latest`.

### Changed

- **Fonts are self-hosted.** Instrument Sans and Newsreader were loaded from Google's CDN, which needs the
  CSP to allow that origin and sends every visitor's IP to Google. `next/font` downloads and serves them
  from the app itself, so the CSP no longer allows any third-party style or font source.

### Upgrading

If you reach Galley directly rather than through a reverse proxy, publish the port as `3000:3000` and set
`TRUSTED_PROXY_HOPS=0`, or copy the new `compose.yml`; the default now binds to localhost. Behind a proxy,
nothing changes. Otherwise nothing to do: the migration adds the two-factor columns and makes an invite's
expiry nullable, and existing invites keep the expiry they already had.

## v1.0.1 — 2026-09-14

### Fixed

- **A `.jpeg` upload was stored where nothing would look for it.** The file was written under the extension it
  arrived with, while every read derived the path from the stored mime — and `.jpg` and `.jpeg` share one mime,
  so a `.jpeg` landed on disk as `original.jpeg` and was looked for as `original.jpg`. The upload appeared to
  work, the byte count was right, and the asset then said "The original file is missing". Uploads now use the
  canonical extension, files already written under the other spelling are renamed into place the first time
  they are asked for — including by the zip export, which would otherwise have dropped them without a word —
  and an asset that failed only for this reason is retried on the next start instead of staying failed.
- **An image that failed to process showed a broken image.** The grid assumed every image had a thumbnail
  whether or not processing had succeeded, so the browser's broken-image glyph appeared instead of the file
  icon and the "Could not process" note underneath. Videos already checked; images do now too.

### Changed

- **The Docker Hub blurb** was still the tagline from before the repositioning, and is now the current one.
  (It also has a 100-character cap, which the obvious replacement exceeded.)
- **Light is the default theme.** It used to follow the operating system before anyone had chosen anything, so
  a visitor on a dark desktop got a dark Galley without asking for it. Dark now happens when you pick it, or
  when you pick "follow the system". The toggle cycles light → dark → system, and the browser chrome colour
  follows the theme that is actually showing rather than the OS setting.

## v1.0.0 — 2026-09-14

The first release meant for other people to run. Everything below landed after v0.1.0.

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
- **A fresh install could fail on a directory it could not write.** Unraid creates appdata as `nobody:users`
  and plain Docker creates a missing bind mount as `root:root`, while the image ran as uid 1000 — so neither
  worked without someone chowning the directory first. The container now starts as root, takes ownership of the
  data directory, and drops to `PUID:PGID` (99:100 on Unraid, 1000:1000 elsewhere) before running anything.
  Pass `--user` to keep the old behaviour and own the chown yourself. CI now installs into a deliberately
  root-owned bind mount, and checks the database comes out owned by the unprivileged user, which is proof the
  privileges were actually dropped.
- Editors were shown a "Create feed link" button that only a manager could use, and it failed when clicked.
- The instance-wide supplier directory could be edited by anyone signed in, including someone invited as a
  viewer on a single project.
- A failed database migration leaked a connection on every subsequent request instead of failing the boot.
- Uploads are checked against the size limit before sending, instead of after a whole file has been uploaded.
- The README described a backup method that silently loses recent writes. Copying the data directory is only
  safe with Galley stopped; the backup zip is safe at any time.

### Upgrading

- Nothing to do. Six migrations apply on start.
- If you had worked around the permissions problem with `--user 99:100` in Extra Parameters, you can remove it:
  Galley handles this itself now. Leaving it in place also works.
- To use the weekly digest, set a client email address in each project's settings and turn the schedule on in
  Admin → Email.

## v0.1.0 — 2026-09-12

First public release: projects with tasks, a copy editor with draft/review/approved states and live
collaborative editing, a calendar, a supplier directory, an asset library with thumbnails and palettes, a
client share link, search, export, backups, and email through SMTP or Resend, Postmark, SendGrid or Mailgun.
Ships as one container with one SQLite file.
