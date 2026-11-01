#!/usr/bin/env bash
# Removes ZenoBid from this server. Touches nothing that belongs to the choir app.
#   sudo zenobid-remove            stops and removes the app, KEEPS your auctions and backups
#   sudo zenobid-remove --all      removes everything, including auctions and backups (cannot be undone)
set -eu
[ "$(id -u)" = 0 ] || { echo "Please run with sudo."; exit 1; }
ALL=0; [ "${1:-}" = "--all" ] && ALL=1
if [ "$ALL" = 1 ]; then
  read -rp "Delete ALL ZenoBid auctions and backups for good? Type YES: " a
  [ "$a" = "YES" ] || { echo "Cancelled."; exit 1; }
fi
systemctl disable --now zenobid-update.timer zenobid-backup.timer zenobid.service 2>/dev/null || true
rm -f /etc/systemd/system/zenobid.service /etc/systemd/system/zenobid-update.service /etc/systemd/system/zenobid-update.timer \
      /etc/systemd/system/zenobid-backup.service /etc/systemd/system/zenobid-backup.timer
systemctl daemon-reload
rm -rf /opt/zenobid /var/lib/zenobid-update /etc/zenobid-branch
rm -f /usr/local/bin/zenobid-update /usr/local/bin/zenobid-backup /usr/local/bin/zenobid-links
if [ "$ALL" = 1 ]; then
  rm -rf /var/lib/zenobid /var/backups/zenobid /etc/zenobid.env
  id zenobid >/dev/null 2>&1 && userdel zenobid || true
  rm -f /usr/local/bin/zenobid-remove
  echo "ZenoBid and all its data are gone. (Also delete the hostname in Cloudflare.)"
else
  echo "ZenoBid is stopped and removed. Your auctions are still in /var/lib/zenobid and backups in /var/backups/zenobid."
  echo "Delete those too with:  sudo zenobid-remove --all"
fi
