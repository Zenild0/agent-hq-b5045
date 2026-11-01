#!/usr/bin/env bash
# One-time setup of ZenoBid as a SECOND app on the same server as the choir app.
# Safe to run again: it never overwrites /etc/zenobid.env or your auction data.
# Run it again with NAME=zenobid-test PORT=3002 BRANCH=staging-zenobid to make a separate test copy.
# It never touches the choir app (/opt/choir, /var/lib/choir, /etc/choir.env, the "choir" service, port 3000).
set -euo pipefail

# ---- settings (all can be overridden; the tests rely on this) ----------------------------------------
# NAME makes a whole separate copy: its own user, folders, settings file, service, port and branch.
#   the real site:   (nothing to set)                                  -> "zenobid", port 3001, branch deploy-zenobid
#   a test copy:     NAME=zenobid-test PORT=3002 BRANCH=staging-zenobid  -> shows a "TEST COPY" ribbon
NAME="${NAME:-zenobid}"
[[ "$NAME" =~ ^[a-z][a-z0-9-]{2,30}$ ]] || { echo "NAME must be lowercase letters, digits and dashes (for example zenobid-test)."; exit 1; }
case "$NAME" in *choir*) echo "That name belongs to the choir app. Choose another."; exit 1;; esac
if [ "$NAME" = zenobid ]; then BRANCH="${BRANCH:-deploy-zenobid}"; else
  [ -n "${BRANCH:-}" ] || { echo "A copy called $NAME needs its own branch: set BRANCH=staging-zenobid (never reuse deploy-zenobid)."; exit 1; }
  [ "$BRANCH" != deploy-zenobid ] || { echo "The test copy must not follow the real branch (deploy-zenobid)."; exit 1; }
fi
REPO="${REPO:-https://github.com/Zenild0/agent-hq-b5045.git}"
PORT="${PORT:-3001}"
APP_DIR="${APP_DIR:-/opt/$NAME}"
DATA_DIR="${DATA_DIR:-/var/lib/$NAME}"
ENV_FILE="${ENV_FILE:-/etc/$NAME.env}"
BRANCH_FILE="${BRANCH_FILE:-/etc/$NAME-branch}"
UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"
BIN_DIR="${BIN_DIR:-/usr/local/bin}"
STATE_DIR="${STATE_DIR:-/var/lib/$NAME-update}"
BACKUP_ROOT="${BACKUP_DIR:-/var/backups/$NAME}"
SKIP_SYSTEM="${ZB_SKIP_SYSTEM:-0}" # tests only: skip apt, swap, users, systemctl
if [ "$NAME" = zenobid ]; then APP_ENV=production; MEM_MAX=300M; MEM_HIGH=240M; DELETE_DAYS=30; else APP_ENV=test; MEM_MAX=200M; MEM_HIGH=160M; DELETE_DAYS=7; fi

[ "$SKIP_SYSTEM" = 1 ] || [ "$(id -u)" = 0 ] || { echo "Please run with sudo:  sudo bash setup.sh"; exit 1; }
[ "$PORT" != 3000 ] || { echo "Port 3000 belongs to the choir app. Choose another port (for example 3001)."; exit 1; }

step() { printf '\n==> %s\n' "$*"; }

# ---- 1. look before touching anything -----------------------------------------------------------------
step "Checking the server (this only looks, it changes nothing)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$HERE/preflight.sh" ]; then PORT="$PORT" NAME="$NAME" bash "$HERE/preflight.sh" || { echo "Fix the ✗ items above, then run setup again."; exit 1; }; fi

