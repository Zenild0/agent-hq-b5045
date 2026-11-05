// Studio announcer voices made by the server. Needs the server started with TTS_PROVIDER=mock (a built-in test
// voice that makes a short tone, so no Google key and no network are needed):
//   TTS_PROVIDER=mock npm start
// Checks the two voice links, their limits, and that screens play the server's recording (and fall back to the
// device's own voice when the server cannot make one).
const L = require('./lib.cjs'); const { chromium, BASE, sleep, t, api, done } = L;
const errors = [];
const VOICES = [{ name: 'Microsoft Kalpana', lang: 'hi-IN' }, { name: 'Microsoft Ravi', lang: 'en-IN' }, { name: 'Microsoft Heera', lang: 'en-IN' }];

async function screen(browser, style, code, { failVoice = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 } });
  await ctx.addInitScript(([style, voices]) => {
    localStorage.setItem('zeno:sound', JSON.stringify({ sfx: false, voice: true, style }));
    window.__said = []; window.__played = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer && this.buffer.duration > 0.2) window.__played++; return start.apply(this, a); };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(text) { this.text = text; } }, configurable: true });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => voices, cancel() {}, addEventListener() {}, speak(u) { window.__said.push({ text: u.text, lang: u.lang, pitch: u.pitch, voice: u.voice && u.voice.name }); } } });
  }, [style, VOICES]);
  if (failVoice) await ctx.route('**/voice/**', (r) => r.fulfill({ status: 503, body: '{}' }));
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(`${style}: ${e.message}`));
  const asked = []; p.on('request', (r) => { if (/\/voice(-sample)?\//.test(r.url())) asked.push(r.url()); });
  await p.goto(`${BASE}/e/${code}/live`); await p.waitForSelector('text=Join code'); await sleep(500);
  return { ctx, p, asked, said: () => p.evaluate(() => window.__said), played: () => p.evaluate(() => window.__played) };
}

(async () => {
  const plat = await (await fetch(`${BASE}/api/platform`)).json();
  if (!plat.voice) { console.log('Start the server with TTS_PROVIDER=mock to run this suite.'); process.exit(1); }
  t('the server says it has studio voices', plat.voice === true);

  // the "Hear it" sample
  for (const style of ['wwe', 'kbc', 'mk']) {
    const r = await fetch(`${BASE}/api/voice-sample/${style}`);
    const buf = Buffer.from(await r.arrayBuffer());
    t(`sample ${style}: a recording comes back`, r.status === 200 && /audio\//.test(r.headers.get('content-type')) && buf.subarray(0, 4).toString() === 'RIFF', `${r.status}`);
    t(`sample ${style}: screens may keep it for a day`, /max-age=86400/.test(r.headers.get('cache-control') || ''));
  }
  t('no studio voice for the classic style', (await fetch(`${BASE}/api/voice-sample/classic`)).status === 400);
  t('an unknown style is refused', (await fetch(`${BASE}/api/voice-sample/..%2f..%2fetc`)).status === 400);

  // the live moment
  const c = await api.create({ name: 'Studio Cup', drawMode: 'manual' });
  await api.cmd(c.code, c.adminKey, 'demo.load');
  const st = await api.state(c.code, c.adminKey);
  const team = st.captains[0], tok = st.secrets.captainTokens[team.id];
  const bid = (amount) => fetch(`${BASE}/api/events/${c.code}/cmd`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-key': tok }, body: JSON.stringify({ action: 'bid', params: amount ? { amount } : {} }) }).then((r) => r.json());
  const host = (a, p = {}) => api.cmd(c.code, c.hostKey, a, p);
  await host('pick', { playerId: st.players[0].id });
  await bid();
  const seq = (await api.state(c.code)).live.lastEvent.seq;
  const v = (s, style = 'wwe', code = c.code) => fetch(`${BASE}/api/events/${code}/voice/${s}?style=${style}`);
  let r = await v(seq);
  t('the latest bid can be heard', r.status === 200 && /audio\//.test(r.headers.get('content-type')));
  t('…in every style', (await v(seq, 'kbc')).status === 200 && (await v(seq, 'mk')).status === 200);
  t('an older moment is not made any more', (await v(seq - 1)).status === 404);
  t('a style is required', (await fetch(`${BASE}/api/events/${c.code}/voice/${seq}`)).status === 400);
  t('an unknown auction is refused', (await v(seq, 'wwe', 'ZZZZZZ')).status === 404);
  t('a moment that is not a number is refused', (await v('abc')).status === 404);
  await host('call'); const callSeq = (await api.state(c.code)).live.lastEvent.seq;
  t('"going once" can be heard', (await v(callSeq, 'mk')).status === 200);
  t('…and the bid before it is now gone', (await v(seq)).status === 404);

  const b = await chromium.launch();
  // a big screen with the WWE style: the server's recording plays, the device's own voice stays quiet
  await host('sold'); await host('next'); await host('pick', { playerId: st.players[1].id }); await sleep(300);
  const s = await screen(b, 'wwe', c.code);
  await bid(); await sleep(1500);
  t('the screen asks the server for the bid it just saw', s.asked.some((u) => /\/voice\/\d+\?style=wwe$/.test(u)), JSON.stringify(s.asked));
  t('…and plays it', (await s.played()) >= 1);
  t('…without also using the device voice', (await s.said()).length === 0, JSON.stringify(await s.said()));
  t('"Hear it" is offered', await s.p.locator('button:has-text("Hear it")').count() === 1);
  {
    const before = await s.played(); await s.p.click('button:has-text("Hear it")'); await sleep(1500);
    t('"Hear it" plays the studio sample', (await s.played()) > before && s.asked.some((u) => /voice-sample\/wwe$/.test(u)), JSON.stringify(s.asked));
  }
  await s.ctx.close();

  // the server cannot make a voice (no key / budget used / Google down): the device voice takes over
  const f = await screen(b, 'kbc', c.code, { failVoice: true });
  await host('call'); await sleep(1500);
  const said = await f.said();
  t('when the server has no recording, the device voice speaks instead', said.length === 1, JSON.stringify(said));
  // this device has only a female Hindi voice: a male Indian-English voice reads the Hindi words in Latin letters
  t('…a male host is never read by a female voice pushed deep', said[0] && said[0].voice === 'Microsoft Ravi' && !/[ऀ-ॿ]/.test(said[0].text), JSON.stringify(said));
  await f.ctx.close();

  // the host runs every part of the auction: take-backs, breaks, new rounds
  for (const style of ['show', 'velvet', 'trailer', 'cricket', 'assistant']) t(`sample ${style}: a recording comes back`, (await fetch(`${BASE}/api/voice-sample/${style}`)).status === 200);
  await host('sold'); await host('next'); await host('pick', { playerId: st.players[2].id }); await bid(); await host('undoBid');
  const undoSeq = (await api.state(c.code)).live.lastEvent;
  t('a take-back can be heard', undoSeq.type === 'undo' && (await v(undoSeq.seq, 'show')).status === 200, JSON.stringify(undoSeq));
  await host('unsold').catch(() => {}); await host('next').catch(() => {});
  const brk = await host('break.start', { seconds: 120 });
  const brkEv = (await api.state(c.code)).live.lastEvent;
  t('a strategy break can be heard', brkEv && brkEv.type === 'break' && (await v(brkEv.seq, 'cricket')).status === 200, JSON.stringify([brk, brkEv]));
  await host('break.end').catch(() => {});

  // one browser, two pages (the big screen and the admin page): only ONE voice, from the big screen
  {
    const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } });
    await ctx.addInitScript(() => {
      localStorage.setItem('zeno:sound', JSON.stringify({ sfx: true, voice: true, style: 'wwe' }));
      window.__played = 0;
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer && this.buffer.duration > 0.2) window.__played++; return start.apply(this, a); };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() {}, addEventListener() {}, speak() { window.__played += 100; } } });
    });
    const live = await ctx.newPage(); const admin = await ctx.newPage();
    const asks = { live: 0, admin: 0 };
    live.on('request', (r) => { if (/\/voice\//.test(r.url())) asks.live++; });
    admin.on('request', (r) => { if (/\/voice\//.test(r.url())) asks.admin++; });
    await live.goto(`${BASE}/e/${c.code}/live`); await live.waitForSelector('text=Join code');
    await admin.goto(`${BASE}/e/${c.code}/admin?k=${c.adminKey}`); await admin.waitForLoadState('networkidle');
    await sleep(800);
    const s2 = await api.state(c.code, c.adminKey);
    const free = s2.players.find((p) => p.status === 'available');
    await host('pick', { playerId: free.id }); await sleep(1500);
    await bid(); await sleep(1500);
    await host('call'); await sleep(1500);
    const pl = await live.evaluate(() => window.__played), pa = await admin.evaluate(() => window.__played);
    t('two pages in one browser: the big screen speaks every moment', pl >= 3 && asks.live === 3, JSON.stringify({ pl, pa, asks }));
    t('…and the admin page stays quiet (no voices on top of each other)', pa === 0 && asks.admin === 0, JSON.stringify({ pl, pa, asks }));
    await ctx.close();
  }

  // a fast bidding war on one screen: only the newest line is heard, never two at once
  {
    const ctx = await b.newContext();
    await ctx.addInitScript(() => {
      localStorage.setItem('zeno:sound', JSON.stringify({ sfx: false, voice: true, style: 'kbc' }));
      window.__live = 0; window.__maxLive = 0;
      const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
      AudioBufferSourceNode.prototype.start = function (...a) {
        if (this.buffer && this.buffer.duration > 0.2) { window.__live++; window.__maxLive = Math.max(window.__maxLive, window.__live); this.__counted = true; this.addEventListener('ended', () => { if (this.__counted) { this.__counted = false; window.__live--; } }); }
        return start.apply(this, a);
      };
      AudioBufferSourceNode.prototype.stop = function (...a) { if (this.__counted) { this.__counted = false; window.__live--; } return stop.apply(this, a); };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], cancel() {}, addEventListener() {}, speak() {} } });
    });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/e/${c.code}/live`); await p.waitForSelector('text=Join code'); await sleep(500);
    const s3 = await api.state(c.code, c.adminKey);
    const tokB = s3.secrets.captainTokens[s3.captains[1].id];
    const bidAs = (tk, amount) => fetch(`${BASE}/api/events/${c.code}/cmd`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-key': tk }, body: JSON.stringify({ action: 'bid', params: amount ? { amount } : {} }) });
    for (let i = 0; i < 4; i++) { await bidAs(i % 2 ? tok : tokB); await sleep(120); }
    await sleep(2000);
    t('rapid bids never play two voices at the same time', (await p.evaluate(() => window.__maxLive)) === 1, String(await p.evaluate(() => window.__maxLive)));
    await ctx.close();
  }
  await b.close();
  done('Studio voices', errors);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
