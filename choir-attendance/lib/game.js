// Rules, scores, badges and leaderboards for the singing game. Pure functions on plain data, so they can be tested.
// Only small numbers are kept per child: no audio and no recordings, ever.
import { LEVELS, DAILY_COUNT, STAGES, stageSpec, starsFor, isTimed, UNTIMED_CAP_MS } from '../public/levels.js';
import { IST_OFFSET_MIN } from './schedule.js';

export const PASS_SHARE = 0.7;
export const TOP_SCORES = 3; // each child keeps their best three scores for every stage (date only)
export class GameError extends Error {}
// Thrown when a child has not been unlocked yet: Warm-up and Level 1 are free, the rest of the game is paid.
export class PaywallError extends GameError {}
export const FREE_LEVELS = 1;
export const FREE_WARMUPS = 3; // free Warm-up sessions (one per day) before it becomes part of the full game

export const emptyGame = () => ({ kids: {}, daily: {} });
export const emptyKid = () => ({ cleared: [], stages: {}, best: {}, top: {}, weekly: {}, badges: {}, dailyDays: [], paid: false, paidOn: '', paidUntil: '', warmups: 0, warmupLast: '' });

// The full game is paid for one year at a time (365 days).
export const YEAR_DAYS = 365;
const addDays = (date, n) => iso(Date.parse(`${date}T00:00:00Z`) + n * dayMs);

