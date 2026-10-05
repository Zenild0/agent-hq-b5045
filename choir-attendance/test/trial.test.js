import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CHOIR_DATA = join(mkdtempSync(join(tmpdir(), 'choir-trial-')), 'db.json');
delete process.env.CHOIR_PIN;
process.env.CHOIR_GAME_GAP_MS = '0';
const { server } = await import('../server.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());
const j = async (path, { method = 'GET', body, code } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(code ? { 'x-code': code } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};

test('every game is free for 7 days for members and 3 for guests, then paid; paying unlocks all games', async () => {
  await j('/api/teacher/settings', { method: 'PUT', body: { gameEnabled: true, staffEnabled: true } });
  const member = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Trial Member' } })).data;
  await j('/api/teacher/occasions', { method: 'POST', body: { name: 'Trial Event', members: [], guests: 'Trial Guest' } });
  const guest = (await j('/api/teacher/children')).data.children.find((c) => c.name === 'Trial Guest');
  assert.ok(guest && guest.guest);
  const m = (await j('/api/me/access', { code: member.code })).data;
  assert.equal(m.trial.active, true);
  assert.equal(m.trial.days, 7);
  assert.equal(m.trial.daysLeft, 7);
  assert.equal(m.full, true);
  assert.equal(m.paid, false);
  assert.deepEqual(m.games, { vocals: true, notation: true });
  const g = (await j('/api/me/access', { code: guest.code })).data;
  assert.equal(g.trial.days, 3);
  assert.equal(g.trial.daysLeft, 3);
  assert.equal(g.guest, true);
  // inside the trial the paid levels open
  const st = (await j('/api/game', { code: member.code })).data;
  assert.equal(st.paid, true);
  assert.equal(st.subscribed, false);
  assert.ok(st.warmupLeft === null, 'unlimited warm-ups during the trial');
  // the trial days are fixed on the first day: asking again does not restart them
  assert.equal((await j('/api/me/access', { code: member.code })).data.trial.daysLeft, 7);
});

test('a bad code is refused and the games switch hides the games list', async () => {
  assert.equal((await j('/api/me/access', { code: 'NOPE' })).status, 401);
  await j('/api/teacher/settings', { method: 'PUT', body: { gameEnabled: false, staffEnabled: false } });
  const c = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Third Child' } })).data;
  const a = (await j('/api/me/access', { code: c.code })).data;
  assert.deepEqual(a.games, { vocals: false, notation: false });
  assert.equal(a.trial.started, false, 'the trial only starts once a game is switched on and opened');
});
