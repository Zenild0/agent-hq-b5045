// Themes, light/dark, brand logo, team-list sorting, unlock dialog, developer page, Terms page.
// Needs the server started with a developer key (DEV_KEY=qa-developer-key-1234).
const L = require('./lib.cjs'); const { chromium, BASE, sleep, t, api, done } = L;
const errors = [];
const DEV = process.env.DEV_KEY || 'qa-developer-key-1234';
const dev = (path, method = 'GET', body) => fetch(BASE + '/api/dev' + path, { method, headers: { 'x-dev-key': DEV, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  const cssVar = (page, name) => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

  const c = await api.create({ name: 'Look Cup', drawMode: 'manual' });
  await api.cmd(c.code, c.adminKey, 'demo.load');
  const st0 = await api.state(c.code, c.adminKey);

  // ============ themes + modes ============
  await p.goto(`${BASE}/e/${c.code}/admin?k=${c.adminKey}`);
  await p.waitForSelector('text=Look Cup');
  t('default theme is Midnight Gold, dark', (await p.evaluate(() => document.documentElement.dataset.mode)) === 'dark' && (await cssVar(p, '--gold')) === '242 184 75');
  await p.click('button:has-text("Settings")');
  const radios = p.locator('button[role=radio]');
  t('the theme picker lists 29 themes (plus "Your brand" below)', await radios.count() === 29, String(await radios.count()));
  for (const name of ['Halloween', 'Christmas', 'Black Friday', 'Parchment', 'Terminal Green', 'Stadium Night']) t(`theme "${name}" is offered`, await p.locator(`button[role=radio]:has-text("${name}")`).count() === 1);
  await p.click('button[role=radio]:has-text("Christmas")');
  t('picking a theme previews it at once', (await p.evaluate(() => document.documentElement.dataset.pattern)) === 'dots' && (await cssVar(p, '--gold')) !== '242 184 75');
  const saveBtn = p.locator('button:has-text("Save changes")'); await saveBtn.click(); await sleep(600);
  t('the choice is saved for the whole auction', (await api.state(c.code)).settings.theme === 'christmas');
  const cap = st0.secrets.captainTokens[st0.captains[0].id];
  const live = await ctx.newPage(); live.on('pageerror', e => errors.push('live pageerror: ' + e.message));
  await live.goto(`${BASE}/e/${c.code}/live`); await live.waitForSelector('text=Join code');
  t('other screens get the organiser\'s theme', (await cssVar(live, '--gold')) === (await cssVar(p, '--gold')) && (await live.evaluate(() => document.documentElement.dataset.pattern)) === 'dots');
  // light / dark
  await live.click('button[aria-label="Switch to light mode"]'); await sleep(200);
  t('the light/dark button switches this screen', (await live.evaluate(() => document.documentElement.dataset.mode)) === 'light');
  const pageBg = await live.evaluate(() => getComputedStyle(document.body).backgroundColor); t('light mode has a light page', /^rgb\((2[0-9]{2}), (2[0-9]{2}), (2[0-9]{2})\)$/.test(pageBg), pageBg);
  t('the choice does not change other people\'s screens', (await p.evaluate(() => document.documentElement.dataset.mode)) === 'dark');
  await live.reload(); await live.waitForSelector('text=Join code');
  t('and it is remembered on this device', (await live.evaluate(() => document.documentElement.dataset.mode)) === 'light');
  await api.cmd(c.code, c.adminKey, 'settings.update', { patch: { mode: 'dark', theme: 'midnight-gold' } }); await sleep(500);
  t('the device\'s own choice wins over the organiser\'s default', (await live.evaluate(() => document.documentElement.dataset.mode)) === 'light');
  await live.click('button[aria-label="Switch to dark mode"]'); await sleep(200);
  t('switching back works', (await live.evaluate(() => document.documentElement.dataset.mode)) === 'dark');
  await live.evaluate(() => localStorage.removeItem('zeno:mode'));
  // organiser's default mode = light
  await api.cmd(c.code, c.adminKey, 'settings.update', { patch: { mode: 'light' } }); await live.reload(); await live.waitForSelector('text=Join code');
  t('an organiser can make light the default', (await live.evaluate(() => document.documentElement.dataset.mode)) === 'light');
  await api.cmd(c.code, c.adminKey, 'settings.update', { patch: { mode: 'dark' } });
  t('leaving an auction restores the default look', await (async () => { await live.goto(BASE + '/'); await sleep(300); return (await cssVar(live, '--gold')) === '242 184 75'; })());

  // ============ team list sorting ============
  const sold = [[0, 90], [1, 30], [2, 60]]; // player index, price (lakh): bought in this order by team 0
  for (const [i, lakh] of sold) { await api.cmd(c.code, c.adminKey, 'player.assign', { id: st0.players[i].id, captainId: st0.captains[0].id, price: lakh * 100000 }); await sleep(15); }
  const names = sold.map(([i]) => st0.players[i].name);
  const capPage = await ctx.newPage(); capPage.on('pageerror', e => errors.push('cap pageerror: ' + e.message));
  await capPage.goto(`${BASE}/e/${c.code}/captain?k=${cap}`); await capPage.waitForSelector('text=My squad');
  const order = async (page, sel) => (await page.locator(sel).allInnerTexts()).map(s => names.find(n => s.includes(n))).filter(Boolean);
  const squadSel = '.card.flex.items-center.gap-3 .truncate.font-semibold';
  t('a captain\'s list starts as the auctioneer set it: highest price first', JSON.stringify(await order(capPage, squadSel)) === JSON.stringify([names[0], names[2], names[1]]), JSON.stringify(await order(capPage, squadSel)));
  await capPage.click('button:has-text("Order bought")'); await sleep(200);
  t('a captain can switch to the order players were bought', JSON.stringify(await order(capPage, squadSel)) === JSON.stringify(names), JSON.stringify(await order(capPage, squadSel)));
  await capPage.reload(); await capPage.waitForSelector('text=My squad');
  t('…and the choice is remembered', JSON.stringify(await order(capPage, squadSel)) === JSON.stringify(names));
  await capPage.click('button:has-text("All teams")'); await sleep(200);
  t('the same choice applies to the all-teams view', JSON.stringify(await order(capPage, 'ul li .truncate.text-sm.font-semibold')) === JSON.stringify(names), JSON.stringify(await order(capPage, 'ul li .truncate.text-sm.font-semibold')));
  // the auctioneer sets what the big screen shows
  const board = await ctx.newPage(); board.on('pageerror', e => errors.push('board pageerror: ' + e.message));
  await board.goto(`${BASE}/e/${c.code}/board`); await board.waitForSelector('text=Team');
  const boardSel = 'ul li .truncate.text-sm.font-semibold';
  t('the big screen board defaults to highest price first', JSON.stringify(await order(board, boardSel)) === JSON.stringify([names[0], names[2], names[1]]), JSON.stringify(await order(board, boardSel)));
  const host = await ctx.newPage(); host.on('pageerror', e => errors.push('host pageerror: ' + e.message));
  await host.goto(`${BASE}/e/${c.code}/host?k=${c.hostKey}`); await host.waitForSelector('text=Team lists on the big screen');
  await host.click('button:has-text("Order bought")'); await sleep(600);
  t('the auctioneer can re-order the big screen live', JSON.stringify(await order(board, boardSel)) === JSON.stringify(names), JSON.stringify(await order(board, boardSel)));
  t('the setting is saved on the server', (await api.state(c.code)).live.squadSort === 'added');
  await host.click('button:has-text("Highest price")'); await sleep(500);
  t('…and back to price', JSON.stringify(await order(board, boardSel)) === JSON.stringify([names[0], names[2], names[1]]));

  // ============ brand ============
  const png = async (text, color, w, h) => Buffer.from(await p.evaluate(([tx, col, w, h]) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.clearRect(0, 0, w, h); g.fillStyle = col; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 14); g.fill(); g.fillStyle = '#fff'; g.font = `bold ${h * 0.45}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tx, w / 2, h / 2); return cv.toDataURL('image/png').split(',')[1]; }, [text, color, w, h]), 'base64');
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zqa5-')); const f1 = path.join(dir, 'logo.png'), f2 = path.join(dir, 'event.png');
  fs.writeFileSync(f1, await png('ACME', '#e11d48', 700, 220)); fs.writeFileSync(f2, await png('ACME CUP 2026', '#0f766e', 1400, 260));
  await p.click('button[role=radio]:has-text("Midnight Gold")');
  await p.click('input[name=theme]'); await sleep(200);
  t('choosing "Your brand" shows the logo controls', await p.locator('text=Company logo').count() >= 1);
  await p.setInputFiles('input[aria-label="Company logo"]', f1); await p.waitForSelector('img[alt=""][src*="/uploads/"]', { timeout: 8000 });
  await sleep(500);
  const brandColor = await p.locator('input[aria-label="Brand colour"]').inputValue();
  t('the brand colour is picked from the logo', /^#(e|d)[0-9a-f]{1}[0-9a-f]{2}[0-9a-f]{2}$/i.test(brandColor) || brandColor.startsWith('#e'), brandColor);
  await p.setInputFiles('input[aria-label="Event logo (optional)"]', f2); await sleep(1200);
  await p.click('button:has-text("As a banner")');
  await p.click('button:has-text("Save changes")'); await sleep(700);
  const sb = (await api.state(c.code)).settings;
  t('brand settings saved (logo, event logo, banner, colour)', sb.theme === 'brand' && sb.brand.logo.startsWith(`/uploads/${c.code}/`) && sb.brand.eventLogo.startsWith('/uploads/') && sb.brand.eventLogoStyle === 'banner' && /^#[0-9a-f]{6}$/i.test(sb.brand.color), JSON.stringify(sb.brand));
  const live2 = await ctx.newPage(); live2.on('pageerror', e => errors.push('live2 pageerror: ' + e.message));
  await live2.goto(`${BASE}/e/${c.code}/live`); await live2.waitForSelector('text=Join code');
  t('the company logo replaces the ZenoBid logo on the big screen', await live2.locator(`img[src="${sb.brand.logo}"]`).count() === 1 && await live2.locator('a[aria-label="ZenoBid home"]').count() === 0);
  t('"Powered by ZenoBid" is shown', await live2.locator('text=Powered by ZenoBid').count() >= 1);
  t('the event logo is shown as a banner', await live2.locator(`img[src="${sb.brand.eventLogo}"]`).count() === 1);
  t('the page takes the brand colour', (await cssVar(live2, '--accent')).split(' ')[0] > 150);
  await live2.screenshot({ path: path.join(__dirname, 'out', 'ui5-brand-live.png') });
  await api.cmd(c.code, c.adminKey, 'settings.update', { patch: { brand: { eventLogoStyle: 'side' } } }); await sleep(600);
  t('switching the event logo to the side works', await live2.locator(`img[src="${sb.brand.eventLogo}"]`).count() === 1 && await live2.locator('.card img[src^="/uploads"]').count() === 0);
  const capB = await ctx.newPage(); await capB.goto(`${BASE}/e/${c.code}/captain?k=${cap}`); await capB.waitForSelector('text=My squad');
  t('captains see the brand too', await capB.locator(`img[src="${sb.brand.logo}"]`).count() === 1);
  // the server refuses anything that is not a picture from this server / https
  const bad2 = await api.cmd(c.code, c.adminKey, 'settings.update', { patch: { brand: { logo: 'javascript:alert(1)', eventLogo: '/uploads/ZZZZZZ/../../etc/passwd' } } });
  t('a script address or path trick is not accepted as a logo', (await api.state(c.code)).settings.brand.logo === sb.brand.logo);
  t('a bad theme id is ignored', (await api.cmd(c.code, c.adminKey, 'settings.update', { patch: { theme: '<img onerror=1>' } }), (await api.state(c.code)).settings.theme === 'brand'));

  // ============ round 2: names and money saved ahead ============
  const r2 = await api.create({ name: 'Round Two Cup', drawMode: 'manual' }); await api.cmd(r2.code, r2.adminKey, 'demo.load');
  const r2s = await api.state(r2.code, r2.adminKey);
  // sell/mark everyone so the pool is empty: first two sold, the rest unsold
  for (let i = 0; i < r2s.players.length; i++) {
    if (i < 2) await api.cmd(r2.code, r2.adminKey, 'player.assign', { id: r2s.players[i].id, captainId: r2s.captains[0].id, price: 3000000 });
    else await api.cmd(r2.code, r2.adminKey, 'player.setStatus', { id: r2s.players[i].id, status: 'unsold' });
  }
  const adm = await ctx.newPage(); adm.on('pageerror', e => errors.push('r2 admin pageerror: ' + e.message)); adm.on('dialog', d => d.accept());
  await adm.goto(`${BASE}/e/${r2.code}/admin?k=${r2.adminKey}`); await adm.waitForSelector('text=Round Two Cup');
  await adm.click('button:has-text("Players")');
  await adm.click('button:has-text("Add player")');
  await adm.fill('[role=dialog] input.input >> nth=0', 'Round Two Rookie');
  t('the add-player form offers "Add for round 2"', await adm.locator('text=Add for round 2').count() >= 1);
  await adm.check('label:has-text("Add for round 2") input'); await adm.click('[role=dialog] button:text-is("Save")'); await sleep(700);
  const afterAdd = await api.state(r2.code, r2.adminKey);
  t('the new name is saved as waiting for round 2', afterAdd.players.some(p => p.name === 'Round Two Rookie' && p.status === 'upcoming'));
  t('the Players tab has a "For round 2" filter', await adm.locator('button.chip:has-text("For round 2")').count() === 1);
  await adm.click('button:has-text("Add player")'); await adm.fill('[role=dialog] input.input >> nth=0', 'Second Rookie'); await adm.check('label:has-text("Add for round 2") input'); await adm.click('[role=dialog] button:text-is("Save")'); await sleep(500);
  await adm.click('button:has-text("Paste a list")'); await adm.fill('textarea', 'Pasted Rookie One\nPasted Rookie Two'); await adm.check('label:has-text("These are for round 2") input'); await adm.click('button:has-text("Import 2")'); await sleep(700);
  const afterPaste = await api.state(r2.code, r2.adminKey);
  t('a pasted list can be saved for round 2 too', afterPaste.players.filter(p => p.status === 'upcoming').length === 4, String(afterPaste.players.filter(p => p.status === 'upcoming').length));
  await adm.click('button:has-text("Teams")');
  t('the Teams tab has the "Extra money for round 2" card', await adm.locator('text=Extra money for round 2').count() === 1);
  const card = adm.locator('section:has-text("Extra money for round 2")');
  await card.locator('input').first().fill('1cr'); await card.locator('button:has-text("Save for round 2")').click(); await sleep(700);
  t('the extra money is saved', (await api.state(r2.code, r2.adminKey)).nextTopup === 10000000);
  t('it says what will happen', await adm.locator('text=Every team will get').count() === 1);
  // the auctioneer starts round 2
  const hp = await ctx.newPage(); hp.on('pageerror', e => errors.push('r2 host pageerror: ' + e.message));
  await hp.goto(`${BASE}/e/${r2.code}/host?k=${r2.hostKey}`); await hp.waitForSelector('text=Round 1 is done');
  const boxText = await hp.locator('div:has(> p:has-text("Round 1 is done"))').first().innerText();
  t('the auctioneer sees unsold + new players and the extra money', /unsold player/.test(boxText) && /4 new players/.test(boxText) && /every team gets \+/.test(boxText), boxText);
  // a captain and the big screen do not see the saved names
  const capTok = r2s.secrets.captainTokens[r2s.captains[0].id];
  const capP = await ctx.newPage(); await capP.goto(`${BASE}/e/${r2.code}/captain?k=${capTok}`); await capP.waitForSelector('text=My squad'); await capP.click('button:has-text("Strategy")'); await sleep(500);
  t('a captain\'s screen never shows the saved names', (await capP.content()).includes('Pasted Rookie') === false && (await capP.content()).includes('Round Two Rookie') === false);
  const purseBefore = (await api.state(r2.code)).captains.map(c => c.budget);
  await hp.click('button:has-text("Start round 2")'); await sleep(900);
  const r2after = await api.state(r2.code, r2.adminKey);
  t('round 2 started', r2after.round === 2);
  t('unsold players and the new names are all in the pool', r2after.players.filter(p => p.status === 'available').length === r2s.players.length - 2 + 4, String(r2after.players.filter(p => p.status === 'available').length));
  t('every team received the extra money', r2after.captains.every((c, i) => c.budget === purseBefore[i] + 10000000));
  t('the saved amount is used up', r2after.nextTopup === 0);
  await capP.reload(); await capP.waitForSelector('text=My squad'); await capP.click('button:has-text("Strategy")'); await sleep(500);
  t('now the captain can see the new players', (await capP.content()).includes('Round Two Rookie'));

  // ============ unlock dialog + developer page ============
  const price = await dev('/config', 'PUT', { price: 499, upiId: 'qa@okaxis', payeeName: 'QA Dev', note: 'Thank you!', operatorName: 'QA Operator', contact: 'qa@example.com' });
  t('payments switched on for the test', price.status === 200);
  const pa = await api.create({ name: 'Pay Cup', drawMode: 'manual' }); await api.cmd(pa.code, pa.adminKey, 'demo.load');
  await p.goto(`${BASE}/e/${pa.code}/admin?k=${pa.adminKey}`); await p.waitForSelector('text=Pay Cup');
  t('the admin sees a clear banner while locked', await p.locator('text=Set-up and practice are free').count() === 1);
  await p.click('button:has-text("Unlock to go live")');
  await p.waitForSelector('img[alt^="UPI QR code"]', { timeout: 8000 });
  t('the dialog shows the price, a QR code and the UPI id', await p.locator('text=₹499').count() >= 1 && await p.locator('code:has-text("qa@okaxis")').count() === 1);
  t('the QR code is a real image', await p.locator('img[alt^="UPI QR code"]').evaluate(i => i.naturalWidth > 100));
  t('the dialog links to the Terms of use', await p.locator('a:has-text("Terms of use")').count() === 1);
  t('"I have paid" waits for a reference', await p.locator('button:has-text("I have paid")').isDisabled());
  await p.fill('input[aria-label="UPI reference"]', 'UTR998877665544'); await p.fill('input[aria-label="Your name"]', 'Asha');
  await p.click('button:has-text("I have paid")'); await p.waitForSelector('text=waiting for approval', { timeout: 5000 }).catch(() => {});
  await p.waitForSelector('text=UTR998877665544');
  t('after sending, the admin sees it is waiting for approval', await p.locator('text=UTR998877665544').count() >= 1);
  const hostP = await ctx.newPage(); await hostP.goto(`${BASE}/e/${pa.code}/host?k=${pa.hostKey}`); await hostP.waitForSelector('text=This auction is not unlocked yet');
  t('the auctioneer is told it is not unlocked', true);
  await p.keyboard.press('Escape');
  // developer page
  const dp = await ctx.newPage(); dp.on('pageerror', e => errors.push('dev pageerror: ' + e.message));
  await dp.goto(BASE + '/dev'); await dp.waitForSelector('input[aria-label="Developer key"]');
  await dp.fill('input[aria-label="Developer key"]', 'wrong-key-wrong-key'); await dp.click('button:has-text("Open")'); await sleep(800);
  t('a wrong developer key does not open the page', await dp.locator('input[aria-label="Developer key"]').count() === 1 && await dp.locator('text=Waiting for your approval').count() === 0);
  await dp.fill('input[aria-label="Developer key"]', DEV); await dp.click('button:has-text("Open")');
  await dp.waitForSelector('text=Waiting for your approval (1)', { timeout: 8000 });
  t('the developer sees the payment and its reference', await dp.locator('text=UTR998877665544').count() >= 1 && await dp.locator('text=Asha').count() >= 1);
  await dp.click('button:has-text("Approve")');
  await p.waitForSelector('text=Set-up and practice are free', { state: 'detached', timeout: 8000 });
  t('approval unlocks the admin page by itself', await p.locator('text=Set-up and practice are free').count() === 0);
  await hostP.waitForSelector('text=This auction is not unlocked yet', { state: 'detached', timeout: 8000 });
  t('…and the auctioneer page too', true);
  t('the auction really can go live now', (await api.cmd(pa.code, pa.hostKey, 'pick', { playerId: (await api.state(pa.code)).players[0].id })).ok === true);
  await dp.screenshot({ path: path.join(__dirname, 'out', 'ui5-dev.png') });
  // grant free from the page
  const pb = await api.create({ name: 'Gift Cup' });
  await dp.click('button:has-text("Refresh")'); await dp.waitForSelector('text=Gift Cup');
  await dp.locator('tr:has-text("Gift Cup") button:has-text("Grant free")').click(); await sleep(800);
  t('the developer can grant free access from the page', (await api.state(pb.code, pb.adminKey)).unlock.by === 'grant');
  // terms
  const tp = await ctx.newPage(); await tp.goto(BASE + '/terms'); await tp.waitForSelector('text=Teams (bidders) per auction');
  t('the Terms page lists the real limits', await tp.locator('td:has-text("32")').count() >= 1 && await tp.locator('td:has-text("500")').count() >= 1 && await tp.locator('text=1 MB').count() >= 1);
  t('the Terms page names the operator and the price', await tp.locator('text=QA Operator').count() >= 1 && await tp.locator('text=₹499').count() >= 1);
  await tp.screenshot({ path: path.join(__dirname, 'out', 'ui5-terms.png'), fullPage: true });
  const home = await ctx.newPage(); await home.goto(BASE + '/'); t('the home page links to the Terms', await home.locator('a:has-text("Terms of use")').count() === 1);

  await dev('/config', 'PUT', { price: 0, upiId: '' });
  await b.close();
  done('Look & feel, sorting, brand, unlock, developer page', errors);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
