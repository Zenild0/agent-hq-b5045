// The singing game inside the parent app: a journey up the piano, levels with three stages each,
// daily challenge, weekly boards, badges and a warm-up room.
// Loaded only when the game opens, so a problem here can never stop the rest of the app.
import { api, esc } from './common.js';
import { openAudio, micMessage } from './audio.js';
import { createPlayer } from './player.js';
import { mountWarmup } from './warmup.js';
import { LEVELS, STAGES, stageSpec, buildDeck, dailyDeck, titleFor, PIANO_KEYS, starsFor } from './levels.js';
import { BADGES } from './badges.js';

const CACHE = 'choir-cache:game|';
const QUEUE = 'choir-cache:gamequeue';
const PREVIEW = 'choir-preview-game';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };
const fmtMs = (ms) => `${(ms / 1000).toFixed(1)} s`;
const stars = (n) => '⭐'.repeat(n || 0);
const WHITE = [{ lv: 1, x: 0 }, { lv: 3, x: 1 }, { lv: 5, x: 2 }, { lv: 6, x: 3 }, { lv: 8, x: 4 }, { lv: 10, x: 5 }, { lv: 12, x: 6 }];
const BLACK = [{ lv: 2, x: 0.68 }, { lv: 4, x: 1.68 }, { lv: 7, x: 3.68 }, { lv: 9, x: 4.68 }, { lv: 11, x: 5.68 }];

