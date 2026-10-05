// Sound and microphone for the singing game. Everything is made in the browser (no sound files).
// The microphone is listened to live and thrown away: nothing is recorded, stored or sent.
import { freqOfMidi, CHORDS } from './pitch.js';
import { renderPiano, renderGuitar } from './synth.js';

// Opens the sound system. Call it from a tap (browsers require that). Add the microphone with enableMic().
export async function openAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  await ctx.resume();
  const a = { ctx, stream: null, analyser: null, buf: null, sound: makeSound(ctx) };
  // Pause and play the sound (the clock of everything that waits for a sound is the audio clock, so it stops too).
  // Some phones leave the audio switched off after the microphone permission appears; make sure it is running before any sound.
  a.ensure = async () => { if (ctx.state !== 'running') { try { await ctx.resume(); } catch { /* try again on the next tap */ } } };
  a.pause = () => ctx.suspend().catch(() => {});
  a.resume = () => ctx.resume().catch(() => {});
  a.stop = () => a.sound.stop();
  a.after = (ms, cb) => { // like setTimeout, but it waits on the audio clock, so Pause really pauses it
    const due = ctx.currentTime + ms / 1000;
    const id = setInterval(() => { if (ctx.currentTime >= due) { clearInterval(id); cb(); } }, 40);
    return () => clearInterval(id);
  };
  a.enableMic = async () => {
    if (a.stream) return;
    a.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
    a.analyser = ctx.createAnalyser(); a.analyser.fftSize = 4096;
    ctx.createMediaStreamSource(a.stream).connect(a.analyser);
    a.buf = new Float32Array(a.analyser.fftSize);
  };
  a.stopMic = () => { a.stream?.getTracks().forEach((t) => t.stop()); a.stream = a.analyser = a.buf = null; }; // the mic light goes off
  a.close = () => { a.stopMic(); ctx.close().catch(() => {}); };
  return a;
}

export function micMessage(e) {
  return e?.name === 'NotAllowedError'
    ? 'The microphone is blocked. Allow it in the browser (tap the lock icon by the address) and try again.'
    : `Could not start the microphone: ${e?.message || e}`;
}

// The sound the phone plays for the child to sing along with. Chosen by the player and kept on this phone.
//  piano:   one mellow piano KEY (a chord is played as just its first note)
//  guitar:  an acoustic guitar; a chord is strummed and left to ring
// Scales and tunes (warm-ups, "echo" levels) are always played on the piano.
export const INSTRUMENTS = [
  { id: 'piano', label: 'Piano', how: 'One clear key to sing from.' },
  { id: 'guitar', label: 'Acoustic guitar', how: 'A strummed chord, left to ring.' },
];
export function getInstrument() {
  try { const v = localStorage.getItem('choir-instrument'); if (INSTRUMENTS.some((i) => i.id === v)) return v; } /* an older saved choice (tanpura, harmonium…) becomes the piano */ catch { /* private mode */ }
  return 'piano';
}
// "My voice": younger children and changing or deeper voices are comfortable in different places. The sounds played for
// singing along move up or down by an octave to suit (written notes in the reading game never move).
export const RANGES = [{ id: 'low', label: 'Lower', shift: -12 }, { id: 'mid', label: 'Middle', shift: 0 }, { id: 'high', label: 'Higher', shift: 12 }];
export function getRange() {
  try { const v = localStorage.getItem('choir-range'); if (RANGES.some((r) => r.id === v)) return v; } catch { /* private mode */ }
  return 'mid';
}
export function setRange(id) { try { localStorage.setItem('choir-range', id); } catch { /* private mode */ } }
const rangeShift = () => RANGES.find((r) => r.id === getRange()).shift;

export function setInstrument(id) { try { localStorage.setItem('choir-instrument', id); } catch { /* private mode */ } }

