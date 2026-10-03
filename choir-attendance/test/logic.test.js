import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS, seasonOf, seasonRange, easterDate, prizeInfo, childStats, scoreboard, pointsFor,
} from '../lib/logic.js';

const mkDb = (sessions = [], settings = {}) => ({
  settings: { ...DEFAULT_SETTINGS, ...settings },
  children: [
    { id: 'a', name: 'Anna', active: true },
    { id: 'b', name: 'Ben', active: true },
  ],
  sessions: Object.fromEntries(sessions.map(([date, type, entries]) => [`${date}|${type}`, { date, type, entries }])),
});
const e = (status, remarks = []) => ({ status, remarks, note: '' });

test('season runs April to March', () => {
  assert.equal(seasonOf('2026-04-01'), 2026);
  assert.equal(seasonOf('2027-03-31'), 2026);
  assert.equal(seasonOf('2027-04-01'), 2027);
  assert.deepEqual(seasonRange(2026), { start: '2026-04-01', end: '2027-03-31' });
});

test('easter dates', () => {
  assert.equal(easterDate(2026), '2026-04-05');
  assert.equal(easterDate(2027), '2027-03-28');
  assert.equal(easterDate(2028), '2028-04-16');
});

test('prize: Easter in first season, December afterwards', () => {
  const db = mkDb([['2026-05-02', 'saturday', { a: e('present') }]]);
  assert.deepEqual(prizeInfo(db, 2026, '2026-10-03'), { label: 'Easter', date: '2027-03-28' });
  assert.deepEqual(prizeInfo(db, 2027, '2027-10-03'), { label: 'December', date: '2027-12-31' });
  // Easter falling after March 31 is capped at the season end
  assert.equal(prizeInfo(mkDb([], { firstSeason: 2027 }), 2027, '2027-05-01').date, '2028-03-31');
});

test('points: Saturday 1, Sunday 2, late earns half', () => {
  const s = DEFAULT_SETTINGS;
  assert.equal(pointsFor(e('present'), 'saturday', s), 1);
  assert.equal(pointsFor(e('present'), 'sunday', s), 2);
  assert.equal(pointsFor(e('present', ['Late']), 'sunday', s), 1);
  assert.equal(pointsFor(e('absent'), 'sunday', s), 0);
  assert.equal(pointsFor(e('excused'), 'saturday', s), 0);
});

test('leaves: only unexcused Saturday absences; sick is exempt', () => {
  const db = mkDb([
    ['2026-05-02', 'saturday', { a: e('absent') }],
    ['2026-05-09', 'saturday', { a: e('excused') }],
    ['2026-05-10', 'sunday', { a: e('absent') }],
  ]);
  const st = childStats(db, 'a', 2026);
  assert.equal(st.leaves, 1);
  assert.equal(st.excused, 1);
  db.settings.countSundayAbsences = true;
  assert.equal(childStats(db, 'a', 2026).leaves, 2);
});

test('sixth leave puts the child out; fifth does not; next April resets', () => {
  const dates = ['2026-05-02', '2026-05-09', '2026-05-16', '2026-05-23', '2026-05-30', '2026-06-06'];
  const db = mkDb(dates.map((d) => [d, 'saturday', { a: e('absent') }]));
  const at = (n) => {
    const d = mkDb(dates.slice(0, n).map((x) => [x, 'saturday', { a: e('absent') }]));
    return childStats(d, 'a', 2026);
  };
  assert.equal(at(5).exceeded, false);
  assert.equal(at(5).leavesLeft, 0);
  const six = childStats(db, 'a', 2026);
  assert.equal(six.exceeded, true);
  assert.equal(six.leftOn, '2026-06-06');
  assert.equal(childStats(db, 'a', 2027).leaves, 0);
});

test('scoreboard ranks by points, shares ties, excludes children who are out', () => {
  const sessions = [
    ['2026-05-02', 'saturday', { a: e('present'), b: e('present') }],
    ['2026-05-03', 'sunday', { a: e('present'), b: e('absent') }],
  ];
  const rows = scoreboard(mkDb(sessions), 2026, '2026-04-01', '2027-03-31');
  assert.deepEqual(rows.map((r) => [r.name, r.points, r.rank]), [['Anna', 3, 1], ['Ben', 1, 2]]);

  const tie = scoreboard(mkDb([['2026-05-02', 'saturday', { a: e('present'), b: e('present') }]]), 2026, '2026-04-01', '2027-03-31');
  assert.deepEqual(tie.map((r) => r.rank), [1, 1]);

  const out = mkDb(['05-02', '05-09', '05-16', '05-23', '05-30', '06-06'].map((d) => [`2026-${d}`, 'saturday', { a: e('absent'), b: e('present') }]));
  out.sessions['2026-06-07|sunday'] = { date: '2026-06-07', type: 'sunday', entries: { a: e('present') } };
  const r = scoreboard(out, 2026, '2026-04-01', '2027-03-31');
  assert.equal(r[0].name, 'Ben');
  assert.equal(r[1].eligible, false);
  assert.equal(r[1].rank, null);
});

