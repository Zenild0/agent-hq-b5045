const L = require('./lib.cjs'); const { chromium, BASE, sleep, t, api, newPage, done } = L;
const errors = [];
(async () => {
  const b = await chromium.launch();
  const c = await api.create({ name: 'QA <b>Bold</b> & "Quotes" 🎉', tagline: '<script>alert(1)</script>', drawMode: 'manual' });
  const { code, adminKey, hostKey } = c;
  await api.cmd(code, adminKey, 'demo.load');
  const st = await api.state(code, adminKey);
  const tok = st.captains.map(x => st.secrets.captainTokens[x.id]);
  // hostile + extreme text
  await api.cmd(code, adminKey, 'captain.update', { id: st.captains[0].id, team: '<img src=x onerror=alert(1)>Team', name: '"><svg onload=alert(1)>' });
  await api.cmd(code, adminKey, 'players.import', { rows: [
    { name: '<img src=x onerror=alert(2)> Evil', role: '<b>role</b>', description: '<script>alert(3)</script> ' + 'long '.repeat(80) },
    { name: 'Wolfeschlegelsteinhausenbergerdorff-Superlongsurname Jr. the Third of Westminster Abbey', role: 'Wicketkeeper-Batter-Allrounder-Specialist', description: 'x' },
    { name: 'محمد الأحمد 🏏', role: 'لاعب', description: 'نص عربي طويل '.repeat(10) },
    { name: '日本語の名前', role: '打者', description: '説明' },
    { name: 'A', role: '', description: '' },
  ] });
  await api.cmd(code, adminKey, 'settings.update', { patch: { name: 'QA <b>Bold</b> & "Quotes" 🎉 with a very long event name that goes on and on and on forever' } });

  const routes = [
    ['/', 'home'], ['/new', 'new'], ['/join', 'join'], [`/join/${code}`, 'join-code'],
    [`/e/${code}/live`, 'live'], [`/e/${code}/board`, 'board'], [`/e/${code}`, 'event-root'],
    [`/e/${code}/captain?k=${tok[0]}`, 'captain'], [`/e/${code}/captain`, 'captain-nokey'], [`/e/${code}/captain?k=ZZZZZZ`, 'captain-wrongkey'],
    [`/e/${code}/host?k=${hostKey}`, 'host'], [`/e/${code}/host`, 'host-nokey'], [`/e/${code}/host?k=bad`, 'host-wrongkey'],
    [`/e/${code}/admin?k=${adminKey}`, 'admin'], [`/e/${code}/admin`, 'admin-nokey'], [`/e/${code}/admin?k=bad`, 'admin-wrongkey'],
    ['/e/NOPE00/live', 'missing-event'], ['/nonsense/route', 'unknown-route'],
  ];
  const sizes = [[390, 844], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]];
  for (const [w, h] of sizes) {
    const p = await newPage(b, w, h, errors, `${w}x${h}`);
    for (const [path, name] of routes) {
      await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      await sleep(450);
      const info = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, text: document.body.innerText.length, html: document.body.innerHTML.includes('onerror=alert') && document.querySelector('img[onerror]') ? 'INJECTED' : 'ok' }));
      t(`${name} @${w}: renders content`, info.text > 20, `text=${info.text}`);
      t(`${name} @${w}: no horizontal overflow`, info.sw <= info.iw + 1, `scrollWidth ${info.sw} > ${info.iw}`);
      t(`${name} @${w}: no injected HTML`, info.html === 'ok');
    }
    await p.context().close();
  }

  // ---- bring the hostile player on screen and check the big screen layout at every size
  const evil = (await api.state(code, adminKey)).players;
  for (const [nm, label] of [['Wolfeschlegel', 'long-name'], ['محمد', 'rtl'], ['<img', 'html-name'], ['日本語', 'cjk']]) {
    const pl = evil.find(x => x.name.includes(nm));
    await api.cmd(code, hostKey, 'pick', { playerId: pl.id });
    for (const [w, h] of [[1366, 768], [1920, 1080], [390, 844]]) {
      const p = await newPage(b, w, h, errors, `live-${label}-${w}`);
      await p.goto(`${BASE}/e/${code}/live`, { waitUntil: 'domcontentloaded' }); await sleep(700);
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      t(`live ${label} @${w}: no horizontal overflow`, o.sw <= o.iw + 1, `${o.sw}>${o.iw}`);
      if (w === 1366 && label === 'long-name') await p.screenshot({ path: require('node:path').join(__dirname, 'out', 'qa-longname.png') });
      if (w === 1366 && label === 'rtl') await p.screenshot({ path: require('node:path').join(__dirname, 'out', 'qa-rtl.png') });
      await p.context().close();
    }
    await api.cmd(code, hostKey, 'unblock');
  }

  // ---- large auction: 32 teams, 500 players, many sold
  const big = await api.create({ name: 'Big One', drawMode: 'manual', defaultBudget: 1_000_000_000 });
  const rows = Array.from({ length: 500 }, (_, i) => ({ name: `Player Number ${i + 1}`, role: ['Bat', 'Bowl', 'AR', 'WK'][i % 4], description: 'desc' }));
  for (let i = 0; i < 32; i++) await api.cmd(big.code, big.adminKey, 'captain.add', { team: `Team ${i + 1}`, name: `Cap ${i + 1}` });
  const imp = await api.cmd(big.code, big.adminKey, 'players.import', { rows });
  t('500 players import', imp.ok && imp.result.added === 500, JSON.stringify(imp).slice(0, 120));
  const over = await api.cmd(big.code, big.adminKey, 'player.add', { name: 'one too many' });
  t('501st player refused', over.ok === false && /500/.test(over.error));
  const over2 = await api.cmd(big.code, big.adminKey, 'captain.add', { team: 'one too many' });
  t('33rd team refused', over2.ok === false && /32/.test(over2.error));
  const bs = await api.state(big.code, big.adminKey);
  for (let i = 0; i < 300; i++) await api.cmd(big.code, big.adminKey, 'player.assign', { id: bs.players[i].id, captainId: bs.captains[i % 32].id, price: (5 + (i % 40)) * 1_000_000 });
  await api.cmd(big.code, big.hostKey, 'pick', { playerId: bs.players[400].id });
  const tk = Object.values(bs.secrets.captainTokens);
  for (const [label, path, w, h] of [['big live', `/e/${big.code}/live`, 1920, 1080], ['big admin players', `/e/${big.code}/admin?k=${big.adminKey}`, 1440, 900], ['big host', `/e/${big.code}/host?k=${big.hostKey}`, 1440, 900], ['big captain', `/e/${big.code}/captain?k=${tk[0]}`, 390, 844], ['big board', `/e/${big.code}/board`, 1920, 1080]]) {
    const p = await newPage(b, w, h, errors, label);
    const t0 = Date.now();
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.body.innerText.length > 200, null, { timeout: 15000 }).catch(() => {});
    const ms = Date.now() - t0;
    if (label === 'big admin players') { await p.click('button:has-text("Players (")'); await sleep(500); const rowsN = await p.locator('tbody tr').count(); t('admin lists all 500 players', rowsN === 500, String(rowsN)); }
    await sleep(600);
    const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    t(`${label}: loads under 6 s`, ms < 6000, `${ms} ms`);
    t(`${label}: no horizontal overflow`, o.sw <= o.iw + 1, `${o.sw}>${o.iw}`);
    if (label === 'big live') await p.screenshot({ path: require('node:path').join(__dirname, 'out', 'qa-big-live.png') });
    await p.context().close();
  }
  await b.close();
  done('UI smoke / responsive / hostile / large', errors);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
