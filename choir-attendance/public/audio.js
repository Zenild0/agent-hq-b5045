// Sound and microphone for the singing game. Everything is made in the browser (no sound files).
// The microphone is listened to live and thrown away: nothing is recorded, stored or sent.
import { freqOfMidi, CHORDS } from './pitch.js';

// Opens the sound system. Call it from a tap (browsers require that). Add the microphone with enableMic().
export async function openAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  await ctx.resume();
  const a = { ctx, stream: null, analyser: null, buf: null, sound: makeSound(ctx) };
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
//  harmonium and sitar: one SUSTAINED key (a chord is played as just its first note, held)
//  keyboard: one struck KEY that rings and fades
//  guitar: a STRUM (a chord is strummed, a single note is plucked)
export const INSTRUMENTS = [
  { id: 'harmonium', label: 'Harmonium', how: 'sustained' },
  { id: 'sitar', label: 'Sitar', how: 'sustained' },
  { id: 'keyboard', label: 'Keyboard', how: 'key' },
  { id: 'guitar', label: 'Guitar', how: 'strum' },
];
export function getInstrument() {
  try { const v = localStorage.getItem('choir-instrument'); if (INSTRUMENTS.some((i) => i.id === v)) return v; } catch { /* private mode */ }
  return 'harmonium';
}
export function setInstrument(id) { try { localStorage.setItem('choir-instrument', id); } catch { /* private mode */ } }

function makeSound(ctx) {
  const env = (g, t0, peak, attack, hold, dur, release = 0.25) => {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak * hold, Math.max(t0 + attack + 0.01, t0 + dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  };
  // The old gentle bell-like key: used for the keyboard.
  function key(freq, t0, dur, gain) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(gain * 0.55, t0 + Math.min(0.5, dur / 2));
    g.gain.setValueAtTime(gain * 0.5, Math.max(t0 + 0.05, t0 + dur - 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(ctx.destination);
    [[1, 'triangle', 1], [2, 'sine', 0.3], [3, 'sine', 0.1]].forEach(([m, w, amp]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = w; o.frequency.value = freq * m; og.gain.value = amp;
      o.connect(og).connect(g); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }
  // Harmonium: two slightly detuned reeds, held perfectly steady (no fade, no wobble).
  function harmonium(freq, t0, dur, gain) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(3200, freq * 7); lp.Q.value = 0.7;
    env(g, t0, gain * 0.7, 0.12, 1, dur, 0.3);
    lp.connect(g).connect(ctx.destination);
    [[1, 'sawtooth', 0.55], [1.003, 'sawtooth', 0.45], [2, 'square', 0.12]].forEach(([m, w, amp]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = w; o.frequency.value = freq * m; og.gain.value = amp;
      o.connect(og).connect(lp); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }
  // Sitar: a bright pluck that keeps ringing (slow fade), with the buzzing upper partials of the bridge.
  function sitar(freq, t0, dur, gain) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain * 0.8, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(gain * 0.45, t0 + 0.5);
    g.gain.exponentialRampToValueAtTime(gain * 0.3, Math.max(t0 + 0.6, t0 + dur - 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(ctx.destination);
    [1, 2, 3, 4, 5, 6, 7].forEach((k, i) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq * k * (1 + 0.0007 * k * k); // slightly stretched, like a real string
      og.gain.setValueAtTime([1, 0.75, 0.6, 0.5, 0.4, 0.3, 0.25][i], t0);
      og.gain.exponentialRampToValueAtTime([1, 0.75, 0.6, 0.5, 0.4, 0.3, 0.25][i] * (i > 2 ? 0.25 : 0.7), t0 + 0.8); // the buzz dies away first
      o.connect(og).connect(g); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }
  // Guitar: a plucked string, bright at first, then mellow.
  function guitar(freq, t0, dur, gain) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1;
    lp.frequency.setValueAtTime(Math.min(5000, freq * 12), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(500, freq * 2), t0 + 0.7);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    lp.connect(g).connect(ctx.destination);
    [[1, 'sawtooth', 0.6], [1.002, 'triangle', 0.4]].forEach(([m, w, amp]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = w; o.frequency.value = freq * m; og.gain.value = amp;
      o.connect(og).connect(lp); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }
  const voices = { harmonium, sitar, keyboard: key, guitar };
  const SUSTAIN_S = 3.4;

  // A single note in the chosen instrument. Sustained instruments hold it; the others ring and fade.
  const note = (midi, secs) => {
    const inst = getInstrument();
    const dur = secs ?? (inst === 'harmonium' || inst === 'sitar' ? SUSTAIN_S : inst === 'guitar' ? 2.6 : 2.2);
    voices[inst](freqOfMidi(midi), ctx.currentTime + 0.05, dur, inst === 'keyboard' ? 0.22 : 0.24);
    return dur * 1000;
  };
  // A chord. Guitar strums all its notes; the others play the first note only, as one clear key to sing from.
  const chord = (root, quality, secs = 3) => {
    const inst = getInstrument();
    if (inst !== 'guitar') return note(root, inst === 'keyboard' ? Math.min(secs, 2.6) : secs ?? SUSTAIN_S);
    const t0 = ctx.currentTime + 0.05;
    [root - 12, ...CHORDS[quality].map((s) => root + s)].forEach((m, i) => guitar(freqOfMidi(m), t0 + i * 0.05, secs, i === 0 ? 0.16 : 0.15));
    return secs * 1000;
  };
  const melody = (midis, each = 0.8) => {
    const inst = getInstrument();
    const t0 = ctx.currentTime + 0.05;
    midis.forEach((m, i) => voices[inst](freqOfMidi(m), t0 + i * each, Math.max(each - 0.02, 0.2), 0.22));
    return midis.length * each * 1000 + 200;
  };
  // What the phone plays for a game challenge. Returns how many milliseconds it lasts.
  const play = (ch) => (ch.play.type === 'chord' ? chord(ch.play.root, ch.play.quality) : ch.play.type === 'note' ? note(ch.play.midi) : melody(ch.play.notes));
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
  return { chord, note, melody, play, singer, chime };
}
