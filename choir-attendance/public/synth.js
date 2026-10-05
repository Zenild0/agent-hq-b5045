// The instruments of the singing game, made from maths (no sound files, works offline, costs nothing).
// Every function returns a Float32Array of samples for ONE note, so the notes can be tested for being in tune.
//   piano   : a grand piano key held for a while (several strings, slightly stretched overtones, hammer thud)
//   guitar  : a plucked steel-string guitar (Karplus-Strong string model, tuned exactly)
//   tanpura : the drone of one tanpura string with its buzzing "jivari" shimmer
// All rings fade out smoothly at the end, so nothing clicks.

const TWO_PI = 2 * Math.PI;
const fade = (out, sr, secs = 0.25) => { // smooth release at the end
  const n = Math.min(out.length, Math.floor(sr * secs));
  for (let i = 0; i < n; i++) { const g = i / n; out[out.length - 1 - i] *= g * g * (3 - 2 * g); }
  return out;
};
const peakNormalise = (out, peak = 0.7) => {
  let m = 0;
  for (let i = 0; i < out.length; i++) { const a = Math.abs(out[i]); if (a > m) m = a; }
  if (m > 0) { const k = peak / m; for (let i = 0; i < out.length; i++) out[i] *= k; }
  return out;
};
// A cheap, steady sine oscillator (a recurrence), so a note with many overtones renders quickly on a phone.
function addPartial(out, freq, amp, sr, decay, startAt = 0, bloom = null) {
  const w = (TWO_PI * freq) / sr;
  const c = 2 * Math.cos(w);
  const from = Math.max(0, Math.floor(startAt * sr));
  // run the recurrence from the note start so the phase is right
  let y0, y1 = 0, y2 = Math.sin(-w);
  const r = Math.exp(-1 / (decay * sr));
  let g = 1;
  for (let i = from; i < out.length; i++) {
    y0 = c * y1 - y2; y2 = y1; y1 = y0;
    g *= r;
    if (bloom) { const t = (i - from) / sr; out[i] += amp * g * (1 + bloom.gain * Math.exp(-(((t - bloom.at) / bloom.width) ** 2))) * y0; }
    else out[i] += amp * g * y0;
  }
}

export function renderPiano(freq, secs = 3, sr = 44100) {
  const out = new Float32Array(Math.floor(sr * (secs + 0.5)));
  const low = Math.min(1, Math.max(0, Math.log2(freq / 65) / 6)); // 0 for the bass, 1 for the top
  const B = 0.00001 + 0.00012 * low * low;                       // stiff strings: overtones are a touch sharp
  const strings = low < 0.25 ? 1 : low < 0.5 ? 2 : 3;            // bass notes have one string, treble three
  const nPart = Math.max(3, Math.min(18, Math.floor((sr / 2 - 200) / freq / 1.05)));
  const base = 5.2 - 2.4 * low;                                   // lower notes ring longer
  for (let s = 0; s < strings; s++) {
    const detune = strings === 1 ? 0 : (s - (strings - 1) / 2) * 0.35; // cents: the chorus of a grand's strings
    const f0 = freq * 2 ** (detune / 1200);
    for (let k = 1; k <= nPart; k++) {
      const fk = f0 * k * Math.sqrt(1 + B * k * k);
      if (fk > sr / 2 - 100) break;
      const hammer = Math.abs(Math.sin((k * Math.PI) / 8)) + 0.15; // the hammer strikes about an eighth along the string
      const amp = (hammer / k ** 0.85) / strings;
      addPartial(out, fk, amp, sr, base / k ** 0.55);
    }
  }
  // the thud of the hammer
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5;
  let lp = 0;
  const thud = Math.floor(sr * 0.018);
  for (let i = 0; i < thud; i++) { lp += 0.35 * (rnd() - lp); out[i] += lp * 0.5 * (1 - i / thud) * (0.4 + 0.6 * (1 - low)); }
  // a key held for `secs` then released: a quick damper fall
  const rel = Math.floor(sr * secs);
  for (let i = rel; i < out.length; i++) out[i] *= Math.exp(-(i - rel) / (sr * 0.12));
  return peakNormalise(fade(out, sr, 0.1), 0.62);
}

