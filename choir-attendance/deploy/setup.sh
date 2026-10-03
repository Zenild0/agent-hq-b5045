#!/usr/bin/env bash
# One-time setup of the Children's Choir ZD app on a fresh Debian/Ubuntu server.
# Safe to run again: it will not overwrite your PIN or data.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Please run with sudo:  curl -fsSL <url> | sudo bash"; exit 1; }

REPO="${REPO:-https://github.com/Zenild0/agent-hq-b5045.git}"
BRANCH="${BRANCH:-claude/childrens-choir-attendance-r3d2st}"
APP_DIR=/opt/choir
DATA_DIR=/var/lib/choir

echo "==> Adding 1 GB of swap (this small server has little memory)"
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Installing programs"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg >/dev/null
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
if ! command -v cloudflared >/dev/null; then
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg > /usr/share/keyrings/cloudflare-main.gpg
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' > /etc/apt/sources.list.d/cloudflared.list
  apt-get update -qq
  apt-get install -y -qq cloudflared >/dev/null
fi

echo "==> Downloading the app ($BRANCH)"
echo "$BRANCH" > /etc/choir-branch
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
else
  git clone --quiet "$REPO" "$APP_DIR"
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
fi
git -C "$APP_DIR" checkout --quiet -B "$BRANCH" "origin/$BRANCH"

id choir >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin choir
mkdir -p "$DATA_DIR"
chown -R choir:choir "$DATA_DIR"

if [ ! -f /etc/choir.env ]; then
  echo
  echo "Choose your TEACHER PIN. You will type it on your phone to open the teacher pages."
  echo "Use 8 or more letters/digits, no spaces. Keep it private."
  while :; do
    read -rsp "Teacher PIN: " PIN </dev/tty; echo
    if [[ "$PIN" =~ ^[A-Za-z0-9]{8,}$ ]]; then break; fi
    echo "Too short, or has spaces/symbols. Try again."
  done
  umask 077
  cat > /etc/choir.env <<ENV
CHOIR_PIN=$PIN
CHOIR_PUBLIC=1
CHOIR_TRUST_PROXY=1
CHOIR_DATA=$DATA_DIR/db.json
PORT=3000
ENV
fi

echo "==> Creating the services"
cat > /etc/systemd/system/choir.service <<UNIT
[Unit]
Description=Children's Choir ZD
After=network-online.target
Wants=network-online.target

[Service]
User=choir
WorkingDirectory=$APP_DIR/choir-attendance
EnvironmentFile=/etc/choir.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
UNIT

install -m 755 "$APP_DIR/choir-attendance/deploy/update.sh" /usr/local/bin/choir-update
install -m 755 "$APP_DIR/choir-attendance/deploy/backup.sh" /usr/local/bin/choir-backup

cat > /etc/systemd/system/choir-update.service <<'UNIT'
[Unit]
Description=Update the choir app from GitHub
[Service]
Type=oneshot
ExecStart=/usr/local/bin/choir-update
UNIT
cat > /etc/systemd/system/choir-update.timer <<'UNIT'
[Unit]
Description=Check GitHub for choir app updates every 5 minutes
[Timer]
OnBootSec=3min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
UNIT
cat > /etc/systemd/system/choir-backup.service <<'UNIT'
[Unit]
Description=Daily choir backup
[Service]
Type=oneshot
ExecStart=/usr/local/bin/choir-backup
UNIT
cat > /etc/systemd/system/choir-backup.timer <<'UNIT'
[Unit]
Description=Daily choir backup
[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true
[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now choir.service choir-update.timer choir-backup.timer >/dev/null
sleep 2

echo
if curl -fsS -m 5 http://127.0.0.1:3000/healthz >/dev/null; then
  echo "SUCCESS: the choir app is running on this server."
else
  echo "The app did not start. Look at:  sudo journalctl -u choir -n 40"
fi
echo
echo "NEXT: connect it to your domain with Cloudflare Tunnel (see GOOGLE-CLOUD.md, Part 4)."
