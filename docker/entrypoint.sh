#!/bin/sh
# Galley starts as root, makes the data directory usable, then drops to an
# unprivileged user. The application itself never runs as root.
#
# This is what lets one image work everywhere without anyone chowning anything
# first. The three cases that used to need different treatment:
#
#   - Unraid creates appdata as nobody:users (99:100)
#   - plain Docker creates a missing bind mount as root:root
#   - a named volume inherits whatever the image set
#
# Set PUID/PGID to choose who it becomes; the Unraid template sets 99:100
# because that is the convention there and keeps the share browsable.
set -e

DATA="${GALLEY_DATA_DIR:-/data}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

if [ "$(id -u)" != "0" ]; then
  # Someone passed --user, or the platform forbids root. Ownership cannot be
  # fixed from here, so check it and say exactly what would fix it.
  if [ ! -w "$DATA" ]; then
    echo "Galley: $DATA is not writable by uid $(id -u):$(id -g)." >&2
    echo "  Either drop --user and let Galley set this up itself, or run: chown -R $(id -u):$(id -g) <the host directory>" >&2
    exit 1
  fi
  mkdir -p "$DATA/uploads" || { echo "Galley: $DATA is writable but $DATA/uploads could not be created. If this is a read-only mount, remount it read-write." >&2; exit 1; }
  exec node server.js
fi

if ! mkdir -p "$DATA/uploads" 2>/dev/null; then
  echo "Galley: cannot create $DATA/uploads. Check that the data directory exists, points at a mounted volume and is not read-only, then start again." >&2
  exit 1
fi

# Only when it is not already right: chown -R over a large uploads tree is slow,
# and it would otherwise run on every single start. A matching directory owner
# is not enough on its own, though: an interrupted chown, a hand-restored backup
# or a mix of previous UIDs leaves individual files owned by someone else, and
# the app fails on those alone. Probe the database (or uploads) as well.
owner="$(stat -c '%u:%g' "$DATA" 2>/dev/null || echo '')"
probe="$DATA/galley.db"
[ -e "$probe" ] || probe="$DATA/uploads"
probe_owner="$(stat -c '%u:%g' "$probe" 2>/dev/null || echo '')"
if [ "$owner" != "$PUID:$PGID" ] || { [ -n "$probe_owner" ] && [ "$probe_owner" != "$PUID:$PGID" ]; }; then
  echo "Galley: taking ownership of $DATA for ${PUID}:${PGID} (was ${owner:-unknown})"
  chown -R "$PUID:$PGID" "$DATA"
fi

# --clear-groups rather than --init-groups: PUID is frequently an id with no
# matching entry in /etc/passwd (99 on Unraid), and looking it up would fail.
exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups --inh-caps=-all node server.js