// Karplus-Strong: a burst of noise circulating in a tuned loop, a little duller each time round.
// The loop's averaging adds half a sample of delay, and an all-pass filter adds the fraction needed, so the pitch is exact.
export function renderGuitar(freq, secs = 3.5, sr = 44100) {
  const out = new Float32Array(Math.floor(sr * secs));
  const total = sr / freq;
  const N = Math.max(2, Math.floor(total - 1));
  const d = total - 0.5 - N;                           // 0.5 .. 1.5 samples still to add
  const ap = (1 - d) / (1 + d);
  const buf = new Float32Array(N);
  let seed = 98765 + Math.floor(freq * 7);
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 * 2 - 1;
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += 0.55 * (rnd() - lp); buf[i] = lp; }  // a soft pick, not harsh noise
  const p = Math.max(1, Math.floor(N * 0.14));                              // picking position: some overtones cancel
  for (let i = N - 1; i >= p; i--) buf[i] -= buf[i - p] * 0.6;
  const rho = 10 ** (-30 / 20 / (freq * secs));                             // about 30 dB quieter by the end
  let prevX = 0, inPrev = 0, outPrev = 0, idx = 0;
  for (let i = 0; i < out.length; i++) {
    const x = buf[idx];
    const avg = 0.5 * (x + prevX); prevX = x;
    let y = ap * (avg - outPrev) + inPrev; inPrev = avg; outPrev = y;
    y *= rho;
    buf[idx] = y; out[i] = y;
    idx = (idx + 1) % N;
  }
  return peakNormalise(fade(out, sr, 0.3), 0.6);
}

// One tanpura string: a plucked string whose upper overtones bloom a moment after the pluck (the jivari buzz).
export function renderTanpura(freq, secs = 5, sr = 44100) {
  const out = new Float32Array(Math.floor(sr * secs));
  const nPart = Math.max(4, Math.min(26, Math.floor((sr / 2 - 200) / freq)));
  for (let k = 1; k <= nPart; k++) {
    const amp = 1 / k ** 0.62;
    const bloomy = k >= 3 && k <= 16;
    addPartial(out, freq * k, amp, sr, 6.5 / k ** 0.3, 0, bloomy ? { gain: 1.6 * Math.min(1, (k - 2) / 4), at: 0.45 + 0.03 * k, width: 0.35 } : null);
  }
  // a short soft pluck at the start
  for (let i = 0; i < Math.floor(sr * 0.004); i++) out[i] *= i / (sr * 0.004);
  return peakNormalise(fade(out, sr, 0.4), 0.6);
}

// Mix a note into a longer track at a time (seconds), with a gain.
export function mixInto(track, note, at, sr, gain = 1) {
  const from = Math.floor(at * sr);
  for (let i = 0; i < note.length && from + i < track.length; i++) track[from + i] += note[i] * gain;
}

// The tanpura drone for a given root frequency: Pa (the fifth below), Sa, Sa, then the low Sa, over and over.
export function renderTanpuraDrone(rootHz, secs = 4.5, sr = 44100) {
  const track = new Float32Array(Math.floor(sr * secs));
  const strings = [rootHz * 0.75, rootHz, rootHz, rootHz / 2];
  const gap = 0.78;
  const cache = new Map();
  const get = (f) => cache.get(f) ?? (cache.set(f, renderTanpura(f, 3.6, sr)), cache.get(f));
  for (let t = 0, i = 0; t < secs - 1; t += gap, i++) mixInto(track, get(strings[i % 4]), t, sr, i % 4 === 1 || i % 4 === 2 ? 0.75 : 0.55);
  return peakNormalise(fade(track, sr, 0.5), 0.6);
}

export const RENDERERS = { piano: renderPiano, guitar: renderGuitar, tanpura: renderTanpura };
