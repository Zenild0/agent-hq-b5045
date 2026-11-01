#!/usr/bin/env bash
# Tests update.sh and backup.sh on a practice copy: a fake "GitHub" (local git repo), a fake app that
# can be made good or bad, and a fake systemctl. Needs no root and touches nothing outside a temp folder.
#   bash deploy/google-cloud/test/update-backup.test.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS="$(cd "$HERE/.." && pwd)"
T="$(mktemp -d)"
trap 'kill $(cat "$T/pid" 2>/dev/null) 2>/dev/null; rm -rf "$T"' EXIT
PORT=$((20000 + RANDOM % 20000))
pass=0; fail=0
check() { if [ "$2" = "0" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "  FAIL: $1"; fi; }
eq()    { [ "$2" = "$3" ]; check "$1 (got '$2', wanted '$3')" $?; }
has()   { grep -q -- "$3" <<<"$2"; check "$1 (looking for '$3' in: $(head -c 200 <<<"$2"))" $?; }

# ---- the practice "app": answers /healthz and /, unless the version is marked bad -----------------------
mkapp() { # $1=dir $2=label $3=good|bad
  mkdir -p "$1/dist-server"
  cat > "$1/dist-server/index.js" <<'JS'
const http = require('http'), fs = require('fs');
if (fs.existsSync('BAD')) { console.error('this version is broken'); process.exit(1); }
const live = () => Number(fs.existsSync(process.env.LIVE_FILE || '/nonexistent') ? fs.readFileSync(process.env.LIVE_FILE, 'utf8') : 0);
http.createServer((req, res) => {
  if (req.url === '/healthz') return res.end(JSON.stringify({ ok: true, auctions: 1, live: live(), version: fs.readFileSync('VERSION', 'utf8').trim() }));
  res.end('<html>ZenoBid</html>');
}).listen(Number(process.env.PORT), '127.0.0.1');
JS
  echo '{"name":"fake","version":"1.0.0","lockfileVersion":3,"requires":true,"packages":{}}' > "$1/package-lock.json"
  echo '{"name":"fake","version":"1.0.0"}' > "$1/package.json"
  mkdir -p "$1/deploy/google-cloud"; cp "$SCRIPTS/update.sh" "$SCRIPTS/backup.sh" "$1/deploy/google-cloud/"
  echo "$2" > "$1/VERSION"
  [ "$3" = bad ] && echo x > "$1/BAD" || rm -f "$1/BAD"
}

# ---- fake GitHub ----------------------------------------------------------------------------------------
ORIGIN="$T/origin.git"; WORK="$T/work"
git init -q --bare -b deploy-zenobid "$ORIGIN"
git init -q -b deploy-zenobid "$WORK"
git -C "$WORK" config user.email t@t; git -C "$WORK" config user.name t
publish() { # label good|bad [lockchange]
  mkapp "$WORK" "$1" "$2"; [ "${3:-}" = lock ] && echo "{\"name\":\"fake\",\"version\":\"1.0.0\",\"lockfileVersion\":3,\"requires\":true,\"packages\":{},\"x\":\"$1\"}" > "$WORK/package-lock.json"
  git -C "$WORK" add -A; git -C "$WORK" commit -q -m "$1" --allow-empty
  git -C "$WORK" push -q --force "$ORIGIN" deploy-zenobid 2>/dev/null
}
publish v1 good

# ---- the "server": app dir cloned from fake GitHub, fake systemctl, fake npm ------------------------------
APP="$T/opt-zenobid"; DATA="$T/data"; STATE="$T/state"; BIN="$T/bin"
mkdir -p "$DATA/events" "$BIN"
echo '{"hello":"auction"}' > "$DATA/events/ABC123.json"
git clone -q --depth 1 --single-branch --branch deploy-zenobid "file://$ORIGIN" "$APP"
cat > "$BIN/systemctl" <<SH
#!/usr/bin/env bash
# fake: "restart zenobid" stops the running fake app and starts the one in $APP
[ "\$1" = restart ] || exit 0
kill \$(cat "$T/pid" 2>/dev/null) 2>/dev/null; sleep 0.2
cd "$APP"
PORT=$PORT LIVE_FILE="$T/live" nohup node dist-server/index.js >> "$T/app.log" 2>&1 &
echo \$! > "$T/pid"
echo "restart" >> "$T/systemctl.calls"
SH
cat > "$BIN/npm" <<SH
#!/usr/bin/env bash
echo "npm \$*" >> "$T/npm.calls"
SH
chmod +x "$BIN/systemctl" "$BIN/npm"
export APP_DIR="$APP" STATE_DIR="$STATE" DATA_DIR="$DATA" PORT BRANCH=deploy-zenobid SYSTEMCTL="$BIN/systemctl" NPM="$BIN/npm" ENV_FILE="$T/none.env" WAIT_SECONDS=6
export BIN_DIR="$T/installed"; mkdir -p "$BIN_DIR"
"$BIN/systemctl" restart zenobid; sleep 1
healthy() { curl -fsS -m 2 "http://127.0.0.1:$PORT/healthz" 2>/dev/null; }
version() { healthy | sed -n 's/.*"version":"\([^"]*\)".*/\1/p'; }
update() { if [ -n "${DEBUG:-}" ]; then bash -x "$SCRIPTS/update.sh" 2>&1; else bash "$SCRIPTS/update.sh" 2>&1; fi; }

echo "== update.sh"
eq "starts on v1" "$(version)" "v1"

out=$(update); rc=$?
eq "nothing new: exits quietly" "$rc" "0"; eq "nothing new: prints nothing" "$out" ""

publish v2 good
out=$(update); rc=$?
eq "good update succeeds" "$rc" "0"; has "good update says ok" "$out" "update ok"
eq "app now runs v2" "$(version)" "v2"
eq "app files are at the new commit" "$(cat "$APP/VERSION")" "v2"
[ -f "$STATE/data-before-update.tgz" ]; check "a copy of the data was kept before updating" $?
tar -tzf "$STATE/data-before-update.tgz" | grep -q ABC123.json; check "…and it contains the auction file" $?
[ ! -f "$T/npm.calls" ]; check "npm is not run when libraries did not change" $?

publish v3 bad
out=$(update); rc=$?; [ -n "${DEBUG:-}" ] && { echo "--- bad update output:"; echo "$out"; cat "$T/app.log"; }
eq "bad update is reported as failure" "$rc" "1"; has "bad update says it rolled back" "$out" "rolling back"; has "…and that the old version is back" "$out" "rollback ok"
eq "app is back on v2 and healthy" "$(version)" "v2"
eq "files are back at v2" "$(cat "$APP/VERSION")" "v2"
[ -f "$STATE/bad-commit" ]; check "the bad version is remembered" $?

n1=$(wc -l < "$T/systemctl.calls")
out=$(update); rc=$?
eq "the same bad version is not retried" "$rc" "0"; eq "…no restart happened" "$(wc -l < "$T/systemctl.calls")" "$n1"

publish v4 good
out=$(update); rc=$?
eq "a newer good version after a bad one is installed" "$rc" "0"; eq "app runs v4" "$(version)" "v4"
[ ! -f "$STATE/bad-commit" ]; check "bad-commit memory is cleared" $?

# a live auction blocks the update
echo 1 > "$T/live"
publish v5 good
out=$(update); rc=$?
eq "a live auction defers the update" "$rc" "0"; has "…and says so" "$out" "auction is live"
eq "…app still on v4" "$(version)" "v4"
echo 0 > "$T/live"
out=$(update); eq "update goes ahead when the auction is over" "$(version)" "v5"

# libraries changed -> npm ci runs; a failing npm rolls back
publish v6 good lock
out=$(update); eq "libraries changed: update ok" "$(version)" "v6"
has "npm ci was run for the new libraries" "$(cat "$T/npm.calls")" "ci --omit=dev"
: > "$T/npm.calls"
publish v7 good lock
cat > "$BIN/npm" <<SH
#!/usr/bin/env bash
echo "npm \$*" >> "$T/npm.calls"
[ -f "$T/npm-fails" ] && exit 1 || exit 0
SH
touch "$T/npm-fails"
out=$(update); rc=$?
eq "a failed library install rolls back" "$rc" "1"; eq "…app stays on v6" "$(version)" "v6"
rm -f "$T/npm-fails" "$STATE/bad-commit"

# GitHub unreachable
mv "$ORIGIN" "$ORIGIN.gone"
out=$(update); rc=$?
eq "GitHub unreachable: not an error" "$rc" "0"; has "…says it will retry" "$out" "will try again later"
eq "…app untouched" "$(version)" "v6"
mv "$ORIGIN.gone" "$ORIGIN"

# two runs at once: the second backs off
( flock -n 8 || exit; sleep 3 ) 8>"$STATE/lock" &
sleep 0.3
publish v8 good
out=$(update)
eq "a run while another is in progress does nothing" "$out" ""; eq "…app still v6" "$(version)" "v6"
wait
out=$(update); eq "afterwards the update goes through" "$(version)" "v8"

# the installed copies of the scripts are refreshed after an update
for f in update backup; do [ -x "$BIN_DIR/zenobid-$f" ]; check "zenobid-$f refreshed in the bin folder after update" $?; done

echo "== backup.sh"
export BACKUP_DIR="$T/backups"
out=$(bash "$SCRIPTS/backup.sh" 2>&1); rc=$?
eq "backup succeeds" "$rc" "0"
f=$(ls "$BACKUP_DIR"/zenobid-*.tgz 2>/dev/null | head -1)
[ -n "$f" ] && tar -tzf "$f" | grep -q events/ABC123.json; check "backup contains the auction file" $?
eq "backups folder is private (700)" "$(stat -c %a "$BACKUP_DIR")" "700"
eq "backup file is private (600)" "$(stat -c %a "$f")" "600"
# pruning: old files go, recent ones stay
touch -d '10 days ago' "$BACKUP_DIR/zenobid-old.tgz"; touch -d '6 days ago' "$BACKUP_DIR/zenobid-recent.tgz"
bash "$SCRIPTS/backup.sh" >/dev/null 2>&1
[ ! -e "$BACKUP_DIR/zenobid-old.tgz" ]; check "a 10-day-old backup is deleted" $?
[ -e "$BACKUP_DIR/zenobid-recent.tgz" ]; check "a 6-day-old backup is kept" $?
# restoring from a backup gives the data back
R="$T/restore"; mkdir "$R"; tar -xzf "$f" -C "$R"; eq "a backup restores the file" "$(cat "$R/events/ABC123.json")" '{"hello":"auction"}'
DATA_DIR="$T/nope" bash "$SCRIPTS/backup.sh" >/dev/null 2>&1; eq "no data folder yet: backup is a no-op, not an error" "$?" "0"

echo
echo "update/backup tests: $pass passed, $fail failed"
[ "$fail" = 0 ]
