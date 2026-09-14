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
  mkdir -p "$DATA/uploads"
  exec node server.js
fi

mkdir -p "$DATA/uploads"

# Only when it is not already right: chown -R over a large uploads tree is slow,
# and it would otherwise run on every single start.
owner="$(stat -c '%u:%g' "$DATA" 2>/dev/null || echo '')"
if [ "$owner" != "$PUID:$PGID" ]; then
  echo "Galley: taking ownership of $DATA for ${PUID}:${PGID} (was ${owner:-unknown})"
  chown -R "$PUID:$PGID" "$DATA"
fi

# --clear-groups rather than --init-groups: PUID is frequently an id with no
# matching entry in /etc/passwd (99 on Unraid), and looking it up would fail.
exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups --inh-caps=-all node server.js