function makeSound(ctx) {
  const sr = ctx.sampleRate;
  const state = { shift: rangeShift() }; // octaves moved for 'My voice'; the staff warm-up sets it to 0
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  // a gentle hall, made from decaying noise, so the instruments sound like they are in a room
  const ir = ctx.createBuffer(2, Math.floor(sr * 1.8), sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let seed = 777 + c * 91;
    for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = ((seed / 4294967296) * 2 - 1) * (1 - i / d.length) ** 2.6; }
  }
  const reverb = ctx.createConvolver();
  reverb.buffer = ir;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.22;
  reverb.connect(wetGain).connect(master);

  const cache = new Map();
  const live = new Set();
  const bufferFor = (key, make) => {
    if (!cache.has(key)) {
      const data = make();
      const b = ctx.createBuffer(1, data.length, sr);
      b.copyToChannel(data, 0);
      cache.set(key, b);
    }
    return cache.get(key);
  };
  // Play a rendered note at a time (seconds from now). Returns nothing; sources are tracked so Stop can end them.
  const sound = (buffer, at, gain = 1, wet = 1) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(master);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(reverb); }
    src.start(ctx.currentTime + at);
    live.add(src);
    src.onended = () => live.delete(src);
  };
  const round = (m) => Math.round(m);
  const pianoBuf = (midi, secs) => bufferFor(`p${round(midi)}:${secs}`, () => renderPiano(freqOfMidi(midi), secs, sr));
  const guitarBuf = (midi, secs = 3.6) => bufferFor(`g${round(midi)}:${secs}`, () => renderGuitar(freqOfMidi(midi), secs, sr));

  // One grand-piano key, held for `secs`.
  const pianoNote = (midi, secs = 2.4, at = 0.05, gain = 1) => { sound(pianoBuf(midi, secs), at, gain, 1); return secs * 1000; };

  // The reference to sing from, in the chosen instrument.
  const note = (midi0, secs) => {
    const midi = midi0 + state.shift;
    const inst = getInstrument();
    if (inst === 'guitar') { sound(guitarBuf(midi, secs ?? 3.6), 0.05, 1, 0.8); return (secs ?? 3.6) * 1000; }
    return pianoNote(midi, secs ?? 2.4);
  };
  // A whole chord (with its real major or minor third). Guitar strums; everything else is the grand piano.
  const chord = (root0, quality, secs = 2.4) => {
    const inst = getInstrument();
    const root = root0 + state.shift;
    const notes = [root - 12, ...CHORDS[quality].map((s) => root + s)];
    if (inst === 'guitar') {
      notes.forEach((m, i) => sound(guitarBuf(m + (i === 0 ? 0 : 0), Math.max(secs, 3)), 0.05 + i * 0.045, i === 0 ? 0.8 : 0.7, 0.8));
      return Math.max(secs, 3) * 1000;
    }
    notes.forEach((m, i) => sound(pianoBuf(m, secs), 0.05 + i * 0.012, i === 0 ? 0.7 : 0.6, 1));
    return secs * 1000;
  };
  // Tunes and scales are always grand piano. `each` is the time between keys, `hold` how long each key is held.
  const melody = (midis, each = 0.8, hold = each) => {
    midis.forEach((m, i) => pianoNote(m + state.shift, Math.max(hold, 0.3), 0.05 + i * each, 0.9));
    return (midis.length - 1) * each * 1000 + Math.max(hold, 0.3) * 1000;
  };
  // Many keys together (an arpeggio held, or a chord of any shape), all grand piano.
  const keys = (midis, secs = 2.4) => { midis.forEach((m, i) => pianoNote(m, secs, 0.05 + i * 0.012, 0.65)); return secs * 1000; };
  const stop = () => { for (const s of [...live]) { try { s.stop(); } catch { /* already ended */ } } live.clear(); };
  // What the phone plays for a game challenge. Returns how many milliseconds it lasts.
  const play = (ch) => (ch.play.type === 'piano' ? pianoNote(ch.play.midi, 2.4) : ch.play.type === 'chord' ? note(ch.play.root) : ch.play.type === 'note' ? note(ch.play.midi) : melody(ch.play.notes, 0.85, 0.85));
  // For chord challenges: the full chord, so a minor chord is heard as minor.
  const hearChord = (ch) => (ch.play.type === 'chord' ? chord(ch.play.root, ch.play.quality) : play(ch));
  // The hint: a synthetic "ah" singer shows the notes to sing (about 3 seconds in total).
  const singer = (ch) => {
    const notes = ch.targets.map((pc) => 60 + pc);
    const each = 3 / notes.length;
    const t0 = ctx.currentTime + 0.05;
    notes.forEach((m, i) => {
      const s = t0 + i * each;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freqOfMidi(m);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = 4; lfo.connect(lg).connect(o.frequency);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, s); out.gain.linearRampToValueAtTime(0.32, s + 0.15); out.gain.setValueAtTime(0.32, s + each - 0.25); out.gain.linearRampToValueAtTime(0, s + each - 0.02);
      [[800, 6, 1], [1150, 8, 0.6], [2900, 10, 0.25]].forEach(([f, q, amp]) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
        const bg = ctx.createGain(); bg.gain.value = amp; o.connect(bp).connect(bg).connect(out);
      });
      out.connect(ctx.destination); o.start(s); lfo.start(s); o.stop(s + each + 0.05); lfo.stop(s + each + 0.05);
    });
    return 3000;
  };
  const chime = (ok) => {
    const t0 = ctx.currentTime + 0.02;
    (ok ? [72, 76, 79, 84] : [60, 57]).forEach((m, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freqOfMidi(m);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.09); g.gain.exponentialRampToValueAtTime(0.16, t0 + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.35);
      o.connect(g).connect(ctx.destination); o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.4);
    });
    if (ok) navigator.vibrate?.(60);
  };
  return { chord, note, melody, keys, pianoNote, play, hearChord, singer, chime, stop, state };
}
