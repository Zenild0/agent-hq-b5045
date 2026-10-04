// The singing game inside the parent app: levels, daily challenge, weekly boards, badges, warm-up.
// Loaded only when the child's page opens the game, so a problem here can never stop the rest of the app.
import { api, esc } from './common.js';
import { openAudio, micMessage } from './audio.js';
import { createPlayer } from './player.js';
import { mountWarmup } from './warmup.js';
import { buildDeck, dailyDeck } from './levels.js';
import { BADGES } from './badges.js';

const CACHE = 'choir-cache:game|';
const QUEUE = 'choir-cache:gamequeue';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };
const fmtMs = (ms) => `${(ms / 1000).toFixed(1)} s`;
const stars = (n) => '⭐'.repeat(n || 0);

export function mountGame(root, { code }) {
  let state = null, offline = false, selected = 1, current = null, audio = null;

  const call = (path, opts = {}) => api(`game${path}`, { code, ...opts });
  async function load(level) {
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
  async function flushQueue() {
    const q = read(QUEUE, []);
    if (!q.length || offline) return;
    const left = [];
    for (const item of q) {
      try { await call('/round', { method: 'POST', body: item }); } catch (e) { if (!e.status) left.push(item); } // a refused round is dropped
    }
    write(QUEUE, left);
  }

  const boardHtml = (b, meId, count) => !b?.top?.length ? '<div class="muted">No scores yet. Be the first!</div>' : `
    <div class="gm-board">${b.top.map((r) => `
      <div class="gm-row${r.id === meId ? ' me' : ''}"><span class="gm-rank">${r.rank}</span><span class="gm-name">${esc(r.name)}</span>
        <span class="gm-score">${r.won}${count ? `/${count}` : ''} · ${fmtMs(r.ms)}</span></div>`).join('')}
      ${b.me ? `<div class="gm-row me"><span class="gm-rank">${b.me.rank}</span><span class="gm-name">You</span><span class="gm-score">${b.me.won}${count ? `/${count}` : ''} · ${fmtMs(b.me.ms)}</span></div>` : ''}
    </div>`;

  function home() {
    current = null;
    const s = state, me = s.me;
    selected = Math.min(selected, me.maxPlayable);
    const lv = s.levels.find((l) => l.id === selected);
    const best = me.best[selected];
    const d = s.daily;
    root.innerHTML = `
      <div class="card">
        <div class="row between"><h2 style="margin:0">🎮 Sing</h2><button class="btn small" data-a="warm">🔥 Warm-up</button></div>
        <div class="muted">Hello ${esc(me.name)}! Match the notes as fast as you can.${me.dailyStreak > 1 ? ` 🔥 ${me.dailyStreak} days in a row.` : ''}${offline ? ' (Offline: scores will be sent when you are back online.)' : ''}</div>
      </div>

      <div class="card">
        <h3 style="margin:0 0 4px">👑 Today's Legend challenge</h3>
        ${d.mine ? `<div>You scored <b>${d.mine.won} of ${d.count}</b> in ${fmtMs(d.mine.ms)} ${stars(d.mine.stars)}</div><div class="muted">One try a day. Come back tomorrow!</div>`
          : `<div class="muted">${d.count} hard notes, the same for everyone today. You get one try.</div><button class="btn primary" data-a="daily"${offline ? ' disabled' : ''}>${offline ? 'Needs internet' : "▶ Play today's challenge"}</button>`}
        <h4 style="margin:10px 0 4px">Today's board</h4>
        ${boardHtml(d.board, me.id, d.count)}
      </div>

      <div class="card">
        <h3 style="margin:0 0 6px">Levels</h3>
        <div class="gm-levels">${s.levels.map((l) => {
          const locked = l.id > me.maxPlayable, done = me.cleared.includes(l.id);
          return `<button class="btn gm-lv${l.id === selected ? ' on' : ''}${locked ? ' lock' : ''}" data-lv="${l.id}" aria-label="Level ${l.id} ${esc(l.name)}${locked ? ' locked' : ''}">${locked ? '🔒' : l.emoji}<small>${l.id}${done ? ' ✓' : ''}</small></button>`;
        }).join('')}</div>
        <div class="gm-info">
          <b>${lv.emoji} Level ${lv.id}: ${esc(lv.name)}</b> <span class="muted">· ${esc(lv.tier)}</span>
          <div>${esc(lv.how)}</div>
          <div class="muted">${lv.count} challenges · margin ±${lv.tol} cents${best ? ` · your best: ${best.won}/${lv.count} in ${fmtMs(best.ms)} ${stars(best.stars)}` : ''}</div>
          ${selected > me.maxPlayable ? '<div class="muted">🔒 Clear the level before this one to unlock it.</div>' : '<button class="btn primary" data-a="play">▶ Play level</button>'}
        </div>
        <h4 style="margin:10px 0 4px">This week: Level ${lv.id}</h4>
        ${boardHtml(s.weekly.level === selected ? s.weekly.board : null, me.id, lv.count)}
      </div>

      <div class="card">
        <h3 style="margin:0 0 6px">Badges</h3>
        <div class="gm-badges">${BADGES.map((b) => `<div class="gm-badge${me.badges[b.id] ? ' got' : ''}" title="${esc(b.desc)}"><span>${b.emoji}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`).join('')}</div>
      </div>`;
  }

  async function pickLevel(id) {
    selected = id;
    try { await load(id); } catch { /* keep what we have */ }
    home();
  }

  async function start(deck, heading, kind, level) {
    try { audio = await openAudio(); } catch (e) { root.insertAdjacentHTML('afterbegin', `<div class="alert bad">${esc(micMessage(e))}</div>`); return; }
    current = createPlayer(root, {
      audio, deck, heading,
      onExit: () => { audio?.close(); audio = null; back(); },
      onDone: (results) => { current?.destroy(); audio?.close(); audio = null; finishRound(kind, level, results); },
    });
  }

  async function finishRound(kind, level, results) {
    root.innerHTML = '<div class="card"><div class="muted">Saving your score…</div></div>';
    let out = null, queued = false;
    try {
      out = await call(kind === 'daily' ? '/daily' : '/round', { method: 'POST', body: kind === 'daily' ? { results } : { level, results } });
      state = out.state; write(`${CACHE}${code}`, state); offline = false;
    } catch (e) {
      if (!e.status && kind !== 'daily') { write(QUEUE, [...read(QUEUE, []), { level, results }]); queued = true; }
      else root.innerHTML = `<div class="card"><div class="alert bad">${esc(e.message)}</div><button class="btn primary" data-a="back">OK</button></div>`;
      if (!queued) return;
    }
    const won = results.filter((r) => r.won).length, ms = results.reduce((a, r) => a + r.ms, 0);
    const sc = out?.score ?? { won, ms, pass: won >= results.length * 0.7, stars: 0 };
    const newB = (out?.newBadges ?? []).map((id) => BADGES.find((b) => b.id === id)).filter(Boolean);
    const rank = out ? state.weekly.board.me?.rank ?? state.weekly.board.top.find((r) => r.id === state.me.id)?.rank : null;
    root.innerHTML = `
      <div class="card gm-result">
        <h2 style="margin:0">${out?.already ? 'Already played today' : kind === 'daily' ? "Daily challenge done!" : sc.pass ? '🏆 Level cleared!' : 'Good try, practise and go again!'}</h2>
        <div class="gm-big">${sc.won} of ${results.length}</div>
        <div>${fmtMs(sc.ms)} ${stars(sc.stars)}</div>
        ${kind !== 'daily' && rank ? `<div class="muted">This week you are number ${rank} on this level.</div>` : ''}
        ${queued ? '<div class="muted">No signal: your score is saved on this phone and will be sent when you are online.</div>' : ''}
        ${out?.already ? '<div class="muted">Your first try today is the one that counts.</div>' : ''}
        ${newB.length ? `<div class="gm-new">New badge${newB.length > 1 ? 's' : ''}: ${newB.map((b) => `${b.emoji} ${esc(b.name)}`).join(', ')}</div>` : ''}
        <button class="btn primary" data-a="back">Back to the game</button>
      </div>`;
  }

  async function back() {
    try { await load(selected); } catch { /* use what we have */ }
    home();
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a], [data-lv]');
    if (!b) return;
    if (b.dataset.lv) return pickLevel(Number(b.dataset.lv));
    const a = b.dataset.a;
    if (a === 'play') return start(buildDeck(selected), `${state.levels.find((l) => l.id === selected).emoji} Level ${selected}`, 'level', selected);
    if (a === 'daily') return start(dailyDeck(state.daily.seed), "👑 Today's Legend challenge", 'daily', 12);
    if (a === 'back') return back();
    if (a === 'warm') {
      const w = mountWarmup(root, { onExit: () => { w.destroy(); home(); } });
      current = w;
    }
  });

  (async () => {
    try { await load(); await flushQueue(); if (!offline) await load(); selected = Math.min(state.me.maxPlayable, 12); home(); }
    catch (e) { root.innerHTML = `<div class="card"><div class="alert bad">${esc(e.message)}</div></div>`; }
  })();

  return { destroy() { current?.destroy?.(); audio?.close(); } };
}
