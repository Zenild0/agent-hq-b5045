import { detectPitch, rms, freqOfMidi, CHORDS } from './pitch.js';
import { LEVELS, NAMES, buildDeck, makeTracker, starsFor } from './levels.js';
import { mountWarmup } from './warmup.js';

const $ = (s) => document.querySelector(s);
const GAP_MS = 400;
const params = new URLSearchParams(location.search);

// ---------- no-flicker DOM helpers: only touch the page when a value really changes ----------
const cache = new Map();
const setText = (id, v) => { if (cache.get(id) !== v) { cache.set(id, v); $(`#${id}`).textContent = v; } };
const setVar = (el, name, v, step = 0.02) => { const k = `${el.id}${name}`; const old = cache.get(k) ?? -9; if (Math.abs(old - v) >= step || (v === 0) !== (old === 0)) { cache.set(k, v); el.style.setProperty(name, v); } };
const setMsg = (text, cls = '') => { if (cache.get('msgv') !== text + cls) { cache.set('msgv', text + cls); const m = $('#msg'); m.className = `msg ${cls}`; m.textContent = text; } };

// ---------- state ----------
let ctx, stream, analyser, buf, raf = 0;
let levelId = Math.min(12, Math.max(1, Number(params.get('lv')) || 1));
let deck = [], idx = 0, phase = 'ready'; // ready | playing | listening | reveal | done
let results = [], streak = 0, tracker = null, cur = null;
let startAt = 0, muteUntil = 0, lastMidi = null, lastAt = 0, recent = [];
const cleared = new Set();
const rngSeed = Number(params.get('seed'));
const rnd = rngSeed ? (() => { let a = rngSeed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })() : Math.random;
const level = () => LEVELS.find((l) => l.id === levelId);

// ---------- the ladder ----------
function drawLadder() {
  $('#ladder').innerHTML = LEVELS.map((l) => `<button class="btn small${l.id === levelId ? ' on' : ''}${cleared.has(l.id) ? ' cleared' : ''}" data-lv="${l.id}" aria-label="Level ${l.id} ${l.name}">${l.emoji}<small>${l.id}</small></button>`).join('');
  const l = level();
  $('#lvInfo').innerHTML = `<b>${l.emoji} Level ${l.id}: ${l.name}</b> <span class="muted">· ${l.tier}</span><br>${l.how}<br><span class="muted">Margin ±${l.tol} cents · hold ${(l.hold / 1000).toFixed(1)} s</span>`;
}
$('#ladder').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lv]');
  if (!b) return;
  levelId = Number(b.dataset.lv);
  clearTimeout(beginTimer);
  newRound();
});

// ---------- sound (all made in the browser: no files) ----------
function tone(freq, t0, dur, gain, type = 'piano') {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(gain * 0.55, t0 + Math.min(0.5, dur / 2));
  g.gain.setValueAtTime(gain * 0.5, Math.max(t0 + 0.05, t0 + dur - 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(ctx.destination);
  [[1, 'triangle', 1], [2, 'sine', 0.3], [3, 'sine', 0.1]].forEach(([m, w, a]) => {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = w; o.frequency.value = freq * m; og.gain.value = a;
    o.connect(og).connect(g); o.start(t0); o.stop(t0 + dur + 0.05);
  });
}
// What the phone plays for a challenge. Returns how many milliseconds it lasts.
function play(ch) {
  const t0 = ctx.currentTime + 0.05;
  const p = ch.play;
  if (p.type === 'chord') {
    CHORDS[p.quality].forEach((s) => tone(freqOfMidi(p.root + s), t0, 3, 0.17));
    tone(freqOfMidi(p.root - 12), t0, 3, 0.12);
    return 3000;
  }
  if (p.type === 'note') { tone(freqOfMidi(p.midi), t0, 2, 0.22); return 2000; }
  p.notes.forEach((m, i) => tone(freqOfMidi(m), t0 + i * 0.8, 0.78, 0.22)); // a short tune, note by note
  return p.notes.length * 800 + 200;
}
// The hint: a synthetic "ah" singer shows the notes to sing (about 3 seconds in total).
function singer(ch) {
  const notes = ch.targets.map((pc) => 60 + pc);
  const each = 3 / notes.length;
  const t0 = ctx.currentTime + 0.05;
  notes.forEach((m, i) => {
    const s = t0 + i * each;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freqOfMidi(m);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = 4; lfo.connect(lg).connect(o.frequency);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, s); out.gain.linearRampToValueAtTime(0.32, s + 0.15); out.gain.setValueAtTime(0.32, s + each - 0.25); out.gain.linearRampToValueAtTime(0, s + each - 0.02);
    [[800, 6, 1], [1150, 8, 0.6], [2900, 10, 0.25]].forEach(([f, q, a]) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const bg = ctx.createGain(); bg.gain.value = a; o.connect(bp).connect(bg).connect(out);
    });
    out.connect(ctx.destination); o.start(s); lfo.start(s); o.stop(s + each + 0.05); lfo.stop(s + each + 0.05);
  });
  return 3000;
}
function chime(ok) {
  const t0 = ctx.currentTime + 0.02;
  (ok ? [72, 76, 79, 84] : [60, 57]).forEach((m, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freqOfMidi(m);
    g.gain.setValueAtTime(0.0001, t0 + i * 0.09); g.gain.exponentialRampToValueAtTime(0.16, t0 + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.35);
    o.connect(g).connect(ctx.destination); o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.4);
  });
  if (ok) navigator.vibrate?.(60);
}

