const L = require('./lib.cjs'); const { chromium, BASE, sleep, t, api, newPage, done } = L;
const errors = [];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const b = await chromium.launch();
  const p = await newPage(b, 1440, 1000, errors, 'admin');
  const cmdA = (a, pr) => api.cmd(code, adminKey, a, pr); let code, adminKey, hostKey;

  // =========================== A. create-event form ===========================
  await p.goto(BASE + '/new');
  await p.fill('input[value="Office Premier League"]', 'QA Cup');
  await p.click('button.chip:has-text("Football")');
  t('sport chip fills the field', await p.inputValue('input[value="Football"]') === 'Football');
  await p.click('button[aria-label="Accent #5cc8ff"]');
  await p.click('button:has-text("$ Dollars")');
  t('western style hint shown', await p.locator('text=Amounts show as K / M').count() === 1);
  const money = p.locator('input[placeholder="e.g. 12cr, 5L, 250k"]');
  await money.nth(0).fill('10m'); await money.nth(1).fill('200k');
  t('money preview understands 10m', await p.locator('text=/= \\$10M/').count() >= 1);
  await money.nth(1).fill('abc');
  t('bad amount shows a hint', await p.locator("text=Couldn't read that").count() >= 1);
  await money.nth(1).fill('200k');
  // tiers: row 2 currently 1Cr→10L (₹ defaults); set explicit values
  await p.locator('button:has-text("Add a tier")').click();
  t('three tier rows after adding', await p.locator('text=Each bid goes up by').count() === 3);
  await p.locator('button[aria-label="Remove tier"]').last().click();
  t('two tier rows after removing', await p.locator('text=Each bid goes up by').count() === 2);
  const tierInputs = p.locator('input[placeholder="e.g. 12cr, 5L, 250k"]');
  const n = await tierInputs.count();            // purse, base, tier2.from, tier1.step, tier2.step  (tier1.from is a static box)
  await tierInputs.nth(2).fill('100k'); await tierInputs.nth(3).fill('1m'); await tierInputs.nth(4).fill('250k');
  await p.click('button:has-text("Photo")'.replace('button:has-text("Photo")', 'button:has-text("Player photo")'));
  await p.click('button:has-text("Description")');
  await p.click('text=Auctioneer picks');
  await p.locator('input[type=number]').nth(0).fill('3');   // planned rounds
  await p.locator('input[type=number]').nth(1).fill('3');   // min squad
  await p.locator('input[type=number]').nth(2).fill('5');   // max squad
  await p.click('button:has-text("Keep money back")');
  await p.click('button:has-text("Create auction")');
  await p.waitForURL(/\/admin\?k=/);
  const u = new URL(p.url()); code = u.pathname.split('/')[2]; adminKey = u.searchParams.get('k');
  hostKey = await p.evaluate((c) => localStorage.getItem(`zeno:key:${c}:host`), code);
  const s1 = (await api.state(code, adminKey)).settings;
  t('A: name', s1.name === 'QA Cup'); t('A: sport', s1.sport === 'Football'); t('A: accent', s1.accent === '#5cc8ff');
  t('A: currency', s1.symbol === '$' && s1.moneyStyle === 'western');
  t('A: purse/base', s1.defaultBudget === 10_000_000 && s1.defaultBasePrice === 200_000, JSON.stringify([s1.defaultBudget, s1.defaultBasePrice]));
  t('A: tiers', JSON.stringify(s1.increments) === JSON.stringify([{ from: 0, step: 100_000 }, { from: 1_000_000, step: 250_000 }]), JSON.stringify(s1.increments));
  t('A: display toggles', s1.display.showPhoto === false && s1.display.showDescription === false && s1.display.showRole === true);
  t('A: draw mode / rounds / squad', s1.drawMode === 'manual' && s1.totalRounds === 3 && s1.minSquad === 3 && s1.maxSquad === 5 && s1.reserveRule === true, JSON.stringify([s1.drawMode, s1.totalRounds, s1.minSquad, s1.maxSquad, s1.reserveRule]));
  // home page lists it
  await p.goto(BASE + '/'); t('home lists the new auction', await p.locator('text=QA Cup').count() >= 1);
  await p.goto(`${BASE}/e/${code}/admin?k=${adminKey}`);

  // =========================== B. teams ===========================
  await p.click('button:has-text("Teams (0)")');
  for (const [team, cap, purse] of [['Alpha', 'Ann', '5m'], ['Beta', 'Bob', ''], ['Gamma', 'Gus', '']]) {
    await p.fill('input[placeholder="Thunder Hawks"]', team); await p.fill('input[placeholder="Priya"]', cap);
    if (purse) { const pm = p.locator('section:has-text("Add a team") input[placeholder="e.g. 12cr, 5L, 250k"]'); await pm.fill(purse); }
    await p.click('button:has-text("Add team")'); await p.waitForSelector(`input[value="${team}"]`);
  }
  let st = await api.state(code, adminKey);
  t('B: 3 teams, Alpha has 5m, others default 10m', st.captains.length === 3 && st.captains[0].budget === 5_000_000 && st.captains[1].budget === 10_000_000, JSON.stringify(st.captains.map(c => c.budget)));
  // rename + captain + colour (commit on blur)
  const nameBox = await p.locator('input[value="Beta"]').elementHandle(); await nameBox.fill('Beta Bulls'); await nameBox.press('Enter');
  await p.waitForFunction(async ([c, k]) => (await (await fetch(`/api/events/${c}/state?key=${k}`)).json()).captains.some(x => x.team === 'Beta Bulls'), [code, adminKey]);
  t('B: team renamed', true);
  await p.locator('input[type=color]').first().fill('#112233');
  await sleep(500); st = await api.state(code, adminKey); t('B: colour changed', st.captains[0].color === '#112233');
  // logo
  await p.locator('input[type=file][accept="image/*"]').first().setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await sleep(1200); st = await api.state(code, adminKey); t('B: logo uploaded and saved', /^\/uploads\//.test(st.captains[0].logo), st.captains[0].logo);
  // purse ops on Alpha (card 1): + 1m, − 500k, set 7m
  const card = p.locator('section.card').filter({ has: p.locator('input[value="Alpha"]') }).first();
  const amt = card.locator('input[placeholder="e.g. 12cr, 5L, 250k"]');
  await amt.fill('1m'); await card.locator('button:has-text("+ Add")').click(); await sleep(400);
  await amt.fill('500k'); await card.locator('button:has-text("− Subtract")').click(); await sleep(400);
  st = await api.state(code, adminKey); t('B: add then subtract → 5.5m', st.captains[0].budget === 5_500_000, String(st.captains[0].budget));
  await amt.fill('7m'); await card.locator('button:has-text("= Set to")').click(); await sleep(400);
  st = await api.state(code, adminKey); t('B: set → 7m', st.captains[0].budget === 7_000_000);
  // all teams
  const all = p.locator('section:has-text("Change every purse at once") input[placeholder="e.g. 12cr, 5L, 250k"]');
  await all.fill('1m'); await p.click('button:has-text("+ Add to all")'); await sleep(400);
  await all.fill('2m'); await p.click('button:has-text("− Subtract from all")'); await sleep(400);
  st = await api.state(code, adminKey); t('B: top-up/trim all (+1m −2m)', st.captains[0].budget === 6_000_000 && st.captains[1].budget === 9_000_000, JSON.stringify(st.captains.map(c => c.budget)));
  // copy link
  await ctxPermissions(p);
  await p.locator('button:has-text("Copy captain link")').first().click(); await sleep(300);
  t('B: copy button confirms', await p.locator('text=Copied').count() >= 1);
  // remove with confirm
  await p.locator('section.card').filter({ has: p.locator('input[value="Gamma"]') }).locator('button:has-text("Remove")').click(); await sleep(500);
  st = await api.state(code, adminKey); t('B: team removed', st.captains.length === 2);
  await p.click('button:has-text("Teams (2)")');

  // =========================== C. players ===========================
  await p.click('button:has-text("Players (0)")');
  await p.getByRole('button', { name: 'Add player', exact: true }).click(); await sleep(400);
  await p.locator('div.fixed input:not([type=file])').first().fill('Zed Alpha');
  await p.fill('input[list="roles"]', 'Forward');
  await p.fill('textarea', 'Quick winger');
  await p.locator('div.fixed input[placeholder="e.g. 12cr, 5L, 250k"]').fill('300k');
  await p.click('button:has-text("Save & add another")'); await sleep(400);
  await p.locator('div.fixed input:not([type=file])').first().fill('Zed Beta');
  await p.locator('div.fixed').getByRole('button', { name: 'Save', exact: true }).click(); await sleep(500);
  st = await api.state(code, adminKey);
  t('C: two players added', st.players.length === 2 && st.players[0].role === 'Forward' && st.players[0].basePrice === 300_000 && st.players[0].description === 'Quick winger');
  t('C: "add another" kept the role', st.players[1].role === 'Forward');
  // edit + photo in modal
  await p.locator('tr', { hasText: 'Zed Beta' }).locator('button[aria-label="Edit"]').click();
  await p.locator('div.fixed input[type=file]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
  await sleep(1200); await p.locator('div.fixed input:not([type=file])').first().fill('Zed Beta II'); await p.locator('div.fixed').getByRole('button', { name: 'Save', exact: true }).click(); await sleep(500);
  st = await api.state(code, adminKey); const zb = st.players.find(x => x.name === 'Zed Beta II');
  t('C: edit renamed and attached a photo', !!zb && /^\/uploads\//.test(zb.photo), JSON.stringify(zb?.photo));
  // bulk photos by filename (one match, one miss)
  await p.locator('input[type=file][multiple]').setInputFiles([{ name: 'zed-alpha.png', mimeType: 'image/png', buffer: PNG }, { name: 'nobody-here.png', mimeType: 'image/png', buffer: PNG }]);
  await sleep(1800); st = await api.state(code, adminKey);
  t('C: bulk photo matched by filename', /^\/uploads\//.test(st.players.find(x => x.name === 'Zed Alpha').photo));
  t('C: bulk photo toast mentions the miss', await p.locator("text=didn't match a player name").count() >= 1);
  // paste import incl. pre-bought
  await p.click('button:has-text("Paste a list")');
  await p.fill('div.fixed textarea', 'Imp One\tKeeper\t250k\tSafe hands\t\t\nImp Two\tDefender\t\t\t\tAlpha\t1m\nImp Three\t\t\t\t\tNoSuchTeam\t1m');
  t('C: preview flags the unknown team', await p.locator('div.fixed td.text-amber-300').count() === 1);
  await p.click('div.fixed button:has-text("Import 3")'); await sleep(700);
  st = await api.state(code, adminKey);
  t('C: import placed Imp Two on Alpha for 1m', st.players.find(x => x.name === 'Imp Two').teamId === st.captains[0].id && st.players.find(x => x.name === 'Imp Two').price === 1_000_000);
  t('C: unknown team left unassigned', st.players.find(x => x.name === 'Imp Three').status === 'available');
  // filters + search
  await p.click('button.chip:has-text("sold")'); await sleep(200);
  t('C: filter "sold" shows 1', await p.locator('tbody tr').count() === 1);
  await p.click('button.chip:has-text("All")'); await p.fill('input[placeholder="Search players"]', 'imp'); await sleep(200);
  t('C: search narrows to 3', await p.locator('tbody tr').count() === 3);
  await p.fill('input[placeholder="Search players"]', 'zzzz'); t('C: no match row', await p.locator('text=No players match').count() === 1);
  await p.fill('input[placeholder="Search players"]', '');
  // assign modal with over-budget warning
  await p.locator('tr', { hasText: 'Imp One' }).locator('button:has-text("Assign")').click();
  await p.locator('div.fixed input[placeholder="e.g. 12cr, 5L, 250k"]').fill('50m');
  t('C: over-budget warning shown', await p.locator('text=more than').count() >= 1);
  await p.locator('div.fixed input[placeholder="e.g. 12cr, 5L, 250k"]').fill('1m'); await p.click('div.fixed button:has-text("Assign")'); await sleep(500);
  st = await api.state(code, adminKey); t('C: assigned', st.players.find(x => x.name === 'Imp One').status === 'sold');
  // delete with confirm
  await p.locator('tr', { hasText: 'Imp Three' }).locator('button[aria-label="Delete"]').click(); await sleep(500);
  st = await api.state(code, adminKey); t('C: player deleted', !st.players.some(x => x.name === 'Imp Three'));

  // =========================== D. settings tab ===========================
  await p.click('button:has-text("Settings")'); await sleep(300);
  await p.fill('input[value="QA Cup"]', 'QA Cup 2');
  t('D: unsaved bar appears', await p.locator('text=You have unsaved changes').count() === 1);
  await p.click('button:has-text("Discard")'); await sleep(200);
  t('D: discard restores', await p.inputValue('input[value="QA Cup"]') === 'QA Cup');
  await p.fill('input[value="QA Cup"]', 'QA Cup 2'); await p.click('button:has-text("Save changes")'); await sleep(500);
  st = await api.state(code, adminKey); t('D: save applies', st.settings.name === 'QA Cup 2');
  // share tab
  await p.click('button:has-text("Share & links")'); await sleep(300);
  t('D: share shows code and captain links', await p.locator(`text=${code}`).count() >= 1 && await p.locator('text=Captain links').count() === 1);
  // team board tab
  await p.click('button:has-text("Team board")'); await sleep(300); t('D: board tab renders teams', await p.locator('text=Purse left').count() >= 2);

  await p.context().browser().close;
  console.log(JSON.stringify({ code, adminKey, hostKey }));
  require('fs').writeFileSync(require('node:path').join(__dirname, 'out', 'qa-ui2.state.json'), JSON.stringify({ code, adminKey, hostKey }));
  await b.close();
  done('UI flows A–D (create / teams / players / settings)', errors);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
async function ctxPermissions(p) { try { await p.context().grantPermissions(['clipboard-read', 'clipboard-write']); } catch {} }
