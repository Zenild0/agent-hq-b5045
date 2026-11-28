// The training XP leaderboard (server side). The phone earns XP and reports it; the server keeps a small record per child,
// limits what it will believe (a day never counts more than the cap, dates must be recent), and ranks only children whose
// paid year is active. Switched on and off by the teacher in Settings; nothing is kept while it is off.
import { weekKey, titleFor, DAY_CAP, STAT_DAY_SECS, accuracyOf } from '../public/xp.js';

const dayMs = 86400000;
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * dayMs).toISOString().slice(0, 10);
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const num = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

export const emptyXp = () => ({ days: {}, stats: {}, total: 0, streak: 0, best: 0, units: 0, updated: '' });

// days: { 'YYYY-MM-DD': xp earned that day }. Applies the daily cap per day; returns how many XP were accepted.
export function recordXp(kidXp, report, today) {
  const x = kidXp;
  let accepted = 0;
  for (const [d, raw] of Object.entries(report.days ?? {})) {
    if (!isDay(d) || d > today || d < addDays(today, -14)) continue; // only the last two weeks, never the future
    const want = num(raw, DAY_CAP);
    const have = x.days[d] ?? 0;
    const room = Math.max(0, DAY_CAP - have);
    const take = Math.min(want, room);
    if (take > 0) { x.days[d] = have + take; x.total += take; accepted += take; }
  }
  // practice numbers: time, notes tried and matched, and how close they were. A day never counts more than an hour.
  x.stats ??= {};
  for (const [d, raw] of Object.entries(report.stats ?? {})) {
    if (!isDay(d) || d > today || d < addDays(today, -14) || !raw || typeof raw !== 'object') continue;
    const have = x.stats[d] ?? { secs: 0, notes: 0, won: 0, errSum: 0, errN: 0 };
    const notes = Math.min(300 - have.notes, num(raw.notes, 300));
    if (notes <= 0) continue;
    const won = Math.min(notes, num(raw.won, 300));
    const errN = Math.min(won, num(raw.errN, 300));
    x.stats[d] = {
      secs: Math.min(STAT_DAY_SECS, have.secs + Math.min(num(raw.secs, STAT_DAY_SECS), notes * 120)),
      notes: have.notes + notes, won: have.won + won, errN: have.errN + errN, errSum: have.errSum + Math.min(num(raw.errSum, 100000), errN * 600),
    };
  }
  for (const d of Object.keys(x.days)) if (d < addDays(today, -70)) delete x.days[d];
  for (const d of Object.keys(x.stats)) if (d < addDays(today, -70)) delete x.stats[d];
  if ('streak' in report) x.streak = num(report.streak, 400); // only what the phone sent is updated
  if ('best' in report || 'streak' in report) x.best = Math.max(x.best, num(report.best, 400), x.streak);
  if ('units' in report) x.units = num(report.units, 100);
  x.updated = today;
  return accepted;
}

export const weekXpOf = (x, today) => { const wk = weekKey(today); let s = 0; for (const [d, v] of Object.entries(x?.days ?? {})) if (weekKey(d) === wk) s += v; return s; };

export function statsOf(x, today, kind) {
  const wk = weekKey(today);
  const t = { secs: 0, notes: 0, won: 0, errSum: 0, errN: 0 };
  for (const [d, v] of Object.entries(x?.stats ?? {})) if (kind === 'all' || weekKey(d) === wk) for (const k of Object.keys(t)) t[k] += v[k] || 0;
  return { ...t, minutes: Math.round(t.secs / 60), accuracy: accuracyOf(t.errSum, t.errN, 5), hitRate: t.notes ? Math.round((100 * t.won) / t.notes) : null };
}

// children: [{ id, name, ... }] already limited to the paid, active, non-guest children.
// The XP board is the main one; the same children are also ranked by accuracy, practice time and streak.
export function buildBoard(xpOf, children, today, meId, decorate) {
  const out = { metrics: {} };
  for (const kind of ['week', 'all']) {
    const all = children.map((c) => {
      const x = xpOf(c.id);
      return { ...decorate(c), xp: kind === 'week' ? weekXpOf(x, today) : x?.total ?? 0, streak: x?.streak ?? 0, units: x?.units ?? 0, ...statsOf(x, today, kind) };
    });
    const ranked = (rows, key) => {
      rows.sort((a, b) => b[key] - a[key] || b.xp - a.xp || a.name.localeCompare(b.name));
      let r = 0;
      rows.forEach((row, i) => { if (!(i && rows[i - 1][key] === row[key])) r += 1; row.rank = r; });
      return rows;
    };
    const pack = (rows, key) => {
      const top = rows.slice(0, 10);
      const mine = rows.find((r) => r.id === meId);
      return { top, me: mine && !top.some((t) => t.id === meId) ? { rank: mine.rank, value: mine[key] } : null, total: rows.length };
    };
    const xpRows = ranked(all.filter((r) => r.xp > 0).map((r) => ({ ...r })), 'xp');
    const top = xpRows.slice(0, 10).map((r) => ({ ...r, title: titleFor(kind === 'all' ? r.xp : xpOf(r.id)?.total ?? 0) }));
    const mine = xpRows.find((r) => r.id === meId);
    out[kind] = { top, me: mine && !top.some((t) => t.id === meId) ? { rank: mine.rank, xp: mine.xp } : null, total: xpRows.length };
    out.metrics[kind] = {
      accuracy: pack(ranked(all.filter((r) => r.accuracy != null).map((r) => ({ ...r })), 'accuracy'), 'accuracy'),
      time: pack(ranked(all.filter((r) => r.secs > 0).map((r) => ({ ...r })), 'secs'), 'secs'),
      streak: pack(ranked(all.filter((r) => r.streak > 0).map((r) => ({ ...r })), 'streak'), 'streak'),
    };
  }
  return { weekLabel: weekKey(today), ...out };
}
