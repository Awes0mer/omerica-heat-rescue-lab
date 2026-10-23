#!/bin/sh
# SPDX-License-Identifier: MIT
set -eu
HOSTING_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$HOSTING_DIR")
export HEAT_RESCUE_ROOT="${HEAT_RESCUE_ROOT:-$PROJECT_DIR/dist}"
CADDY_BIN="${HEAT_RESCUE_CADDY_BIN:-caddy}"
if ! command -v "$CADDY_BIN" >/dev/null 2>&1; then
  echo "Install open-source Caddy first: https://caddyserver.com/docs/install" >&2
  echo "Or set HEAT_RESCUE_CADDY_BIN to your existing Caddy executable." >&2
  exit 1
fi
if [ ! -f "$HEAT_RESCUE_ROOT/index.html" ]; then
  echo "Missing app: $HEAT_RESCUE_ROOT/index.html" >&2
  exit 1
fi
case "${1:-run}" in
  run) exec "$CADDY_BIN" run --config "$HOSTING_DIR/Caddyfile" --adapter caddyfile ;;
  validate) exec "$CADDY_BIN" validate --config "$HOSTING_DIR/Caddyfile" --adapter caddyfile ;;
  *) echo "Usage: $0 [run|validate]" >&2; exit 2 ;;
esac
