#!/usr/bin/env bash
# Builds ZenoBid and publishes the READY-TO-RUN result to its own branch (default: deploy-zenobid).
# The small Google server never builds anything (building needs more memory than it has): it just
# downloads this branch. The branch holds only the built app, never source code, keys or data.
#
#   deploy/publish.sh                 build + push (replaces the branch each time)
#   DRY_RUN=1 deploy/publish.sh       build and show what would be pushed, push nothing
#   PUSH_URL=/path/to/bare.git ...    push somewhere else (used by the tests)
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-deploy-zenobid}"
cd "$APP"

if [ -n "$(git status --porcelain -- . )" ]; then
  echo "There are uncommitted changes in zeno-auction/. Commit them first so the published build matches the code on GitHub." >&2
  exit 1
fi
SRC="$(git rev-parse --short HEAD)"
PUSH_URL="${PUSH_URL:-$(git remote get-url "${REMOTE:-origin}")}"

echo "==> Building ZenoBid ($SRC)"
npm ci --no-audit --no-fund --loglevel=error
npm run build >/dev/null

OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
mkdir -p "$OUT/dist" "$OUT/deploy"
cp -r dist/web "$OUT/dist/web"
cp -r dist-server "$OUT/dist-server"
cp package.json package-lock.json "$OUT/"
mkdir "$OUT/deploy/google-cloud"
for f in setup.sh update.sh backup.sh preflight.sh uninstall.sh links.cjs GOOGLE-CLOUD.md; do cp "deploy/google-cloud/$f" "$OUT/deploy/google-cloud/$f"; done
printf '%s %s\n' "$SRC" "$(date -u +%F)" > "$OUT/VERSION"
printf 'node_modules/\n' > "$OUT/.gitignore"

cd "$OUT"
git init -q -b "$BRANCH"
git add -A
git -c user.name="ZenoBid build" -c user.email="build@users.noreply.github.com" commit -q -m "ZenoBid build from $SRC"
echo "==> Built: $(du -sh dist dist-server | tr '\n' ' ')  ($(git ls-files | wc -l) files)"

if [ "${DRY_RUN:-0}" = 1 ]; then echo "Dry run: nothing pushed."; exit 0; fi
echo "==> Publishing to branch '$BRANCH'"
git push --force --quiet "$PUSH_URL" "$BRANCH:refs/heads/$BRANCH"
echo "Published ZenoBid $SRC. The server picks it up within 10 minutes (or run: sudo zenobid-update)."
