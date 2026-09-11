#!/bin/sh
set -e
mkdir -p "${GALLEY_DATA_DIR:-/data}/uploads"
if [ ! -w "${GALLEY_DATA_DIR:-/data}" ]; then
  echo "Galley: ${GALLEY_DATA_DIR:-/data} is not writable by uid $(id -u). Fix the volume permissions (chown 1000:1000) and restart." >&2
  exit 1
fi
if [ -z "$GALLEY_SECRET" ]; then
  echo "Galley: GALLEY_SECRET is not set. Sessions still work, but set it in compose.yml for a stable install." >&2
fi
exec node server.js
