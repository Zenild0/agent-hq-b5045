#!/usr/bin/env bash
# Removes one ZenoBid copy from this server. Touches nothing that belongs to the choir app,
# and nothing that belongs to a different ZenoBid copy.
#   sudo zenobid-remove            stops and removes the app, KEEPS your auctions and backups
#   sudo zenobid-remove --all      removes everything, including auctions and backups (cannot be undone)
# (A test copy has its own command: sudo zenobid-test-remove)
set -eu
NAME="${NAME:-$(basename "$0" | sed -n 's/^\(.*\)-remove$/\1/p')}"; NAME="${NAME:-zenobid}"
[[ "$NAME" =~ ^[a-z][a-z0-9-]{2,30}$ ]] && case "$NAME" in *choir*) false;; *) true;; esac || { echo "Refusing: strange or protected name '$NAME'."; exit 1; }
[ "$(id -u)" = 0 ] || { echo "Please run with sudo."; exit 1; }
ALL=0; [ "${1:-}" = "--all" ] && ALL=1
if [ "$ALL" = 1 ]; then
  read -rp "Delete ALL auctions and backups of '$NAME' for good? Type YES: " a
  [ "$a" = "YES" ] || { echo "Cancelled."; exit 1; }
fi
systemctl disable --now "$NAME-update.timer" "$NAME-backup.timer" "$NAME.service" 2>/dev/null || true
rm -f "/etc/systemd/system/$NAME.service" "/etc/systemd/system/$NAME-update.service" "/etc/systemd/system/$NAME-update.timer" \
      "/etc/systemd/system/$NAME-backup.service" "/etc/systemd/system/$NAME-backup.timer"
systemctl daemon-reload
rm -rf "/opt/$NAME" "/var/lib/$NAME-update" "/etc/$NAME-branch"
rm -f "/usr/local/bin/$NAME-update" "/usr/local/bin/$NAME-backup" "/usr/local/bin/$NAME-links"
if [ "$ALL" = 1 ]; then
  rm -rf "/var/lib/$NAME" "/var/backups/$NAME" "/etc/$NAME.env"
  id "$NAME" >/dev/null 2>&1 && userdel "$NAME" || true
  rm -f "/usr/local/bin/$NAME-remove"
  echo "'$NAME' and all its data are gone. (Also delete its hostname in Cloudflare.)"
else
  echo "'$NAME' is stopped and removed. Your auctions are still in /var/lib/$NAME and backups in /var/backups/$NAME."
  echo "Delete those too with:  sudo $NAME-remove --all"
fi
