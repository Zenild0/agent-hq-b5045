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

function makeSound(ctx) {
  function tone(freq, t0, dur, gain) {
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
  const chord = (root, quality, secs = 3) => {
    const t0 = ctx.currentTime + 0.05;
    CHORDS[quality].forEach((s) => tone(freqOfMidi(root + s), t0, secs, 0.17));
    tone(freqOfMidi(root - 12), t0, secs, 0.12); // the root an octave lower, to anchor it
    return secs * 1000;
  };
  const note = (midi, secs = 2) => { tone(freqOfMidi(midi), ctx.currentTime + 0.05, secs, 0.22); return secs * 1000; };
  const melody = (midis, each = 0.8) => {
    const t0 = ctx.currentTime + 0.05;
    midis.forEach((m, i) => tone(freqOfMidi(m), t0 + i * each, each - 0.02, 0.22));
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
