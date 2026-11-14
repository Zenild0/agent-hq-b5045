import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { streakMark, cleanAvatar, challengeView, DEFAULT_AVATAR } from '../lib/space.js';

process.env.CHOIR_DATA = join(mkdtempSync(join(tmpdir(), 'choir-space-')), 'db.json');
process.env.CHOIR_TRIAL_DAYS = '0'; process.env.CHOIR_TRIAL_GUEST_DAYS = '0';
delete process.env.CHOIR_PIN;
const { server } = await import('../server.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());
const j = async (path, { method = 'GET', body, code } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(code ? { 'x-code': code } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};
const day = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

test('streak milestones, avatars and the weekly challenge are worked out safely', () => {
  assert.equal(streakMark(2), 0); assert.equal(streakMark(3), 3); assert.equal(streakMark(9), 7); assert.equal(streakMark(400), 100);
  assert.deepEqual(cleanAvatar({ color: '#FFC62E', badge: 'note', frame: 'none' }, 0), { color: '#FFC62E', badge: 'note', frame: 'none' });
  assert.equal(cleanAvatar({ color: '#FFC62E', badge: 'crown', frame: 'none' }, 100), null, 'a crown needs 500 XP');
  assert.ok(cleanAvatar({ color: '#FFC62E', badge: 'crown', frame: 'gold' }, 600));
  assert.equal(cleanAvatar({ color: 'red', badge: 'note', frame: 'none' }, 0), null, 'only the offered colours');
  const c = challengeView([{ id: 'a', name: 'Ben B.', secs: 3000 }, { id: 'b', name: 'Maya P.', secs: 1800 }], 100, 'b');
  assert.equal(c.minutes, 80); assert.equal(c.pct, 80);
  assert.deepEqual(c.medals.map((m) => m.got), [true, true, false]);
  assert.equal(c.top[0].name, 'Ben B.'); assert.equal(c.top[1].me, true); assert.equal(c.mine, 30);
  assert.equal(challengeView([], 100).pct, 0);
});

test('Choir Space stays closed until the teacher opens it, needs the parent tick, and shows short names only', async () => {
  const mk = async (name, consent = true) => { const c = (await j('/api/teacher/children', { method: 'POST', body: { name } })).data; await j(`/api/teacher/children/${c.id}/game`, { method: 'PUT', body: { paid: true } }); if (consent) await j('/api/me/consent', { method: 'POST', body: { agree: true }, code: c.code }); return c; };
  const ben = await mk('Ben Bright'), maya = await mk('Maya Singer'), shy = await mk('Shy Child', false);
  assert.equal((await j('/api/me/space', { code: ben.code })).data.enabled, false);
  assert.equal((await j('/api/public')).data.settings.spaceEnabled, false);
  assert.equal((await j('/api/teacher/settings', { method: 'PUT', body: { spaceEnabled: true, spaceTarget: 100 } })).status, 200);
  assert.equal((await j('/api/teacher/settings', { method: 'PUT', body: { spaceTarget: 3 } })).status, 400);
  assert.equal((await j('/api/me/space', { code: shy.code })).data.needConsent, true, 'no tick, no Space');
  // Ben practises: a 5-day streak and 12 minutes today become posts
  await j('/api/me/xp', { method: 'POST', code: ben.code, body: { days: { [day()]: 30 }, streak: 5, stats: { [day()]: { secs: 720, notes: 10, won: 8, errSum: 80, errN: 8 } } } });
  await j('/api/me/xp', { method: 'POST', code: maya.code, body: { days: { [day()]: 20 }, streak: 1, stats: { [day()]: { secs: 480, notes: 6, won: 5, errSum: 50, errN: 5 } } } });
  const v = (await j('/api/me/space', { code: maya.code })).data;
  assert.equal(v.locked, false);
  const kinds = v.feed.map((p) => p.kind).sort();
  assert.deepEqual(kinds, ['bigday', 'streak']);
  assert.equal(v.feed.find((p) => p.kind === 'streak').n, 3, 'the 3-day mark');
  assert.ok(v.feed.every((p) => p.who.name === 'Ben B.'), 'a short name, and nobody without a tick');
  assert.ok(!JSON.stringify(v).includes('Bright'));
  assert.equal(v.challenge.minutes, 20); assert.equal(v.challenge.pct, 20);
  // same milestone twice does not post twice
  await j('/api/me/xp', { method: 'POST', code: ben.code, body: { days: { [day()]: 5 }, streak: 5 } });
  assert.equal((await j('/api/me/space', { code: maya.code })).data.feed.length, 2);
  // reactions toggle
  const post = v.feed[0];
  const r1 = (await j('/api/me/space/react', { method: 'POST', code: maya.code, body: { post: post.id, emoji: '👏' } })).data;
  assert.equal(r1.reacts.find((x) => x.e === '👏').n, 1);
  assert.equal((await j('/api/me/space/react', { method: 'POST', code: maya.code, body: { post: post.id, emoji: '👏' } })).data.reacts.find((x) => x.e === '👏').n, 0, 'tap again to undo');
  assert.equal((await j('/api/me/space/react', { method: 'POST', code: maya.code, body: { post: post.id, emoji: '💩' } })).status, 400, 'only the offered reactions');
  assert.equal((await j('/api/me/space/react', { method: 'POST', code: shy.code, body: { post: post.id, emoji: '👏' } })).status, 403);
});

test('avatars unlock with XP, and the teacher can post a note and remove any post', async () => {
  const kid = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Avatar Kid' } })).data;
  await j(`/api/teacher/children/${kid.id}/game`, { method: 'PUT', body: { paid: true } });
  await j('/api/me/consent', { method: 'POST', body: { agree: true }, code: kid.code });
  await j('/api/me/xp', { method: 'POST', code: kid.code, body: { days: { [day()]: 100 }, streak: 1 } });
  const set = (a) => j('/api/me/avatar', { method: 'POST', code: kid.code, body: a });
  assert.equal((await set({ color: '#FF8AD1', badge: 'note', frame: 'gold' })).status, 200);
  assert.equal((await set({ color: '#FF8AD1', badge: 'crown', frame: 'none' })).status, 400, 'not unlocked yet');
  assert.equal((await j('/api/me/space', { code: kid.code })).data.me.avatar.frame, 'gold');
  const t = (await j('/api/teacher/space', { method: 'POST', body: { text: 'Well done everyone this week! 🎶' } })).data;
  assert.equal(t.posts[0].kind, 'note');
  assert.equal((await j('/api/teacher/space', { method: 'POST', body: { text: '' } })).status, 400);
  assert.ok((await j('/api/me/space', { code: kid.code })).data.feed.some((p) => p.kind === 'note' && p.text.includes('Well done')));
  const gone = (await j(`/api/teacher/space/${t.posts[0].id}`, { method: 'DELETE' })).data;
  assert.ok(!gone.posts.some((p) => p.kind === 'note'));
  void DEFAULT_AVATAR;
});