# ---- 2. the address (not a secret) ----------------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  PUBLIC_HOST="${PUBLIC_HOST:-}"
  if [ -z "$PUBLIC_HOST" ] && [ -t 0 ]; then
    echo
    echo "Which web address will ZenoBid use? Press Enter for the suggestion."
    read -rp "Address [teamauction.zenildodias.com]: " PUBLIC_HOST
  fi
  PUBLIC_HOST="${PUBLIC_HOST:-teamauction.zenildodias.com}"
  PUBLIC_HOST="${PUBLIC_HOST#https://}"; PUBLIC_HOST="${PUBLIC_HOST%/}"
  [[ "$PUBLIC_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "That address has odd characters. Use something like teamauction.zenildodias.com"; exit 1; }
fi

# ---- 3. programs ------------------------------------------------------------------------------------------
if [ "$SKIP_SYSTEM" != 1 ]; then
  step "Memory safety cushion (swap)"
  if [ -n "$(swapon --show --noheadings 2>/dev/null)" ]; then
    echo "Swap already exists — reusing it."
  else
    fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "Added 1 GB of swap."
  fi

  step "Programs (only what is missing)"
  export DEBIAN_FRONTEND=noninteractive
  need=""
  for p in curl git ca-certificates; do dpkg -s "$p" >/dev/null 2>&1 || need="$need $p"; done
  if [ -n "$need" ]; then apt-get update -qq && apt-get install -y -qq $need >/dev/null; fi
  if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
  fi
  echo "Node $(node -v) ready."
fi

# ---- 4. the app -------------------------------------------------------------------------------------------
step "Downloading ZenoBid ($BRANCH)"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet --depth 1 origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
  git -C "$APP_DIR" checkout --quiet -B "$BRANCH" "origin/$BRANCH"
elif [ -e "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
  echo "$APP_DIR already exists and is not a ZenoBid install — leaving it alone. Stop."; exit 1
else
  git clone --quiet --depth 1 --single-branch --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
echo "$BRANCH" > "$BRANCH_FILE"

step "Installing its libraries (small: only what the app needs to run)"
( cd "$APP_DIR" && nice npm ci --omit=dev --no-audit --no-fund --loglevel=error )

# ---- 5. a user, a data folder and the settings file ------------------------------------------------------
if [ "$SKIP_SYSTEM" != 1 ]; then
  id "$NAME" >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$NAME"
fi
mkdir -p "$DATA_DIR" "$STATE_DIR"
[ "$SKIP_SYSTEM" = 1 ] || chown -R "$NAME:$NAME" "$DATA_DIR"

if [ ! -f "$ENV_FILE" ]; then
  umask 077
  cat > "$ENV_FILE" <<ENV
# ZenoBid ($NAME) settings. Edit with:  sudo nano $ENV_FILE   then:  sudo systemctl restart $NAME
# Auctions have their own admin links, so nothing here is needed to run auctions. The one optional secret is
# DEV_KEY (the developer page and payments): add that line yourself, never paste it anywhere else.
NODE_ENV=production
APP_ENV=$APP_ENV
PORT=$PORT
HOST=127.0.0.1
TRUST_PROXY=true
DATA_DIR=$DATA_DIR
# An auction nobody has touched for this many days deletes itself (0 = never).
AUTO_DELETE_DAYS=$DELETE_DAYS
MAX_EVENTS=50
PUBLIC_URL=https://$PUBLIC_HOST
ENV
  echo "Settings file created: $ENV_FILE"
else
  echo "Settings file already exists — kept as it is."
fi

# ---- 6. the service and its timers ------------------------------------------------------------------------
step "Creating the service and timers"
install -d "$BIN_DIR" "$UNIT_DIR"
for f in update backup; do install -m 755 "$APP_DIR/deploy/google-cloud/$f.sh" "$BIN_DIR/$NAME-$f"; done
install -m 755 "$APP_DIR/deploy/google-cloud/uninstall.sh" "$BIN_DIR/$NAME-remove"
cat > "$BIN_DIR/$NAME-links" <<WRAP
#!/bin/sh
ENV_FILE="$ENV_FILE" exec node "$APP_DIR/deploy/google-cloud/links.cjs" "\$@"
WRAP
chmod 755 "$BIN_DIR/$NAME-links"

cat > "$UNIT_DIR/$NAME.service" <<UNIT
[Unit]
Description=ZenoBid live team auctions ($NAME)
After=network-online.target
Wants=network-online.target

[Service]
User=$NAME
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
Environment=NODE_OPTIONS=--max-old-space-size=160
ExecStart=/usr/bin/node dist-server/index.js
Restart=always
RestartSec=3
# Keep it small and polite: if the server ever runs short of memory, ZenoBid is stopped before the choir app.
MemoryHigh=$MEM_HIGH
MemoryMax=$MEM_MAX
OOMScoreAdjust=300
Nice=5
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
UNIT

cat > "$UNIT_DIR/$NAME-update.service" <<UNIT
[Unit]
Description=Update $NAME from GitHub
[Service]
Type=oneshot
ExecStart=$BIN_DIR/$NAME-update
UNIT
cat > "$UNIT_DIR/$NAME-update.timer" <<UNIT
[Unit]
Description=Check GitHub for a new $NAME every 10 minutes
[Timer]
OnBootSec=5min
OnUnitActiveSec=10min
[Install]
WantedBy=timers.target
UNIT
cat > "$UNIT_DIR/$NAME-backup.service" <<UNIT
[Unit]
Description=Nightly $NAME backup
[Service]
Type=oneshot
ExecStart=$BIN_DIR/$NAME-backup
Environment=BACKUP_DIR=$BACKUP_ROOT
UNIT
cat > "$UNIT_DIR/$NAME-backup.timer" <<UNIT
[Unit]
Description=Nightly $NAME backup
[Timer]
OnCalendar=*-*-* 03:10:00
Persistent=true
[Install]
WantedBy=timers.target
UNIT

if [ "$SKIP_SYSTEM" = 1 ]; then echo "(test mode: not starting anything)"; exit 0; fi

systemctl daemon-reload
systemctl enable --now "$NAME.service" "$NAME-update.timer" "$NAME-backup.timer" >/dev/null 2>&1
for _ in $(seq 1 20); do curl -fsS -m 2 "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 1; done

echo
if curl -fsS -m 5 "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
  echo "SUCCESS: ZenoBid ($NAME) is running on this server (port $PORT). The choir app was not touched."
  echo "Check it:   curl http://127.0.0.1:$PORT/healthz"
else
  echo "ZenoBid did not start. Look at:  sudo journalctl -u $NAME -n 40 --no-pager"
  exit 1
fi
echo
echo "NEXT: add the public hostname in Cloudflare (see GOOGLE-CLOUD.md, Part 5)."
