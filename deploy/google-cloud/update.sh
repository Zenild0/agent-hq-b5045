#!/usr/bin/env bash
# Checks GitHub for a new ZenoBid build; if there is one, installs it and restarts the app.
#   - never restarts while an auction is live (waits for the next check)
#   - if the new version does not start, goes back to the previous one and remembers the bad one
# Everything below can be overridden with environment variables (the tests do exactly that).
set -u
# The installed copy is called <name>-update (zenobid-update, zenobid-test-update …) and works on that copy only.
NAME="${NAME:-$(basename "$0" | sed -n 's/^\(.*\)-update$/\1/p')}"; NAME="${NAME:-zenobid}"
APP_DIR="${APP_DIR:-/opt/$NAME}"
ENV_FILE="${ENV_FILE:-/etc/$NAME.env}"
BRANCH="${BRANCH:-$(cat "/etc/$NAME-branch" 2>/dev/null || echo deploy-zenobid)}"
SERVICE="${SERVICE:-$NAME}"
STATE_DIR="${STATE_DIR:-/var/lib/$NAME-update}"
WAIT_SECONDS="${WAIT_SECONDS:-25}"
SYSTEMCTL="${SYSTEMCTL:-systemctl}"
NPM="${NPM:-npm}"
BIN_DIR="${BIN_DIR:-/usr/local/bin}"

envval() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-; }
PORT="${PORT:-$(envval PORT)}"; PORT="${PORT:-3001}"
DATA_DIR="${DATA_DIR:-$(envval DATA_DIR)}"; DATA_DIR="${DATA_DIR:-/var/lib/$NAME}"

log() { echo "$(date -Is) $*"; }

mkdir -p "$STATE_DIR"
cd "$APP_DIR" || { log "no app directory $APP_DIR"; exit 1; }

# Only one update at a time (the timer must never overlap a slow run).
exec 9>"$STATE_DIR/lock"
flock -n 9 || exit 0

# The published branch is replaced as a whole each time, so fetch it by force.
timeout 90 git fetch --quiet --depth 1 origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" \
  || { log "could not reach GitHub, will try again later"; exit 0; }
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")
[ "$LOCAL" = "$REMOTE" ] && exit 0
if [ -f "$STATE_DIR/bad-commit" ] && [ "$(cat "$STATE_DIR/bad-commit")" = "$REMOTE" ]; then
  exit 0 # this version already failed to start: wait for a newer one
fi

# Never interrupt a live auction. (If the app is not answering at all, go ahead: the update may fix it.)
HEALTH=$(curl -fsS -m 3 "http://127.0.0.1:${PORT}/healthz" 2>/dev/null || true)
LIVE=$(printf '%s' "$HEALTH" | sed -n 's/.*"live":\([0-9][0-9]*\).*/\1/p')
if [ "${LIVE:-0}" -gt 0 ]; then
  log "an auction is live right now; will update at a quieter moment"
  exit 0
fi

lockhash() { sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1; }
install_deps() { timeout 600 nice "$NPM" ci --omit=dev --no-audit --no-fund --loglevel=error; }

log "updating ${LOCAL:0:8} -> ${REMOTE:0:8} ($BRANCH)"
# A copy of everyone's data from just before the update, in case it is ever needed.
if [ -d "$DATA_DIR" ]; then tar -czf "$STATE_DIR/data-before-update.tgz" -C "$DATA_DIR" . 2>/dev/null || true; fi

LOCK_BEFORE=$(lockhash)
git reset --hard --quiet "$REMOTE"
OK=1
if [ "$(lockhash)" != "$LOCK_BEFORE" ]; then install_deps || OK=0; fi
if [ "$OK" = 1 ]; then
  "$SYSTEMCTL" restart "$SERVICE" 9>&-  # (do not hand the lock to the app)
  for _ in $(seq 1 "$WAIT_SECONDS"); do
    # "started" = answers its health check AND serves the web page
    if curl -fsS -m 2 "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1 \
      && curl -fsS -m 5 -o /dev/null "http://127.0.0.1:${PORT}/" 2>/dev/null; then
      log "update ok"
      rm -f "$STATE_DIR/bad-commit"
      # So that a newer version of this very script takes effect from the next run on.
      # (install replaces the file instead of editing it, so the copy running right now is not disturbed.)
      for f in update backup; do
        [ -f "$APP_DIR/deploy/google-cloud/$f.sh" ] && install -m 755 "$APP_DIR/deploy/google-cloud/$f.sh" "$BIN_DIR/$NAME-$f" 2>/dev/null || true
      done
      exit 0
    fi
    sleep 1
  done
fi

log "new version did not start; rolling back to ${LOCAL:0:8}"
echo "$REMOTE" > "$STATE_DIR/bad-commit"
LOCK_NEW=$(lockhash)
git reset --hard --quiet "$LOCAL"
if [ "$(lockhash)" != "$LOCK_NEW" ]; then install_deps || log "could not restore the previous libraries"; fi
"$SYSTEMCTL" restart "$SERVICE" 9>&-  # (do not hand the lock to the app)
for _ in $(seq 1 "$WAIT_SECONDS"); do
  if curl -fsS -m 2 "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then log "rollback ok, the previous version is running again"; exit 1; fi
  sleep 1
done
log "WARNING: the previous version does not answer either — look at: journalctl -u $SERVICE -n 50"
exit 1
