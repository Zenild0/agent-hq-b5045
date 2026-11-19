// Ear Detective: hear two notes, tap the answer. Six levels from "higher or lower?" to naming the jump.
// Uses the app's piano sound; no microphone. Progress stays on this phone; XP joins the rest.
import { esc } from './common.js';
import { openAudio } from './audio.js';
import { EAR_LEVELS, FREE_EAR_LEVELS, earLevel, makeEarRound, earStars, EAR_ROUND } from './eartrain.js';
import { xpFor, awardLine } from './xp.js';

const KEY = 'choir-ear';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage full */ } };
const STAR = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

// A tiny picture of the two notes, so the answer is also seen: higher note, higher dot.
const picture = (notes) => {
  const [a, b] = notes, lo = Math.min(a, b) - 2, hi = Math.max(a, b) + 2, y = (m) => 70 - ((m - lo) / Math.max(1, hi - lo)) * 56;
  return `<svg class="ed-pic" viewBox="0 0 160 80" aria-hidden="true"><line x1="10" y1="${y(a)}" x2="150" y2="${y(a)}" class="g"/><path d="M50 ${y(a)} L110 ${y(b)}" class="ln"/><circle cx="50" cy="${y(a)}" r="9" class="n1"/><circle cx="110" cy="${y(b)}" r="9" class="n2"/></svg>`;
};

