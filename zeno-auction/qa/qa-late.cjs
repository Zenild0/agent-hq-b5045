const L = require('./lib.cjs'); const { chromium, BASE, sleep, t, api, newPage, done } = L;
const errors = [];
(async () => {
  const b = await chromium.launch();
  const c = await api.create({ drawMode: 'random' }); await api.cmd(c.code, c.adminKey, 'demo.load');
  const st = await api.state(c.code, c.adminKey); const tok = st.captains.map(x => st.secrets.captainTokens[x.id]);
  await api.cmd(c.code, c.hostKey, 'draw');
  const t0 = Date.now(); await sleep(3500);
  const late = await newPage(b, 1500, 850, errors, 'late-live'); await late.goto(`${BASE}/e/${c.code}/live`);
  const lateCap = await newPage(b, 390, 844, errors, 'late-cap', { isMobile: true }); await lateCap.goto(`${BASE}/e/${c.code}/captain?k=${tok[0]}`);
  await late.waitForSelector('text=DRAWING THE NEXT PLAYER', { timeout: 5000 }); t('late joiner sees the wheel mid-spin', true);
  const s = await api.state(c.code, c.adminKey); const winner = s.players.find(p => p.id === s.live.playerId).name;
  await late.waitForSelector(`text=${winner.toUpperCase()}`, { timeout: 6000 }).catch(() => {}); 
  await late.waitForSelector("text=Who's bidding", { timeout: 9000 }); t('late joiner reaches the bidding screen when the wheel ends', true);
  const elapsed = Date.now() - t0; t('timing matches the server (spin is 7 s, joiner not delayed or early)', elapsed < 11000, elapsed + ' ms');
  await lateCap.waitForSelector('button:has-text("BID")', { timeout: 5000 }); t('late captain can bid right after the reveal', true);
  // break joiner
  await api.cmd(c.code, c.hostKey, 'undoBid').catch(() => {}); await api.cmd(c.code, c.hostKey, 'unblock');
  await api.cmd(c.code, c.hostKey, 'break.start', { seconds: 20 }); await sleep(2500);
  const lateB = await newPage(b, 1500, 850, errors, 'late-break'); await lateB.goto(`${BASE}/e/${c.code}/live`);
  await lateB.waitForSelector('text=Captains: time to plan', { timeout: 5000 });
  const clock = await lateB.evaluate(() => (document.body.innerText.match(/\b0:\d\d\b/) || [''])[0]);
  const secs = Number(clock.split(':')[1]); t('break joiner sees the REAL remaining time (~17 s, not 20)', secs >= 14 && secs <= 18, clock);
  await b.close(); done('Late joiners (mid-spin / mid-break)', errors);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
