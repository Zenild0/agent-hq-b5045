const L = require('./lib.cjs'); const { chromium, BASE, sleep, t, api, newPage, done } = L;
const errors = [];
(async () => {
  const b = await chromium.launch();
  const c = await api.create({}); await api.cmd(c.code, c.adminKey, 'demo.load');
  const st = await api.state(c.code, c.adminKey); const tok = st.captains.map(x => st.secrets.captainTokens[x.id]);
  // a mistyped PIN (not throttled) shows the PIN screen
  const p = await newPage(b, 390, 844, errors, 'wrongpin');
  await p.goto(`${BASE}/e/${c.code}/captain?k=WRONG1`); await p.waitForSelector('text=CAPTAIN LOGIN', { timeout: 6000 }); t('a wrong PIN shows the PIN screen', true);
  // hammer wrong keys until this connection is throttled
  let limited = false;
  for (let i = 0; i < 140 && !limited; i++) limited = (await fetch(`${BASE}/api/events/${c.code}/state?key=BAD${i}`)).status === 429;
  t('hammering wrong keys gets throttled', limited);
  // while throttled: a wrong-PIN page says so (no endless spinner), a valid captain still gets in
  await p.goto(`${BASE}/e/${c.code}/captain?k=WRONG2`);
  await p.waitForSelector('text=Too many wrong keys', { timeout: 6000 }); t('throttled wrong-PIN page explains what happened', true);
  const ok = await newPage(b, 390, 844, errors, 'valid'); await ok.goto(`${BASE}/e/${c.code}/captain?k=${tok[0]}`);
  await ok.waitForSelector('text=Squad', { timeout: 6000 }); t('a valid captain is never locked out', true);
  // the throttled page recovers by itself once the minute is up
  await p.waitForSelector('text=CAPTAIN LOGIN', { timeout: 75000 }); t('the throttled page recovers on its own after ~1 minute', true);
  await b.close(); done('Throttle UX', errors);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
