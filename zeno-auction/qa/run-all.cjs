// Runs every QA script in order against a running server (default http://localhost:8787).
//   BASE=http://localhost:8787 node qa/run-all.cjs
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const suites = [
  ['API: validation, auth, secrets, uploads, traversal, WebSocket, races, throttle', 'qa-api.cjs'],
  ['Throttle UX: a throttled person sees a message and recovers; valid keys unaffected', 'qa-throttle.cjs'],
  ['UI: every page × 5 screen sizes, hostile text, 500 players / 32 teams', 'qa-ui1.cjs'],
  ['UI flows: create / teams / players / settings', 'qa-ui2.cjs'],
  ['UI flows: auctioneer / captain / big screen', 'qa-ui3.cjs'],
  ['Resilience: server restart, blocked WebSockets, outage', 'qa-resilience.cjs'],
  ['Late joiners: mid-spin and mid-break', 'qa-late.cjs'],
];
let failed = 0;
for (const [title, file] of suites) {
  console.log(`\n━━ ${title}`);
  const r = spawnSync('node', [path.join(__dirname, file)], { stdio: 'inherit', env: process.env, timeout: 600_000 });
  if (r.status !== 0) failed++;
}
for (const n of [8, 20, 30]) {
  const r = spawnSync('node', [path.join(__dirname, 'qa-multitab.cjs'), String(n)], { stdio: 'inherit', env: process.env, timeout: 120_000 });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n✗ ${failed} suite(s) failed` : '\n✓ all QA suites passed');
process.exit(failed ? 1 : 0);
