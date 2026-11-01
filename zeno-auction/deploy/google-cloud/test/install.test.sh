#!/usr/bin/env bash
# End-to-end rehearsal of the install, with no root and no systemd: publish.sh builds the app into a
# practice "GitHub", setup.sh installs from it (test mode: no apt / users / systemctl), and we start the
# app the way the service would and use it. Takes about a minute (it really builds and installs libraries).
#   bash deploy/google-cloud/test/install.test.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
GC="$(cd "$HERE/.." && pwd)"
APP_SRC="$(cd "$GC/../.." && pwd)"
T="$(mktemp -d)"
trap 'kill $(cat "$T/pid" "$T/pid2" 2>/dev/null) 2>/dev/null; rm -rf "$T"' EXIT
PORT=$((20000 + RANDOM % 20000))
pass=0; fail=0
check() { if [ "$2" = "0" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "  FAIL: $1"; fi; }
eq()    { [ "$2" = "$3" ]; check "$1 (got '$2', wanted '$3')" $?; }
has()   { grep -q -- "$3" <<<"$2"; check "$1 (looking for '$3' in: $(head -c 300 <<<"$2"))" $?; }

echo "== publish.sh (builds the app and publishes the ready-to-run branch)"
git init -q --bare -b deploy-zenobid "$T/origin.git"
out=$(PUSH_URL="$T/origin.git" bash "$APP_SRC/deploy/publish.sh" 2>&1); rc=$?
eq "publish succeeds" "$rc" "0"
[ "$rc" != 0 ] && echo "$out" | tail -15
files=$(git -C "$T/origin.git" ls-tree -r --name-only deploy-zenobid)
has "the branch holds the built web app" "$files" "dist/web/index.html"
has "…the server bundle" "$files" "dist-server/index.js"
has "…the install scripts" "$files" "deploy/google-cloud/setup.sh"
has "…a version file" "$files" "^VERSION$"
! grep -qE '^(server|web|shared|qa)/' <<<"$files"; check "…and no source code" $?
! grep -qE 'node_modules|\.env|data/' <<<"$files"; check "…and no libraries, settings or data" $?
eq "the branch has exactly one commit (no history piles up)" "$(git -C "$T/origin.git" rev-list --count deploy-zenobid)" "1"

echo "== setup.sh (test mode)"
export ZB_SKIP_SYSTEM=1 REPO="file://$T/origin.git" BRANCH=deploy-zenobid PORT
export APP_DIR="$T/opt/zenobid" DATA_DIR="$T/var/zenobid" ENV_FILE="$T/etc/zenobid.env" BRANCH_FILE="$T/etc/zenobid-branch"
export UNIT_DIR="$T/units" BIN_DIR="$T/bin" STATE_DIR="$T/var/zenobid-update" PUBLIC_HOST=auction.example.org
mkdir -p "$T/etc"
out=$(bash "$GC/setup.sh" 2>&1); rc=$?
eq "setup succeeds" "$rc" "0"; [ "$rc" != 0 ] && echo "$out" | tail -15
env=$(cat "$ENV_FILE")
has "settings: own port" "$env" "^PORT=$PORT$"
has "settings: only reachable from this machine" "$env" "^HOST=127.0.0.1$"
has "settings: behind the tunnel" "$env" "^TRUST_PROXY=true$"
has "settings: own data folder" "$env" "^DATA_DIR=$DATA_DIR$"
has "settings: public address" "$env" "^PUBLIC_URL=https://auction.example.org$"
! grep -qiE 'pin|password|token|secret=|key=' <<<"$(grep -v '^#' "$ENV_FILE")"; check "settings hold no secrets" $?
eq "settings file is private (600)" "$(stat -c %a "$ENV_FILE")" "600"
for f in zenobid.service zenobid-update.service zenobid-update.timer zenobid-backup.service zenobid-backup.timer; do [ -f "$UNIT_DIR/$f" ]; check "unit $f written" $?; done
svc=$(cat "$UNIT_DIR/zenobid.service")
has "service: own user" "$svc" "^User=zenobid$"; has "service: memory cap" "$svc" "^MemoryMax=300M$"
has "service: dies before the choir app does" "$svc" "^OOMScoreAdjust=300$"; has "service: only writes to its own data" "$svc" "^ReadWritePaths=$DATA_DIR$"
has "service: reads its settings file" "$svc" "^EnvironmentFile=$ENV_FILE$"
has "update timer every 10 minutes" "$(cat "$UNIT_DIR/zenobid-update.timer")" "OnUnitActiveSec=10min"
has "backup timer at night" "$(cat "$UNIT_DIR/zenobid-backup.timer")" "OnCalendar=.*03:10"
grep -rqE '/opt/choir|/var/lib/choir|choir\.env|choir\.service|choir-update|:3000|=3000' "$UNIT_DIR" "$ENV_FILE" "$BIN_DIR"; [ $? -ne 0 ]; check "nothing generated uses the choir app's folders, files, services or port" $?
for f in zenobid-update zenobid-backup zenobid-links zenobid-remove; do [ -x "$BIN_DIR/$f" ]; check "command $f installed" $?; done
[ -d "$APP_DIR/node_modules/express" ] && [ ! -d "$APP_DIR/node_modules/vite" ]; check "libraries installed: express yes, build tools no" $?
size=$(du -sm "$APP_DIR/node_modules" | cut -f1); [ "$size" -lt 30 ]; check "libraries are small (${size} MB)" $?
eq "branch remembered" "$(cat "$BRANCH_FILE")" "deploy-zenobid"

echo "customised" >> "$ENV_FILE"
out=$(bash "$GC/setup.sh" 2>&1); rc=$?
eq "running setup again is fine" "$rc" "0"; has "…and keeps the settings file" "$(cat "$ENV_FILE")" "^customised$"
PORT=3000 bash "$GC/setup.sh" >/dev/null 2>&1; eq "setup refuses the choir app's port 3000" "$?" "1"
mkdir -p "$T/occupied"; echo x > "$T/occupied/file"
APP_DIR="$T/occupied" bash "$GC/setup.sh" >/dev/null 2>&1; eq "setup will not overwrite a folder that is not a ZenoBid install" "$?" "1"
eq "…and left it alone" "$(cat "$T/occupied/file")" "x"
PUBLIC_HOST='bad host;rm -rf /' ENV_FILE="$T/etc/other.env" APP_DIR="$T/opt/other" bash "$GC/setup.sh" >/dev/null 2>&1; eq "setup rejects a strange web address" "$?" "1"

echo "== the installed app, started the way the service starts it"
cd "$APP_DIR"
( set -a; . "$ENV_FILE" 2>/dev/null; set +a; NODE_OPTIONS=--max-old-space-size=192 exec nohup node dist-server/index.js ) >"$T/app.log" 2>&1 &
echo $! > "$T/pid"
for _ in $(seq 1 30); do curl -fsS -m 1 "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 0.5; done
h=$(curl -fsS "http://127.0.0.1:$PORT/healthz"); has "healthz answers" "$h" '"ok":true'; has "…with the build's version" "$h" "\"version\":\"$(cut -d' ' -f1 "$APP_DIR/VERSION")"
has "the web page is served" "$(curl -fsS "http://127.0.0.1:$PORT/")" "<div id=\"root\""
(exec 3<>/dev/tcp/127.0.0.1/$PORT) 2>/dev/null; check "listens on the local port" $?
# it must not be reachable on another address of this machine
other=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -n "$other" ] && [ "$other" != 127.0.0.1 ]; then ! curl -fsS -m 2 "http://$other:$PORT/healthz" >/dev/null 2>&1; check "NOT reachable from the network side (only via the tunnel)" $?; fi
c=$(curl -fsS -X POST -H 'content-type: application/json' -d '{"settings":{"name":"Rehearsal Cup"}}' "http://127.0.0.1:$PORT/api/events")
code=$(sed -n 's/.*"code":"\([^"]*\)".*/\1/p' <<<"$c"); akey=$(sed -n 's/.*"adminKey":"\([^"]*\)".*/\1/p' <<<"$c")
sleep 0.5
[ -f "$DATA_DIR/events/$code.json" ]; check "an auction is saved in the data folder" $?
links=$(DATA_DIR="$DATA_DIR" ENV_FILE="$ENV_FILE" "$BIN_DIR/zenobid-links")
has "zenobid-links shows the admin link" "$links" "https://auction.example.org/e/$code/admin?k=$akey"
has "…and the big-screen link" "$links" "/e/$code/live"
out=$(BACKUP_DIR="$T/backups" ENV_FILE="$ENV_FILE" "$BIN_DIR/zenobid-backup" 2>&1); eq "backup of the real data works" "$?" "0"
tar -tzf "$T/backups"/zenobid-*.tgz | grep -q "events/$code.json"; check "the backup contains the auction" $?
# restore the way the guide says: stop, unpack, start
curl -fsS -X DELETE -H "x-key: $akey" "http://127.0.0.1:$PORT/api/events/$code" >/dev/null; sleep 0.3
[ ! -f "$DATA_DIR/events/$code.json" ]; check "deleting the auction removes its file" $?
kill "$(cat "$T/pid")"; sleep 1
tar -xzf "$T/backups"/zenobid-*.tgz -C "$DATA_DIR"
( set -a; . "$ENV_FILE" 2>/dev/null; set +a; exec nohup node dist-server/index.js ) >"$T/app2.log" 2>&1 &
echo $! > "$T/pid"
for _ in $(seq 1 30); do curl -fsS -m 1 "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 0.5; done
eq "after restoring the backup the auction is back" "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/events/$code/exists")" "200"
rss=$(awk '/VmRSS/ {print int($2/1024)}' /proc/$(cat "$T/pid")/status 2>/dev/null); [ "${rss:-999}" -lt 150 ]; check "memory use is small (${rss:-?} MB resident)" $?


