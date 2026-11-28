import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VOICE_TIPS, REMEDIES, OPEN_AT_START, START_FRIDAY, releaseAt, tipsAt, nextFridayEvening } from '../lib/voicetips.js';

process.env.CHOIR_DATA = join(mkdtempSync(join(tmpdir(), 'choir-tips-')), 'db.json');
delete process.env.CHOIR_PIN;
const { server } = await import('../server.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());
const j = async (path, { method = 'GET', body, code } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(code ? { 'x-code': code } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};
const at = (iso) => Date.parse(iso);

test('the tips are all well formed and the links only go to web pages', () => {
  assert.ok(VOICE_TIPS.length >= 25);
  const all = [...VOICE_TIPS, ...REMEDIES];
  assert.equal(new Set(all.map((t) => t.id)).size, all.length, 'no tip is both weekly and a remedy');
  for (const t of all) {
    assert.ok(t.title && t.body.length > 60 && t.emoji, t.id);
    if (t.link) assert.match(t.link, /^https:\/\//, t.id);
  }
  assert.ok(VOICE_TIPS.some((t) => /warm water|sip water/i.test(t.title + t.body)));
});

test('cough and sore-throat home remedies are open at any time, with the honey warning and when to see a doctor', () => {
  assert.ok(REMEDIES.length >= 8);
  assert.ok(REMEDIES.every((t) => t.tag === 'Home remedy'));
  for (const id of ['honey-lemon', 'ginger-honey']) assert.match(REMEDIES.find((t) => t.id === id).body, /under 1 year/, `${id} warns about babies`);
  assert.equal(REMEDIES.at(-1).id, 'see-doctor', 'the list ends with when to see a doctor');
  assert.match(REMEDIES.at(-1).body, /fever|breathing/);
  assert.equal(tipsAt(at('2026-11-14T00:00:00Z')).remedies.length, REMEDIES.length, 'all open before the first Friday');
});

test('every built-in tip is open now; a tip added to the end of the list later comes out the next Friday at 6 pm', () => {
  assert.equal(START_FRIDAY, '2026-11-20');
  assert.equal(new Date(at('2026-11-20T12:30:00Z') + 330 * 60000).getUTCDay(), 5, 'that is a Friday');
  assert.equal(OPEN_AT_START, VOICE_TIPS.length, 'the teacher asked for all of them at once');
  const now = tipsAt(at('2026-11-19T00:00:00Z'));
  assert.equal(now.tips.length, VOICE_TIPS.length);
  assert.equal(now.next, null);
  assert.equal(now.remaining, 0);
  assert.equal(releaseAt(OPEN_AT_START), at('2026-11-20T12:30:00Z'), 'a new tip added later: the first Friday');
  assert.equal(releaseAt(OPEN_AT_START + 1) - releaseAt(OPEN_AT_START), 7 * 86400000, 'and one a week after that');
  // the next Friday evening, from a Wednesday, from Friday before 6 pm, and from Friday after 6 pm
  assert.equal(nextFridayEvening(at('2026-11-18T06:00:00Z')), at('2026-11-20T12:30:00Z'));
  assert.equal(nextFridayEvening(at('2026-11-20T05:00:00Z')), at('2026-11-20T12:30:00Z'));
  assert.equal(nextFridayEvening(at('2026-11-20T13:00:00Z')), at('2026-11-27T12:30:00Z'));
});

test('children see the open tips, the newest first, and the teacher can add their own', async () => {
  const kid = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Tip Kid' } })).data;
  assert.equal((await j('/api/me/voice-tips', { code: 'NOPE' })).status, 401);
  const d = (await j('/api/me/voice-tips', { code: kid.code })).data;
  assert.ok(d.tips.length >= OPEN_AT_START);
  assert.ok(d.tips.every((t, i, a) => !i || a[i - 1].at >= t.at), 'newest first');
  assert.ok(d.remaining >= 0 && (d.next === null || typeof d.next === 'string'));
  const add = await j('/api/teacher/voice-tips', { method: 'POST', body: { title: 'Warm water first', body: 'Start practice with a few sips of warm water.', when: 'now', link: 'https://example.com/x' } });
  assert.equal(add.status, 201);
  assert.equal(add.data.own.length, 1);
  assert.ok(add.data.own[0].live);
  const after1 = (await j('/api/me/voice-tips', { code: kid.code })).data;
  const mine = after1.tips.find((t) => t.title === 'Warm water first');
  assert.ok(mine && mine.custom && mine.isNew && mine.tag === 'From your teacher');
  const later = await j('/api/teacher/voice-tips', { method: 'POST', body: { title: 'Friday special', body: 'A scheduled tip for Friday.', when: 'friday' } });
  assert.equal(later.data.own.find((t) => t.title === 'Friday special').live, false, 'a Friday tip is not out yet');
  assert.ok(!(await j('/api/me/voice-tips', { code: kid.code })).data.tips.some((t) => t.title === 'Friday special'));
  assert.equal((await j('/api/teacher/voice-tips', { method: 'POST', body: { title: '', body: 'x' } })).status, 400);
  assert.equal((await j('/api/teacher/voice-tips', { method: 'POST', body: { title: 'Bad link', body: 'x', link: 'javascript:alert(1)' } })).status, 400);
  const gone = await j(`/api/teacher/voice-tips/${add.data.own.find((t) => t.title === 'Warm water first').id}`, { method: 'DELETE' });
  assert.equal(gone.data.own.length, 1);
  const t = (await j('/api/teacher/voice-tips')).data;
  assert.ok(t.upcoming.length === 0 && t.published >= OPEN_AT_START);
});
