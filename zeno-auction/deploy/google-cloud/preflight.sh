#!/usr/bin/env bash
# Looks at the server and says whether it is safe to install ZenoBid. It only READS: it changes nothing.
#   bash preflight.sh
set -u
PORT="${PORT:-3001}"
NAME="${NAME:-zenobid}"
bad=0; warn=0
say()  { printf '%s\n' "$*"; }
ok()   { say "  ✓ $*"; }
note() { say "  ! $*"; warn=$((warn + 1)); }
fail() { say "  ✗ $*"; bad=$((bad + 1)); }
listening() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

say "== Memory (RAM) and swap"
read -r _ total used free _ _ avail < <(free -m | awk '/^Mem:/ {print}')
swap_total=$(free -m | awk '/^Swap:/ {print $2}')
say "     RAM: ${total:-?} MB total, ${avail:-?} MB available. Swap: ${swap_total:-0} MB."
if [ "${avail:-0}" -ge 250 ]; then ok "enough free memory (ZenoBid needs about 100 MB)"; else note "less than 250 MB of memory is free — ZenoBid is light, but check what else is running (top)"; fi
if [ "${swap_total:-0}" -ge 512 ]; then ok "swap is already set up, it will be reused"; else note "no swap found — the installer will add 1 GB of swap (a safety cushion for a 1 GB server)"; fi

say "== Disk"
free_mb=$(df -Pm / | awk 'NR==2 {print $4}')
say "     ${free_mb} MB free on the main disk."
if [ "${free_mb:-0}" -ge 1500 ]; then ok "plenty of disk space"; elif [ "${free_mb:-0}" -ge 800 ]; then note "disk is getting full; ZenoBid itself needs under 100 MB"; else fail "less than 800 MB of disk is free — free some space first"; fi

say "== Your other app (the choir app) — we only LOOK, we never touch it"
if systemctl is-active --quiet choir 2>/dev/null; then ok "the choir service is running (it will be left alone)"; else say "     (the choir service is not running here — that is fine if this is a different server)"; fi
if listening 3000; then ok "port 3000 is in use by the choir app — ZenoBid will NOT use it"; fi

say "== ${NAME}'s door (port $PORT)"
if systemctl is-active --quiet "$NAME" 2>/dev/null; then ok "$NAME is already installed and running (re-running setup is safe)"
elif listening "$PORT"; then fail "port $PORT is already used by something else — pick another with: sudo PORT=3004 bash setup.sh"
else ok "port $PORT is free"; fi

say "== Software"
if command -v node >/dev/null; then
  major=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$major" -ge 20 ]; then ok "Node.js $(node -v) is installed"; else note "Node.js $(node -v) is too old — the installer will install Node 22"; fi
else note "Node.js is not installed — the installer will add it"; fi
command -v git >/dev/null && ok "git is installed" || note "git is not installed — the installer will add it"

say
if [ "$bad" -gt 0 ]; then say "RESULT: stop — fix the ✗ items above first."; exit 1; fi
if [ "$warn" -gt 0 ]; then say "RESULT: OK to install (the ! items are only notes)."; else say "RESULT: all good — OK to install."; fi
