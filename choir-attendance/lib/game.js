// Rules, scores, badges and leaderboards for the singing game. Pure functions on plain data, so they can be tested.
// Only small numbers are kept per child: no audio and no recordings, ever.
import { LEVELS, DAILY_COUNT, starsFor } from '../public/levels.js';
import { IST_OFFSET_MIN } from './schedule.js';

export const PASS_SHARE = 0.7;
export class GameError extends Error {}

export const emptyGame = () => ({ kids: {}, daily: {} });
export const emptyKid = () => ({ cleared: [], best: {}, weekly: {}, badges: {}, dailyDays: [] });

const dayMs = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// ISO week (Monday start) of a YYYY-MM-DD date, e.g. "2026-W41".
export function weekKeyOf(date) {
  const t = new Date(`${date}T00:00:00Z`);
  const dow = (t.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(t.getTime() + (3 - dow) * dayMs);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / dayMs / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// The same number for everyone on a given (Indian) date.
export const dailySeed = (date) => [...date].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) || 1;

const num = (v, min, max, label) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new GameError(`${label} looks wrong`);
  return v;
};

// Checks what the phone reported for a round. Returns clean results.
export function checkResults(results, expected) {
  if (!Array.isArray(results) || results.length !== expected) throw new GameError('That round was not complete');
  return results.map((r, i) => {
    if (typeof r?.won !== 'boolean') throw new GameError(`Result ${i + 1} looks wrong`);
    const limit = num(r.limit, 5000, 40000, 'Time limit');
    const ms = num(r.ms, r.won ? 400 : 0, limit + 1000, 'Time');
    const err = r.err == null ? null : num(r.err, 0, 600, 'Accuracy');
    const hints = Math.round(num(r.hints ?? 0, 0, 50, 'Hints'));
    return { won: r.won, ms: Math.round(ms), limit: Math.round(limit), err, hints };
  });
}

export function scoreRound(results) {
  const won = results.filter((r) => r.won).length;
  const ms = results.reduce((s, r) => s + r.ms, 0);
  return { won, ms, pass: won >= results.length * PASS_SHARE, stars: starsFor(results, (i) => results[i].limit) };
}

// Better round = more matched, then less time.
const better = (a, b) => !b || a.won > b.won || (a.won === b.won && a.ms < b.ms);

export const maxPlayable = (kid) => Math.min(LEVELS.length, Math.max(0, ...kid.cleared) + 1);

function longestRun(results) {
  let best = 0, run = 0;
  for (const r of results) { run = r.won ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

// Records a finished level round. Returns { score, newBadges }. Throws GameError if the round is not allowed.
export function applyRound(game, childId, level, rawResults, today) {
  const lv = LEVELS.find((l) => l.id === level);
  if (!lv) throw new GameError('Unknown level');
  const kid = (game.kids[childId] ??= emptyKid());
  if (level > maxPlayable(kid)) throw new GameError('Clear the level before this one first');
  const results = checkResults(rawResults, lv.count);
  const score = scoreRound(results);
  const week = weekKeyOf(today);

  if (better(score, kid.best[level])) kid.best[level] = { won: score.won, ms: score.ms, stars: score.stars, on: today };
  else if (kid.best[level] && score.stars > kid.best[level].stars) kid.best[level].stars = score.stars;
  kid.weekly[week] ??= {};
  if (better(score, kid.weekly[week][level])) kid.weekly[week][level] = { won: score.won, ms: score.ms };
  for (const w of Object.keys(kid.weekly)) if (w < weekKeyOf(iso(Date.parse(`${today}T00:00:00Z`) - 28 * dayMs))) delete kid.weekly[w]; // keep about a month
  if (score.pass && !kid.cleared.includes(level)) kid.cleared.push(level);

  const earned = [];
  const give = (id) => { if (!kid.badges[id]) { kid.badges[id] = today; earned.push(id); } };
  if (score.won > 0) give('first_note');
  if (score.pass && level >= 2 && results.every((r) => r.hints === 0)) give('no_hints');
  if (longestRun(results) >= 10) give('ten_in_row');
  const wins = results.filter((r) => r.won);
  if (level >= 3 && wins.length >= 5 && wins.every((r) => r.err != null && r.err <= 10)) give('perfect_pitch');
  if (level >= 3 && score.stars === 3) give('triple_star');
  if (score.pass && level >= 6) give('amateur');
  if (score.pass && level >= 9) give('pro');
  if (score.pass && level >= 11) give('expert');
  if (score.pass && level >= 12) give('legend');
  return { score, newBadges: earned };
}

// One try per child per day at the daily Legend challenge. Later tries are ignored (and reported).
export function applyDaily(game, childId, today, rawResults) {
  const results = checkResults(rawResults, DAILY_COUNT);
  const day = (game.daily[today] ??= {});
  const kid = (game.kids[childId] ??= emptyKid());
  if (day[childId]) return { already: true, score: day[childId], newBadges: [] };
  const score = scoreRound(results);
  day[childId] = { won: score.won, ms: score.ms, stars: score.stars };
  for (const d of Object.keys(game.daily)) if (d < iso(Date.parse(`${today}T00:00:00Z`) - 30 * dayMs)) delete game.daily[d];
  if (!kid.dailyDays.includes(today)) kid.dailyDays.push(today);
  kid.dailyDays = kid.dailyDays.sort().slice(-30);
  const earned = [];
  const give = (id) => { if (!kid.badges[id]) { kid.badges[id] = today; earned.push(id); } };
  let streak = 0;
  for (let d = Date.parse(`${today}T00:00:00Z`); kid.dailyDays.includes(iso(d)); d -= dayMs) streak += 1;
  if (streak >= 3) give('daily_3');
  if (streak >= 7) give('daily_7');
  if (score.won > 0) give('first_note');
  return { already: false, score: day[childId], newBadges: earned, streak };
}

export const dailyStreak = (kid, today) => {
  let streak = 0;
  for (let d = Date.parse(`${today}T00:00:00Z`); kid?.dailyDays?.includes(iso(d)); d -= dayMs) streak += 1;
  return streak;
};

// Sorted board with shared, sequential ranks (the same rule as the main leaderboard).
export function rankRows(rows) {
  rows.sort((a, b) => b.won - a.won || a.ms - b.ms || a.name.localeCompare(b.name));
  let rank = 0;
  rows.forEach((r, i) => { const p = rows[i - 1]; if (!p || p.won !== r.won || p.ms !== r.ms) rank += 1; r.rank = rank; });
  return rows;
}

export function weeklyBoard(game, children, week, level) {
  const rows = [];
  for (const c of children) {
    const w = game.kids[c.id]?.weekly?.[week]?.[level];
    if (w) rows.push({ id: c.id, name: c.name, won: w.won, ms: w.ms });
  }
  return rankRows(rows);
}

export function dailyBoard(game, children, date) {
  const rows = [];
  for (const c of children) {
    const d = game.daily[date]?.[c.id];
    if (d) rows.push({ id: c.id, name: c.name, won: d.won, ms: d.ms, stars: d.stars });
  }
  return rankRows(rows);
}

export const istDate = (nowMs = Date.now()) => iso(nowMs + IST_OFFSET_MIN * 60000);
