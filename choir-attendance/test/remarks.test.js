import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CHOIR_DATA = join(mkdtempSync(join(tmpdir(), 'choir-rem-')), 'db.json');
delete process.env.CHOIR_PIN;
const { server } = await import('../server.js');
const { pointsFor, remarkBonus, remarkDeduction, isGoodRemark, isValidRemark, DEFAULT_SETTINGS } = await import('../lib/logic.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());
const j = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(base + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};

test('a free comment with a plus is a positive remark and a minus is a negative one', () => {
  const s = { satPoints: 1, remarkPenalty: 0.5, remarkBonus: 0.25, latePointsFactor: 1 };
  assert.ok(isGoodRemark('+ Led the warm-up') && !isGoodRemark('- Forgot the book'));
  assert.ok(isValidRemark('+ Led the warm-up') && isValidRemark('- Forgot the book') && !isValidRemark('Led the warm-up') && !isValidRemark('+ '));
  const plus = { status: 'present', remarks: ['+ Led the warm-up', '+ Sang solo'] };
  assert.equal(remarkBonus(plus, s), 0.5);
  assert.equal(remarkDeduction(plus, s), 0);
  const minus = { status: 'present', remarks: ['- Forgot the book', '- Chatting'] };
  assert.equal(remarkDeduction(minus, s), 0.5, 'one flat penalty however many');
  assert.equal(pointsFor(minus, 'saturday', s), 0.5);
  void DEFAULT_SETTINGS;
});

test('free comments are saved with the mark and shown back with their sign', async () => {
  const c = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Remark Kid' } })).data;
  const date = (await j('/api/teacher/session')).data.date;
  const r = await j('/api/teacher/mark', { method: 'PUT', body: { date, type: 'saturday', childId: c.id, status: 'present', remarks: ['Late', '+ Helped tidy up', '- Left early', 'nonsense'], note: '' } });
  assert.equal(r.status, 200);
  const v = (await j(`/api/teacher/session?date=${date}&type=saturday`)).data;
  assert.deepEqual(v.children.find((x) => x.id === c.id).remarks, ['Late', '+ Helped tidy up', '- Left early']);
});
