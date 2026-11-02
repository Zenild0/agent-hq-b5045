// Going live: price, UPI payment request, developer approval / free grant, signed unlock on restore.
// Needs a server started with a developer key:   DEV_KEY=qa-developer-key-1234 npm start   and the same value here.
const BASE = process.env.BASE || 'http://localhost:8787';
const DEV = process.env.DEV_KEY || 'qa-developer-key-1234';
const WebSocket = require('ws');
let pass = 0; const fails = [];
const t = (name, cond, extra = '') => { if (cond) pass++; else { fails.push(name); console.log('FAIL', name, extra); } };
const j = (path, init = {}) => fetch(BASE + path, init).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
const post = (path, body, headers = {}) => j(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body ?? {}) });
const dev = (path, method = 'GET', body) => j('/api/dev' + path, { method, headers: { 'x-dev-key': DEV, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

(async () => {
  let r = await j('/api/dev/overview', { headers: { 'x-dev-key': DEV } });
  if (r.status === 404) { console.log('SKIPPED: the server has no DEV_KEY (start it with DEV_KEY=... to run these checks)'); process.exit(0); }
  t('developer overview opens with the right key', r.status === 200);
  r = await j('/api/dev/overview', { headers: { 'x-dev-key': 'wrong-key' } }); t('wrong developer key → 403', r.status === 403);
  r = await j('/api/dev/overview'); t('no developer key → 403', r.status === 403);
  r = await post('/api/dev/create', {}); t('developer routes need the key (POST)', r.status === 403);

  // an auction made BEFORE any price exists stays free
  const early = (await post('/api/events', { settings: { name: 'Early', drawMode: 'manual' } })).body;
  const ecmd = (a, p, k = early.adminKey) => post(`/api/events/${early.code}/cmd`, { action: a, params: p }, { 'x-key': k });
  await ecmd('demo.load', {});

  // ---- settings ----
  r = await dev('/config', 'PUT', { price: 499, upiId: 'no good' }); t('a bad UPI id is refused', r.status === 400, JSON.stringify(r.body));
  r = await dev('/config', 'PUT', { price: -5, upiId: 'qa@okaxis' }); t('a negative price is refused', r.status === 400);
  r = await dev('/config', 'PUT', { price: 499, upiId: 'qa@okaxis', payeeName: 'QA Dev', note: 'Thanks', operatorName: 'QA Operator', contact: 'qa@example.com' }); t('valid payment settings are saved', r.status === 200);
  r = await j('/api/platform'); t('public info shows payments on and the price', r.body.payments === true && r.body.price === 499 && r.body.operatorName === 'QA Operator');
  t('public info never shows the UPI id', !JSON.stringify(r.body).includes('qa@okaxis'));
  t('public info lists the limits', r.body.limits.teams === 32 && r.body.limits.players === 500 && r.body.limits.photoBytes === 1048576);
  r = await ecmd('pick', { playerId: (await j(`/api/events/${early.code}/state`)).body.players[0].id }, early.hostKey); t('an auction made before the price keeps going live for free', r.status === 200, JSON.stringify(r.body));

  // ---- a new auction is locked ----
  const a = (await post('/api/events', { settings: { name: 'Paid Cup', drawMode: 'manual' } })).body;
  const cmd = (act, p, k = a.adminKey) => post(`/api/events/${a.code}/cmd`, { action: act, params: p }, { 'x-key': k });
  await cmd('demo.load', {});
  let st = (await j(`/api/events/${a.code}/state?key=${a.adminKey}`)).body;
  t('new auction is locked at the current price', st.unlock.status === 'locked' && st.unlock.price === 499, JSON.stringify(st.unlock));
  t('admin is told where to pay', st.unlock.payee && st.unlock.payee.upiId === 'qa@okaxis');
  const view = (await j(`/api/events/${a.code}/state`)).body;
  t('viewers see the status but never the UPI id', view.unlock.status === 'locked' && !view.unlock.payee && !JSON.stringify(view).includes('qa@okaxis'));
  const hostView = (await j(`/api/events/${a.code}/state?key=${a.hostKey}`)).body;
  t('the auctioneer sees the status but not the payee', hostView.unlock.status === 'locked' && !hostView.unlock.payee);
  const pid = st.players[0].id;
  r = await cmd('pick', { playerId: pid }, a.hostKey); t('picking a player while locked → 402', r.status === 402 && /not unlocked/.test(r.body.error), JSON.stringify(r));
  r = await cmd('draw', {}, a.hostKey); t('spinning the wheel while locked → 402', r.status === 402);
  r = await cmd('player.add', { name: 'Extra' }); t('set-up still works while locked', r.status === 200);
  r = await cmd('practice.start', {}); t('practice can be started while locked', r.status === 200, JSON.stringify(r.body));
  st = (await j(`/api/events/${a.code}/state?key=${a.adminKey}`)).body;
  r = await cmd('pick', { playerId: st.players[0].id }, a.hostKey); t('a practice auction can go live for free', r.status === 200, JSON.stringify(r.body));
  r = await cmd('practice.end', {}); t('practice ends', r.status === 200);

  // ---- asking to unlock ----
  const un = (k, body) => post(`/api/events/${a.code}/unlock/request`, body, k ? { 'x-key': k } : {});
  r = await un(null, { ref: 'ABC123456789' }); t('only the admin can say they paid (no key)', r.status === 403);
  r = await un(a.hostKey, { ref: 'ABC123456789' }); t('only the admin can say they paid (host key)', r.status === 403);
  r = await un(a.adminKey, { ref: 'x' }); t('a too-short reference is refused', r.status === 400);
  r = await un(a.adminKey, { ref: '<script>alert(1)</script>' }); t('a reference with symbols is refused', r.status === 400);
  const wsMsgs = []; const ws = new WebSocket(`ws://localhost:8787/api/events/${a.code}/ws?key=${a.adminKey}`); ws.on('message', m => wsMsgs.push(JSON.parse(m)));
  await new Promise(res => ws.on('open', res)); await new Promise(res => setTimeout(res, 300));
  r = await un(a.adminKey, { ref: 'UTR123456789', payer: 'Asha' }); t('the admin can send a payment reference', r.status === 200, JSON.stringify(r.body));
  st = (await j(`/api/events/${a.code}/state?key=${a.adminKey}`)).body;
  t('status becomes pending and shows the reference to the admin', st.unlock.status === 'pending' && st.unlock.ref === 'UTR123456789');
  r = await cmd('pick', { playerId: pid }, a.hostKey); t('pending does not unlock', r.status === 402);
  await new Promise(res => setTimeout(res, 300));
  t('the admin screen is told straight away (live)', wsMsgs.some(m => m.unlock && m.unlock.status === 'pending'));
  r = await dev('/overview'); const row = r.body.auctions.find(x => x.code === a.code);
  t('the developer sees it waiting, with the reference', row && row.status === 'pending' && row.ref === 'UTR123456789' && row.payer === 'Asha', JSON.stringify(row));

  // ---- approve ----
  r = await dev(`/auctions/${a.code}/approve`, 'POST', {}); t('the developer approves', r.status === 200);
  await new Promise(res => setTimeout(res, 400));
  t('the admin screen unlocks by itself (live)', wsMsgs.some(m => m.unlock && m.unlock.status === 'unlocked'));
  r = await cmd('pick', { playerId: pid }, a.hostKey); t('after approval the auction can go live', r.status === 200, JSON.stringify(r));
  r = await dev(`/auctions/${a.code}/approve`, 'POST', {}); t('approving twice is refused', r.status === 400);
  r = await un(a.adminKey, { ref: 'UTR999999999' }); t('an unlocked auction cannot be paid for again', r.status === 400);

  // ---- save to file / restore keeps the unlock ----
  const file = (await j(`/api/events/${a.code}/export`, { headers: { 'x-key': a.adminKey } })).body;
  t('the saved file carries a signed unlock', file.auction.unlock && file.auction.unlock.by === 'payment' && /^[0-9a-f]{64}$/.test(file.auction.unlock.proof));
  t('the saved file never contains the developer key', !JSON.stringify(file).includes(DEV));
  r = await post('/api/events/restore', file); t('restoring a paid auction keeps it unlocked', r.status === 201);
  let rs = (await j(`/api/events/${r.body.code}/state?key=${r.body.adminKey}`)).body; t('…and it is unlocked', rs.unlock.status === 'unlocked' && rs.unlock.by === 'payment');
  const forged = JSON.parse(JSON.stringify(file)); forged.auction.unlock.proof = 'f'.repeat(64);
  r = await post('/api/events/restore', forged); rs = (await j(`/api/events/${r.body.code}/state?key=${r.body.adminKey}`)).body; t('a forged unlock is ignored (locked again)', rs.unlock.status === 'locked');
  const fake = JSON.parse(JSON.stringify(file)); delete fake.auction.unlock; fake.auction.unlock = { by: 'grant', proof: '0'.repeat(64) };
  r = await post('/api/events/restore', fake); rs = (await j(`/api/events/${r.body.code}/state?key=${r.body.adminKey}`)).body; t('an unlock written by hand is ignored', rs.unlock.status === 'locked');

  // ---- reject / grant / lock / delete ----
  const b = (await post('/api/events', { settings: { name: 'Second' } })).body;
  await post(`/api/events/${b.code}/unlock/request`, { ref: 'NOTPAID12345' }, { 'x-key': b.adminKey });
  r = await dev(`/auctions/${b.code}/reject`, 'POST', {}); st = (await j(`/api/events/${b.code}/state?key=${b.adminKey}`)).body; t('a payment that was not received goes back to locked', r.status === 200 && st.unlock.status === 'locked' && !st.unlock.ref);
  r = await dev(`/auctions/${b.code}/grant`, 'POST', {}); st = (await j(`/api/events/${b.code}/state?key=${b.adminKey}`)).body; t('the developer can grant free access', r.status === 200 && st.unlock.status === 'unlocked' && st.unlock.by === 'grant');
  r = await dev(`/auctions/${b.code}/lock`, 'POST', {}); st = (await j(`/api/events/${b.code}/state?key=${b.adminKey}`)).body; t('…and take it back', st.unlock.status === 'locked');
  r = await dev(`/auctions/${b.code}/nonsense`, 'POST', {}); t('an unknown developer action → 404', r.status === 404);
  r = await dev(`/auctions/NOPE00/grant`, 'POST', {}); t('an unknown auction → 404', r.status === 404);
  r = await dev('/create', 'POST', { settings: { name: 'Gift' } }); t('the developer can create a free unlocked auction to hand over', r.status === 201 && r.body.adminKey, JSON.stringify(r.body));
  st = (await j(`/api/events/${r.body.code}/state?key=${r.body.adminKey}`)).body; t('…which is unlocked by grant', st.unlock.status === 'unlocked' && st.unlock.by === 'grant');
  const giftCode = r.body.code;
  r = await dev(`/auctions/${giftCode}/delete`, 'POST', {}); t('the developer can delete any auction', r.status === 200 && (await j(`/api/events/${giftCode}/exists`)).status === 404);

  // ---- the admin cannot unlock themselves ----
  const c = (await post('/api/events', { settings: { name: 'Sneaky' } })).body;
  r = await post(`/api/events/${c.code}/cmd`, { action: 'unlock', params: {} }, { 'x-key': c.adminKey }); t('there is no way to unlock through normal commands', r.status === 404);
  r = await post(`/api/events/${c.code}/cmd`, { action: 'settings.update', params: { patch: { unlock: { status: 'unlocked' } } } }, { 'x-key': c.adminKey }); st = (await j(`/api/events/${c.code}/state?key=${c.adminKey}`)).body; t('settings cannot be used to unlock', st.unlock.status === 'locked');
  r = await j(`/api/dev/auctions/${c.code}/grant`, { method: 'POST', headers: { 'x-key': c.adminKey, 'content-type': 'application/json' }, body: '{}' }); t('an admin key is not a developer key', r.status === 403);

  // ---- price back to 0: waiting auctions open up; paid ones stay ----
  r = await dev('/config', 'PUT', { price: 0, upiId: '' }); t('price 0 is accepted', r.status === 200);
  st = (await j(`/api/events/${c.code}/state?key=${c.adminKey}`)).body; t('a locked auction becomes free when payments are switched off', st.unlock.status === 'free');
  st = (await j(`/api/events/${a.code}/state?key=${a.adminKey}`)).body; t('a paid auction stays unlocked', st.unlock.status === 'unlocked');
  r = await j('/api/platform'); t('public info: payments off', r.body.payments === false && r.body.price === 0);
  const d2 = (await post('/api/events', { settings: { name: 'Free again' } })).body; st = (await j(`/api/events/${d2.code}/state?key=${d2.adminKey}`)).body; t('new auctions are free again', st.unlock.status === 'free');

  // ---- guessing the developer key is throttled ----
  let limited = 0; for (let i = 0; i < 30; i++) { const x = await j('/api/dev/overview', { headers: { 'x-dev-key': 'guess-' + i } }); if (x.status === 429) limited++; }
  t('guessing the developer key gets throttled', limited > 0, String(limited));
  ws.close();

  console.log(`\nPayments QA: ${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