// `preview` = the hidden test version: every level is open and progress stays on this phone only.
export function mountGame(root, { code = '', preview = false } = {}) {
  let state = null, offline = false, view = 'home', selected = 1, current = null, audio = null;
  const maxPlayableOf = (cleared) => Math.min(LEVELS.length, Math.max(0, ...cleared) + 1);

  // ---------- data: the server, or this phone in preview mode ----------
  const call = (path, opts = {}) => api(`game${path}`, { code, ...opts });
  function previewState() {
    const p = read(PREVIEW, { cleared: [], stages: {}, best: {}, badges: {} });
    const paid = read('choir-preview-paid', true);
    return {
      paid,
      pay: paid ? null : { price: 500, mobile: '98200 00000', upi: 'choir@upi' },
      levels: LEVELS.map((l) => ({ ...l, stages: STAGES.map((st) => stageSpec(l.id, st.stage)) })),
      me: { id: 'preview', name: 'Tester', paid, cleared: p.cleared, stages: p.stages, best: p.best, badges: p.badges, maxPlayable: maxPlayableOf(p.cleared), dailyStreak: 0 },
      daily: null, weekly: { level: selected, board: { top: [], me: null, total: 0 } },
    };
  }
  async function load(level) {
    if (preview) { state = previewState(); return state; }
    try {
      state = await call(level ? `?level=${level}` : '');
      write(`${CACHE}${code}`, state); offline = false;
    } catch (e) {
      if (e.status) throw e; // the server answered: show that
      state = read(`${CACHE}${code}`, null); offline = true;
      if (!state) throw e;
    }
    return state;
  }
  async function submit(kind, level, stage, results) {
    if (preview) {
      const p = read(PREVIEW, { cleared: [], stages: {}, best: {}, badges: {} });
      const spec = stageSpec(level, stage);
      const won = results.filter((r) => r.won).length, ms = results.reduce((a, r) => a + r.ms, 0);
      const pass = won >= spec.count * 0.7, st = starsFor(results, (i) => results[i].limit);
      const key = `${level}.${stage}`;
      if (!p.best[key] || won > p.best[key].won || (won === p.best[key].won && ms < p.best[key].ms)) p.best[key] = { won, ms, stars: st };
      let levelCleared = false;
      if (pass && (p.stages[level] ?? 0) < stage) p.stages[level] = stage;
      if (pass && stage === 3 && !p.cleared.includes(level)) { p.cleared.push(level); levelCleared = true; }
      write(PREVIEW, p);
      state = previewState();
      return { score: { won, ms, pass, stars: st }, newBadges: [], levelCleared, state };
    }
    const out = await call(kind === 'daily' ? '/daily' : '/round', { method: 'POST', body: kind === 'daily' ? { results } : { level, stage, results } });
    state = out.state; write(`${CACHE}${code}`, state); offline = false;
    return out;
  }
  async function flushQueue() {
    const q = read(QUEUE, []);
    if (!q.length || offline || preview) return;
    const left = [];
    for (const item of q) {
      try { await call('/round', { method: 'POST', body: item }); } catch (e) { if (!e.status) left.push(item); } // a refused round is dropped
    }
    write(QUEUE, left);
  }

  // ---------- helpers ----------
  const paid = () => Boolean(state.me.paid);
  const behindPay = (level) => level > 1 && !paid(); // Level 1 and the Warm-up are free
  const unlocked = (level, stage = 1) => !behindPay(level) && (preview || (level <= state.me.maxPlayable && (state.me.stages[level] ?? 0) >= stage - 1));
  const nextTarget = () => { // what "Continue" plays: the next stage on the road
    const level = state.me.maxPlayable;
    return { level, stage: Math.min(3, (state.me.stages[level] ?? 0) + 1) };
  };
  const levelOf = (id) => state.levels.find((l) => l.id === id);
  const boardHtml = (b, meId, count) => !b?.top?.length ? '<div class="muted">No scores yet. Be the first!</div>' : `
    <div class="gm-board">${b.top.map((r) => `
      <div class="gm-row${r.id === meId ? ' me' : ''}"><span class="gm-rank">${r.rank}</span><span class="gm-name">${esc(r.name)}</span>
        <span class="gm-score">${r.won}${count ? `/${count}` : ''} · ${fmtMs(r.ms)}</span></div>`).join('')}
      ${b.me ? `<div class="gm-row me"><span class="gm-rank">${b.me.rank}</span><span class="gm-name">You</span><span class="gm-score">${b.me.won}${count ? `/${count}` : ''} · ${fmtMs(b.me.ms)}</span></div>` : ''}
    </div>`;

  // How to pay: parents pay the teacher directly, then the teacher unlocks their child.
  function unlockHtml() {
    const p = state.pay || {};
    const price = p.price ?? 500;
    const upiLink = p.upi ? `upi://pay?pa=${encodeURIComponent(p.upi)}&pn=${encodeURIComponent("Children's Choir")}&am=${price}&cu=INR&tn=${encodeURIComponent('Choir singing game')}` : '';
    return `
      <div class="card gm-unlock">
        <h3 style="margin:0">Unlock the full game · ₹${esc(price)}</h3>
        <div>Warm-up and Level 1 are free. The full game adds <b>Level 2 to Legend</b>, the <b>daily Legend challenge</b> and the <b>weekly leaderboards</b>.</div>
        ${p.mobile || p.upi ? `
          <div class="gm-pay">
            ${p.mobile ? `<div>Pay <b>₹${esc(price)}</b> to mobile number <b>${esc(p.mobile)}</b> <button class="btn small" data-copy="${esc(p.mobile)}">Copy number</button></div>` : ''}
            ${p.upi ? `<div>UPI ID: <b>${esc(p.upi)}</b> <button class="btn small" data-copy="${esc(p.upi)}">Copy UPI ID</button></div>
              <a class="btn small primary" href="${esc(upiLink)}">Open my UPI app</a>` : ''}
          </div>` : '<div class="muted">Please ask your choir teacher how to pay.</div>'}
        <div class="muted">After you pay, tell your choir teacher. They will unlock the full game for your child.</div>
      </div>`;
  }

  // The journey: one piano key per level. A cleared level lights its key.
  function pianoHtml() {
    const me = state.me, W = 50, H = 118;
    const done = (lv) => me.cleared.includes(lv);
    const now = me.maxPlayable;
    const label = (lv) => `Level ${lv} ${levelOf(lv).name}${done(lv) ? ', cleared' : ''}`;
    const white = WHITE.map(({ lv, x }) => `
      <g data-lv="${lv}" role="button" tabindex="0" aria-label="${esc(label(lv))}">
        <rect class="pk w${done(lv) ? ' got' : ''}${lv === now && !done(lv) ? ' now' : ''}" x="${x * W + 1}" y="1" width="${W - 2}" height="${H}" rx="6"/>
        <text x="${x * W + W / 2}" y="${H - 8}" text-anchor="middle" class="pn">${lv}</text></g>`).join('');
    const black = BLACK.map(({ lv, x }) => `
      <g data-lv="${lv}" role="button" tabindex="0" aria-label="${esc(label(lv))}">
        <rect class="pk b${done(lv) ? ' got' : ''}${lv === now && !done(lv) ? ' now' : ''}" x="${x * W}" y="1" width="31" height="72" rx="5"/>
        <text x="${x * W + 15.5}" y="62" text-anchor="middle" class="pn pb">${lv}</text></g>`).join('');
    return `<svg class="gm-piano" viewBox="0 0 ${7 * W} ${H + 2}" role="group" aria-label="Your journey on the piano">${white}${black}</svg>`;
  }

  // ---------- screens ----------
  function home() {
    view = 'home';
    const me = state.me, top = Math.max(0, ...me.cleared), t = nextTarget();
    const lv = levelOf(t.level);
    const allDone = me.cleared.length >= LEVELS.length;
    const d = state.daily;
    root.innerHTML = `
      ${preview ? `<div class="alert warn">Test version: your progress stays on this phone only. You are viewing the <b>${paid() ? 'paid' : 'free'}</b> game. <button class="btn small" data-a="togglePaid">Show the ${paid() ? 'free' : 'paid'} game</button></div>` : ''}
      <div class="card gm-hero">
        <div class="muted">Your journey</div>
        <h2 class="gm-title">${esc(titleFor(top))}</h2>
        <div class="muted">${me.cleared.length} of ${LEVELS.length} levels cleared${!preview && me.dailyStreak > 1 ? ` · 🔥 ${me.dailyStreak} days in a row` : ''}${offline ? ' · offline' : ''}</div>
        ${pianoHtml()}
        <div class="muted gm-tip">Each cleared level lights a piano key. Tap a key to open that level.</div>
        ${allDone ? '<div class="gm-new">You have cleared every level. Legend!</div>' : behindPay(t.level) ? '<button class="btn primary gm-cta" data-a="unlock">🔓 Unlock the full game to keep going</button>' : `<button class="btn primary gm-cta" data-a="continue">▶ Continue: ${esc(lv.name)}, Stage ${t.stage}</button>`}
        <div class="row"><button class="btn" data-a="levels">All levels</button><button class="btn" data-a="warm">🔥 Warm-up</button></div>
      </div>
      ${!paid() ? `<div id="unlock">${unlockHtml()}</div>` : ''}
      ${d ? `<div class="card">
        <h3 style="margin:0 0 4px">Today's Legend challenge</h3>
        ${d.mine ? `<div>You scored <b>${d.mine.won} of ${d.count}</b> in ${fmtMs(d.mine.ms)} ${stars(d.mine.stars)}</div><div class="muted">One try a day. Come back tomorrow!</div>`
          : `<div class="muted">${d.count} hard notes, the same for everyone today. You get one try.</div><button class="btn primary" data-a="daily"${offline ? ' disabled' : ''}>${offline ? 'Needs internet' : "▶ Play today's challenge"}</button>`}
        <h4 style="margin:10px 0 4px">Today's board</h4>
        ${boardHtml(d.board, me.id, d.count)}
      </div>` : ''}
      <div class="card">
        <h3 style="margin:0 0 6px">Badges</h3>
        <div class="gm-badges">${BADGES.map((b) => `<div class="gm-badge${me.badges[b.id] ? ' got' : ''}" title="${esc(b.desc)}"><span>${b.emoji}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`).join('')}</div>
      </div>`;
  }

  function levels() {
    view = 'levels';
    const me = state.me;
    root.innerHTML = `
      <div class="card">
        <div class="row between"><h2 style="margin:0">Levels</h2><button class="btn small" data-a="home">← Back</button></div>
        <div class="muted">Each level has three stages. Clear all three to light its piano key.</div>
        <div class="gm-list">${state.levels.map((l) => {
          const open = unlocked(l.id), got = me.stages[l.id] ?? 0, done = me.cleared.includes(l.id);
          return `<button class="gm-lvcard${open ? '' : ' lock'}${done ? ' done' : ''}" data-lv="${l.id}" aria-label="Level ${l.id} ${esc(l.name)}${open ? '' : ', locked'}">
            <span class="gm-n">${l.id}</span>
            <span class="gm-lvt"><b>${esc(l.name)}</b><small>${esc(l.tier)}</small></span>
            <span class="gm-pips" aria-label="${got} of 3 stages cleared">${open ? [1, 2, 3].map((s) => (s <= got ? '●' : '○')).join('') : behindPay(l.id) ? '🔒 Full game' : '🔒'}</span></button>`;
        }).join('')}</div>
      </div>`;
  }

  function level(id) {
    view = 'level'; selected = id;
    const l = levelOf(id), me = state.me;
    root.innerHTML = `
      <div class="card">
        <div class="row between"><h2 style="margin:0">Level ${l.id}: ${esc(l.name)}</h2><button class="btn small" data-a="levels">← Levels</button></div>
        <div class="muted">${esc(l.tier)}</div>
        <div style="margin:6px 0">${esc(l.how)}</div>
        ${behindPay(l.id) ? unlockHtml() : ''}
        <div class="gm-stages">${l.stages.map((s) => {
          const open = unlocked(l.id, s.stage), best = me.best[`${l.id}.${s.stage}`], got = (me.stages[l.id] ?? 0) >= s.stage;
          return `<div class="gm-stage${got ? ' done' : ''}${open ? '' : ' lock'}">
            <div><b>Stage ${s.stage}: ${esc(s.name)}</b> ${got ? '✓' : ''}<div class="muted">${s.count} challenges · margin ±${s.tol} cents${best ? ` · best ${best.won}/${s.count} in ${fmtMs(best.ms)} ${stars(best.stars)}` : ''}</div></div>
            ${open ? `<button class="btn ${got ? '' : 'primary'} small" data-play="${s.stage}">${got ? 'Play again' : '▶ Play'}</button>` : '<span class="muted">🔒</span>'}</div>`;
        }).join('')}</div>
        ${preview || !state.weekly?.board ? '' : `<h4 style="margin:12px 0 4px">This week's showdowns</h4>
        ${boardHtml(state.weekly.level === id ? state.weekly.board : null, me.id, l.count)}
        <div class="muted">Only Stage 3 counts for the weekly board.</div>`}
      </div>`;
  }

  // ---------- playing ----------
  async function play(kind, lvId, stage) {
    try { audio = await openAudio(); } catch (e) { root.insertAdjacentHTML('afterbegin', `<div class="alert bad">${esc(micMessage(e))}</div>`); return; }
    const l = levelOf(lvId);
    const deck = kind === 'daily' ? dailyDeck(state.daily.seed) : buildDeck(lvId, Math.random, stage);
    const heading = kind === 'daily' ? "Today's Legend challenge" : `${esc(l.name)} · Stage ${stage}`;
    current = createPlayer(root, {
      audio, deck, heading,
      onExit: () => { audio?.close(); audio = null; back(); },
      onDone: (results) => { current?.destroy(); audio?.close(); audio = null; finishRound(kind, lvId, stage, results); },
    });
  }

  async function finishRound(kind, lvId, stage, results) {
    root.innerHTML = '<div class="card"><div class="muted">Saving your score…</div></div>';
    let out = null, queued = false;
    try { out = await submit(kind, lvId, stage, results); }
    catch (e) {
      if (!e.status && kind !== 'daily') { write(QUEUE, [...read(QUEUE, []), { level: lvId, stage, results }]); queued = true; }
      else { root.innerHTML = `<div class="card"><div class="alert bad">${esc(e.message)}</div><button class="btn primary" data-a="back">OK</button></div>`; return; }
    }
    const won = results.filter((r) => r.won).length, ms = results.reduce((a, r) => a + r.ms, 0);
    const sc = out?.score ?? { won, ms, pass: won >= results.length * 0.7, stars: 0 };
    const newB = (out?.newBadges ?? []).map((id) => BADGES.find((b) => b.id === id)).filter(Boolean);
    const l = levelOf(lvId), nextLevel = state.levels.find((x) => x.id === lvId + 1);
    const headline = out?.already ? 'Already played today' : kind === 'daily' ? 'Daily challenge done!'
      : out?.levelCleared ? `🏆 Level cleared: ${l.name}!` : sc.pass ? `Stage ${stage} cleared!` : 'Good try. Practise and go again!';
    const nextStage = sc.pass && stage < 3 ? stage + 1 : 0;
    root.innerHTML = `
      <div class="card gm-result">
        <h2 style="margin:0">${headline}</h2>
        <div class="gm-big">${sc.won} of ${results.length}</div>
        <div>${fmtMs(sc.ms)} ${stars(sc.stars)}</div>
        ${out?.levelCleared ? `<div class="gm-new">A piano key just lit up!${nextLevel ? ` Next: ${esc(nextLevel.name)}` : ''}</div>` : ''}
        ${queued ? '<div class="muted">No signal: your score is saved on this phone and will be sent when you are online.</div>' : ''}
        ${out?.already ? '<div class="muted">Your first try today is the one that counts.</div>' : ''}
        ${newB.length ? `<div class="gm-new">New badge${newB.length > 1 ? 's' : ''}: ${newB.map((b) => `${b.emoji} ${esc(b.name)}`).join(', ')}</div>` : ''}
        ${nextStage ? `<button class="btn primary" data-play="${nextStage}" data-lvl="${lvId}">▶ Next: Stage ${nextStage}</button>` : ''}
        ${kind !== 'daily' && !sc.pass ? `<button class="btn primary" data-play="${stage}" data-lvl="${lvId}">🔁 Try again</button>` : ''}
        <button class="btn" data-a="${kind === 'daily' ? 'home' : 'toLevel'}" data-lvl="${lvId}">Back</button>
      </div>`;
  }

  async function back() {
    try { await load(selected); } catch { /* use what we have */ }
    if (view === 'level') level(selected); else if (view === 'levels') levels(); else home();
  }
  async function openLevel(id) {
    selected = id;
    try { await load(id); } catch { /* keep what we have */ }
    level(id);
  }

  root.addEventListener('click', (e) => {
    const cp = e.target.closest('[data-copy]');
    if (cp) { // copy a number or UPI ID; if the phone refuses, show it to select
      const text = cp.dataset.copy;
      navigator.clipboard?.writeText(text).then(() => { cp.textContent = 'Copied ✓'; }, () => { cp.textContent = text; });
      return;
    }
    const b = e.target.closest('[data-a], [data-lv], [data-play]');
    if (!b) return;
    if (b.dataset.play) return play('level', Number(b.dataset.lvl) || selected, Number(b.dataset.play));
    if (b.dataset.lv) { const id = Number(b.dataset.lv); return unlocked(id) || behindPay(id) ? openLevel(id) : undefined; }
    const a = b.dataset.a;
    if (a === 'home') return home();
    if (a === 'levels') return levels();
    if (a === 'continue') { const t = nextTarget(); selected = t.level; return play('level', t.level, t.stage); }
    if (a === 'daily') return play('daily', 12, 3);
    if (a === 'back') return back();
    if (a === 'unlock') { home(); return document.getElementById('unlock')?.scrollIntoView({ behavior: 'smooth' }); }
    if (a === 'togglePaid') { write('choir-preview-paid', !paid()); return load().then(home); }
    if (a === 'toLevel') return openLevel(Number(b.dataset.lvl) || selected);
    if (a === 'warm') { const w = mountWarmup(root, { onExit: () => { w.destroy(); home(); } }); current = w; }
  });
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-lv]')) { e.preventDefault(); e.target.closest('[data-lv]').dispatchEvent(new MouseEvent('click', { bubbles: true })); } });

  (async () => {
    try { await load(); if (!preview) { await flushQueue(); if (!offline) await load(); } selected = Math.min(state.me.maxPlayable, 12); home(); }
    catch (e) { root.innerHTML = `<div class="card"><div class="alert bad">${esc(e.message)}</div></div>`; }
  })();

  return { destroy() { current?.destroy?.(); audio?.close(); } };
}
