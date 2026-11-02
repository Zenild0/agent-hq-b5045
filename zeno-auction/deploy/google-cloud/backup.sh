#!/usr/bin/env bash
# Nightly backup of every auction and photo into /var/backups/zenobid (readable by root only),
# keeping the last 7 days. Run by zenobid-backup.timer; you can also run it by hand: sudo zenobid-backup
set -eu
NAME="${NAME:-$(basename "$0" | sed -n 's/^\(.*\)-backup$/\1/p')}"; NAME="${NAME:-zenobid}"
ENV_FILE="${ENV_FILE:-/etc/$NAME.env}"
envval() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-; }
DATA_DIR="${DATA_DIR:-$(envval DATA_DIR)}"; DATA_DIR="${DATA_DIR:-/var/lib/$NAME}"
DEST="${BACKUP_DIR:-/var/backups/$NAME}"
KEEP_DAYS="${KEEP_DAYS:-7}"

umask 077
mkdir -p "$DEST"
chmod 700 "$DEST"
[ -d "$DATA_DIR" ] || { echo "$(date -Is) no data folder yet ($DATA_DIR), nothing to back up"; exit 0; }

FILE="$DEST/$NAME-$(date +%F).tgz"
# tar exits 1 when a file changed while it was being read (an auction saving at that moment): the
# copy is still fine because every file is written atomically. Anything above 1 is a real failure.
rc=0
tar -czf "$FILE.tmp" -C "$DATA_DIR" . || rc=$?
if [ "$rc" -gt 1 ]; then rm -f "$FILE.tmp"; echo "backup failed (tar exit $rc)"; exit 1; fi
mv "$FILE.tmp" "$FILE"
find "$DEST" -name "$NAME-*.tgz" -mtime +"$((KEEP_DAYS - 1))" -delete
echo "$(date -Is) backup saved: $FILE ($(du -h "$FILE" | cut -f1))"
