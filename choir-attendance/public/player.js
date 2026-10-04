// One round of the singing game: plays a challenge, listens to the voice, times it, reports the results.
// Every box has a fixed size, so nothing moves or flickers while a child sings.
import { detectPitch, rms } from './pitch.js';
import { NAMES, makeTracker } from './levels.js';
import { micMessage } from './audio.js';

const GAP_MS = 400;

export function createPlayer(root, { audio, deck, heading = '', onDone, onExit }) {
  const $ = (s) => root.querySelector(s);
  root.innerHTML = `
    <div class="card pl-hud">
      <div class="row between"><b>${heading}</b><button class="btn small" data-x="exit">✕ Leave</button></div>
      <div class="pl-dots" data-x="dots" aria-label="Progress"></div>
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
      <button class="btn primary pl-go" data-x="go">▶ Start</button>
      <button class="btn" data-x="again" disabled>🔁 Hear it again</button>
      <button class="btn" data-x="hint" disabled>🎶 Singer hint</button>
    </div>
    <div class="pl-fine" data-x="fine">&nbsp;</div>`;
  const X = (n) => root.querySelector(`[data-x="${n}"]`);

  // only touch the page when a value really changes
  const cache = new Map();
  const setText = (n, v) => { if (cache.get(n) !== v) { cache.set(n, v); X(n).textContent = v; } };
  const setVar = (n, name, v, step = 0.02) => { const k = n + name; const old = cache.get(k) ?? -9; if (Math.abs(old - v) >= step || (v === 0) !== (old === 0)) { cache.set(k, v); X(n).style.setProperty(name, v); } };
  const setMsg = (text, cls = '') => { if (cache.get('msgv') !== text + cls) { cache.set('msgv', text + cls); const m = X('msg'); m.className = `pl-msg ${cls}`; m.textContent = text; } };

  let idx = 0, phase = 'ready', results = [], streak = 0, tracker = null, cur = deck[0];
  let startAt = 0, muteUntil = 0, lastMidi = null, lastAt = 0, recent = [], raf = 0, timer = 0, hints = 0;
  let errSum = 0, errN = 0, stepErrs = [], micReady = false, dead = false;

  const dots = () => { X('dots').innerHTML = deck.map((_, i) => `<i class="${results[i] ? (results[i].won ? 'done' : 'miss') : i === idx && phase !== 'done' ? 'now' : ''}"></i>`).join(''); };
  const slots = (n, done) => Array.from({ length: n }, (_, i) => (i < done ? '●' : '○')).join('');

  function render(stepDone = 0) {
    const label = phase === 'done' ? '✔ Finish' : phase === 'reveal' ? '➡ Next' : '▶ Start';
    if (X('go').textContent !== label) X('go').textContent = label;
    X('go').disabled = phase === 'playing' || phase === 'listening';
    X('again').disabled = X('hint').disabled = phase !== 'listening';
    setText('no', phase === 'done' ? 'All done' : `Challenge ${Math.min(idx + 1, deck.length)} of ${deck.length}`);
    setText('streak', streak > 1 ? `🔥 ${streak} in a row` : ' ');
    setText('ringLab', phase === 'listening' ? 'You are singing' : phase === 'playing' ? 'Listen' : 'Ready');
    const c = phase === 'ready' || phase === 'playing' || phase === 'listening' ? cur : null;
    const shown = c ? (c.blind && c.kind !== 'echo' ? '🙈 Hidden chord' : c.title) : phase === 'done' ? 'Well done!' : ' ';
    if (!(c?.hideAfterPlay && phase === 'listening')) setText('target', shown);
    setText('how', c ? c.how : ' ');
    setText('ringSub', c && c.targets.length > 1 && phase !== 'reveal' ? slots(c.targets.length, stepDone) : ' ');
  }

  async function go() {
    if (phase === 'done') return onDone?.(results);
    if (phase === 'reveal') { phase = 'ready'; cur = deck[idx]; setMsg('Ready? Press Start.'); render(); return; }
    if (phase !== 'ready') return;
    if (!micReady) {
      try { await audio.enableMic(); micReady = true; loop(); } catch (e) { setMsg(micMessage(e)); return; }
    }
    if (dead) return;
    phase = 'playing'; recent = []; lastMidi = null; hints = 0; errSum = errN = 0; stepErrs = [];
    setMsg('🎹 Listen carefully…');
    const ms = audio.sound.play(cur);
    render();
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (cur.hideAfterPlay) { setText('target', '🧠 ?'); setMsg('🧠 Remember it…'); }
      timer = setTimeout(() => {
        phase = 'listening'; recent = []; tracker = makeTracker(cur);
        startAt = performance.now(); // the clock starts when the sound (and any waiting time) is over
        render();
      }, (cur.delayMs || 0) + GAP_MS); // a short silence, so the speaker is not mistaken for the child's voice
    }, ms);
  }
  // Hearing it again or the singer costs nothing extra: the clock keeps running while it plays.
  function replay(kind) {
    if (phase !== 'listening') return;
    hints += 1;
    const ms = kind === 'hint' ? audio.sound.singer(cur) : audio.sound.play(cur);
    muteUntil = performance.now() + ms + GAP_MS; recent = [];
    setMsg(kind === 'hint' ? '🎶 Listen to the singer…' : '🎹 Listen again…');
  }
  function finish(won, now) {
    const limit = cur.limit * 1000;
    const ms = Math.min(limit, now - startAt);
    const err = stepErrs.length ? Math.round(stepErrs.reduce((a, b) => a + b, 0) / stepErrs.length) : null;
    results[idx] = { won, ms: Math.round(ms), limit, err: won ? err : null, hints };
    streak = won ? streak + 1 : 0;
    audio.sound.chime(won);
    const name = cur.targets.map((t) => NAMES[t]).join(' ');
    setMsg(won ? `🎉 Got it! ${(ms / 1000).toFixed(1)} s` : `⏰ The note${cur.targets.length > 1 ? 's were' : ' was'} ${name}`, won ? 'ok' : 'bad');
    idx += 1; tracker = null;
    phase = idx >= deck.length ? 'done' : 'reveal';
    dots(); render();
    if (phase === 'done') {
      const won2 = results.filter((r) => r.won).length;
      X('fine').textContent = `${won2} of ${results.length} matched · ${(results.reduce((s, r) => s + r.ms, 0) / 1000).toFixed(1)} s`;
    }
  }

  function loop(now = performance.now()) {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    audio.analyser.getFloatTimeDomainData(audio.buf);
    const vol = rms(audio.buf);
    let midi = null;
    if (vol > 0.01 && phase === 'listening' && now >= muteUntil) {
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
    const doneMs = results.reduce((n, x) => n + (x?.ms || 0), 0);
    if (phase !== 'listening') {
      setText('clock', `Total ${(doneMs / 1000).toFixed(1)} s`);
      setVar('ring', '--w', 0); setVar('ring', '--hold', 0);
      X('cover').style.transform = 'scaleX(1)';
      return;
    }
    const left = Math.max(0, cur.limit * 1000 - (now - startAt));
    setText('clock', `Total ${((doneMs + now - startAt) / 1000).toFixed(1)} s`);
    const t = tracker.feed(now, midi);
    if (t.hold > 0) { errSum += t.cents; errN += 1; } else { errSum = errN = 0; }
    if (t.justAdvanced) { if (errN) stepErrs.push(errSum / errN); errSum = errN = 0; }
    setVar('ring', '--w', t.warm);
    X('cover').style.transform = `scaleX(${1 - t.warm})`;
    setVar('ring', '--hold', t.hold, 0.03);
    render(t.step);
    if (t.justAdvanced && !t.done) navigator.vibrate?.(20);
    if (t.done) return finish(true, now);
    if (left <= 0) return finish(false, now);
    if (now < muteUntil) setMsg('🎧 Listen…');
    else if (vol < 0.01) setMsg(`Sing out loud, ${Math.ceil(left / 1000)} s left`);
    else if (midi == null) setMsg(`Sing a steady "Ahh"… ${Math.ceil(left / 1000)} s`);
    else setMsg(t.hold > 0.1 ? 'Hold it!' : t.warm > 0.66 ? 'Almost there!' : t.warm > 0.2 ? 'Getting warmer…' : 'Keep trying, slide your voice…');
  }

  X('go').addEventListener('click', go);
  X('again').addEventListener('click', () => replay('again'));
  X('hint').addEventListener('click', () => replay('hint'));
  X('exit').addEventListener('click', () => { destroy(); onExit?.(); });
  function destroy() { dead = true; cancelAnimationFrame(raf); clearTimeout(timer); audio.stopMic(); }
  dots(); render(); setMsg('Ready? Press Start.');
  return { destroy };
}
