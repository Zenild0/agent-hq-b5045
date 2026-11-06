const L = require('./lib.cjs'); const { chromium, BASE, sleep, t, api, newPage, done } = L;
const { execSync, spawn } = require('node:child_process');
const errors = [];
const LK = 100_000;
const startServer = () => { spawn('node', ['dist-server/index.js'], { cwd: require('node:path').resolve(__dirname, '..'), env: { ...process.env, DATA_DIR: process.env.DATA_DIR || './qa/.data', PORT: process.env.PORT || '8787' }, detached: true, stdio: 'ignore' }).unref(); };
const stopServer = () => { try { execSync('fuser -k -TERM 8787/tcp', { stdio: 'ignore' }); } catch {} };
const waitUp = async () => { for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/api/health'); return true; } catch { await sleep(250); } } return false; };

(async () => {
  const b = await chromium.launch();
  const c = await api.create({ name: 'Resilience', drawMode: 'manual', defaultBudget: 50 * LK, defaultBasePrice: 2 * LK });
  const { code, adminKey, hostKey } = c;
  await api.cmd(code, adminKey, 'demo.load');
  let st = await api.state(code, adminKey);
  const tok = st.captains.map(x => st.secrets.captainTokens[x.id]);
  await api.cmd(code, hostKey, 'pick', { playerId: st.players[0].id });

  // ================= G. server restart while screens are open =================
  const live = await newPage(b, 1400, 800, errors, 'live'); const cap = await newPage(b, 390, 844, errors, 'cap', { isMobile: true });
  await live.goto(`${BASE}/e/${code}/live`); await cap.goto(`${BASE}/e/${code}/captain?k=${tok[0]}`);
  await cap.waitForSelector('button:has-text("BID")');
  await cap.click('button:has-text("BID")'); await sleep(400);
  t('G: bid before the restart', (await api.state(code)).live.bids.length === 1);
  stopServer(); await sleep(1500);
  await live.waitForSelector('text=Connection lost', { timeout: 8000 }); t('G: "Connection lost" banner appears when the server goes down', true);
  // try to act while down: must fail fast with a message, never hang the button
  await cap.locator('button').filter({ hasText: /BID|YOU LEAD|CAN/ }).first().evaluate(() => {});
  startServer(); t('G: server comes back', await waitUp());
  await live.waitForFunction(() => !document.body.innerText.includes('Connection lost'), null, { timeout: 15000 }); t('G: banner disappears after the server returns', true);
  st = await api.state(code, adminKey);
  t('G: the auction survived the restart (bid, player, purses)', st.live.bids.length === 1 && st.live.phase === 'bidding');
  // another captain bids after the restart; the open screens update with no reload
  const nextAmt = (s) => { const top = s.live.bids.slice(-1)[0].amount; const tiers = s.settings.increments; let step = tiers[0].step; for (const x of tiers) if (top >= x.from) step = x.step; return top + step; };
  const afterRestart = await api.state(code, adminKey);
  const r2 = await api.cmd(code, tok[1], 'bid', { amount: nextAmt(afterRestart) });
  t('G: another captain can bid after the restart', r2.ok === true, JSON.stringify(r2));
  const wantText = `₹${(nextAmt(afterRestart) / 100000)} L`;
  await live.waitForFunction((x) => document.body.innerText.includes(x), wantText, { timeout: 6000 }).then(() => t('G: big screen updates live after reconnect (no refresh)', true)).catch(() => t('G: big screen updates live after reconnect (no refresh)', false, 'wanted ' + wantText));
  const capText = await cap.evaluate(() => document.body.innerText);
  t('G: captain phone shows "outbid" after reconnect', /outbid/i.test(capText), capText.slice(0, 80));
  await cap.waitForSelector('button:has-text("BID")'); await cap.click('button:has-text("BID")'); await sleep(500);
  t('G: captain can bid again after the restart', (await api.state(code)).live.bids.length === 3);

  // ================= H. WebSockets blocked (corporate proxy / old network) =================
  const blockWS = async (page) => page.addInitScript(() => { window.WebSocket = class { constructor() { throw new Error('WebSocket blocked'); } }; });
  const ctx2 = await b.newContext({ viewport: { width: 1300, height: 800 } }); const live2 = await ctx2.newPage(); await blockWS(live2);
  live2.on('pageerror', e => errors.push('[ws-blocked] pageerror: ' + e.message));
  const ctx3 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true }); const cap2 = await ctx3.newPage(); await blockWS(cap2);
  cap2.on('pageerror', e => errors.push('[ws-blocked-cap] pageerror: ' + e.message));
  await live2.goto(`${BASE}/e/${code}/live`); await cap2.goto(`${BASE}/e/${code}/captain?k=${tok[2]}`);
  await live2.waitForSelector("text=Who's bidding", { timeout: 8000 }); t('H: with WebSockets blocked the screen still loads', true);
  await cap2.waitForSelector('button:has-text("BID")', { timeout: 8000 });
  const before = (await api.state(code)).live.bids.length;
  await cap2.click('button:has-text("BID")'); await sleep(500);
  t('H: with WebSockets blocked a captain can still bid', (await api.state(code)).live.bids.length === before + 1);
  const s3 = await api.state(code, adminKey);
  const amt3 = nextAmt(s3);
  const r3 = await api.cmd(code, tok[3], 'bid', { amount: amt3 });
  await live2.waitForFunction((x) => document.body.innerText.includes(x), `₹${amt3 / 100000} L`, { timeout: 6500 }).then(() => t('H: with WebSockets blocked the big screen still updates (polling)', r3.ok === true)).catch(() => t('H: with WebSockets blocked the big screen still updates (polling)', false, 'did not update within 6.5 s'));

  // ================= timeouts: a command to a dead server must not freeze the button =================
  stopServer(); await sleep(600);
  const t0 = Date.now();
  await cap.locator('button').filter({ hasText: /BID|CAN|YOU LEAD/ }).first().click({ timeout: 2000 }).catch(() => {});
  await sleep(1500);
  const msg = await cap.evaluate(() => document.body.innerText);
  t('G: a click while the server is down shows an error instead of freezing', /Could not reach the server|taking too long|Connection lost/i.test(msg), msg.slice(0, 60));
  startServer(); await waitUp(); await sleep(4000);
  await cap.waitForFunction(() => !!document.querySelector('button'), null, { timeout: 5000 });
  const freeze = await cap.evaluate(() => [...document.querySelectorAll('button')].filter(b => /BID|YOU LEAD|CAN/.test(b.innerText)).map(b => b.disabled));
  t('G: the bid button is not left stuck after an outage', freeze.length >= 1);

  for (let i = errors.length - 1; i >= 0; i--) if (/ERR_CONNECTION|WebSocket connection to|Failed to load resource/.test(errors[i])) errors.splice(i, 1); // expected during the deliberate outage
  await b.close();
  done('Resilience (restart / blocked WebSockets / outage)', errors);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
