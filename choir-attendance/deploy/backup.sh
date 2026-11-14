#!/usr/bin/env bash
# Daily backup: the same file as Settings -> Download backup (restorable from Settings -> Restore).
set -eu
set -a; . "${ENV_FILE:-/etc/choir.env}"; set +a
DEST="${BACKUP_DIR:-/var/backups/choir}"
mkdir -p "$DEST"
FILE="$DEST/choir-backup-$(date +%F).tar"
curl -fsS -H "x-pin: ${CHOIR_PIN}" "http://127.0.0.1:${PORT:-3000}/api/teacher/backup" -o "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
find "$DEST" -name 'choir-backup-*.tar' -mtime +14 -delete
echo "$(date -Is) backup saved: $FILE"