// ---------- the round ----------
function drawDots() {
  $('#dots').innerHTML = deck.map((_, i) => `<i class="${results[i] ? (results[i].won ? 'done' : 'miss') : i === idx && phase !== 'done' ? 'now' : ''}"></i>`).join('');
}
function newRound() {
  deck = buildDeck(levelId, rnd); idx = 0; results = []; streak = 0; phase = 'ready'; cur = deck[0]; tracker = null;
  drawLadder(); drawDots(); render();
  setMsg('Ready? Press Start.');
  $('#fine').textContent = ' ';
}

let beginTimer = 0;
function pressGo() {
  if (phase === 'done') return newRound();
  if (phase === 'reveal') { phase = 'ready'; cur = deck[idx]; setMsg('Ready? Press Start.'); render(); return; }
  if (phase !== 'ready') return;
  phase = 'playing'; recent = []; lastMidi = null;
  setMsg('🎹 Listen carefully…');
  const ms = play(cur);
  render();
  clearTimeout(beginTimer);
  beginTimer = setTimeout(() => {
    if (cur.hideAfterPlay) { setText('target', '🧠 ?'); setMsg('🧠 Remember it…'); }
    beginTimer = setTimeout(() => {
      phase = 'listening'; recent = []; tracker = makeTracker(cur);
      startAt = performance.now(); // the clock starts when the sound (and any waiting time) is over
      render();
    }, (cur.delayMs || 0) + GAP_MS); // a short silence, so the speaker is not mistaken for the child's voice
  }, ms);
}
// Hearing it again or the singer costs nothing extra: the clock keeps running while it plays.
function replay(kind) {
  if (phase !== 'listening') return;
  const ms = kind === 'hint' ? singer(cur) : play(cur);
  muteUntil = performance.now() + ms + GAP_MS; recent = [];
  setMsg(kind === 'hint' ? '🎶 Listen to the singer…' : '🎹 Listen again…');
}
function finish(won, now) {
  const ms = Math.min(cur.limit * 1000, now - startAt);
  results[idx] = { won, ms };
  streak = won ? streak + 1 : 0;
  chime(won);
  const name = cur.kind === 'echo' || cur.kind === 'interval' ? cur.targets.map((t) => NAMES[t]).join(' ') : `${NAMES[cur.targets[0]]}`;
  setMsg(won ? `🎉 Got it! ${(ms / 1000).toFixed(1)} s` : `⏰ The note${cur.targets.length > 1 ? 's were' : ' was'} ${name}`, won ? 'ok' : 'bad');
  idx += 1;
  phase = idx >= deck.length ? 'done' : 'reveal';
  tracker = null;
  drawDots(); render();
  if (phase === 'done') showEnd();
}
function showEnd() {
  const won = results.filter((r) => r.won).length;
  const total = results.reduce((s, r) => s + r.ms, 0);
  const stars = starsFor(results, (i) => deck[i].limit * 1000);
  const pass = won >= results.length * 0.7;
  if (pass) cleared.add(levelId);
  const next = LEVELS.find((l) => l.id === levelId + 1);
  $('#fine').innerHTML = `<b>${pass ? '🏆 Level cleared!' : 'Not quite, try again!'}</b> ${won} of ${results.length} · ${(total / 1000).toFixed(1)} s ${'⭐'.repeat(stars)}${pass && next ? `<br>Next: ${next.emoji} ${next.name}` : ''}`;
  drawLadder();
}

// ---------- screen ----------
const slots = (n, done) => Array.from({ length: n }, (_, i) => (i < done ? '●' : '○')).join('');
function render(stepDone = 0) {
  const go = $('#go');
  const label = phase === 'done' ? '🔄 Play again' : phase === 'reveal' ? '➡ Next' : '▶ Start';
  if (go.textContent !== label) go.textContent = label;
  go.disabled = phase === 'playing' || phase === 'listening';
  $('#again').disabled = phase !== 'listening';
  $('#hint').disabled = phase !== 'listening';
  setText('chordNo', phase === 'done' ? 'All done' : `Challenge ${Math.min(idx + 1, deck.length)} of ${deck.length}`);
  setText('streak', streak > 1 ? `🔥 ${streak} in a row` : ' ');
  setText('ringLab', phase === 'listening' ? 'You are singing' : phase === 'playing' ? 'Listen' : 'Ready');
  const c = phase === 'ready' || phase === 'playing' || phase === 'listening' ? cur : null;
  const shown = c ? (c.blind && c.kind !== 'echo' ? '🙈 Hidden chord' : c.title) : phase === 'done' ? 'Well done!' : ' ';
  if (!(c?.hideAfterPlay && phase === 'listening')) setText('target', shown);
  setText('how', c ? c.how : ' ');
  setText('ringSub', c && c.targets.length > 1 && phase !== 'reveal' ? slots(c.targets.length, stepDone) : ' ');
}

