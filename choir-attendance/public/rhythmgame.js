// Rhythm trainer: hear a rhythm, then tap it back on the drum. Levels from a steady beat to off-beat rhythms.
// The sounds are made in the browser (no files, no microphone). Progress and stars stay on this phone; XP joins the rest.
import { esc } from './common.js';
import { RLEVELS, FREE_RHYTHM_LEVELS, BEATS_PER_BAR, levelR, makeRound, onsets, patternBeats, scoreTaps, rhythmStars, rhythmFeedback } from './rhythm.js';
import { xpFor, awardLine } from './xp.js';

const KEY = 'choir-rhythm';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage full */ } };
const STAR = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

// ---- the written rhythm: one line per bar (so two bars stay big on a phone), notes placed by time, eighths beamed in pairs ----
export function rhythmSvg(pattern, marks = []) {
  const bars = []; let cur = [], t = 0;
  for (const d of pattern) { cur.push(d); t += Math.abs(d); if (t >= BEATS_PER_BAR - 1e-9) { bars.push(cur); cur = []; t = 0; } }
  if (cur.length) bars.push(cur);
  let k = 0;
  return bars.map((b) => { const n = b.filter((d) => d > 0).length, m = marks.slice(k, k + n); k += n; return barSvg(b, m); }).join('');
}

function barSvg(pattern, marks = []) {
  const beats = patternBeats(pattern), bars = beats / BEATS_PER_BAR, W = 320 * bars, L = 18, U = (W - 2 * L) / beats, Y = 58;
  const xOf = (b) => L + b * U + 12;
  let svg = `<line x1="${L - 8}" y1="${Y}" x2="${W - 8}" y2="${Y}" class="rl"/>`;
  for (let b = 1; b < bars; b++) svg += `<line x1="${L + b * BEATS_PER_BAR * U}" y1="${Y - 22}" x2="${L + b * BEATS_PER_BAR * U}" y2="${Y + 22}" class="rl"/>`;
  svg += `<line x1="${W - 8}" y1="${Y - 22}" x2="${W - 8}" y2="${Y + 22}" class="rl thick"/>`;
  for (let b = 0; b < beats; b++) svg += `<text x="${xOf(b)}" y="${Y + 40}" class="rc">${(b % BEATS_PER_BAR) + 1}</text>`;
  let t = 0; const items = [];
  pattern.forEach((d, i) => { items.push({ d, t, i }); t += Math.abs(d); });
  const head = (x, open) => `<ellipse cx="${x}" cy="${Y}" rx="7.5" ry="5.6" transform="rotate(-20 ${x} ${Y})" class="${open ? 'rh open' : 'rh'}"/>`;
  const stem = (x) => `<line x1="${x + 6.6}" y1="${Y - 2}" x2="${x + 6.6}" y2="${Y - 34}" class="rs"/>`;
  let noteNo = 0; const noteX = [];
  for (let k = 0; k < items.length; k++) {
    const { d, t: at } = items[k], x = xOf(at);
    if (d < 0) { // rests: a quarter rest zig-zag or a little eighth rest
      svg += d === -1 ? `<path d="M${x - 3} ${Y - 18} l6 7 -6 6 6 7 -4 -2 -3 6" class="rr"/>` : `<path d="M${x - 4} ${Y - 10} q4 4 8 -2 l-5 16" class="rr"/>`;
      continue;
    }
    noteX.push(x); noteNo++;
    if (d >= 2) { svg += head(x, true) + stem(x); continue; }
    svg += head(x, false) + stem(x);
    if (d === 0.5) {
      const nx = items[k + 1];
      const pair = nx && nx.d === 0.5 && Number.isInteger(at); // two eighths on one beat share a beam
      if (pair) { const x2 = xOf(nx.t); svg += head(x2, false) + stem(x2) + `<line x1="${x + 6.6}" y1="${Y - 33}" x2="${x2 + 6.6}" y2="${Y - 33}" class="rb"/>`; noteX.push(x2); noteNo++; k++; }
      else svg += `<path d="M${x + 6.6} ${Y - 34} q8 6 6 16" class="rf"/>`;
    }
  }
  marks.forEach((m, i) => { if (noteX[i] != null) svg += `<circle cx="${noteX[i] + 2}" cy="${Y - 48}" r="6" class="rm ${m.grade}"/>`; });
  return `<svg class="rsvg" viewBox="0 0 ${W} ${Y + 52}" role="img" aria-label="A rhythm of ${noteNo} notes">${svg}</svg>`;
}

