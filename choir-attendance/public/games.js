// Training Games: the hub that holds every game, so new ones can be added over time.
//   1. Vocal trainer (sing the note you hear)    2. Notation trainer (read the note on the staff)    3. Rhythm trainer (soon)
// Everyone gets the full version of every game free for a few days (7 for choir members, 3 for guests),
// and one payment unlocks all the games. The server keeps the days; this screen only shows them.
import { api, esc } from './common.js';
import { RANGES, getRange, setRange } from './audio.js';

const CACHE = 'choir-cache:games-access';
const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function mountGames(root, { code }) {
  let view = 'hub', ctl = null, access = null;

  async function loadAccess() {
    try {
      access = await api('me/access', { code });
      try { localStorage.setItem(CACHE, JSON.stringify(access)); } catch { /* storage full */ }
    } catch (e) {
      if (e.status) throw e; // a real answer (wrong code, games off): do not hide it
      try { access = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch { access = null; }
      if (!access) throw e;
    }
    return access;
  }

  const banner = () => {
    const a = access;
    if (a.paid) return `<div class="alert ok"><b>Full version active</b> · every training game is open until ${fmtDay(a.paidUntil)}.</div>`;
    if (a.trial.active) return `<div class="alert ok">🎁 <b>Free trial: ${a.trial.daysLeft} day${a.trial.daysLeft === 1 ? '' : 's'} left.</b> Every level of every game is open. After that, one payment unlocks all the games.</div>`;
    const pay = a.pay;
    return `<div class="card gm-unlock">
      <h3 style="margin:0">${a.trial.started ? 'Your free trial has ended' : 'Free to try'} · unlock all games for ₹${esc(pay?.price ?? 500)} a year</h3>
      <div class="muted">One payment opens every level of every training game, now and as new ones arrive. The first levels stay free.</div>
      ${pay?.mobile || pay?.upi ? `<div class="gm-pay">Pay your choir teacher${pay.mobile ? ` on <b>${esc(pay.mobile)}</b>` : ''}${pay.upi ? ` (UPI: <b>${esc(pay.upi)}</b>)` : ''}. They will unlock it for you.</div>` : '<div class="muted">Ask your choir teacher how to pay.</div>'}
    </div>`;
  };

  function hub() {
    view = 'hub';
    ctl?.destroy?.(); ctl = null;
    const g = access.games;
    root.innerHTML = `
      <div class="card"><h2 style="margin:0">Training games</h2>
        <div class="muted">Short, fun practice that makes you a better singer and music reader.</div>
        <div class="gm-note" style="margin-top:8px">🎧 Use headphones for the best results, so the phone's sound does not mix with your voice.</div></div>
      ${banner()}
      <div class="card"><h3 style="margin:0 0 6px">My voice</h3>
        <div class="seg" role="group" aria-label="My voice range">${RANGES.map((r) => `<button type="button" data-range="${r.id}" class="${getRange() === r.id ? 'on' : ''}" aria-pressed="${getRange() === r.id}">${r.label}</button>`).join('')}</div>
        <div class="muted" style="margin-top:6px">Pick the range that is comfortable. Lower suits deeper or changing voices, Higher suits very young voices. The piano plays an octave lower or higher to match.</div></div>
      <div class="tg-list">
        ${g.vocals ? `<button class="tg-card" data-game="vocals"><span class="tg-n">1</span><span class="grow"><b>Vocal trainer</b><span class="muted">Hear a note, then sing it. Levels from beginner to legend, a daily challenge and badges.</span></span><span>›</span></button>` : ''}
        ${g.notation ? `<button class="tg-card" data-game="notation"><span class="tg-n">2</span><span class="grow"><b>Notation trainer</b><span class="muted">Learn to read music. See a note on the staff and sing it. 20 levels, treble and bass clef.</span></span><span>›</span></button>` : ''}
        <div class="tg-card soon"><span class="tg-n">3</span><span class="grow"><b>Rhythm trainer</b><span class="muted">Clap and tap the beat. Coming soon.</span></span></div>
      </div>
      ${!g.vocals && !g.notation ? '<div class="empty">Your teacher has not switched any game on yet.</div>' : ''}`;
  }

  async function open(which) {
    view = which;
    root.innerHTML = '<div class="empty">Loading…</div>';
    try {
      await loadAccess(); // refresh the trial days and payment status each time a game opens
      root.innerHTML = '<div class="games-bar"><button class="btn small" data-g="hub">‹ Training games</button></div><div id="gbox"></div>';
      const box = root.querySelector('#gbox');
      if (which === 'vocals') { const m = await import('./game.js'); ctl = m.mountGame(box, { code }); }
      else { const m = await import('./staffgame.js'); ctl = m.mountStaffGame(box, { access }); }
    } catch (e) { root.innerHTML = `<div class="card"><div class="alert bad">${esc(e.message)}</div><button class="btn" data-g="hub">‹ Back</button></div>`; }
  }

  root.addEventListener('click', (e) => {
    const r = e.target.closest('[data-range]');
    if (r) { setRange(r.dataset.range); return hub(); }
    const g = e.target.closest('[data-game]');
    if (g) return open(g.dataset.game);
    if (e.target.closest('[data-g="hub"]')) return hub();
  });

  (async () => {
    root.innerHTML = '<div class="empty">Loading…</div>';
    try { await loadAccess(); hub(); } catch (e) { root.innerHTML = `<div class="card"><div class="alert bad">${esc(e.message)}</div></div>`; }
  })();

  return {
    destroy() { ctl?.destroy?.(); ctl = null; },
    // the phone's Back button: leave a level first, then the game, then the hub
    back() {
      if (view === 'hub') return false;
      if (ctl?.back?.()) return true;
      hub();
      return true;
    },
  };
}