echo "== a separate TEST copy next to the real one"
before=$(cat "$ENV_FILE" "$UNIT_DIR/zenobid.service" | sha256sum)
git -C "$T/origin.git" branch staging-zenobid deploy-zenobid
TP=$((PORT + 1))
tcopy() { env NAME=zenobid-test PORT=$TP BRANCH=staging-zenobid APP_DIR="$T/opt/zenobid-test" DATA_DIR="$T/var/zenobid-test" ENV_FILE="$T/etc/zenobid-test.env" BRANCH_FILE="$T/etc/zenobid-test-branch" STATE_DIR="$T/var/zenobid-test-update" PUBLIC_HOST=test.example.org "$@"; }
tcopy bash "$GC/setup.sh" >"$T/test-setup.log" 2>&1; eq "the test copy installs" "$?" "0"
tenv=$(cat "$T/etc/zenobid-test.env")
has "test copy: its own port" "$tenv" "^PORT=$TP$"; has "test copy: marked as a test" "$tenv" "^APP_ENV=test$"
has "test copy: its own data folder" "$tenv" "^DATA_DIR=$T/var/zenobid-test$"; has "test copy: short auto-delete" "$tenv" "^AUTO_DELETE_DAYS=7$"
has "test copy: its own address" "$tenv" "^PUBLIC_URL=https://test.example.org$"
for f in zenobid-test.service zenobid-test-update.timer zenobid-test-backup.timer; do [ -f "$UNIT_DIR/$f" ]; check "test copy: unit $f" $?; done
tsvc=$(cat "$UNIT_DIR/zenobid-test.service"); has "test copy: its own user" "$tsvc" "^User=zenobid-test$"; has "test copy: smaller memory cap" "$tsvc" "^MemoryMax=200M$"; has "test copy: only writes its own data" "$tsvc" "^ReadWritePaths=$T/var/zenobid-test$"
has "test copy: updates follow the test branch only" "$(cat "$T/etc/zenobid-test-branch")" "staging-zenobid"
has "test copy: update timer runs ITS update command" "$(cat "$UNIT_DIR/zenobid-test-update.service")" "zenobid-test-update"
for f in zenobid-test-update zenobid-test-backup zenobid-test-links zenobid-test-remove; do [ -x "$BIN_DIR/$f" ]; check "test copy: command $f" $?; done
after=$(cat "$ENV_FILE" "$UNIT_DIR/zenobid.service" | sha256sum); eq "the REAL copy's settings and service were not touched" "$before" "$after"
tcopy env BRANCH= bash "$GC/setup.sh" >/dev/null 2>&1; eq "a test copy without its own branch is refused" "$?" "1"
NAME=zenobid-test BRANCH=deploy-zenobid ENV_FILE="$T/etc/x.env" bash "$GC/setup.sh" >/dev/null 2>&1; eq "a test copy may not follow the real branch" "$?" "1"
NAME=choir-copy BRANCH=staging-zenobid ENV_FILE="$T/etc/y.env" bash "$GC/setup.sh" >/dev/null 2>&1; eq "a name containing 'choir' is refused" "$?" "1"
NAME='Bad Name' BRANCH=staging-zenobid ENV_FILE="$T/etc/z.env" bash "$GC/setup.sh" >/dev/null 2>&1; eq "a strange name is refused" "$?" "1"
( cd "$T/opt/zenobid-test"; set -a; . "$T/etc/zenobid-test.env" 2>/dev/null; set +a; exec nohup node dist-server/index.js ) >"$T/test-app.log" 2>&1 &
echo $! > "$T/pid2"
for _ in $(seq 1 30); do curl -fsS -m 1 "http://127.0.0.1:$TP/healthz" >/dev/null 2>&1 && break; sleep 0.5; done
has "test copy answers and says it is a test" "$(curl -fsS "http://127.0.0.1:$TP/healthz")" '"env":"test"'
has "the real copy says it is production" "$(curl -fsS "http://127.0.0.1:$PORT/healthz")" '"env":"production"'
has "the page tells everyone it is a test" "$(curl -fsS "http://127.0.0.1:$TP/api/platform")" '"env":"test"'
real_before=$(ls "$DATA_DIR/events" | wc -l)
curl -fsS -X POST -H 'content-type: application/json' -d '{"settings":{"name":"Only in test"}}' "http://127.0.0.1:$TP/api/events" >/dev/null; sleep 0.5
eq "an auction made in the test copy is not on the real one" "$(ls "$DATA_DIR/events" | wc -l)" "$real_before"
[ "$(ls "$T/var/zenobid-test/events" | wc -l)" = 1 ]; check "…it is saved in the test copy's own folder" $?
kill "$(cat "$T/pid2")" 2>/dev/null
bash -n "$GC/uninstall.sh"; check "the remove command is valid" $?
NAME=choir bash "$GC/uninstall.sh" >/dev/null 2>&1; eq "the remove command refuses the choir app's name" "$?" "1"
echo
echo "install rehearsal: $pass passed, $fail failed"
[ "$fail" = 0 ]
