// "Say it to bid" on the captain's phone. The browser's speech recognition is replaced by a stand-in the test can
// "speak" into, so no microphone is needed.
const L = require('./lib.cjs'); const { chromium, BASE, sleep, t, api, done } = L;
const errors = [];

(async () => {
  const b = await chromium.launch();
  const c = await api.create({ name: 'Voice Bid Cup', drawMode: 'manual' });
  await api.cmd(c.code, c.adminKey, 'demo.load');
  const st = await api.state(c.code, c.adminKey);
  const [A, B] = st.captains;
  const tokA = st.secrets.captainTokens[A.id], tokB = st.secrets.captainTokens[B.id];
  const host = (a, p = {}) => api.cmd(c.code, c.hostKey, a, p);
  const top = async () => { const s = await api.state(c.code); const x = s.live.bids[s.live.bids.length - 1]; return x ? { team: x.captainId, amount: x.amount, n: s.live.bids.length } : { n: 0 }; };

  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, hasTouch: true });
  await ctx.addInitScript(() => {
    window.__recs = [];
    class FakeRec { constructor() { window.__recs.push(this); } start() { window.__live = this; } abort() { this.aborted = true; } stop() {} }
    for (const k of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, k, { value: FakeRec, configurable: true, writable: true });
    window.__say = (...alts) => {
      const r = alts.map((a) => ({ transcript: a })); r.isFinal = true;
      window.__live.onresult({ resultIndex: 0, results: [r] });
    };
  });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${BASE}/e/${c.code}/captain?k=${tokA}`); await p.waitForSelector('text=Use voice');
  t('the captain sees a "Use voice" button', await p.locator('button:has-text("Use voice")').count() === 1);
  await p.click('button:has-text("Use voice")'); await sleep(200);
  t('the mic switches on', await p.getAttribute('[data-testid="voice-toggle"]', 'aria-pressed') === 'true');
  const note = () => p.locator('[data-testid="voice-note"]').innerText().catch(() => '');
  const say = async (...alts) => { await p.evaluate((a) => window.__say(...a), alts); await sleep(700); };

  // nothing on the block yet
  await say('raise');
  t('no bid while bidding is closed', (await top()).n === 0 && /not open/i.test(await note()), await note());

  await host('pick', { playerId: st.players[0].id }); await sleep(500);
  await say('raise');
  let tp = await top();
  t('"raise" places the next bid', tp.n === 1 && tp.team === A.id, JSON.stringify(tp));
  t('…and says so on the phone', /raise.*bid/i.test(await note()), await note());
  await say('raise'); await sleep(200);
  t('no bid on top of your own', (await top()).n === 1);

  // the other team bids; chatter is ignored
  await fetch(`${BASE}/api/events/${c.code}/cmd`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-key': tokB }, body: JSON.stringify({ action: 'bid', params: {} }) });
  await sleep(2700); // past the cool-down
  await say('what do you guys think about this player');
  t('talk is ignored', (await top()).n === 2);
  const want = (await top()).amount + 1_000_000;
  const words = `${want / 100_000} lakh`;
  await say(words);
  tp = await top();
  t(`an amount ("${words}") is bid exactly`, tp.n === 3 && tp.team === A.id && tp.amount === want, JSON.stringify(tp));

  // a huge jump asks for a tap first
  await fetch(`${BASE}/api/events/${c.code}/cmd`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-key': tokB }, body: JSON.stringify({ action: 'bid', params: {} }) });
  await sleep(2700);
  await say('5 crore');
  t('a very big jump is not bid straight away', (await top()).n === 4);
  t('…the captain is asked to confirm it with a tap', await p.locator('button:has-text("Bid ₹5")').count() === 1 || await p.locator('button:has-text("?")').count() >= 1);
  await p.click('button:has-text("No")');
  t('…and "No" cancels it', (await top()).n === 4);

  // the host announces it on the big screen like any bid (it is a normal bid)
  const s = await api.state(c.code);
  t('a voice bid is a normal bid (the big screen announces it)', s.live.lastEvent.type === 'bid');

  await sleep(2700);
  await p.click('[data-testid="voice-toggle"]'); await sleep(300);
  const before = (await top()).n;
  t('the mic switches off', await p.getAttribute('[data-testid="voice-toggle"]', 'aria-pressed') === 'false');
  await say('raise');
  t('with the mic off nothing is heard', (await top()).n === before, JSON.stringify([before, await top(), await note()]));
  await p.screenshot({ path: require('node:path').join(__dirname, 'out', 'voicebid-captain.png') });
  await ctx.close();

  // a browser that cannot turn speech into words: no button at all
  const ctx2 = await b.newContext({ viewport: { width: 400, height: 860 } });
  await ctx2.addInitScript(() => { for (const k of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, k, { value: undefined, configurable: true, writable: true }); });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/e/${c.code}/captain?k=${tokB}`); await p2.waitForSelector('text=BID').catch(() => {});
  await sleep(500);
  t('no mic button where the browser cannot listen', await p2.locator('button:has-text("Use voice")').count() === 0);
  await ctx2.close();
  await b.close();
  done('Say it to bid', errors);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
