#!/usr/bin/env node
// Lists every auction on this server with its links — handy if you lost the admin link.
//   sudo zenobid-links
// (The links contain secret keys: don't paste them into chats or put them on GitHub.)
const fs = require('node:fs');
const path = require('node:path');

function envFile(file) {
  const out = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2];
    }
  } catch { /* no env file: defaults */ }
  return out;
}
const env = { ...envFile(process.env.ENV_FILE || '/etc/zenobid.env'), ...process.env };
const dataDir = env.DATA_DIR || '/var/lib/zenobid';
const base = (env.PUBLIC_URL || 'http://localhost:' + (env.PORT || 3001)).replace(/\/$/, '');
const eventsDir = path.join(dataDir, 'events');

let files = [];
try { files = fs.readdirSync(eventsDir).filter((f) => f.endsWith('.json')); } catch { /* none */ }
if (!files.length) { console.log('No auctions on this server yet.'); process.exit(0); }

const rows = [];
for (const f of files) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(eventsDir, f), 'utf8'));
    rows.push(s);
  } catch (e) { console.log(`(could not read ${f}: ${e.message})`); }
}
rows.sort((a, b) => b.data.createdAt - a.data.createdAt);
for (const s of rows) {
  const d = s.data, code = d.code;
  const sold = d.players.filter((p) => p.status === 'sold').length;
  console.log(`\n== ${d.settings.name}  [${code}]  created ${new Date(d.createdAt).toISOString().slice(0, 10)} · ${d.captains.length} teams · ${sold}/${d.players.length} players sold`);
  console.log(`   Admin       ${base}/e/${code}/admin?k=${s.secrets.adminKey}`);
  console.log(`   Auctioneer  ${base}/e/${code}/host?k=${s.secrets.hostKey}`);
  console.log(`   Big screen  ${base}/e/${code}/live`);
  for (const c of d.captains) console.log(`   Captain ${c.team.padEnd(14).slice(0, 14)} ${base}/e/${code}/captain?k=${s.secrets.captainTokens[c.id]}   (PIN ${s.secrets.captainTokens[c.id]})`);
}
console.log('');
