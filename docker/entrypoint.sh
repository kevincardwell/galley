#!/bin/sh
set -e
DATA="${GALLEY_DATA_DIR:-/data}"
# Checked before mkdir: on a bind mount Docker creates the directory as root:root,
# so mkdir is what fails first and its error says nothing useful.
if [ ! -w "$DATA" ]; then
  echo "Galley: $DATA is not writable by uid $(id -u). Fix the volume permissions (chown 1000:1000 on the host, or run the container with --user) and restart." >&2
  exit 1
fi
mkdir -p "$DATA/uploads"
exec node server.js
