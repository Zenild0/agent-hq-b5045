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

test('a guest sees only their own event: event board, event attendance, a schedule switch; a new code replaces the old one', async () => {
  const put = (path, body, code) => j(path, { method: 'PUT', body, code });
  await j('/api/teacher/occasions', { method: 'POST', body: { name: 'Carol Night', members: [], guests: 'Guest One\nGuest Two' } });
  const kids = (await j('/api/teacher/children')).data.children;
  const g1 = kids.find((c) => c.name === 'Guest One'), g2 = kids.find((c) => c.name === 'Guest Two');
  const d = '2026-05-10';
  const mark = (id, status, remarks = []) => j('/api/teacher/mark', { method: 'PUT', body: { date: d, type: 'practice', event: 'Carol Night', childId: id, status, remarks } });
  assert.equal((await mark(g1.id, 'present')).status, 200);
  assert.equal((await mark(g2.id, 'absent')).status, 200);
  const me = (await j('/api/me', { code: g1.code })).data;
  assert.equal(me.guest, true);
  assert.equal(me.showSchedule, false, 'main-choir practice times are off until the guest taps to see them');
  assert.equal(me.events.length, 1);
  const ev = me.events[0];
  assert.equal(ev.name, 'Carol Night');
  assert.equal(ev.me.rank, 1);
  assert.equal(ev.board.length, 2);
  assert.deepEqual(ev.attendance.map((a) => a.status), ['present']);
  assert.ok(!('contact' in ev.board[0]) && !('address' in ev.board[0]), 'no private details on the event board');
  // the main choir leaderboard never includes guests
  const pub = (await j('/api/public')).data;
  assert.ok(![...pub.yearBoard, ...pub.monthBoard].some((r) => r.name.startsWith('Guest ')));
  // the guest opts in to the schedule
  assert.equal((await put('/api/me/schedule', { show: true }, g1.code)).status, 200);
  assert.equal((await j('/api/me', { code: g1.code })).data.showSchedule, true);
  // a new private code: the old one stops working
  const fresh = (await j(`/api/teacher/children/${g1.id}/newcode`, { method: 'POST', body: {} })).data.code;
  assert.notEqual(fresh, g1.code);
  assert.equal((await j('/api/me', { code: g1.code })).status, 401);
  assert.equal((await j('/api/me', { code: fresh })).status, 200);
});
