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
  r = await up(adminKey, 'image/jpeg', Buffer.alloc(1_100_000)); t('1.1 MB upload → 413 (limit is 1 MB)', r.status === 413, String(r.status));
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

  // ---- save to file / restore / delete ----
  {
    const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const up = await fetch(`${BASE}/api/events/${code}/upload`, { method: 'POST', headers: { 'content-type': 'image/png', 'x-key': adminKey }, body: photo }).then(r => r.json());
    t('photo uploaded for the export test', !!up.url);
    const p0 = st.players[0].id;
    await cmd(adminKey, 'player.update', { id: p0, patch: { photo: up.url } });

    r = await j(`/api/events/${code}/export`);                         t('export without a key → 403', r.status === 403, String(r.status));
    r = await j(`/api/events/${code}/export`, { headers: { 'x-key': hostKey } }); t('export with the host key → 403', r.status === 403);
    r = await j(`/api/events/${code}/export`, { headers: { 'x-key': tok[0] } });  t('export with a captain PIN → 403', r.status === 403);
    r = await j(`/api/events/${code}/export`, { headers: { 'x-key': adminKey } });
    const file = r.body;
    t('export returns the whole auction', r.status === 200 && file.format === 'zenobid-auction' && file.auction.players.length >= st.players.length && file.auction.captains.length === st.captains.length, String(r.status));
    t('export has the photo inside', Object.keys(file.photos).length >= 1 && file.photos[Object.keys(file.photos)[0]].startsWith('data:image/png;base64,'));
    t('export never contains the admin or host key', !JSON.stringify(file).includes(adminKey) && !JSON.stringify(file).includes(hostKey));

    r = await post('/api/events/restore', file);
    t('restore creates a new auction with new keys', r.status === 201 && r.body.code && r.body.code !== code && r.body.adminKey !== adminKey, JSON.stringify(r.body));
    const re = r.body;
    const rs = (await j(`/api/events/${re.code}/state?key=${re.adminKey}`)).body;
    t('restored teams and players match', rs.captains.length === file.auction.captains.length && rs.players.length === file.auction.players.length);
    t('restored captain PINs are unchanged', JSON.stringify(rs.secrets.captainTokens) === JSON.stringify(file.auction.captainPins));
    const rp = rs.players.find(p => p.photo);
    t('restored photo is served from the new auction', !!rp && rp.photo.startsWith(`/uploads/${re.code}/`) && (await fetch(BASE + rp.photo)).status === 200, rp && rp.photo);
    r = await post('/api/events/restore', { hello: 'world' });          t('restore of a non-auction file → 400', r.status === 400 && r.body.ok === false, String(r.status));
    r = await post('/api/events/restore', '{broken');                    t('restore of broken JSON → 400', r.status === 400, String(r.status));
    r = await post('/api/events/restore', { ...file, version: 9 });      t('restore of a newer file → 400', r.status === 400);
    const bigPhotos = { ...file, photos: { 'a.png': 'data:image/png;base64,' + 'A'.repeat(3_000_000) } };
    r = await post('/api/events/restore', bigPhotos);                    t('an oversized photo inside a file is skipped, not fatal', r.status === 201);
    if (r.body?.code) await fetch(`${BASE}/api/events/${r.body.code}`, { method: 'DELETE', headers: { 'x-key': r.body.adminKey } });

    // delete
    const ws2 = await wsOpen(`/api/events/${re.code}/ws?key=${re.adminKey}`);
    t('a screen is connected before the delete', ws2.opened);
    const del = (c, key) => fetch(`${BASE}/api/events/${c}`, { method: 'DELETE', headers: key ? { 'x-key': key } : {} }).then(async x => ({ status: x.status, body: await x.json().catch(() => null) }));
    r = await del(re.code);                  t('delete without a key → 403', r.status === 403);
    r = await del(re.code, re.hostKey);      t('delete with the host key → 403', r.status === 403);
    r = await del(re.code, tok[0]);          t('delete with a captain PIN of another auction → 403', r.status === 403);
    r = await j(`/api/events/${re.code}/exists`); t('still there after refused deletes', r.status === 200);
    r = await del(re.code, re.adminKey);     t('delete with the admin key → 200', r.status === 200 && r.body.ok === true, JSON.stringify(r));
    await new Promise(x => setTimeout(x, 300));
    t('connected screens are told it was deleted', ws2.msgs.some(m => m && m.deleted === true), JSON.stringify(ws2.msgs.slice(-1)));
    r = await j(`/api/events/${re.code}/exists`);  t('deleted auction → 404', r.status === 404);
    r = await j(`/api/events/${re.code}/state`);   t('deleted auction state → 404', r.status === 404);
    r = await fetch(BASE + (rp ? rp.photo : '/uploads/x/y.png')); t('deleted auction photos are gone', r.status === 404, String(r.status));
    r = await del(re.code, re.adminKey);     t('deleting twice → 404', r.status === 404);
    const ws3 = await wsOpen(`/api/events/${re.code}/ws`); t('cannot connect to a deleted auction', !ws3.opened && ws3.status === 404);
    r = await j(`/api/events/${code}/exists`); t('other auctions are untouched', r.status === 200);
  }

  // ---- light live updates, caching, health ----
  {
    const room = await post('/api/events', { settings: { name: 'Delta', drawMode: 'manual' } });
    const rc = room.body.code, ra = room.body.adminKey, rh = room.body.hostKey;
    const rcmd = (key, action, params) => post(`/api/events/${rc}/cmd`, { action, params }, { 'x-key': key });
    await rcmd(ra, 'captain.add', { team: 'A' }); await rcmd(ra, 'captain.add', { team: 'B' });
    await rcmd(ra, 'players.import', { rows: Array.from({ length: 30 }, (_, i) => ({ name: 'P' + i })) });
    const rs0 = (await j(`/api/events/${rc}/state?key=${ra}`)).body;
    const rtok = rs0.captains.map(c => rs0.secrets.captainTokens[c.id]);
    const wd = await wsOpen(`/api/events/${rc}/ws`);
    t('first WS message is the complete state', wd.opened && !wd.msgs[0].delta && Array.isArray(wd.msgs[0].players) && wd.msgs[0].players.length === 30);
    t('the activity log is not sent to screens', wd.msgs[0].log === undefined && rs0.log === undefined);
    await rcmd(rh, 'pick', { playerId: rs0.players[0].id });
    await rcmd(rtok[0], 'bid', {});
    await new Promise(x => setTimeout(x, 400));
    const last = wd.msgs[wd.msgs.length - 1];
    t('later messages carry only what changed', last.delta === true && last.live && last.players === undefined && last.settings === undefined && last.captains === undefined, Object.keys(last).join());
    t('…and are much smaller than the full state', JSON.stringify(last).length * 4 < JSON.stringify(wd.msgs[0]).length, `${JSON.stringify(last).length} vs ${JSON.stringify(wd.msgs[0]).length}`);
    // applying the partial updates gives exactly what the server would have sent in full
    let merged = {}; for (const m of wd.msgs) { const { delta, ...rest } = m; merged = { ...merged, ...rest }; }
    const fresh = (await j(`/api/events/${rc}/state`)).body;
    t('partial updates add up to the full state', JSON.stringify(merged.live) === JSON.stringify(fresh.live) && JSON.stringify(merged.players) === JSON.stringify(fresh.players));
    await rcmd(rh, 'sold', {});
    await new Promise(x => setTimeout(x, 400));
    const afterSale = wd.msgs[wd.msgs.length - 1];
    t('a sale updates players and live together', afterSale.delta && afterSale.players && afterSale.live);
    const adminWs = await wsOpen(`/api/events/${rc}/ws?key=${ra}`);
    t('admin screen still gets secrets (full first message)', adminWs.msgs[0].secrets && adminWs.msgs[0].secrets.adminKey === ra);
    t('viewers never get secrets in updates', wd.msgs.every(m => m.secrets === undefined));
    const cWs = await wsOpen(`/api/events/${rc}/ws?key=${rtok[1]}`);
    await rcmd(rtok[1], 'strategy.add', { playerId: rs0.players[5].id, budget: 5_000_000 });
    await new Promise(x => setTimeout(x, 400));
    t('a captain gets own plan in an update', cWs.msgs.some(m => m.delta && Array.isArray(m.strategy) && m.strategy.length === 1));
    t('other screens do not get that captain\'s plan', !wd.msgs.some(m => m.strategy) && !adminWs.msgs.some(m => m.strategy));
    [wd, adminWs, cWs].forEach(x => x.w && x.w.close());

    const sse = await fetch(`${BASE}/api/events/${rc}/stream`); const reader = sse.body.getReader(); const chunk = new TextDecoder().decode((await reader.read()).value) + new TextDecoder().decode((await reader.read()).value);
    t('the plain-HTTP stream always sends full state', chunk.includes('"players"') && !chunk.includes('"delta"'));
    reader.cancel();
    await fetch(`${BASE}/api/events/${rc}`, { method: 'DELETE', headers: { 'x-key': ra } });

    r = await j('/healthz'); t('/healthz answers with ok and a version', r.status === 200 && r.body.ok === true && typeof r.body.version === 'string', JSON.stringify(r.body));
    const home = await fetch(BASE + '/'); const html = await home.text();
    t('the page itself is always re-checked (no-cache)', /no-cache/.test(home.headers.get('cache-control') || ''), home.headers.get('cache-control'));
    const asset = (html.match(/\/assets\/[^"']+\.js/) || [])[0];
    if (asset) { const a = await fetch(BASE + asset); t('fingerprinted assets are cached for a year', /max-age=31536000/.test(a.headers.get('cache-control') || '') && /immutable/.test(a.headers.get('cache-control') || ''), a.headers.get('cache-control')); }
    const missing = await fetch(BASE + '/assets/nope-123.js'); t('a missing asset is a 404, not the app page', missing.status === 404 && !(await missing.text()).includes('<div id="root"'));
  }

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
