import { detectPitch, noteFromFreq, matches, rms, freqOfMidi, NOTE_NAMES, CHORDS } from './pitch.js';

const $ = (s) => document.querySelector(s);
const ROUND_MS = 15000;
const HOLD_MS = 500;

let ctx, stream, analyser, buf, raf = 0;
let target = 0, type = 'major';
let phase = 'idle'; // idle | playing | listening
let startAt = 0, hitAt = 0, deadline = 0;
let recent = [];
const attempts = [];

$('#roots').innerHTML = NOTE_NAMES.map((n, i) => `<button class="btn small${i === 0 ? ' on' : ''}" data-pc="${i}">${n}</button>`).join('');
$('#roots').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pc]');
  if (!b) return;
  target = Number(b.dataset.pc);
  document.querySelectorAll('#roots button').forEach((x) => x.classList.toggle('on', x === b));
});
document.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
  type = b.dataset.type;
  document.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('on', x === b));
}));

async function start() {
  $('#err').textContent = '';
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
  } catch (e) {
    $('#err').textContent = e.name === 'NotAllowedError'
      ? 'The microphone is blocked. Allow it in the browser (tap the lock icon by the address) and try again.'
      : `Could not start the microphone: ${e.message}`;
    return;
  }
  analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  ctx.createMediaStreamSource(stream).connect(analyser);
  buf = new Float32Array(analyser.fftSize);
  $('#startCard').hidden = true; $('#live').hidden = false; $('#game').hidden = false;
  loop();
}

function stop() {
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop()); // the microphone light goes off
  ctx?.close();
  stream = ctx = analyser = null; phase = 'idle';
  $('#startCard').hidden = false; $('#live').hidden = true; $('#game').hidden = true;
}

function median(a) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }

function loop() {
  raf = requestAnimationFrame(loop);
  analyser.getFloatTimeDomainData(buf);
  const level = rms(buf);
  $('#vol').style.width = `${Math.min(100, level * 400)}%`;
  const now = performance.now();
  let note = null;
  if (level > 0.01 && phase !== 'playing') {
    const p = detectPitch(buf, ctx.sampleRate);
    if (p && p.clarity > 0.85) {
      recent.push(p.freq); if (recent.length > 5) recent.shift();
      note = noteFromFreq(median(recent));
    }
  }
  if (!note) { recent = recent.slice(1); }
  $('#hint').textContent = phase === 'playing' ? '' : level < 0.01 ? 'Too quiet: sing a little louder or move the phone closer.' : note ? '' : 'Hold one steady "Ahh"…';
  $('#note').textContent = note ? `${note.name}${note.octave}` : '–';
  $('#cents').textContent = note ? `${note.cents > 0 ? '+' : ''}${note.cents}` : ' ';
  $('#needle').style.left = note ? `calc(${50 + note.cents}% - 3px)` : 'calc(50% - 3px)';
  if (phase !== 'listening') return;
  const left = Math.max(0, deadline - now);
  if (note && matches(note, target)) {
    if (!hitAt) hitAt = now;
    if (now - hitAt >= HOLD_MS) return finish(true, hitAt - startAt);
  } else hitAt = 0;
  if (left <= 0) return finish(false, ROUND_MS);
  $('#result').innerHTML = `Sing <b>${NOTE_NAMES[target]}</b> · ${Math.ceil(left / 1000)}s`;
}

function finish(won, ms) {
  phase = 'idle';
  attempts.unshift(`${NOTE_NAMES[target]} ${type}: ${won ? `${(ms / 1000).toFixed(1)}s ✅` : 'missed ❌'}`);
  $('#result').innerHTML = won ? `<span class="ok">Matched ${NOTE_NAMES[target]} in ${(ms / 1000).toFixed(1)} seconds!</span>` : `<span class="bad">Time's up. Try again!</span>`;
  $('#log').innerHTML = attempts.slice(0, 8).map((a) => `<div>${a}</div>`).join('');
}

// A simple piano-like chord made in the browser (no sound files).
function tone(freq, t0, dur, gain = 0.18) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(gain * 0.35, t0 + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(ctx.destination);
  [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12]].forEach(([mult, wave, amp]) => {
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.type = wave; o.frequency.value = freq * mult; a.gain.value = amp;
    o.connect(a).connect(g); o.start(t0); o.stop(t0 + dur + 0.05);
  });
}

function playNotes(semis, afterMs = 1500) {
  phase = 'playing'; recent = [];
  $('#result').textContent = '🎹 Listen…';
  const root = 60 + target; // middle C and up: a comfortable range for children
  const t0 = ctx.currentTime + 0.05;
  semis.forEach((s) => tone(freqOfMidi(root + s), t0, afterMs / 1000 + 0.3));
  setTimeout(() => {
    phase = 'listening'; recent = []; hitAt = 0;
    startAt = performance.now(); deadline = startAt + ROUND_MS;
  }, afterMs + 350); // a short silence so the speaker is not heard by the microphone
}

$('#start').addEventListener('click', start);
$('#stop').addEventListener('click', stop);
$('#play').addEventListener('click', () => playNotes(CHORDS[type]));
$('#again').addEventListener('click', () => playNotes(CHORDS[type]));
$('#rootOnly').addEventListener('click', () => playNotes([0], 1000));
window.addEventListener('pagehide', stop);