// Is the full game unlocked for this child on this date? (Expires after a year; the date is the day it ends.)
export function isPaid(kid, today = istDate()) {
  if (!kid?.paid) return false;
  const until = kid.paidUntil || addDays(kid.paidOn || '1970-01-01', YEAR_DAYS); // older records: a year from the day it was unlocked
  return today < until;
}
export const paidUntilOf = (kid) => (kid?.paid ? kid.paidUntil || addDays(kid.paidOn || '1970-01-01', YEAR_DAYS) : '');
export const daysLeft = (kid, today = istDate()) => (kid?.paid ? Math.round((Date.parse(`${paidUntilOf(kid)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / dayMs) : 0);
export const wasPaid = (kid) => Boolean(kid?.paid); // true even after the year ended: shown as "expired, renew"

// The teacher unlocks (or locks) the full game for one child after a payment. Unlocking gives 365 days;
// renewing while it is still running adds a year to the end date.
export function setPaid(game, childId, paid, today) {
  const kid = (game.kids[childId] ??= emptyKid());
  if (paid) {
    const active = isPaid(kid, today);
    const base = active ? paidUntilOf(kid) : today;
    kid.paidOn = active ? kid.paidOn : today;
    kid.paid = true;
    kid.paidUntil = addDays(base, YEAR_DAYS);
  } else { kid.paid = false; kid.paidOn = ''; kid.paidUntil = ''; }
  return kid;
}

// Free Warm-up sessions still available (null = unlimited, the child has the full game).
export const warmupsLeft = (kid, today = istDate()) => (isPaid(kid, today) ? null : Math.max(0, FREE_WARMUPS - (kid?.warmups ?? 0)));

// The teacher gives a child their three free Warm-up sessions again.
export function resetWarmups(game, childId) {
  const kid = (game.kids[childId] ??= emptyKid());
  kid.warmups = 0;
  kid.warmupLast = '';
  return kid;
}

// Everyone gets their three free Warm-up sessions again. Returns how many children had used some.
export function resetAllWarmups(game) {
  let n = 0;
  for (const kid of Object.values(game.kids)) { if (kid.warmups || kid.warmupLast) n += 1; kid.warmups = 0; kid.warmupLast = ''; }
  return n;
}

// Opening the Warm-up room. One session per day: opening it again the same day is the same session.
export function useWarmup(game, childId, today) {
  const kid = (game.kids[childId] ??= emptyKid());
  if (isPaid(kid, today) || kid.warmupLast === today) return { left: warmupsLeft(kid, today) };
  if ((kid.warmups ?? 0) >= FREE_WARMUPS) throw new PaywallError('The free Warm-up sessions are used up. Unlock the full game to keep warming up');
  kid.warmups = (kid.warmups ?? 0) + 1;
  kid.warmupLast = today;
  return { left: warmupsLeft(kid, today) };
}

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
export function checkResults(results, expected, timed = true) {
  if (!Array.isArray(results) || results.length !== expected) throw new GameError('That round was not complete');
  return results.map((r, i) => {
    if (typeof r?.won !== 'boolean') throw new GameError(`Result ${i + 1} looks wrong`);
    const limit = num(r.limit, 5000, 40000, 'Time limit');
    const ms = num(r.ms, r.won ? 400 : 0, timed ? limit + 1000 : UNTIMED_CAP_MS, 'Time');
    const err = r.err == null ? null : num(r.err, 0, 600, 'Accuracy');
    const hints = Math.round(num(r.hints ?? 0, 0, 50, 'Hints'));
    return { won: r.won, ms: Math.round(ms), limit: Math.round(limit), err, hints };
  });
}

export function scoreRound(results) {
  const won = results.filter((r) => r.won).length;
  const ms = results.reduce((s, r) => s + r.ms, 0);
  const pass = won >= results.length * PASS_SHARE;
  return { won, ms, pass, stars: pass ? starsFor(results, (i) => results[i].limit) : 0 }; // stars are only for a passed round
}

// Better round = more matched, then less time.
const better = (a, b) => !b || a.won > b.won || (a.won === b.won && a.ms < b.ms);

export const maxPlayable = (kid) => Math.min(LEVELS.length, Math.max(0, ...kid.cleared) + 1);
// The highest stage of a level that can be played now (1 to 3), or 0 if the level is still locked.
export const maxStage = (kid, level) => (level > maxPlayable(kid) ? 0 : Math.min(STAGES.length, (kid.stages?.[level] ?? 0) + 1));

function longestRun(results) {
  let best = 0, run = 0;
  for (const r of results) { run = r.won ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

// Records a finished stage of a level. Returns { score, newBadges, levelCleared }. Throws GameError if it is not allowed.
export function applyRound(game, childId, level, stage, rawResults, today) {
  const lv = LEVELS.find((l) => l.id === level);
  if (!lv || !STAGES.some((s) => s.stage === stage)) throw new GameError('Unknown level');
  const kid = (game.kids[childId] ??= emptyKid());
  kid.stages ??= {};
  if (level > FREE_LEVELS && !isPaid(kid, today)) throw new PaywallError('Unlock the full game to play this level');
  if (stage > maxStage(kid, level)) throw new GameError(level > maxPlayable(kid) ? 'Clear the level before this one first' : 'Clear the stage before this one first');
  const results = checkResults(rawResults, stageSpec(level, stage).count, isTimed(level));
  const score = scoreRound(results);
  const week = weekKeyOf(today);
  const key = `${level}.${stage}`;

  // The best three scores of this stage, each with the date only.
  kid.top ??= {};
  const list = (kid.top[key] ??= kid.best[key] ? [{ ...kid.best[key] }] : []);
  const personalBest = better(score, list[0]); // beat their own best on this stage
  list.push({ won: score.won, ms: score.ms, stars: score.stars, on: today });
  list.sort((a, b) => b.won - a.won || a.ms - b.ms || a.on.localeCompare(b.on));
  list.length = Math.min(list.length, TOP_SCORES);
  kid.best[key] = list[0];
  if (stage === STAGES.length) { // only the full showdown counts for the weekly board
    kid.weekly[week] ??= {};
    if (better(score, kid.weekly[week][level])) kid.weekly[week][level] = { won: score.won, ms: score.ms };
  }
  for (const w of Object.keys(kid.weekly)) if (w < weekKeyOf(iso(Date.parse(`${today}T00:00:00Z`) - 28 * dayMs))) delete kid.weekly[w]; // keep about a month
  let levelCleared = false;
  if (score.pass && (kid.stages[level] ?? 0) < stage) kid.stages[level] = stage;
  if (score.pass && stage === STAGES.length && !kid.cleared.includes(level)) { kid.cleared.push(level); levelCleared = true; }

  const earned = [];
  const give = (id) => { if (!kid.badges[id]) { kid.badges[id] = today; earned.push(id); } };
  const showdown = stage === STAGES.length;
  if (score.won > 0) give('first_note');
  if (score.pass && showdown && level >= 2 && results.every((r) => r.hints === 0)) give('no_hints');
  if (longestRun(results) >= 10) give('ten_in_row');
  const wins = results.filter((r) => r.won);
  if (level >= 3 && wins.length >= 5 && wins.every((r) => r.err != null && r.err <= 10)) give('perfect_pitch');
  if (level >= 3 && showdown && score.stars === 3) give('triple_star');
  if (score.pass && showdown && level >= 6) give('amateur');
  if (score.pass && showdown && level >= 9) give('pro');
  if (score.pass && showdown && level >= 11) give('expert');
  if (score.pass && showdown && level >= 12) give('legend');
  return { score, newBadges: earned, levelCleared, personalBest };
}

// One try per child per day at the daily Legend challenge. Later tries are ignored (and reported).
export function applyDaily(game, childId, today, rawResults) {
  const results = checkResults(rawResults, DAILY_COUNT);
  const day = (game.daily[today] ??= {});
  const kid = (game.kids[childId] ??= emptyKid());
  if (!isPaid(kid, today)) throw new PaywallError('Unlock the full game to play the daily challenge');
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

// Weekly board for a level: each child's best showdown (stage 3) this week.
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
