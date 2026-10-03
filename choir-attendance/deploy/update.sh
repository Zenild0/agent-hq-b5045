#!/usr/bin/env bash
# Checks GitHub for new code; if there is any, installs it and restarts the app.
# If the new version does not start, it rolls back to the previous one and remembers
# the bad version so it is not retried over and over.
set -u
APP_DIR="${APP_DIR:-/opt/choir}"
BRANCH="${BRANCH:-$(cat /etc/choir-branch 2>/dev/null || echo main)}"
SERVICE="${SERVICE:-choir}"
PORT="${PORT:-3000}"
STATE_DIR="${STATE_DIR:-/var/lib/choir-update}"
WAIT_SECONDS="${WAIT_SECONDS:-20}"

log() { echo "$(date -Is) $*"; }

mkdir -p "$STATE_DIR"
cd "$APP_DIR" || { log "no app directory $APP_DIR"; exit 1; }

git fetch --quiet origin "$BRANCH" || { log "could not reach GitHub, will try again later"; exit 0; }
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")
[ "$LOCAL" = "$REMOTE" ] && exit 0
if [ -f "$STATE_DIR/bad-commit" ] && [ "$(cat "$STATE_DIR/bad-commit")" = "$REMOTE" ]; then
  exit 0 # this version already failed to start: wait for a newer one
fi

log "updating ${LOCAL:0:8} -> ${REMOTE:0:8} ($BRANCH)"
git reset --hard --quiet "$REMOTE"
systemctl restart "$SERVICE"

for _ in $(seq 1 "$WAIT_SECONDS"); do
  if curl -fsS -m 2 "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
    log "update ok"
    rm -f "$STATE_DIR/bad-commit"
    exit 0
  fi
  sleep 1
done

log "new version did not start; rolling back to ${LOCAL:0:8}"
echo "$REMOTE" > "$STATE_DIR/bad-commit"
git reset --hard --quiet "$LOCAL"
systemctl restart "$SERVICE"
exit 1
