const BASE = 'http://localhost:8787';
const WebSocket = require('ws');
let pass = 0; const fails = [];
const t = (name, cond, extra = '') => { if (cond) pass++; else { fails.push(name + (extra ? ' — ' + extra : '')); console.log('FAIL', name, extra); } };
const j = (path, init) => fetch(BASE + path, init).then(async r => ({ status: r.status, body: await r.json().catch(() => null), ct: r.headers.get('content-type') }));
const post = (path, body, headers = {}) => j(path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

(async () => {
  // ---- create ----
  let r = await post('/api/events', { settings: { name: 'QA', drawMode: 'manual' } });
  t('create returns 201 with keys', r.status === 201 && r.body.code && r.body.adminKey && r.body.hostKey);
  const { code, adminKey, hostKey } = r.body;
  const cmd = (key, action, params) => post(`/api/events/${code}/cmd`, { action, params }, key ? { 'x-key': key } : {});
  await cmd(adminKey, 'demo.load');
  const st = (await j(`/api/events/${code}/state?key=${adminKey}`)).body;
  const tok = st.captains.map(c => st.secrets.captainTokens[c.id]);

  r = await post('/api/events', '{not json');           t('invalid JSON → 400 JSON error (not 500/HTML)', r.status === 400 && r.body && r.body.ok === false, JSON.stringify([r.status, r.ct]));
  r = await post('/api/events', '');                    t('empty body creates with defaults', r.status === 201);
  r = await post('/api/events', { settings: 'junk' });  t('non-object settings tolerated', r.status === 201);
  r = await post('/api/events', { settings: { name: 'x'.repeat(5000), increments: 'bad', defaultBudget: -5, accent: 'javascript:alert(1)', display: 7, __proto__: { polluted: 1 }, constructor: { prototype: { polluted: 1 } } } });
  t('hostile settings accepted safely', r.status === 201 || r.status === 400, String(r.status));
  t('prototype not polluted', ({}).polluted === undefined);
  if (r.body?.code) { const s = (await j(`/api/events/${r.body.code}/state`)).body; t('name truncated to 80', s.settings.name.length <= 80); t('bad accent rejected', /^#[0-9a-f]{6}$/i.test(s.settings.accent)); t('negative budget rejected', s.settings.defaultBudget > 0); }
  r = await post('/api/events', 'x'.repeat(1_200_000)); t('body over 1 MB → 413', r.status === 413 || r.status === 400, String(r.status));

  // ---- lookup ----
  r = await j('/api/events/NOPE00/exists');                t('unknown code → 404', r.status === 404 && r.body.ok === false);
  r = await j(`/api/events/${code.toLowerCase()}/exists`); t('code is case-insensitive', r.status === 200);
  r = await j('/api/events/%00%00/state');                 t('weird code → 404 not crash', r.status === 404);
  r = await j('/api/events/..%2f..%2fetc%2fpasswd/state'); t('path-ish code → 404', r.status === 404 || r.status === 400, String(r.status));

  // ---- auth ----
  r = await cmd(null, 'player.add', { name: 'x' });        t('no key → 403', r.status === 403, String(r.status));
  r = await cmd('wrong', 'player.add', { name: 'x' });     t('wrong key → 403', r.status === 403);
  r = await cmd(hostKey, 'player.add', { name: 'x' });     t('host cannot admin → 403', r.status === 403);
  r = await cmd(tok[0], 'draw', {});                       t('captain cannot run auction → 403', r.status === 403);
  r = await cmd(tok[0].toLowerCase(), 'strategy.add', { playerId: st.players[0].id }); t('captain PIN is case-insensitive', r.status === 200, JSON.stringify(r.body));
  r = await post(`/api/events/${code}/cmd`, { action: 'player.add', params: { name: 'KeyInBody' }, key: adminKey }); t('admin key in body accepted', r.status === 200);
  r = await cmd(adminKey, 'nope.nope', {});                t('unknown action → 404', r.status === 404);
  r = await post(`/api/events/${code}/cmd`, { action: 123 }, { 'x-key': adminKey }); t('non-string action → error not crash', r.status >= 400 && r.status < 500, String(r.status));
  r = await post(`/api/events/${code}/cmd`, [], { 'x-key': adminKey });              t('array body → error not crash', r.status >= 400 && r.status < 500, String(r.status));
  r = await post(`/api/events/${code}/cmd`, { action: '__proto__' }, { 'x-key': adminKey }); t('__proto__ action → 404', r.status === 404, String(r.status));
  r = await post(`/api/events/${code}/cmd`, { action: 'constructor' }, { 'x-key': adminKey }); t('constructor action → 404', r.status === 404, String(r.status));
  r = await post(`/api/events/${code}/cmd`, { action: 'toString' }, { 'x-key': adminKey }); t('toString action → 404', r.status === 404, String(r.status));
  r = await cmd(adminKey, 'player.add', { name: '<img src=x onerror=alert(1)>', description: '<script>alert(1)</script>' }); t('html in names accepted as plain text', r.status === 200);

  // ---- secrets never leak ----
  const viewer = (await j(`/api/events/${code}/state`)).body;
  const cap0 = (await j(`/api/events/${code}/state?key=${tok[0]}`)).body;
  const cap1 = (await j(`/api/events/${code}/state?key=${tok[1]}`)).body;
  const hostS = (await j(`/api/events/${code}/state?key=${hostKey}`)).body;
  t('viewer: no secrets, no strategy', viewer.secrets === undefined && viewer.strategy === undefined && viewer.me.role === 'viewer');
  t('captain: no secrets', cap0.secrets === undefined && cap0.me.role === 'captain');
  t('captain sees own plan only', cap0.strategy.length === 1 && cap1.strategy.length === 0);
  t('host: no admin secrets', hostS.secrets === undefined);
  t('no key/token string appears in a viewer payload', !JSON.stringify(viewer).includes(adminKey) && !JSON.stringify(viewer).includes(hostKey) && tok.every(x => !JSON.stringify(viewer).includes(x)));
  t('no key/token string appears in a captain payload', !JSON.stringify(cap1).includes(adminKey) && !JSON.stringify(cap1).includes(hostKey) && tok.every(x => !JSON.stringify(cap1).includes(x)));

  // ---- uploads ----
  const up = (key, ct, body) => fetch(`${BASE}/api/events/${code}/upload`, { method: 'POST', headers: { 'content-type': ct, ...(key ? { 'x-key': key } : {}) }, body }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=', 'base64');
  r = await up(null, 'image/jpeg', jpeg);                  t('upload without key → 403', r.status === 403);
  r = await up(hostKey, 'image/jpeg', jpeg);               t('upload by host → 403', r.status === 403);
  r = await up(adminKey, 'image/svg+xml', '<svg onload=alert(1)/>'); t('SVG upload rejected', r.status === 400, String(r.status));
  r = await up(adminKey, 'text/html', '<script>1</script>'); t('HTML upload rejected', r.status === 400, String(r.status));
  r = await up(adminKey, 'image/jpeg', Buffer.alloc(0));   t('empty upload rejected', r.status === 400, String(r.status));
  r = await up(adminKey, 'image/jpeg', Buffer.alloc(2_200_000)); t('2.2 MB upload → 413', r.status === 413, String(r.status));
  r = await up(adminKey, 'image/jpeg', jpeg);              t('valid jpeg → 201', r.status === 201 && /^\/uploads\//.test(r.body.url), JSON.stringify(r.body));
  if (r.body?.url) { const img = await fetch(BASE + r.body.url); t('uploaded file served as image', img.status === 200 && /image\/jpeg/.test(img.headers.get('content-type'))); }
  // path traversal must never expose the event files (which contain the admin key)
  for (const p of [`/uploads/../events/${code}.json`, `/uploads/%2e%2e/events/${code}.json`, `/uploads/..%2fevents%2f${code}.json`, `/uploads/${code}/..%2f..%2fevents%2f${code}.json`, `/uploads/%2e%2e%2fevents%2f${code}.json`]) {
    const res = await fetch(BASE + p); const txt = await res.text();
    t('traversal blocked: ' + p, !txt.includes(adminKey), `status ${res.status}`);
  }
  for (const p of [`/events/${code}.json`, `/data/events/${code}.json`, '/package.json', '/server/index.ts', '/.env']) {
    const res = await fetch(BASE + p); const txt = await res.text(); t('no source/data served: ' + p, !txt.includes(adminKey) && !txt.includes('"dependencies"') && !txt.includes('express'), `status ${res.status}`);
  }

  // ---- websocket ----
  const wsOpen = (path) => new Promise((resolve) => { const w = new WebSocket('ws://localhost:8787' + path); const out = { msgs: [] }; w.on('message', m => out.msgs.push(JSON.parse(m))); w.on('open', () => setTimeout(() => resolve({ w, ...out, opened: true }), 300)); w.on('error', e => resolve({ error: String(e.message), opened: false })); w.on('unexpected-response', (_q, res) => resolve({ status: res.statusCode, opened: false })); });
  let w = await wsOpen('/api/events/NOPE00/ws');   t('WS to unknown auction refused (404)', !w.opened && w.status === 404, JSON.stringify(w));
  w = await wsOpen(`/api/events/${code}/ws`);      t('WS viewer gets a snapshot without secrets', w.opened && w.msgs[0]?.me.role === 'viewer' && w.msgs[0].secrets === undefined);
  w.w.close();
  w = await wsOpen(`/api/events/${code}/ws?key=${adminKey}`); t('WS admin gets secrets', w.opened && !!w.msgs[0]?.secrets); w.w.close();
  w = await wsOpen(`/api/events/${code}/ws?key=${tok[1]}`);   t('WS captain gets own (empty) plan, no secrets', w.opened && w.msgs[0].me.role === 'captain' && w.msgs[0].strategy.length === 0 && !w.msgs[0].secrets);
  // live push: a bid by someone else arrives on this socket
  await cmd(hostKey, 'pick', { playerId: st.players[0].id });
  await new Promise(r => setTimeout(r, 200));
  await cmd(tok[0], 'bid', {});
  await new Promise(r => setTimeout(r, 300));
  const last = w.msgs[w.msgs.length - 1];
  t('WS receives live bid updates', last.live.bids.length === 1 && last.live.phase === 'bidding');
  w.w.send('x'.repeat(5000)); await new Promise(r => setTimeout(r, 300));
  t('oversize WS frame closes the socket (no memory abuse)', w.w.readyState !== WebSocket.OPEN);
  const pres = (await j(`/api/events/${code}/state`)).body.presence;
  t('presence drops after disconnect', pres.viewers === 0, JSON.stringify(pres));

  // ---- race: two captains click the same bid at the same instant ----
  await cmd(hostKey, 'undoBid');
  const nextMin = (await j(`/api/events/${code}/state`)).body.live.bids.length ? null : 2_000_000;
  const [a, b2] = await Promise.all([cmd(tok[0], 'bid', { amount: nextMin }), cmd(tok[1], 'bid', { amount: nextMin })]);
  t('simultaneous identical bids: exactly one wins', [a.status, b2.status].sort().join() === '200,400', `${a.status},${b2.status}`);
  const after = (await j(`/api/events/${code}/state`)).body;
  t('only one bid recorded', after.live.bids.length === 1);
  // 40 parallel bids from 4 captains must keep the ladder consistent
  const amounts = []; for (let i = 0; i < 40; i++) amounts.push(cmd(tok[i % 4], 'bid', {}));
  await Promise.all(amounts);
  const fin = (await j(`/api/events/${code}/state`)).body.live.bids;
  t('parallel storm keeps strictly increasing, alternating bids', fin.every((b, i) => i === 0 || (b.amount > fin[i - 1].amount && b.captainId !== fin[i - 1].captainId)), `${fin.length} bids`);

  // ---- brute-force protection: wrong keys are throttled, valid keys never are ----
  let limited = 0, firstLimitedAt = -1;
  for (let i = 0; i < 140; i++) { const q = await cmd('GUESS' + String(i).padStart(2, '0'), 'bid', {}); if (q.status === 429) { limited++; if (firstLimitedAt < 0) firstLimitedAt = i; } }
  t('wrong keys are throttled after ~120 tries', limited > 0 && firstLimitedAt >= 100, `limited=${limited} first=${firstLimitedAt}`);
  r = await cmd(adminKey, 'player.add', { name: 'still works' }); t('valid admin key unaffected while throttled', r.status === 200, String(r.status));
  r = await cmd(tok[0], 'strategy.add', { playerId: st.players[1].id }); t('valid captain PIN unaffected while throttled', r.status === 200 || r.status === 400, String(r.status));
  r = await j(`/api/events/${code}/state?key=${adminKey}`); t('valid key can read state while throttled', r.status === 200);
  r = await j(`/api/events/${code}/state?key=WRONG1`); t('another wrong key is refused with 429', r.status === 429, String(r.status));
  r = await j(`/api/events/${code}/state`); t('no key at all (viewer) is never throttled', r.status === 200);
  const wsT = await wsOpen(`/api/events/${code}/ws?key=BADBAD`); t('WS with a wrong key is refused while throttled', !wsT.opened && wsT.status === 429, JSON.stringify(wsT));

  console.log(`\nAPI QA: ${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