import {
  sessionKey, monthlyAchievers, yearlyAchievers, occasions, isLeave,
} from '../lib/logic.js';

test('feast practices and masses add points but never cost a leave', () => {
  const s = DEFAULT_SETTINGS;
  assert.equal(pointsFor(e('present'), 'practice', s), 1);
  assert.equal(pointsFor(e('present'), 'feast', s), 2);
  assert.equal(pointsFor(e('present', ['Late']), 'feast', s), 1);
  assert.equal(isLeave(e('absent'), 'practice', s), false);
  assert.equal(isLeave(e('absent'), 'feast', s), false);
});

test('session keys keep each occasion separate', () => {
  assert.equal(sessionKey('2026-12-19', 'saturday', ''), '2026-12-19|saturday');
  assert.notEqual(sessionKey('2026-12-19', 'practice', 'Christmas'), sessionKey('2026-12-19', 'practice', 'New Year'));
});

test('monthly achievers: highest scorer wins, ties share, empty months skipped', () => {
  const db = mkDb([
    ['2026-05-02', 'saturday', { a: e('present'), b: e('present') }],
    ['2026-05-03', 'sunday', { a: e('present'), b: e('absent') }],
    ['2026-06-06', 'saturday', { a: e('present'), b: e('present') }],
  ]);
  const m = monthlyAchievers(db, 2026, '2026-10-03');
  assert.deepEqual(m.map((x) => x.month), ['2026-06', '2026-05']);
  assert.deepEqual(m[1].winners.map((w) => w.name), ['Anna']);
  assert.deepEqual(m[0].winners.map((w) => w.name).sort(), ['Anna', 'Ben']); // tie
  assert.equal(m[0].inProgress, false);
  assert.equal(monthlyAchievers(db, 2026, '2026-06-10')[0].inProgress, true);
});

test('a child who left the choir still keeps their past achievement', () => {
  const db = mkDb([['2026-05-02', 'saturday', { a: e('present') }]]);
  db.children[0].active = false;
  assert.equal(monthlyAchievers(db, 2026, '2026-10-03')[0].winners[0].name, 'Anna');
});

test('out status applies only from the sixth leave onwards', () => {
  const dates = ['05-02', '05-09', '05-16', '05-23', '05-30', '06-06'];
  const entries = dates.map((d) => [`2026-${d}`, 'saturday', { a: e('absent'), b: e('present') }]);
  entries.push(['2026-05-03', 'sunday', { a: e('present') }]);
  const db = mkDb(entries);
  const may = scoreboard(db, 2026, '2026-05-01', '2026-05-31', { hideOut: true });
  assert.ok(may.some((r) => r.name === 'Anna'), 'still in the choir in May');
  const june = scoreboard(db, 2026, '2026-06-01', '2026-06-30', { hideOut: true });
  assert.ok(!june.some((r) => r.name === 'Anna'), 'out once the 6th leave happens');
  assert.equal(yearlyAchievers(db, '2026-10-03')[0].winners[0].name, 'Ben');
});

test('occasions list who attended each practice', () => {
  const db = mkDb([
    ['2026-12-12', 'practice', { a: e('present'), b: e('absent') }],
    ['2026-12-19', 'practice', { a: e('present'), b: e('present') }],
    ['2026-12-25', 'feast', { a: e('present') }],
  ]);
  db.sessions['2026-12-12|practice'].event = 'Christmas';
  db.sessions['2026-12-19|practice'].event = 'Christmas';
  db.sessions['2026-12-25|feast'].event = 'Christmas';
  const [xmas] = occasions(db, 2026);
  assert.equal(xmas.event, 'Christmas');
  assert.deepEqual(xmas.sessions.map((s) => s.presentCount), [1, 2, 1]);
  const anna = xmas.children.find((c) => c.name === 'Anna');
  assert.equal(anna.attended, 3);
  assert.equal(anna.points, 1 + 1 + 2);
  assert.deepEqual(xmas.children.find((c) => c.name === 'Ben').cells, ['absent', 'present', null]);
});
