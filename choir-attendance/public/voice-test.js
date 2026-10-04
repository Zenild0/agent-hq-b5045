import { detectPitch, noteFromFreq, rms, freqOfMidi, NOTE_NAMES, CHORDS } from './pitch.js';

const $ = (s) => document.querySelector(s);
const ROUND_MS = 15000, HOLD_MS = 500, CHORD_S = 3.0, GAP_MS = 400;
const PENALTY = { again: 2000, hint: 3000 };
const TOLERANCE = 40; // cents: "within the range", not exact

// ---------- no-flicker DOM helpers: only touch the page when a value really changes ----------
const cache = new Map();
const setText = (id, v) => { if (cache.get(id) !== v) { cache.set(id, v); $(`#${id}`).textContent = v; } };
const setVar = (el, name, v, step = 0.02) => { const k = `${el.id}${name}`; const old = cache.get(k) ?? -9; if (Math.abs(old - v) >= step || v === 0 !== (old === 0)) { cache.set(k, v); el.style.setProperty(name, v); } };
const setMsg = (text, cls = '') => { if (cache.get('msgv') !== text + cls) { cache.set('msgv', text + cls); const m = $('#msg'); m.className = `msg ${cls}`; m.textContent = text; } };

// ---------- game state ----------
let ctx, stream, analyser, buf, raf = 0;
let level = 1, deck = [], idx = 0, phase = 'ready'; // ready | playing | listening | reveal | done
let results = [], streak = 0;
let startAt = 0, hitAt = 0, penalty = 0, listenFrom = 0, lastNote = null, lastNoteAt = 0, recent = [];
let cur = null; // { pc, type, root }
const forced = new URLSearchParams(location.search).get('force'); // for testing: ?force=0,2,4

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function buildDeck() {
  if (forced) return forced.split(',').map((n) => ({ pc: Number(n), type: 'major' }));
  if (level === 1) return [0, 2, 4, 5, 7, 9, 11].map((pc) => ({ pc, type: 'major' }));
  if (level === 2) return shuffle([0, 2, 4, 5, 7, 9, 11]).map((pc) => ({ pc, type: 'major' }));
  return shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).slice(0, 10).map((pc) => ({ pc, type: Math.random() < 0.7 ? 'major' : 'minor' }));
}

function drawDots() {
  $('#dots').innerHTML = deck.map((_, i) => `<i class="${results[i] ? (results[i].won ? 'done' : 'miss') : i === idx && phase !== 'done' ? 'now' : ''}"></i>`).join('');
}
function newRound() {
  deck = buildDeck(); idx = 0; results = []; streak = 0; phase = 'ready'; cur = null;
  drawDots(); render();
  setMsg('Ready? Press Start. You will hear a chord, but not its name.');
  $('#fine').textContent = ' ';
}

