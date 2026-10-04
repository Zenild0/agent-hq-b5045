// Warm-up room: listen to chords and scales and sing along any time. No score, no clock, nothing saved.
import { detectPitch, rms, noteFromFreq, freqOfMidi } from './pitch.js';
import { NAMES } from './levels.js';
import { openAudio, micMessage } from './audio.js';

export function mountWarmup(root, { onExit } = {}) {
  let quality = 'major', audio = null, raf = 0, playing = null, playingUntil = 0, dead = false, micOn = false;
  const box = document.createElement('div'); // its own container, so its listeners go away with it
  root.replaceChildren(box);
  box.innerHTML = `
    <div class="card">
      <div class="row between"><h2 style="margin:0">🔥 Warm-up</h2><button class="btn small" data-x="exit">✕ Back</button></div>
      <p class="muted" style="margin:6px 0">Tap a chord and sing along on "Ahh". Nothing is scored. Take your time and breathe.</p>
      <div class="row" role="group" aria-label="Chord type">
        <button class="btn small primary" data-q="major">Major chords</button>
        <button class="btn small" data-q="minor">Minor chords</button>
      </div>
      <div class="wu-grid" data-x="pads"></div>
      <div class="wu-now" data-x="now">&nbsp;</div>
    </div>
    <div class="card">
      <h3 style="margin:0 0 6px">Scales and slides</h3>
      <div class="row">
        <button class="btn small" data-s="up">⬆ Scale up (do re mi)</button>
        <button class="btn small" data-s="down">⬇ Scale down</button>
        <button class="btn small" data-s="siren">🚨 Siren slide</button>
      </div>
      <div class="muted" style="margin-top:6px">Starts on the note you last tapped (or C).</div>
    </div>
    <div class="card">
      <div class="row between"><h3 style="margin:0">Hear yourself</h3><button class="btn small" data-x="mic">🎤 Listen to my voice</button></div>
      <div class="wu-tuner">
        <div class="wu-big" data-x="note">–</div>
        <div class="wu-meter" aria-label="Flat or sharp"><b></b><i data-x="needle"></i></div>
        <div class="wu-lab"><span>flat</span><span data-x="cents">&nbsp;</span><span>sharp</span></div>
      </div>
      <div class="muted" data-x="err" role="alert">The phone listens live. Nothing is recorded or sent anywhere.</div>
    </div>`;
  const X = (n) => box.querySelector(`[data-x="${n}"]`);
  X('pads').innerHTML = NAMES.map((n, i) => `<button class="btn" data-pc="${i}">${n}</button>`).join('');

  let lastPc = 0;
  const ensureAudio = async () => { if (!audio) audio = await openAudio(); return audio; };
  const cache = new Map();
  const setText = (n, v) => { if (cache.get(n) !== v) { cache.set(n, v); X(n).textContent = v; } };

  box.addEventListener('click', async (e) => {
    const q = e.target.closest('[data-q]');
    if (q) {
      quality = q.dataset.q;
      box.querySelectorAll('[data-q]').forEach((b) => b.classList.toggle('primary', b === q));
      return;
    }
    const pad = e.target.closest('[data-pc]');
    if (pad) {
      lastPc = Number(pad.dataset.pc);
      const a = await ensureAudio();
      const ms = a.sound.chord(60 + lastPc, quality, 3.5);
      playing = lastPc; playingUntil = performance.now() + ms;
      box.querySelectorAll('[data-pc]').forEach((b) => b.classList.toggle('on', b === pad));
      setText('now', `${NAMES[lastPc]} ${quality}: sing ${NAMES[lastPc]}`);
      setTimeout(() => { if (!dead) box.querySelectorAll('[data-pc]').forEach((b) => b.classList.remove('on')); }, ms);
      return;
    }
    const sc = e.target.closest('[data-s]');
    if (sc) {
      const a = await ensureAudio();
      const root0 = 60 + lastPc;
      const major = [0, 2, 4, 5, 7, 9, 11, 12];
      if (sc.dataset.s === 'up') a.sound.melody(major.map((s) => root0 + s), 0.9);
      else if (sc.dataset.s === 'down') a.sound.melody(major.map((s) => root0 + s).reverse(), 0.9);
      else {
        const o = a.ctx.createOscillator(), g = a.ctx.createGain(), t0 = a.ctx.currentTime + 0.05;
        o.type = 'sine';
        o.frequency.setValueAtTime(freqOfMidi(root0), t0);
        o.frequency.exponentialRampToValueAtTime(freqOfMidi(root0 + 12), t0 + 3);
        o.frequency.exponentialRampToValueAtTime(freqOfMidi(root0), t0 + 6);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.2, t0 + 0.2); g.gain.setValueAtTime(0.2, t0 + 5.6); g.gain.linearRampToValueAtTime(0, t0 + 6);
        o.connect(g).connect(a.ctx.destination); o.start(t0); o.stop(t0 + 6.1);
      }
      setText('now', sc.dataset.s === 'siren' ? 'Slide your voice up and down with the sound' : `Sing along from ${NAMES[lastPc]}`);
      return;
    }
    if (e.target.closest('[data-x="mic"]')) {
      const a = await ensureAudio();
      if (micOn) { a.stopMic(); micOn = false; cancelAnimationFrame(raf); X('mic').textContent = '🎤 Listen to my voice'; setText('note', '–'); return; }
      try { await a.enableMic(); micOn = true; X('mic').textContent = '⏹ Stop listening'; X('err').textContent = ''; loop(); }
      catch (err) { X('err').textContent = micMessage(err); }
      return;
    }
    if (e.target.closest('[data-x="exit"]')) { destroy(); onExit?.(); }
  });

  let recent = [], shownAt = 0, shown = '–';
  function loop(now = performance.now()) {
    if (dead || !micOn) return;
    raf = requestAnimationFrame(loop);
    audio.analyser.getFloatTimeDomainData(audio.buf);
    let f = 0;
    if (rms(audio.buf) > 0.01 && now > playingUntil) {
      const p = detectPitch(audio.buf, audio.ctx.sampleRate);
      if (p && p.clarity > 0.85) { recent.push(p.freq); if (recent.length > 5) recent.shift(); f = [...recent].sort((a, b) => a - b)[Math.floor(recent.length / 2)]; }
    }
    if (!f && recent.length) recent.shift();
    if (f) {
      const n = noteFromFreq(f);
      shown = `${n.name}${n.octave}`; shownAt = now;
      setText('cents', `${n.cents > 0 ? '+' : ''}${n.cents}`);
      X('needle').style.transform = `translateX(${n.cents * 2.2}px)`;
    }
    setText('note', now - shownAt < 350 ? shown : '–');
    if (now - shownAt >= 350) setText('cents', ' ');
  }
  function destroy() { dead = true; cancelAnimationFrame(raf); audio?.close(); }
  return { destroy };
}
