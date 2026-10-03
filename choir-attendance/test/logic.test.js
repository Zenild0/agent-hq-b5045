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
  occasions: [],
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

test('sixth leave only flags the child; nothing is removed automatically', () => {
  const dates = ['2026-05-02', '2026-05-09', '2026-05-16', '2026-05-23', '2026-05-30', '2026-06-06'];
  const at = (n) => childStats(mkDb(dates.slice(0, n).map((x) => [x, 'saturday', { a: e('absent') }])), 'a', 2026);
  assert.equal(at(5).exceeded, false);
  assert.equal(at(5).leavesLeft, 0);
  const six = at(6);
  assert.equal(six.exceeded, true);
  assert.equal(six.leftOn, '2026-06-06');
  assert.equal(six.decision, null);
  const db = mkDb(dates.map((x) => [x, 'saturday', { a: e('absent'), b: e('present') }]));
  const board = scoreboard(db, 2026, '2026-04-01', '2027-03-31', { hideOut: true });
  assert.ok(board.some((r) => r.name === 'Anna'), 'still on the board');
  assert.equal(board.find((r) => r.name === 'Anna').over, true);
  assert.equal(childStats(db, 'a', 2027).leaves, 0); // next April resets
});

test('medical (excused) absences never count as leaves, whatever the count', () => {
  const dates = ['05-02', '05-09', '05-16', '05-23', '05-30', '06-06', '06-13'];
  const db = mkDb(dates.map((d) => [`2026-${d}`, 'saturday', { a: { status: 'excused', reason: 'Hospitalised', remarks: [], note: '' } }]));
  const st = childStats(db, 'a', 2026);
  assert.equal(st.leaves, 0);
  assert.equal(st.excused, 7);
  assert.equal(st.exceeded, false);
});

test('scoreboard ranks by points and shares ties', () => {
  const sessions = [
    ['2026-05-02', 'saturday', { a: e('present'), b: e('present') }],
    ['2026-05-03', 'sunday', { a: e('present'), b: e('absent') }],
  ];
  const rows = scoreboard(mkDb(sessions), 2026, '2026-04-01', '2027-03-31');
  assert.deepEqual(rows.map((r) => [r.name, r.points, r.rank]), [['Anna', 3, 1], ['Ben', 1, 2]]);

  const tie = scoreboard(mkDb([['2026-05-02', 'saturday', { a: e('present'), b: e('present') }]]), 2026, '2026-04-01', '2027-03-31');
  assert.deepEqual(tie.map((r) => r.rank), [1, 1]);

  // over the leave limit: still ranked on points, just flagged for the teacher
  const over = mkDb(['05-02', '05-09', '05-16', '05-23', '05-30', '06-06'].map((d) => [`2026-${d}`, 'saturday', { a: e('absent'), b: e('present') }]));
  over.sessions['2026-06-07|sunday'] = { date: '2026-06-07', type: 'sunday', entries: { a: e('present') } };
  const r = scoreboard(over, 2026, '2026-04-01', '2027-03-31');
  assert.equal(r[0].name, 'Ben');
  assert.equal(r[1].over, true);
  assert.equal(r[1].eligible, true);
  assert.equal(r[1].rank, 2);
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

test('"out" applies only once the teacher decides, and only from that date', () => {
  const db = mkDb([
    ['2026-05-02', 'saturday', { a: e('present'), b: e('present') }],
    ['2026-07-04', 'saturday', { a: e('present'), b: e('absent') }],
  ]);
  db.children[0].leaveDecisions = { 2026: { status: 'keep', on: '2026-08-01' } };
  assert.ok(scoreboard(db, 2026, '2026-04-01', '2027-03-31', { hideOut: true }).some((r) => r.name === 'Anna'));
  db.children[0].leaveDecisions = { 2026: { status: 'out', on: '2026-08-01' } };
  const may = scoreboard(db, 2026, '2026-05-01', '2026-05-31', { hideOut: true });
  assert.ok(may.some((r) => r.name === 'Anna'), 'May achievements are kept');
  const year = scoreboard(db, 2026, '2026-04-01', '2027-03-31', { hideOut: true });
  assert.ok(!year.some((r) => r.name === 'Anna'), 'hidden for the year once marked out');
  assert.equal(yearlyAchievers(db, '2026-10-03')[0].winners[0].name, 'Ben');
  assert.equal(childStats(db, 'a', 2026).decision.status, 'out');
});

test('occasions list who attended each practice', () => {
  const db = mkDb([
    ['2026-12-12', 'practice', { a: e('present'), b: e('absent') }],
    ['2026-12-19', 'practice', { a: e('present'), b: e('present') }],
    ['2026-12-25', 'feast', { a: e('present') }],
  ]);
  db.occasions = [{ id: 'o1', season: 2026, name: 'Christmas', members: ['a', 'b'] }];
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

test('guests join an occasion only: never on the main leaderboard, but their points and remarks show', () => {
  const db = mkDb([
    ['2026-12-12', 'practice', { a: e('present'), g: e('present', ['Well behaved']) }],
    ['2026-12-19', 'practice', { a: e('present'), g: e('present', ['Well behaved', 'Helped others']) }],
  ]);
  db.children.push({ id: 'g', name: 'Guest Gita', active: true, guest: true });
  db.occasions = [{ id: 'o1', season: 2026, name: 'Christmas', members: ['a', 'g'] }];
  for (const s of Object.values(db.sessions)) s.event = 'Christmas';
  const board = scoreboard(db, 2026, '2026-04-01', '2027-03-31');
  assert.ok(!board.some((r) => r.name === 'Guest Gita'));
  assert.ok(!monthlyAchievers(db, 2026, '2026-12-31')[0].winners.some((w) => w.name === 'Guest Gita'));
  const [xmas] = occasions(db, 2026);
  const gita = xmas.children.find((c) => c.name === 'Guest Gita');
  assert.deepEqual([gita.guest, gita.attended, gita.points, gita.good], [true, 2, 2, 3]);
  assert.deepEqual(xmas.children.map((c) => c.name), ['Anna', 'Guest Gita']); // alphabetical
  gita && (db.children.find((c) => c.id === 'g').guest = false); // promoted
  assert.ok(scoreboard(db, 2026, '2026-04-01', '2027-03-31').some((r) => r.name === 'Guest Gita'));
});
