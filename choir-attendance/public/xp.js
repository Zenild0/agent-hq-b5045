// Gamification that lives on the phone: XP, a daily goal, a day streak (one missed day a week is forgiven), titles and badges.
// Nothing here is sent anywhere. A leaderboard can be added later (for children who have purchased); it is switched off for now.
export const LEADERBOARD_ON = false;
export const DAILY_GOAL = 15;     // XP a day. Small on purpose: about one lesson or one short quiz.
export const DAY_CAP = 150;       // XP counted per day, so nobody farms points
export const TITLES = [[0, 'Newcomer'], [60, 'Beginner'], [200, 'Chorister'], [500, 'Singer'], [1000, 'Soloist'], [2000, 'Maestro']];

const dayMs = 86400000;
const toMs = (d) => Date.parse(`${d}T00:00:00Z`);
export const daysBetween = (a, b) => Math.round((toMs(b) - toMs(a)) / dayMs);
export function weekKey(date) { // ISO week, Monday first
  const d = new Date(toMs(date));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const wk = 1 + Math.round(((d - first) / dayMs - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
export const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
export const titleFor = (xp) => [...TITLES].reverse().find(([min]) => xp >= min)[1];
export const nextTitle = (xp) => TITLES.find(([min]) => min > xp) ?? null;

export const BADGES = [
  { id: 'first_lesson', emoji: '📖', name: 'First lesson', desc: 'Finish a lesson.' },
  { id: 'first_pass', emoji: '🎵', name: 'First pass', desc: 'Pass a quiz.' },
  { id: 'perfect', emoji: '⭐', name: 'Perfect quiz', desc: 'Get three stars on a quiz.' },
  { id: 'streak3', emoji: '🔥', name: '3-day streak', desc: 'Reach your daily goal 3 days in a row.' },
  { id: 'streak7', emoji: '🔥', name: 'Week streak', desc: '7 days in a row.' },
  { id: 'streak30', emoji: '🏅', name: 'Month streak', desc: '30 days in a row.' },
  { id: 'xp100', emoji: '⚡', name: '100 XP', desc: 'Earn 100 XP.' },
  { id: 'xp500', emoji: '⚡', name: '500 XP', desc: 'Earn 500 XP.' },
  { id: 'reviewer', emoji: '🔁', name: 'Revision master', desc: 'Get 20 revision notes right.' },
  { id: 'reader', emoji: '🎼', name: 'Sight reader', desc: 'Pass a Read the staff quiz.' },
  { id: 'explorer', emoji: '🧭', name: 'Explorer', desc: 'Try both training games.' },
];

const blank = () => ({ pending: {}, total: 0, byDay: {}, streak: { current: 0, best: 0, last: '', freeze: { week: '', used: false } }, badges: {}, done: {}, counts: { review: 0 }, games: {} });

// store: { load(): object|null, save(object) }. today(): 'YYYY-MM-DD'.
export function makeXp(store, today = istToday) {
  let s = (() => { try { return { ...blank(), ...(store.load() || {}) }; } catch { return blank(); } })();
  const persist = () => { try { store.save(s); } catch { /* storage full or private mode */ } };

  // Is the streak still alive today? (shown on screen; one missed day in a week is forgiven)
  const liveStreak = () => {
    const t = today(), st = s.streak;
    if (!st.last) return 0;
    const missed = daysBetween(st.last, t) - 1;
    if (missed <= 0) return st.current;
    if (missed === 1 && freezeAvailable(t)) return st.current;
    return 0;
  };
  const freezeAvailable = (date) => !(s.streak.freeze.week === weekKey(date) && s.streak.freeze.used);

  function reachGoal(t) {
    const st = s.streak;
    if (st.last === t) return;
    const missed = st.last ? daysBetween(st.last, t) - 1 : 0;
    if (!st.last || missed < 0) st.current = 1;
    else if (missed === 0) st.current += 1;
    else if (missed === 1 && freezeAvailable(t)) { st.current += 1; st.freeze = { week: weekKey(t), used: true }; }
    else st.current = 1;
    st.best = Math.max(st.best, st.current);
    st.last = t;
  }

  // kind: lesson | practice | quiz | level. detail: { unit, won, total, stars, passed, review (right revision notes), game }
  function award(kind, d = {}) {
    const t = today();
    let gain = 0;
    if (kind === 'lesson') { const k = `lesson:${d.unit}`; gain = s.done[k] ? 2 : 10; s.done[k] = true; }
    else if (kind === 'practice') gain = 5 + Math.min(10, d.won ?? 0);
    else if (kind === 'quiz') gain = d.passed ? 20 + 5 * (d.stars ?? 0) : 3 + (d.won ?? 0);
    else if (kind === 'level') gain = d.passed ? 15 + 5 * (d.stars ?? 0) : 3;
    gain += d.review ?? 0; // a point for every revision note you got right
    const used = s.byDay[t] ?? 0;
    gain = Math.max(0, Math.min(gain, DAY_CAP - used));
    const before = s.total;
    s.total += gain;
    s.byDay[t] = used + gain;
    if (gain) { s.pending = s.pending || {}; s.pending[t] = (s.pending[t] ?? 0) + gain; for (const k of Object.keys(s.pending)) if (daysBetween(k, t) > 14) delete s.pending[k]; } // what the server has not been told yet
    for (const k of Object.keys(s.byDay)) if (daysBetween(k, t) > 60) delete s.byDay[k]; // keep it small
    s.counts.review += d.review ?? 0;
    if (d.game) s.games[d.game] = true;
    const reached = used < DAILY_GOAL && s.byDay[t] >= DAILY_GOAL;
    if (s.byDay[t] >= DAILY_GOAL) reachGoal(t);
    const had = new Set(Object.keys(s.badges));
    const give = (id, cond) => { if (cond && !s.badges[id]) s.badges[id] = t; };
    give('first_lesson', kind === 'lesson');
    give('first_pass', (kind === 'quiz' || kind === 'level') && d.passed);
    give('perfect', (kind === 'quiz' || kind === 'level') && d.passed && d.stars === 3);
    give('streak3', s.streak.current >= 3); give('streak7', s.streak.current >= 7); give('streak30', s.streak.current >= 30);
    give('xp100', s.total >= 100); give('xp500', s.total >= 500);
    give('reviewer', s.counts.review >= 20);
    give('reader', kind === 'quiz' && d.passed && d.reading);
    give('explorer', Object.keys(s.games).length >= 2);
    const newBadges = BADGES.filter((b) => s.badges[b.id] && !had.has(b.id));
    const oldTitle = titleFor(before), newTitle = titleFor(s.total);
    persist();
    return { gained: gain, total: s.total, goalReached: reached, streak: liveStreak(), newBadges, newTitle: newTitle !== oldTitle ? newTitle : null, capped: gain === 0 && used >= DAY_CAP };
  }

  const view = () => {
    const t = today();
    const todayXp = s.byDay[t] ?? 0;
    const nt = nextTitle(s.total);
    return {
      total: s.total, today: todayXp, goal: DAILY_GOAL, goalMet: todayXp >= DAILY_GOAL, goalShare: Math.min(1, todayXp / DAILY_GOAL),
      streak: liveStreak(), best: s.streak.best, atRisk: liveStreak() > 0 && s.streak.last !== t, freezeLeft: freezeAvailable(t),
      title: titleFor(s.total), next: nt ? { title: nt[1], need: nt[0] - s.total } : null,
      badges: BADGES.map((b) => ({ ...b, got: Boolean(s.badges[b.id]) })),
    };
  };
  // What to tell the server (only used while the leaderboard is switched on): XP per day not yet sent, plus the streak.
  const report = (units = 0) => ({ days: { ...(s.pending || {}) }, streak: liveStreak(), best: s.streak.best, units });
  return { award, view, report, hasPending: () => Object.keys(s.pending || {}).length > 0, clearPending() { s.pending = {}; persist(); }, reset() { s = blank(); persist(); } };
}

// The real one for a person on this phone (each child code has its own).
export function xpFor(code = 'me') {
  const key = `choir-xp:${code}`;
  return makeXp({
    load: () => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
    save: (v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } },
  });
}

// A small card for the top of a games screen.
export function xpCardHtml(v) {
  return `
    <div class="card xp-card">
      <div class="xp-top"><span class="xp-chip fire" title="Day streak">🔥 ${v.streak} day${v.streak === 1 ? '' : 's'}</span><span class="xp-chip">⚡ ${v.total} XP</span><span class="xp-chip title">${v.title}</span></div>
      <div class="xp-goal"><div class="xp-ring" style="--p:${v.goalShare}"><span>${Math.min(v.today, v.goal)}/${v.goal}</span></div>
        <div class="grow"><b>${v.goalMet ? 'Daily goal done!' : `Daily goal: ${v.goal} XP`}</b>
          <div class="muted">${v.goalMet ? 'Come back tomorrow to keep your streak.' : v.atRisk ? `Earn ${v.goal - v.today} more XP today to keep your ${v.streak}-day streak.` : `Earn ${v.goal - v.today} more XP to start a streak.`}${v.next ? ` ${v.next.need} XP to ${v.next.title}.` : ''}</div>
          <div class="muted" style="font-size:.75rem">One missed day a week is forgiven${v.freezeLeft ? ' (this week\'s is ready).' : ' (used this week).'}</div></div></div>
    </div>`;
}
export const badgesHtml = (v) => `<div class="gm-badges">${v.badges.map((b) => `<div class="gm-badge${b.got ? ' got' : ''}" title="${b.desc}"><span>${b.emoji}</span><b>${b.name}</b><small>${b.desc}</small></div>`).join('')}</div>`;

// What to say after an award.
export const awardLine = (a) => (a.gained ? `+${a.gained} XP${a.goalReached ? ' · daily goal reached! 🔥 ' + a.streak + '-day streak' : ''}${a.newTitle ? ` · new title: ${a.newTitle}!` : ''}${a.newBadges.length ? ` · badge: ${a.newBadges.map((b) => `${b.emoji} ${b.name}`).join(', ')}` : ''}` : (a.capped ? 'You have earned plenty today. Rest your voice!' : ''));
