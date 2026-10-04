import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSchedule, scheduleDays, nextPractice, istNow, isTime, isDate } from '../lib/schedule.js';

const sc = () => defaultSchedule('2026-10-01');

test('every Saturday from the start date, with exceptions', () => {
  const s = sc();
  s.days['2026-10-24'] = { cancelled: true };
  s.days['2026-10-31'] = { time: '19:30' };
  s.days['2026-12-13'] = { special: true, time: '17:00', label: 'Christmas' };
  const d = scheduleDays(s, '2026-10-01', '2026-12-31');
  assert.deepEqual(d.slice(0, 5).map((x) => x.date), ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']);
  assert.equal(d.find((x) => x.date === '2026-10-24').cancelled, true);
  assert.equal(d.find((x) => x.date === '2026-10-31').time, '19:30');
  assert.equal(d.find((x) => x.date === '2026-10-03').time, '19:00');
  const xmas = d.find((x) => x.date === '2026-12-13');
  assert.deepEqual([xmas.special, xmas.label, xmas.time], [true, 'Christmas', '17:00']);
  assert.ok(!scheduleDays(s, '2026-09-01', '2026-09-30').length); // nothing before the start date
});

test('next practice skips cancelled days and stays on today until a while after it starts', () => {
  const s = sc();
  s.days['2026-10-10'] = { cancelled: true };
  assert.equal(nextPractice(s, { date: '2026-10-04', minutes: 600 }).date, '2026-10-17');
  const t = sc();
  assert.equal(nextPractice(t, { date: '2026-10-10', minutes: 18 * 60 }).date, '2026-10-10'); // 6 pm, practice at 7
  assert.equal(nextPractice(t, { date: '2026-10-10', minutes: 20 * 60 }).date, '2026-10-10'); // 8 pm, still on
  assert.equal(nextPractice(t, { date: '2026-10-10', minutes: 21 * 60+1 }).date, '2026-10-17'); // after 9 pm
});

test('Indian time and input checks', () => {
  assert.deepEqual(istNow(Date.parse('2026-10-03T19:00:00Z')), { date: '2026-10-04', minutes: 30 }); // 12:30 am IST next day
  assert.ok(isTime('19:30') && !isTime('7pm') && !isTime('25:00'));
  assert.ok(isDate('2026-10-10') && !isDate('2026-02-30') && !isDate('x'));
});
