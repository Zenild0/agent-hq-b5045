#!/usr/bin/env bash
# Backs up every auction and photo (the Docker volume) into deploy/backups/, keeping 14 days.
#   ./deploy/backup.sh          # run it by hand, or from cron (see deploy/README.md)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
STAMP=$(date +%Y-%m-%d-%H%M)
docker run --rm -v zenobid_zenobid-data:/data:ro -v "$PWD/backups":/backup alpine \
  tar czf "/backup/zenobid-$STAMP.tgz" -C /data .
find backups -name 'zenobid-*.tgz' -mtime +14 -delete
echo "Saved deploy/backups/zenobid-$STAMP.tgz"
