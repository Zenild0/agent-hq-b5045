// The announcer styles: what is spoken when a bid is placed, in each style, with and without a Hindi voice on the device.
// The browser's speech is replaced by a recorder so the test can read exactly what would be said.
const L = require('./lib.cjs'); const { chromium, BASE, sleep, t, api, done } = L;
const errors = [];
const VOICES_ALL = [{ name: 'Microsoft Heera', lang: 'en-IN' }, { name: 'Microsoft Ravi', lang: 'en-IN' }, { name: 'Microsoft Zira Desktop', lang: 'en-US' }, { name: 'Microsoft Hemant', lang: 'hi-IN' }];
const VOICES_NO_HINDI = VOICES_ALL.filter(v => v.lang !== 'hi-IN');

async function session(browser, style, voices, code) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 } });
  await ctx.addInitScript(([style, voices]) => {
    localStorage.setItem('zeno:sound', JSON.stringify({ sfx: false, voice: true, style }));
    window.__said = [];
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(text) { this.text = text; } }, configurable: true });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => voices, cancel() {}, addEventListener() {}, speak(u) { window.__said.push({ text: u.text, lang: u.lang, pitch: u.pitch, rate: u.rate, voice: u.voice && u.voice.name }); } } });
  }, [style, voices]);
  // this suite tests the device's own voices: a server with studio voices switched on is told "not now"
  await ctx.route(/\/voice(-sample)?\//, (r) => r.fulfill({ status: 503, body: '{}' }));
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push(`${style}: ${e.message}`));
  await p.goto(`${BASE}/e/${code}/live`); await p.waitForSelector('text=Join code'); await sleep(500);
  return { ctx, p, said: () => p.evaluate(() => window.__said), clear: () => p.evaluate(() => { window.__said = []; }) };
}

