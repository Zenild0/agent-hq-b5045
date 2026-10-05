// One round of the singing game: plays a challenge, listens to the voice, times it, reports the results.
// Levels 1 to 4 are untimed: keep trying a note, skip it, and move front and back between notes; the score is
// the total time spent. From level 5 each note has a countdown and the round runs front to back.
// Every box has a fixed size, so nothing moves or flickers while a child sings.
import { detectPitch, rms } from './pitch.js';
import { NAMES, makeTracker, UNTIMED_CAP_MS } from './levels.js';
import { micMessage } from './audio.js';

const GAP_MS = 400;

export function createPlayer(root, { audio, deck, heading = '', onDone, onExit }) {
  const untimed = !deck[0]?.timed;
  root.innerHTML = `
    <div class="card pl-hud">
      <div class="row between"><b>${heading}</b><button class="btn small" data-x="exit">✕ Leave</button></div>
      <div class="pl-dots" data-x="dots" aria-label="Notes in this round"></div>
      <div class="pl-stats"><span data-x="no">&nbsp;</span><span data-x="streak">&nbsp;</span><span data-x="clock">Total 0.0 s</span></div>
    </div>
    <div class="card pl-arena">
      <div class="pl-target" data-x="target">&nbsp;</div>
      <div class="pl-how" data-x="how">&nbsp;</div>
      <div class="pl-ring" data-x="ring"><div><small data-x="ringLab">Ready</small><div class="pl-big" data-x="note">♪</div><div class="pl-sub" data-x="ringSub">&nbsp;</div></div></div>
      <div><div class="pl-warm"><i data-x="cover"></i></div><div class="pl-warmlab"><span>cold</span><span>hot</span></div></div>
      <div class="pl-msg" data-x="msg" aria-live="polite"></div>
    </div>
    <div class="pl-acts">
      <button class="btn primary pl-go" data-x="go">▶ Play</button>
      <button class="btn" data-x="chord" disabled hidden>🎹 Hear the chord</button>
      <button class="btn" data-x="hint" disabled>🎶 Singer hint</button>
      <button class="btn" data-x="pause" disabled aria-pressed="false">⏸ Pause sound</button>
      ${untimed ? `<button class="btn" data-x="prev">◀ Back</button><button class="btn" data-x="next">Next ▶</button>
      <button class="btn pl-skip" data-x="finish">✔ Finish round</button>`
    : '<button class="btn pl-skip" data-x="skip" disabled>⏭ Skip this note</button>'}
    </div>
    <div class="pl-fine" data-x="fine">&nbsp;</div>`;
  const X = (n) => root.querySelector(`[data-x="${n}"]`);

  // only touch the page when a value really changes
  const cache = new Map();
  const setText = (n, v) => { if (cache.get(n) !== v) { cache.set(n, v); X(n).textContent = v; } };
  const setVar = (n, name, v, step = 0.02) => { const k = n + name; const old = cache.get(k) ?? -9; if (Math.abs(old - v) >= step || (v === 0) !== (old === 0)) { cache.set(k, v); X(n).style.setProperty(name, v); } };
  const setMsg = (text, cls = '') => { if (cache.get('msgv') !== text + cls) { cache.set('msgv', text + cls); const m = X('msg'); m.className = `pl-msg ${cls}`; m.textContent = text; } };

  // One entry per note. ms is the time really spent listening to this child on that note (all tries added up).
  const notes = deck.map(() => ({ won: false, ms: 0, err: null, hints: 0, tried: false }));
  let idx = 0, phase = 'ready', streak = 0, tracker = null, cur = deck[0]; // phase: ready | playing | listening | reveal | done
  let startAt = 0, muteUntil = 0, lastMidi = null, lastAt = 0, recent = [], raf = 0, timer = null, paused = false; // muteUntil is on the audio clock, so Pause holds it too
  let errSum = 0, errN = 0, stepErrs = [], micReady = false, dead = false, starting = false;

  const spentOn = (i, now) => notes[i].ms + (phase === 'listening' && i === idx ? now - startAt : 0);
  const totalMs = (now) => notes.reduce((n, _, i) => n + spentOn(i, now), 0);
  const dots = () => {
    X('dots').innerHTML = deck.map((_, i) => `<i data-i="${i}" class="${notes[i].won ? 'done' : i === idx && phase !== 'done' ? 'now' : notes[i].tried ? 'miss' : ''}"></i>`).join('');
  };
  const slots = (n, done) => Array.from({ length: n }, (_, i) => (i < done ? '●' : '○')).join('');
  const allWon = () => notes.every((n) => n.won);

  function render(stepDone = 0) {
    const n = notes[idx];
    const label = phase === 'done' ? '✔ Finish' : untimed ? (n?.won ? '✓ Done' : '▶ Play') : phase === 'reveal' ? '➡ Next' : '▶ Play';
    if (X('go').textContent !== label) X('go').textContent = label;
    X('go').disabled = phase === 'playing' || (untimed && n?.won && phase !== 'done');
    X('hint').disabled = phase !== 'listening';
    X('chord').hidden = !(cur?.play?.type === 'chord');
    X('chord').disabled = phase !== 'listening';
    X('pause').disabled = phase !== 'playing' && phase !== 'listening';
    if (!untimed) X('skip').disabled = phase !== 'listening';
    else { X('prev').disabled = idx === 0 || phase === 'done'; X('next').disabled = idx >= deck.length - 1 || phase === 'done'; X('finish').disabled = phase === 'playing'; }
    setText('no', phase === 'done' ? 'All done' : `Note ${Math.min(idx + 1, deck.length)} of ${deck.length}`);
    setText('streak', streak > 1 ? `🔥 ${streak} in a row` : ' ');
    setText('ringLab', phase === 'listening' ? 'You are singing' : phase === 'playing' ? 'Listen' : 'Ready');
    const c = phase === 'done' || phase === 'reveal' ? null : cur;
    const shown = c ? (c.blind && c.kind !== 'echo' ? '🙈 Hidden chord' : c.title) : phase === 'done' ? 'Well done!' : ' ';
    if (!(c?.hideAfterPlay && phase === 'listening')) setText('target', shown);
    setText('how', c ? c.how : ' ');
    setText('ringSub', c && c.targets.length > 1 ? slots(c.targets.length, stepDone) : ' ');
  }

  const noteStatus = () => {
    const n = notes[idx];
    setMsg(n.won ? `✓ Done in ${(n.ms / 1000).toFixed(1)} s` : n.tried ? `Try again. ${(n.ms / 1000).toFixed(1)} s so far` : 'Ready? Press Play.', n.won ? 'ok' : '');
  };

  async function go() {
    if (phase === 'done') return finishRound();
    if (phase === 'reveal') { phase = 'ready'; cur = deck[idx]; setMsg('Ready? Press Play.'); render(); return; }
    if (phase === 'listening') return replay('again'); // Play again simply plays the sound again
    if (phase !== 'ready') return;
    if (untimed && notes[idx].won) return;
    if (!micReady) {
      if (starting) return; // a second tap while the microphone permission is pending must not start a second chord
      starting = true;
      try { await audio.enableMic(); micReady = true; loop(); } catch (e) { setMsg(micMessage(e)); return; } finally { starting = false; }
    }
    if (dead || phase !== 'ready') return;
    phase = 'playing'; recent = []; lastMidi = null; errSum = errN = 0; stepErrs = []; cur = deck[idx];
    setMsg('🎹 Listen carefully…');
    setPaused(false);
    audio.stop();
    const ms = audio.sound.play(cur);
    render();
    timer?.();
    timer = audio.after(ms, () => {
      if (cur.hideAfterPlay) { setText('target', '🧠 ?'); setMsg('🧠 Remember it…'); }
      timer = audio.after((cur.delayMs || 0) + GAP_MS, () => {
        phase = 'listening'; recent = []; tracker = makeTracker(cur);
        startAt = performance.now(); // the clock starts when the sound (and any waiting time) is over
        render();
      }); // a short silence, so the speaker is not mistaken for the child's voice
    });
  }
  // Hearing it again or the singer costs nothing extra: the clock keeps running while it plays.
  function replay(kind) {
    if (phase !== 'listening') return;
    if (kind !== 'again') notes[idx].hints += 1; // pressing Play again is free; the singer hint and the full chord count as help
    setPaused(false);
    audio.stop();
    const ms = kind === 'hint' ? audio.sound.singer(cur) : kind === 'chord' ? audio.sound.hearChord(cur) : audio.sound.play(cur);
    muteUntil = audio.ctx.currentTime + (ms + GAP_MS) / 1000; recent = [];
    setMsg(kind === 'hint' ? '🎶 Listen to the singer…' : kind === 'chord' ? '🎹 Listen to the chord…' : '🎹 Listen again…');
  }

  // Stop listening to the current note (leaving it, or moving on), adding the time spent to its total.
  function leaveNote(now) {
    timer?.();
    setPaused(false);
    audio.stop();
    if (phase === 'listening') notes[idx].ms = Math.min(UNTIMED_CAP_MS, notes[idx].ms + (now - startAt));
    if (phase === 'listening') notes[idx].tried = true;
    tracker = null; phase = 'ready';
  }
  function goTo(i, now = performance.now()) {
    if (!untimed || i < 0 || i >= deck.length || i === idx || phase === 'done') return;
    leaveNote(now);
    idx = i; cur = deck[idx]; lastMidi = null;
    noteStatus(); dots(); render();
  }

  // A note finished: matched, or (timed levels) the countdown ran out or it was skipped.
  function finishNote(won, now, byTimeout = false) {
    const n = notes[idx];
    const limit = cur.limit * 1000;
    const spent = now - startAt;
    if (cur.timed) n.ms = won ? Math.min(limit, spent) : limit; // a miss costs the whole countdown
    else n.ms = Math.min(UNTIMED_CAP_MS, n.ms + spent);
    n.won = won; n.tried = true;
    n.err = won && stepErrs.length ? Math.round(stepErrs.reduce((a, b) => a + b, 0) / stepErrs.length) : null;
    streak = won ? streak + 1 : 0;
    audio.sound.chime(won);
    tracker = null;
    if (untimed) {
      phase = allWon() ? 'done' : 'ready';
      setMsg(won ? `🎉 Got it! ${(n.ms / 1000).toFixed(1)} s${phase === 'ready' ? ' Use Next ▶ for the next note' : ''}` : 'Skipped', won ? 'ok' : '');
      if (phase === 'done') X('fine').textContent = `All ${deck.length} matched · ${(totalMs(now) / 1000).toFixed(1)} s`;
    } else {
      const name = cur.targets.map((t) => NAMES[t]).join(' ');
      setMsg(won ? `🎉 Got it! ${(n.ms / 1000).toFixed(1)} s` : `⏰ The note${cur.targets.length > 1 ? 's were' : ' was'} ${name}`, won ? 'ok' : 'bad');
      idx += 1;
      phase = idx >= deck.length ? 'done' : 'reveal';
      if (phase === 'done') X('fine').textContent = `${notes.filter((x) => x.won).length} of ${deck.length} matched · ${(totalMs(now) / 1000).toFixed(1)} s`;
    }
    dots(); render();
  }

  function finishRound() {
    leaveNote(performance.now());
    onDone?.(notes.map((n, i) => ({ won: n.won, ms: Math.round(Math.min(n.ms, UNTIMED_CAP_MS)), limit: deck[i].limit * 1000, err: n.won ? n.err : null, hints: n.hints })));
  }

  function loop(now = performance.now()) {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    audio.analyser.getFloatTimeDomainData(audio.buf);
    const vol = rms(audio.buf);
    let midi = null;
    if (vol > 0.01 && phase === 'listening' && audio.ctx.currentTime >= muteUntil) {
      const p = detectPitch(audio.buf, audio.ctx.sampleRate);
      if (p && p.clarity > 0.85) {
        recent.push(69 + 12 * Math.log2(p.freq / 440)); if (recent.length > 5) recent.shift();
        midi = [...recent].sort((a, b) => a - b)[Math.floor(recent.length / 2)];
      }
    }
    if (midi == null && recent.length) recent.shift();
    if (midi != null) { lastMidi = midi; lastAt = now; }
    const r = lastMidi != null ? Math.round(lastMidi) : 0;
    setText('note', phase === 'listening' ? (lastMidi != null && now - lastAt < 350 ? `${NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}` : '–') : '♪');
    setText('clock', `Total ${(totalMs(now) / 1000).toFixed(1)} s`);
    if (phase !== 'listening') {
      setVar('ring', '--w', 0); setVar('ring', '--hold', 0);
      X('cover').style.transform = 'scaleX(1)';
      return;
    }
    const left = cur.timed ? Math.max(0, cur.limit * 1000 - (now - startAt)) : Infinity;
    const t = tracker.feed(now, midi);
    if (t.hold > 0) { errSum += t.cents; errN += 1; } else { errSum = errN = 0; }
    if (t.justAdvanced) { if (errN) stepErrs.push(errSum / errN); errSum = errN = 0; }
    setVar('ring', '--w', t.warm);
    X('cover').style.transform = `scaleX(${1 - t.warm})`;
    setVar('ring', '--hold', t.hold, 0.03);
    render(t.step);
    if (t.justAdvanced && !t.done) navigator.vibrate?.(20);
    if (t.done) return finishNote(true, now);
    if (cur.timed && left <= 0) return finishNote(false, now, true);
    if (!cur.timed && spentOn(idx, now) >= UNTIMED_CAP_MS) return finishNote(false, now);
    if (audio.ctx.currentTime < muteUntil) setMsg(paused ? '⏸ Sound paused' : '🎧 Listen…');
    else if (vol < 0.01) setMsg(cur.timed ? `Sing out loud, ${Math.ceil(left / 1000)} s left` : 'Sing out loud, take your time');
    else if (midi == null) setMsg(cur.timed ? `Sing a steady "Ahh"… ${Math.ceil(left / 1000)} s` : 'Sing a steady "Ahh"… no rush');
    else setMsg(t.hold > 0.1 ? 'Hold it!' : t.warm > 0.66 ? 'Almost there!' : t.warm > 0.2 ? 'Getting warmer…' : 'Keep trying, slide your voice…');
  }

  X('go').addEventListener('click', go);
  X('hint').addEventListener('click', () => replay('hint'));
  X('chord').addEventListener('click', () => replay('chord'));
  X('pause').addEventListener('click', () => setPaused(!paused));
  X('exit').addEventListener('click', () => { destroy(); onExit?.(); });
  if (untimed) {
    X('prev').addEventListener('click', () => goTo(idx - 1));
    X('next').addEventListener('click', () => goTo(idx + 1));
    X('finish').addEventListener('click', finishRound);
    X('dots').addEventListener('click', (e) => { const d = e.target.closest('[data-i]'); if (d) goTo(Number(d.dataset.i)); });
  } else X('skip').addEventListener('click', () => { if (phase === 'listening') finishNote(false, performance.now()); });
  function setPaused(p) {
    if (p === paused) return;
    paused = p;
    if (p) audio.pause(); else audio.resume();
    X('pause').textContent = p ? '▶ Play sound' : '⏸ Pause sound';
    X('pause').setAttribute('aria-pressed', String(p));
    if (p) setMsg('⏸ Sound paused');
  }
  function destroy() { dead = true; cancelAnimationFrame(raf); timer?.(); audio.stop(); audio.stopMic(); }
  dots(); render(); setMsg('Ready? Press Play.');
  return { destroy };
}