// ---------- the listening loop ----------
function loop(now = performance.now()) {
  raf = requestAnimationFrame(loop);
  analyser.getFloatTimeDomainData(buf);
  const vol = rms(buf);
  let midi = null;
  if (vol > 0.01 && phase === 'listening' && now >= muteUntil) {
    const p = detectPitch(buf, ctx.sampleRate);
    if (p && p.clarity > 0.85) {
      recent.push(69 + 12 * Math.log2(p.freq / 440)); if (recent.length > 5) recent.shift();
      midi = [...recent].sort((a, b) => a - b)[Math.floor(recent.length / 2)];
    }
  }
  if (midi == null && recent.length) recent.shift();
  if (midi != null) { lastMidi = midi; lastAt = now; }
  // the sung note stays on screen a moment after the voice dips, so the number never blinks
  const shown = lastMidi != null && now - lastAt < 350 ? `${NAMES[((Math.round(lastMidi) % 12) + 12) % 12]}${Math.floor(Math.round(lastMidi) / 12) - 1}` : '–';
  setText('note', phase === 'listening' ? shown : '♪');
  const doneMs = results.reduce((n, r) => n + (r?.ms || 0), 0);

  if (phase !== 'listening') {
    setText('clock', `Total ${(doneMs / 1000).toFixed(1)} s`);
    setVar($('#ring'), '--w', 0); setVar($('#ring'), '--hold', 0);
    $('#warmCover').style.transform = 'scaleX(1)';
    return;
  }
  const left = Math.max(0, cur.limit * 1000 - (now - startAt));
  setText('clock', `Total ${((doneMs + now - startAt) / 1000).toFixed(1)} s`);
  const t = tracker.feed(now, midi);
  setVar($('#ring'), '--w', t.warm);
  $('#warmCover').style.transform = `scaleX(${1 - t.warm})`;
  setVar($('#ring'), '--hold', t.hold, 0.03);
  render(t.step);
  if (t.justAdvanced && !t.done) navigator.vibrate?.(20);
  if (t.done) return finish(true, now);
  if (left <= 0) return finish(false, now);
  if (now < muteUntil) setMsg('🎧 Listen…');
  else if (vol < 0.01) setMsg(`Sing out loud, ${Math.ceil(left / 1000)} s left`);
  else if (midi == null) setMsg(`Sing a steady "Ahh"… ${Math.ceil(left / 1000)} s`);
  else setMsg(t.hold > 0.1 ? 'Hold it!' : t.warm > 0.66 ? 'Almost there!' : t.warm > 0.2 ? 'Getting warmer…' : 'Keep trying, slide your voice…');
}

// ---------- microphone ----------
async function start() {
  $('#err').textContent = '';
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
  } catch (e) {
    $('#err').textContent = e.name === 'NotAllowedError' ? 'The microphone is blocked. Allow it in the browser (tap the lock icon by the address) and try again.' : `Could not start the microphone: ${e.message}`;
    return;
  }
  analyser = ctx.createAnalyser(); analyser.fftSize = 4096;
  ctx.createMediaStreamSource(stream).connect(analyser);
  buf = new Float32Array(analyser.fftSize);
  $('#startCard').hidden = true; $('#game').hidden = false;
  newRound(); loop();
}
function stop() {
  cancelAnimationFrame(raf); clearTimeout(beginTimer);
  stream?.getTracks().forEach((t) => t.stop()); // the microphone light goes off
  ctx?.close(); stream = ctx = analyser = null; phase = 'ready';
  $('#startCard').hidden = false; $('#game').hidden = true;
}

$('#start').addEventListener('click', start);
$('#stop').addEventListener('click', stop);
$('#go').addEventListener('click', pressGo);
$('#again').addEventListener('click', () => replay('again'));
$('#hint').addEventListener('click', () => replay('hint'));
window.addEventListener('pagehide', stop);

// Warm-up room: chords, scales and a live tuner, no score. Same room as in the real game.
let warm = null;
function openWarm() {
  if (ctx) stop(); // the game's microphone goes off first
  $('#startCard').hidden = true; $('#game').hidden = true; $('#warm').hidden = false;
  warm = mountWarmup($('#warm'), { onExit: () => { warm?.destroy(); warm = null; $('#warm').hidden = true; $('#warm').innerHTML = ''; $('#startCard').hidden = false; } });
}
$('#warmBtn').addEventListener('click', openWarm);
$('#warmBtn2').addEventListener('click', openWarm);
