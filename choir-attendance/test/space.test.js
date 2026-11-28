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
  // open to every choir child, whether or not they have paid
  const free = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Free Kid' } })).data;
  await j('/api/me/consent', { method: 'POST', body: { agree: true }, code: free.code });
  const fv = (await j('/api/me/space', { code: free.code })).data;
  assert.equal(fv.locked, false, 'no payment needed');
  assert.ok(fv.feed.length >= 2 && fv.challenge);
  assert.equal((await j('/api/me/space/react', { method: 'POST', code: free.code, body: { post: post.id, emoji: '🔥' } })).status, 200);
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

test('groups: the main choir sees Main choir and its occasions; a guest sees only their occasion', async () => {
  const mk = async (name) => { const c = (await j('/api/teacher/children', { method: 'POST', body: { name } })).data; await j('/api/me/consent', { method: 'POST', body: { agree: true }, code: c.code }); return c; };
  const inOcc = await mk('Carol Singer'), notInOcc = await mk('Home Body');
  await j('/api/teacher/occasions', { method: 'POST', body: { season: 2026, name: 'Christmas Carols', members: [inOcc.id], guests: 'Gina Guest' } });
  const occ = (await j('/api/teacher/occasions?season=2026')).data.events.find((e) => e.event === 'Christmas Carols');
  const gina = (await j('/api/teacher/children')).data.children.find((c) => c.name === 'Gina Guest');
  await j('/api/me/consent', { method: 'POST', body: { agree: true }, code: gina.code });
  // the guest practises: her post shows in the occasion only
  await j('/api/me/xp', { method: 'POST', code: gina.code, body: { days: { [day()]: 20 }, streak: 3 } });
  const g = (await j('/api/me/space', { code: gina.code })).data;
  assert.deepEqual(g.groups.map((x) => x.label), ['Christmas Carols'], 'a guest sees only her occasion');
  assert.equal(g.group, `occ:${occ.id}`);
  assert.ok(g.feed.some((p) => p.who?.name === 'Gina G.'));
  const inMain = (await j('/api/me/space', { code: notInOcc.code })).data;
  assert.deepEqual(inMain.groups.map((x) => x.label), ['Main choir']);
  assert.ok(!inMain.feed.some((p) => p.who?.name === 'Gina G.'), 'guests are not in the main choir feed');
  const member = (await j('/api/me/space', { code: inOcc.code })).data;
  assert.deepEqual(member.groups.map((x) => x.label), ['Main choir', 'Christmas Carols'], 'a choir child in an occasion sees both');
  const occView = (await j(`/api/me/space?group=occ:${occ.id}`, { code: inOcc.code })).data;
  assert.ok(occView.feed.some((p) => p.who?.name === 'Gina G.'), 'inside the occasion, everyone in it shows');
  assert.equal((await j(`/api/me/space?group=occ:${occ.id}`, { code: notInOcc.code })).data.group, 'main', 'someone outside the occasion cannot open it');
  // a note to the occasion reaches only that group
  await j('/api/teacher/space', { method: 'POST', body: { text: 'Carol practice is at 6!', group: `occ:${occ.id}` } });
  assert.ok((await j('/api/me/space', { code: gina.code })).data.feed.some((p) => p.text === 'Carol practice is at 6!'));
  assert.ok(!(await j('/api/me/space', { code: notInOcc.code })).data.feed.some((p) => p.text === 'Carol practice is at 6!'));
  const ginaPost = g.feed.find((p) => p.who?.name === 'Gina G.');
  assert.equal((await j('/api/me/space/react', { method: 'POST', code: notInOcc.code, body: { post: ginaPost.id, emoji: '👏' } })).status, 404, 'cannot react to a post you cannot see');
  assert.equal((await j('/api/me/space/react', { method: 'POST', code: inOcc.code, body: { post: ginaPost.id, emoji: '👏' } })).status, 200);
});
