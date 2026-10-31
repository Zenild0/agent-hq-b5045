// Reproduces: many tabs open in ONE browser (as a person testing several captain accounts would),
// then bidding from the last tab.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8787';
const TABS = Number(process.argv[2] || 10);
(async () => {
  const created = await (await fetch(BASE + '/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings: { drawMode: 'manual' } }) })).json();
  const { code, adminKey, hostKey } = created;
  const cmd = (k, a, p = {}) => fetch(`${BASE}/api/events/${code}/cmd`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-key': k }, body: JSON.stringify({ action: a, params: p }) }).then(r => r.json());
  await cmd(adminKey, 'demo.load');
  const st = await (await fetch(`${BASE}/api/events/${code}/state?key=${adminKey}`)).json();
  const tokens = st.captains.map(c => st.secrets.captainTokens[c.id]);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });   // ONE context = one connection pool
  const pages = [];
  for (let i = 0; i < TABS; i++) { const p = await ctx.newPage(); await p.goto(`${BASE}/e/${code}/captain?k=${tokens[i % 4]}`, { waitUntil: 'domcontentloaded' }); pages.push(p); }
  await new Promise(r => setTimeout(r, 1500));
  await cmd(hostKey, 'pick', { playerId: st.players[0].id });
  const last = pages[pages.length - 1];
  const t0 = Date.now();
  let outcome;
  try {
    await last.waitForSelector('button:has-text("BID")', { timeout: 6000 });
    await last.click('button:has-text("BID")', { timeout: 3000 });
    await last.waitForFunction(() => /You hold the top bid/.test(document.body.innerText), null, { timeout: 8000 });
    outcome = `OK — bid landed in ${Date.now() - t0} ms`;
  } catch (e) { outcome = 'FAILED — ' + e.message.split('\n')[0]; }
  console.log(`${TABS} tabs:`, outcome);
  await b.close();
})();
