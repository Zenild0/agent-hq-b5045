// Save-to-file, restore-from-file and delete, as a person would do them in the browser.
const L = require('./lib.cjs'); const { chromium, BASE, sleep, t, api, newPage, done } = L;
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const errors = [];
(async () => {
  const b = await chromium.launch();
  const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'zqa-'));
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept());

  const c = await api.create({ name: 'Keepsake Cup', drawMode: 'manual' });
  await api.cmd(c.code, c.adminKey, 'demo.load');
  const before = await api.state(c.code, c.adminKey);

  // ---- viewer on the big screen while we work ----
  const live = await ctx.newPage();
  await live.goto(`${BASE}/e/${c.code}/live`);
  await live.waitForSelector('text=Join code');

  // ---- save a copy ----
  await p.goto(`${BASE}/e/${c.code}/admin?k=${c.adminKey}`);
  await p.click('button:has-text("Settings")');
  const [download] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Download the whole auction file")')]);
  const saved = path.join(dl, download.suggestedFilename());
  await download.saveAs(saved);
  t('file name has the auction name, code and date', /^zenobid-keepsake-cup-[A-Z0-9]{6}-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
  const file = JSON.parse(fs.readFileSync(saved, 'utf8'));
  t('downloaded file is a ZenoBid auction file', file.format === 'zenobid-auction' && file.auction.players.length === before.players.length);
  t('success message shown', await p.locator('text=Saved “zenobid-keepsake-cup').count() >= 1);

  // ---- restore on the create screen ----
  const q = await ctx.newPage();
  q.on('dialog', (d) => d.accept());
  await q.goto(BASE + '/new');
  await q.setInputFiles('input[type=file]', saved);
  await q.waitForURL(/\/e\/[A-Z0-9]{6}\/admin\?k=/);
  const rcode = new URL(q.url()).pathname.split('/')[2];
  t('restore opens a new auction', rcode !== c.code);
  await q.waitForSelector('text=Keepsake Cup');
  const rstate = await api.state(rcode, new URL(q.url()).searchParams.get('k'));
  t('restored auction has the same teams and players', rstate.captains.length === before.captains.length && rstate.players.length === before.players.length);
  t('restore does not touch the original', (await api.state(c.code)).captains.length === before.captains.length);

  // a wrong file gives a clear message, not a crash
  const bad = path.join(dl, 'bad.json'); fs.writeFileSync(bad, '{"hello":1}');
  const q2 = await ctx.newPage(); await q2.goto(BASE + '/new');
  await q2.setInputFiles('input[type=file]', bad);
  await q2.waitForSelector('text=does not look like a ZenoBid auction file');
  t('a wrong file is explained', true);
  const bad2 = path.join(dl, 'bad.txt'); fs.writeFileSync(bad2, 'hello');
  await q2.setInputFiles('input[type=file]', bad2);
  await q2.waitForSelector('text=could not be read');
  t('a non-JSON file is explained', true);

  // ---- delete ----
  await p.click('button:has-text("Delete this auction")');
  const del = p.locator('button:has-text("Delete forever")');
  t('delete is disabled until the name is typed', await del.isDisabled());
  await p.fill('input[aria-label="Type the auction name to confirm"]', 'Keepsake');
  t('a partial name is not enough', await del.isDisabled());
  await p.fill('input[aria-label="Type the auction name to confirm"]', 'keepsake cup');
  t('typing the name (any capitals) enables it', await del.isEnabled());
  await del.click();
  await p.waitForURL(BASE + '/');
  t('after deleting you land on the home page', true);
  t('server forgot it', (await fetch(`${BASE}/api/events/${c.code}/exists`)).status === 404);
  await live.waitForSelector('text=This auction was deleted', { timeout: 8000 });
  t('the big screen says the auction was deleted', true);
  const saved2 = await p.evaluate(() => localStorage.getItem('zeno:events') || '');
  t('the deleted auction is forgotten on this browser', !saved2.includes(c.code) && saved2.includes(rcode), saved2.slice(0, 200));
  t('its stored admin key is wiped too', (await p.evaluate((k) => localStorage.getItem(k), `zeno:key:${c.code}:admin`)) === null);
  t('restored copy still alive', (await fetch(`${BASE}/api/events/${rcode}/exists`)).status === 200);

  await p.screenshot({ path: path.join(__dirname, 'out', 'ui4-home-after-delete.png') });
  await b.close();
  done('Save / restore / delete UI', errors);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