(async () => {
  const b = await chromium.launch();
  const c = await api.create({ name: 'Voice Cup', drawMode: 'manual' });
  await api.cmd(c.code, c.adminKey, 'demo.load');
  const st = await api.state(c.code, c.adminKey);
  const team = st.captains[0], tok = st.secrets.captainTokens[team.id];
  const bid = (amount) => fetch(`${BASE}/api/events/${c.code}/cmd`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-key': tok }, body: JSON.stringify({ action: 'bid', params: amount ? { amount } : {} }) }).then(r => r.json());
  const host = (a, p = {}) => api.cmd(c.code, c.hostKey, a, p);
  let n = 0;
  const nextPlayer = async () => { await host('pick', { playerId: st.players[n++].id }); await sleep(250); };

  const expect = {
    classic: { bid: new RegExp(`^${team.team}, 20 lakh`), pitch: undefined },
    wwe: { bid: new RegExp(`${team.team}.*20 lakh`), pitch: 0.8, rate: 1.12, voice: 'Microsoft Ravi', lang: 'en-IN' },
    mk: { bid: new RegExp(`${team.team}.*20 lakh`), pitch: 0.25, rate: 0.78, voice: 'Microsoft Ravi', lang: 'en-IN' },
    kbc: { bid: /बीस लाख रुपये/, pitch: 0.6, rate: 0.82, voice: 'Microsoft Hemant', lang: 'hi-IN' },
  };
  for (const style of ['classic', 'wwe', 'mk', 'kbc']) {
    const s = await session(b, style, VOICES_ALL, c.code);
    await nextPlayer(); await s.clear();
    await bid();           await sleep(500);
    const said = await s.said(); const line = said[said.length - 1] || {};
    t(`${style}: a bid is spoken with the team and the amount`, !!line.text && expect[style].bid.test(line.text) && line.text.includes(team.team), JSON.stringify(said));
    if (style !== 'classic') {
      t(`${style}: the style's own pace and depth are used`, line.pitch === expect[style].pitch && line.rate === expect[style].rate, JSON.stringify(line));
      t(`${style}: the right voice is chosen`, line.voice === expect[style].voice && line.lang === expect[style].lang, JSON.stringify(line));
    } else t('classic: the old voice settings are untouched (no style pitch)', line.pitch !== 0.8 && line.pitch !== 0.25 && line.pitch !== 0.6);
    // the bidding war: each new bid is announced again, with the new amount
    await s.clear(); await bid(3_000_000); await sleep(400); // a captain cannot outbid themself: expect the server to refuse, nothing new said
    t(`${style}: a refused bid is not announced`, (await s.said()).length === 0);
    // going once / twice / thrice and sold
    await s.clear();
    for (let i = 1; i <= 3; i++) { await host('call'); await sleep(300); }
    const calls = await s.said();
    t(`${style}: all three calls are spoken`, calls.length === 3, JSON.stringify(calls.map(x => x.text)));
    if (style === 'mk') t('mk: the last call is "Finish him!"', calls[2].text === 'Finish him!');
    if (style === 'kbc') t('kbc: the calls are in Hindi', /एक बार/.test(calls[0].text) && /तीसरी बार/.test(calls[2].text));
    if (style === 'wwe') t('wwe: the calls are hyped', /Going once/.test(calls[0].text) && /three times/.test(calls[2].text));
    await s.clear(); await host('sold'); await sleep(500);
    const soldLine = (await s.said()).pop() || {};
    t(`${style}: SOLD names the player, the team and the price`, soldLine.text && soldLine.text.includes(st.players[n - 1].name) && soldLine.text.includes(team.team) && (style === 'kbc' ? /बीस लाख/.test(soldLine.text) : /20 lakh/.test(soldLine.text)), soldLine.text);
    await host('next'); await s.ctx.close();
  }

  // a device with no Hindi voice: the same Hindi words, written in Latin letters, read by an Indian-English voice
  const s2 = await session(b, 'kbc', VOICES_NO_HINDI, c.code);
  await nextPlayer(); await s2.clear(); await bid(); await sleep(500);
  const fb = (await s2.said()).pop() || {};
  t('kbc without a Hindi voice: falls back to Latin letters', /bees lakh rupaye/.test(fb.text || '') && !/[ऀ-ॿ]/.test(fb.text || ''), JSON.stringify(fb));
  t('…read by a male Indian-English voice', fb.voice === 'Microsoft Ravi' && fb.lang === 'en-IN', JSON.stringify(fb));
  await s2.ctx.close();
  // no voices at all: nothing breaks
  const s3 = await session(b, 'wwe', [], c.code);
  await s3.clear(); await bid(4_000_000); await sleep(300);
  t('a device with no voices at all does not crash', true);
  await s3.ctx.close();

  // the picker
  const ctx = await b.newContext({ viewport: { width: 1300, height: 800 } });
  await ctx.addInitScript((voices) => { window.__said = []; Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(t) { this.text = t; } }, configurable: true }); Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => voices, cancel() {}, addEventListener() {}, speak(u) { window.__said.push({ text: u.text, pitch: u.pitch, voice: u.voice && u.voice.name }); } } }); }, VOICES_ALL);
  await ctx.route(/\/voice(-sample)?\//, (r) => r.fulfill({ status: 503, body: '{}' }));
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push('picker: ' + e.message));
  await p.goto(`${BASE}/e/${c.code}/live`); await p.waitForSelector('text=Join code');
  t('the style picker is hidden until the announcer is on', await p.locator('select[aria-label="Announcer style"]').count() === 0);
  await p.click('button[title="Announcer voice"]'); await sleep(300);
  const sel = p.locator('select[aria-label="Announcer style"]');
  t('the picker offers all four styles', await sel.count() === 1 && (await sel.locator('option').allInnerTexts()).join('|').match(/Classic.*WWE hype.*KBC host.*Mortal Kombat/) !== null);
  await p.evaluate(() => { window.__said = []; });
  await sel.selectOption('kbc'); await sleep(900);
  const heard = await p.evaluate(() => window.__said);
  t('choosing a style plays a sample bid in that style', heard.length >= 1 && /थंडर|Thunder/.test(heard[heard.length - 1].text) && /बोली|boli|लाख/.test(heard[heard.length - 1].text), JSON.stringify(heard));
  t('the choice is remembered on this device', JSON.parse(await p.evaluate(() => localStorage.getItem('zeno:sound'))).style === 'kbc');
  await p.reload(); await p.waitForSelector('text=Join code');
  t('…after a reload too', await p.locator('select[aria-label="Announcer style"]').inputValue() === 'kbc');
  t('"Hear it" is offered for the fun styles', await p.locator('button:has-text("Hear it")').count() === 1);
  await p.screenshot({ path: require('node:path').join(__dirname, 'out', 'ui6-announcer-picker.png') });
  await b.close();
  done('Announcer styles', errors);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