// ---------- sound (all made in the browser: no files) ----------
function chordTone(freq, t0, dur, gain) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(gain * 0.55, t0 + 0.5);   // piano-like bloom, then a long sustain
  g.gain.setValueAtTime(gain * 0.5, t0 + dur - 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(ctx.destination);
  [[1, 'triangle', 1], [2, 'sine', 0.3], [3, 'sine', 0.1]].forEach(([m, w, a]) => {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = w; o.frequency.value = freq * m; og.gain.value = a;
    o.connect(og).connect(g); o.start(t0); o.stop(t0 + dur + 0.05);
  });
}
// A slightly different voicing each time (octave and inversion move a little), so no two rounds sound identical.
function playChord(c, seconds = CHORD_S) {
  const rootMidi = 48 + c.pc + 12 * Math.floor(Math.random() * 2);   // C3..B4
  const inversion = Math.floor(Math.random() * 3);
  const detune = (Math.random() - 0.5) * 0.3;                         // up to about 15 cents either way
  const notes = CHORDS[c.type].map((s, i) => rootMidi + s + (i < inversion ? 12 : 0));
  const t0 = ctx.currentTime + 0.05;
  notes.forEach((m) => chordTone(freqOfMidi(m + detune), t0, seconds, 0.17));
  chordTone(freqOfMidi(rootMidi - 12 + detune), t0, seconds, 0.12);    // the root, an octave lower, to anchor it
}
// A synthetic "singer" for the hint: a buzzy tone shaped like an "ah" vowel, with a gentle vibrato.
function playSinger(c, seconds = 2.4) {
  const t0 = ctx.currentTime + 0.05;
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freqOfMidi(60 + c.pc);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = 4; lfo.connect(lg).connect(o.frequency);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(0.35, t0 + 0.25); out.gain.setValueAtTime(0.35, t0 + seconds - 0.4); out.gain.linearRampToValueAtTime(0, t0 + seconds);
  [[800, 6, 1], [1150, 8, 0.6], [2900, 10, 0.25]].forEach(([f, q, a]) => {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const bg = ctx.createGain(); bg.gain.value = a; o.connect(bp).connect(bg).connect(out);
  });
  out.connect(ctx.destination); o.start(t0); lfo.start(t0); o.stop(t0 + seconds + 0.1); lfo.stop(t0 + seconds + 0.1);
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

// ---------- flow ----------
function beginChord(replay = false) {
  if (!replay) cur = deck[idx];
  phase = 'playing'; recent = []; hitAt = 0;
  setMsg('🎹 Listen carefully…');
  playChord(cur);
  render();
  clearTimeout(beginChord.t);
  beginChord.t = setTimeout(() => {
    phase = 'listening'; recent = [];
    if (!replay || !startAt) { startAt = performance.now(); penalty = penalty || 0; }
    listenFrom = performance.now();
    render();
  }, CHORD_S * 1000 + GAP_MS); // a short silence, so the speaker is not mistaken for the child's voice
}
function pressGo() {
  if (phase === 'done') return newRound();
  if (phase === 'reveal') { phase = 'ready'; setMsg('Ready? Press Start for the next chord.'); render(); return; }
  if (phase !== 'ready') return;
  penalty = 0; startAt = 0; beginChord(false);
}
function useAgain() { if (phase !== 'listening') return; penalty += PENALTY.again; beginChord(true); }
function useHint() {
  if (phase !== 'listening') return;
  penalty += PENALTY.hint; playSinger(cur);
  setMsg('🎶 A singer is showing you the note…');
}
function finishNote(won) {
  const ms = Math.min(ROUND_MS, hitAt && won ? hitAt - startAt : ROUND_MS) + penalty;
  results[idx] = { won, ms };
  streak = won ? streak + 1 : 0;
  chime(won);
  setMsg(won ? `🎉 ${NOTE_NAMES[cur.pc]} ${cur.type}! ${(ms / 1000).toFixed(1)} s` : `⏰ It was ${NOTE_NAMES[cur.pc]} ${cur.type}`, won ? 'ok' : 'bad');
  idx += 1;
  phase = idx >= deck.length ? 'done' : 'reveal';
  drawDots(); render();
  if (phase === 'done') showEnd();
}
function showEnd() {
  const won = results.filter((r) => r.won).length;
  const total = results.reduce((s, r) => s + r.ms, 0);
  const avg = total / results.length / 1000;
  const stars = won === results.length && avg < 4 ? '⭐⭐⭐' : won >= results.length * 0.7 && avg < 8 ? '⭐⭐' : won ? '⭐' : '';
  $('#fine').innerHTML = `<b>Round finished:</b> ${won} of ${results.length} matched · total ${(total / 1000).toFixed(1)} s ${stars}`;
}

function render() {
  const go = $('#go');
  const label = phase === 'done' ? '🔄 Play again' : phase === 'reveal' ? '➡ Next chord' : '▶ Start';
  if (go.textContent !== label) go.textContent = label;
  go.disabled = phase === 'playing' || phase === 'listening';
  $('#again').disabled = phase !== 'listening';
  $('#hint').disabled = phase !== 'listening';
  setText('chordNo', phase === 'done' ? 'All done' : `Chord ${Math.min(idx + 1, deck.length)} of ${deck.length}`);
  setText('streak', streak > 1 ? `🔥 ${streak} in a row` : ' ');
  setText('ringLab', phase === 'listening' ? 'You are singing' : phase === 'playing' ? 'Listen' : 'Ready');
  if (phase === 'listening' && $('#peek').checked && cur) setText('ringSub', `sing ${NOTE_NAMES[cur.pc]}`);
  else if (phase !== 'listening') setText('ringSub', ' ');
}

// ---------- the listening loop ----------
function circDist(freq, pc) { // distance in semitones between a sung pitch and a note name, any octave (0..6)
  const exact = 69 + 12 * Math.log2(freq / 440);
  const d = (((exact - pc) % 12) + 12) % 12;
  return Math.min(d, 12 - d);
}
function loop(now = performance.now()) {
  raf = requestAnimationFrame(loop);
  analyser.getFloatTimeDomainData(buf);
  const level = rms(buf);
  let freq = 0;
  if (level > 0.01 && phase === 'listening') {
    const p = detectPitch(buf, ctx.sampleRate);
    if (p && p.clarity > 0.85) { recent.push(p.freq); if (recent.length > 5) recent.shift(); freq = [...recent].sort((a, b) => a - b)[Math.floor(recent.length / 2)]; }
  }
  if (!freq && recent.length) recent.shift();
  // show the sung note steadily: it stays for a moment after the voice dips, so the number never blinks
  if (freq) { lastNote = noteFromFreq(freq); lastNoteAt = now; }
  const show = lastNote && now - lastNoteAt < 350 ? `${lastNote.name}${lastNote.octave}` : '–';
  setText('note', phase === 'listening' ? show : '♪');

  if (phase === 'listening') {
    const left = Math.max(0, ROUND_MS - (now - listenFrom));
    setText('clock', `${((now - startAt + penalty) / 1000).toFixed(1)} s`);
    const warm = freq ? Math.max(0, 1 - circDist(freq, cur.pc) / 3) : 0;
    setVar($('#ring'), '--w', warm);
    $('#warmCover').style.transform = `scaleX(${1 - warm})`;
    const hit = freq && circDist(freq, cur.pc) * 100 <= TOLERANCE;
    if (hit) { if (!hitAt) hitAt = now; } else hitAt = 0;
    setVar($('#ring'), '--hold', hit ? Math.min(1, (now - hitAt) / HOLD_MS) : 0, 0.03);
    if (hit && now - hitAt >= HOLD_MS) return finishNote(true);
    if (left <= 0) return finishNote(false);
    if (level < 0.01 && cache.get('msgv') !== 'quiet') setMsg(`Sing out loud, ${Math.ceil(left / 1000)} s left`);
    else if (!freq) setMsg(`Sing a steady "Ahh"… ${Math.ceil(left / 1000)} s`);
    else setMsg(warm > 0.66 ? 'Almost there, hold it!' : warm > 0.2 ? 'Getting warmer…' : 'Keep trying, slide your voice…');
  } else {
    setVar($('#ring'), '--w', 0); setVar($('#ring'), '--hold', 0);
    $('#warmCover').style.transform = 'scaleX(1)';
  }
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
  cancelAnimationFrame(raf); clearTimeout(beginChord.t);
  stream?.getTracks().forEach((t) => t.stop()); // the microphone light goes off
  ctx?.close(); stream = ctx = analyser = null; phase = 'ready';
  $('#startCard').hidden = false; $('#game').hidden = true;
}

$('#start').addEventListener('click', start);
$('#stop').addEventListener('click', stop);
$('#go').addEventListener('click', pressGo);
$('#again').addEventListener('click', useAgain);
$('#hint').addEventListener('click', useHint);
$('#peek').addEventListener('change', () => { cache.delete('ringSub'); render(); });
document.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => {
  level = Number(b.dataset.lv);
  document.querySelectorAll('[data-lv]').forEach((x) => x.classList.toggle('on', x === b));
  if (phase === 'playing' || phase === 'listening') clearTimeout(beginChord.t);
  newRound();
}));
window.addEventListener('pagehide', stop);