// ---- sound ----
function makeSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination);
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.15), ctx.sampleRate);
  const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  const live = new Set();
  const click = (at, accent) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = accent ? 2000 : 1400; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.28, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05); o.connect(g).connect(out); o.start(at); o.stop(at + 0.06); live.add(o); o.onended = () => live.delete(o); };
  const clap = (at) => { const s = ctx.createBufferSource(); s.buffer = noise; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.9; const g = ctx.createGain(); g.gain.value = 1.4; s.connect(bp).connect(g).connect(out); s.start(at); live.add(s); s.onended = () => live.delete(s); };
  const tick = () => { const o = ctx.createOscillator(), g = ctx.createGain(), at = ctx.currentTime; o.type = 'triangle'; o.frequency.value = 700; g.gain.setValueAtTime(0.25, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07); o.connect(g).connect(out); o.start(at); o.stop(at + 0.08); };
  const stop = () => { for (const s of [...live]) { try { s.stop(); } catch { /* ended */ } } live.clear(); };
  return { ctx, click, clap, tick, stop, close: () => { stop(); ctx.close().catch(() => {}); }, lag: () => (ctx.outputLatency || 0) + (ctx.baseLatency || 0) };
}

export function mountRhythm(host, { access = null, xp: xpIn = null } = {}) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const xp = xpIn ?? xpFor('teacher');
  const full = () => (access ? Boolean(access.full) : true);
  let snd = null, raf = 0, timers = [], state = null, dead = false;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); snd?.stop(); };
  const lockOf = (id, best) => (id > FREE_RHYTHM_LEVELS && !full() ? 'pay' : id > 1 && !best[id - 1] ? 'order' : '');

  function home() {
    clearTimers(); state = null;
    const best = read().best || {};
    const total = Object.values(best).reduce((a, n) => a + n, 0);
    root.innerHTML = `
      <div class="card rt-head"><div class="rt-hero" aria-hidden="true">🥁</div><div class="grow"><h2 style="margin:0">Rhythm trainer</h2>
        <div class="muted">Listen to the rhythm, then tap it back on the drum. ${total} of ${RLEVELS.length * 3} stars.</div></div></div>
      <div class="rt-levels">${RLEVELS.map((l) => { const lk = lockOf(l.id, best), s = best[l.id] || 0; return `
        <button type="button" class="rt-lv${lk ? ' locked' : ''}${s ? ' done' : ''}" data-lv="${l.id}" ${lk === 'order' ? 'disabled' : ''}>
          <span class="rt-em">${l.emoji}</span><span class="grow"><b>${l.id}. ${esc(l.name)}</b><small>${esc(l.how)}</small></span>
          <span class="rt-st">${lk === 'pay' ? '🔒' : lk === 'order' ? '🔒' : `<span class="stars">${STAR(s)}</span>`}<small>${l.bpm} bpm</small></span></button>`; }).join('')}</div>
      <div class="muted rt-fine">Tip: use headphones or a quiet room, and tap with one finger. Levels 1 and 2 are free.</div>`;
  }

  function startLevel(id) {
    const best = read().best || {};
    const lk = lockOf(id, best);
    if (lk === 'pay') { home(); root.insertAdjacentHTML('afterbegin', '<div class="alert warn">This level is part of the full Music Lab. Ask your teacher about it.</div>'); return; }
    if (!snd) snd = makeSound();
    snd.ctx.resume();
    state = { id, lv: levelR(id), deck: makeRound(id), i: 0, results: [], phase: 'ready', taps: [], best: null };
    play();
  }

  function play() {
    const { lv, deck, i } = state, p = deck[i];
    root.innerHTML = `
      <div class="card rt-play">
        <div class="row between"><b>${lv.emoji} ${esc(lv.name)}</b><button class="btn small" data-a="leave">✕ Leave</button></div>
        <div class="rt-dots">${deck.map((_, k) => `<i class="${k < i ? (state.results[k] >= 55 ? 'ok' : 'bad') : k === i ? 'now' : ''}"></i>`).join('')}</div>
        <div class="rt-score" id="rtScore">${rhythmSvg(p)}</div>
        <div class="rt-beats" id="rtBeats">${Array.from({ length: BEATS_PER_BAR }, (_, k) => `<i data-b="${k}">${k + 1}</i>`).join('')}</div>
        <div class="rt-msg" id="rtMsg" aria-live="polite">${i === 0 ? esc(lv.how) : 'Listen first, then your turn.'}</div>
        <button type="button" class="rt-pad" id="rtPad" aria-label="Drum: tap here">TAP</button>
        <div class="rt-acts"><button class="btn" data-a="listen">👂 Listen</button><button class="btn primary" data-a="go">🥁 My turn</button></div>
        <div class="rt-acts" id="rtNext" hidden><button class="btn" data-a="again">🔁 Try again</button><button class="btn primary" data-a="next">${i === deck.length - 1 ? 'Finish ✓' : 'Next ▶'}</button></div>
      </div>`;
  }

  // Count in one bar, then (listen) clap the rhythm with the beat, or (go) keep the beat while the child taps.
  function run(kind) {
    clearTimers();
    const { lv, deck, i } = state, p = deck[i];
    const beat = 60 / lv.bpm, t0 = snd.ctx.currentTime + 0.25, start = t0 + BEATS_PER_BAR * beat, len = patternBeats(p);
    for (let b = 0; b < BEATS_PER_BAR; b++) snd.click(t0 + b * beat, b === 0);
    for (let b = 0; b < len; b++) snd.click(start + b * beat, b % BEATS_PER_BAR === 0);
    if (kind === 'listen') onsets(p).forEach((o) => snd.clap(start + o * beat));
    state.phase = kind; state.taps = []; state.start = start; state.beat = beat;
    root.querySelectorAll('[data-a="listen"], [data-a="go"]').forEach((b) => { b.disabled = true; });
    root.querySelector('#rtNext').hidden = true;
    root.querySelector('#rtScore').innerHTML = rhythmSvg(p);
    const msg = root.querySelector('#rtMsg'), dots = [...root.querySelectorAll('#rtBeats i')];
    const end = start + len * beat;
    const loop = () => {
      if (dead) return;
      const now = snd.ctx.currentTime;
      if (now < start) { const k = Math.floor((now - t0) / beat); msg.textContent = k >= 0 ? `${['1', '2', 'Ready', 'Go!'][k] ?? ''}` : 'Get ready…'; }
      else if (now < end) msg.textContent = kind === 'listen' ? '👂 Listen…' : '🥁 Tap the rhythm!';
      const k = Math.floor((now - (now < start ? t0 : start)) / beat) % BEATS_PER_BAR;
      dots.forEach((d, n) => d.classList.toggle('on', now >= t0 && n === k && now < end));
      if (now < end + beat * 0.6) raf = requestAnimationFrame(loop); else finish(kind);
    };
    raf = requestAnimationFrame(loop);
  }

  function finish(kind) {
    root.querySelectorAll('[data-a="listen"], [data-a="go"]').forEach((b) => { b.disabled = false; });
    const msg = root.querySelector('#rtMsg');
    if (kind === 'listen') { state.phase = 'ready'; msg.textContent = 'Your turn! Press “My turn” and tap the same rhythm.'; return; }
    const { deck, i, beat, start } = state, p = deck[i];
    const lag = snd.lag();
    const exp = onsets(p).map((o) => start + o * beat + lag);
    const r = scoreTaps(exp, state.taps);
    state.best = Math.max(state.best ?? 0, r.accuracy);
    state.phase = 'scored';
    root.querySelector('#rtScore').innerHTML = rhythmSvg(p, r.notes);
    msg.innerHTML = `<b>${r.accuracy}%</b> · ${esc(rhythmFeedback(r))}`;
    msg.className = `rt-msg ${r.accuracy >= 75 ? 'ok' : r.accuracy >= 55 ? '' : 'bad'}`;
    if (r.accuracy >= 90) navigator.vibrate?.([20, 40, 20]);
    root.querySelector('#rtNext').hidden = false;
  }

  function next() {
    state.results.push(state.best ?? 0);
    state.i += 1; state.best = null;
    if (state.i < state.deck.length) { play(); return; }
    const acc = Math.round(state.results.reduce((a, n) => a + n, 0) / state.results.length), stars = rhythmStars(acc), passed = stars > 0;
    const data = read(); data.best = data.best || {};
    const was = data.best[state.id] || 0; if (stars > was) data.best[state.id] = stars; write(data);
    const earned = xp.award('level', { passed, stars, game: 'rhythm' });
    const nextLv = RLEVELS.find((l) => l.id === state.id + 1);
    root.innerHTML = `
      <div class="card rt-result">
        <div class="rt-big">${passed ? (stars === 3 ? '🏆' : '🎉') : '💪'}</div>
        <h2 style="margin:0">${passed ? `${esc(state.lv.name)} cleared!` : 'Not quite yet'}</h2>
        <div class="stars rt-stars">${STAR(stars)}</div>
        <div class="kid-tiles"><div class="kid-tile gold"><small>XP</small><b>+${earned?.gained ?? 0}</b></div><div class="kid-tile"><small>TIMING</small><b>${acc}%</b></div><div class="kid-tile"><small>BEST</small><b>${STAR(Math.max(stars, was)).replace(/☆/g, '')}${Math.max(stars, was) ? '' : '–'}</b></div></div>
        ${earned && awardLine(earned) ? `<div class="gm-new">${esc(awardLine(earned))}</div>` : ''}
        <div class="muted">${passed ? (stars < 3 ? 'Play again for 3 stars, or go on.' : 'Perfect rhythm!') : 'You need 55% to clear it. Listen carefully and try again.'}</div>
        ${passed && nextLv ? `<button class="btn primary" data-lv="${nextLv.id}">▶ Next: ${esc(nextLv.name)}</button>` : ''}
        <button class="btn${passed ? '' : ' primary'}" data-lv="${state.id}">🔁 Play again</button>
        <button class="btn" data-a="home">All levels</button>
      </div>`;
    state = null;
  }

  const tap = () => {
    if (!state || state.phase !== 'go') return;
    state.taps.push(snd.ctx.currentTime);
    snd.tick();
    const pad = root.querySelector('#rtPad');
    pad?.classList.remove('hit'); void pad?.offsetWidth; pad?.classList.add('hit');
  };
  root.addEventListener('pointerdown', (e) => { if (e.target.closest('#rtPad')) { e.preventDefault(); tap(); } });
  const onKey = (e) => { if ((e.code === 'Space' || e.key === 'j') && state?.phase === 'go') { e.preventDefault(); tap(); } };
  document.addEventListener('keydown', onKey);
  root.addEventListener('click', (e) => {
    const lv = e.target.closest('[data-lv]'); if (lv && !lv.disabled) return startLevel(Number(lv.dataset.lv));
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'leave' || a === 'home') return home();
    if (a === 'listen' || a === 'go') return run(a);
    if (a === 'again') { state.phase = 'ready'; root.querySelector('#rtNext').hidden = true; root.querySelector('#rtMsg').textContent = 'Listen again or go straight to your turn.'; return; }
    if (a === 'next') return next();
  });
  home();
  return { destroy() { dead = true; clearTimers(); snd?.close(); snd = null; document.removeEventListener('keydown', onKey); }, back() { if (state) { home(); return true; } return false; } };
}