export function mountEar(host, { access = null, xp: xpIn = null } = {}) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const xp = xpIn ?? xpFor('teacher');
  const full = () => (access ? Boolean(access.full) : true);
  let audio = null, st = null, timer = 0;
  const lockOf = (id, best) => (id > FREE_EAR_LEVELS && !full() ? 'pay' : id > 1 && !best[id - 1] ? 'order' : '');

  function home() {
    clearTimeout(timer); st = null;
    const best = read().best || {};
    const total = Object.values(best).reduce((a, n) => a + n, 0);
    root.innerHTML = `
      <div class="card rt-head"><div class="rt-hero ed-hero" aria-hidden="true">🕵️</div><div class="grow"><h2 style="margin:0">Ear Detective</h2>
        <div class="muted">Train your ears: listen to two notes and solve the case. ${total} of ${EAR_LEVELS.length * 3} stars.</div></div></div>
      <div class="rt-levels">${EAR_LEVELS.map((l) => { const lk = lockOf(l.id, best), s = best[l.id] || 0; return `
        <button type="button" class="rt-lv${lk ? ' locked' : ''}${s ? ' done' : ''}" data-lv="${l.id}" ${lk === 'order' ? 'disabled' : ''}>
          <span class="rt-em">${l.emoji}</span><span class="grow"><b>${l.id}. ${esc(l.name)}</b><small>${esc(l.how)}</small></span>
          <span class="rt-st">${lk ? '🔒' : `<span class="stars">${STAR(s)}</span>`}</span></button>`; }).join('')}</div>
      <div class="muted rt-fine">No microphone needed. Levels 1 and 2 are free.</div>`;
  }

  async function start(id) {
    const lk = lockOf(id, read().best || {});
    if (lk === 'pay') { home(); root.insertAdjacentHTML('afterbegin', '<div class="alert warn">This level is part of the full Music Lab. Ask your teacher about it.</div>'); return; }
    try { if (!audio) audio = await openAudio(); await audio.ensure(); } catch { root.insertAdjacentHTML('afterbegin', '<div class="alert bad">The sound could not start. Tap again.</div>'); return; }
    st = { id, lv: earLevel(id), deck: makeEarRound(id), i: 0, right: 0, answered: false };
    ask();
  }
  const hear = () => { const q = st.deck[st.i]; audio.stop(); audio.sound.pianoNote(q.notes[0], 1.1, 0.05, 0.9); audio.sound.pianoNote(q.notes[1], 1.1, 1.0, 0.9); };

  function ask() {
    const { lv, deck, i } = st, q = deck[i];
    st.answered = false;
    root.innerHTML = `
      <div class="card rt-play ed-play">
        <div class="row between"><b>${lv.emoji} ${esc(lv.name)}</b><button class="btn small" data-a="leave">✕ Leave</button></div>
        <div class="rt-dots">${deck.map((_, k) => `<i class="${k < i ? (st.marks?.[k] ? 'ok' : 'bad') : k === i ? 'now' : ''}"></i>`).join('')}</div>
        <div class="ed-q">${esc(lv.how)}</div>
        <button type="button" class="ed-hear" data-a="hear" aria-label="Hear the two notes">🔊<span>Hear it</span></button>
        <div class="ed-ans" style="--n:${q.choices.length}">${q.choices.map((c) => `<button type="button" class="ed-btn" data-ans="${esc(c.id)}"><span class="ic">${esc(c.icon)}</span><b>${esc(c.label)}</b></button>`).join('')}</div>
        <div class="ed-fb" id="edFb" aria-live="polite">Tap “Hear it” as often as you like.</div>
      </div>`;
    hear();
  }

  function answer(id) {
    if (st.answered) return;
    st.answered = true;
    const q = st.deck[st.i], ok = id === q.answer;
    if (ok) st.right += 1;
    (st.marks ||= [])[st.i] = ok;
    audio.sound.chime(ok);
    root.querySelectorAll('[data-ans]').forEach((b) => { b.disabled = true; b.classList.toggle('right', b.dataset.ans === q.answer); b.classList.toggle('wrong', b.dataset.ans === id && !ok); });
    const right = q.choices.find((c) => c.id === q.answer);
    root.querySelector('#edFb').innerHTML = `<div>${ok ? '<b class="ok">✓ Case solved!</b>' : `<b class="bad">Not this time.</b> It was <b>${esc(right.label)}</b>.`}</div>${picture(q.notes)}<button type="button" class="btn primary" data-a="next">${st.i === st.deck.length - 1 ? 'Finish ✓' : 'Next ▶'}</button>`;
    if (ok) navigator.vibrate?.(20);
  }

  function next() {
    st.i += 1;
    if (st.i < st.deck.length) return ask();
    const stars = earStars(st.right), passed = stars > 0;
    const data = read(); data.best = data.best || {}; const was = data.best[st.id] || 0; if (stars > was) data.best[st.id] = stars; write(data);
    const earned = xp.award('quiz', { passed, stars, won: st.right, game: 'ear' });
    const nextLv = EAR_LEVELS.find((l) => l.id === st.id + 1);
    root.innerHTML = `
      <div class="card rt-result">
        <div class="rt-big">${passed ? (stars === 3 ? '🏆' : '🕵️') : '💪'}</div>
        <h2 style="margin:0">${passed ? `${esc(st.lv.name)}: solved!` : 'Keep listening, detective'}</h2>
        <div class="stars rt-stars">${STAR(stars)}</div>
        <div class="kid-tiles"><div class="kid-tile gold"><small>XP</small><b>+${earned?.gained ?? 0}</b></div><div class="kid-tile"><small>RIGHT</small><b>${st.right}/${EAR_ROUND}</b></div><div class="kid-tile"><small>BEST</small><b>${Math.max(stars, was) ? '★'.repeat(Math.max(stars, was)) : '–'}</b></div></div>
        ${earned && awardLine(earned) ? `<div class="gm-new">${esc(awardLine(earned))}</div>` : ''}
        <div class="muted">${passed ? (stars < 3 ? 'Get 9 right for 3 stars.' : 'Super ears!') : 'Get 5 right to clear it. Hear each pair twice before you answer.'}</div>
        ${passed && nextLv ? `<button class="btn primary" data-lv="${nextLv.id}">▶ Next: ${esc(nextLv.name)}</button>` : ''}
        <button class="btn${passed ? '' : ' primary'}" data-lv="${st.id}">🔁 Play again</button>
        <button class="btn" data-a="home">All levels</button>
      </div>`;
    st = null;
  }

  root.addEventListener('click', (e) => {
    const lv = e.target.closest('[data-lv]'); if (lv && !lv.disabled) return start(Number(lv.dataset.lv));
    const an = e.target.closest('[data-ans]'); if (an && st) return answer(an.dataset.ans);
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'leave' || a === 'home') return home();
    if (a === 'hear' && st) return hear();
    if (a === 'next' && st) return next();
  });
  home();
  return { destroy() { clearTimeout(timer); audio?.close(); audio = null; }, back() { if (st) { home(); return true; } return false; } };
}
