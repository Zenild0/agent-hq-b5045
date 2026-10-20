// The instruments of the singing game, made from maths (no sound files, works offline, costs nothing).
// Every function returns a Float32Array of samples for ONE note, so the notes can be tested for being in tune.
//   piano   : a mellow digital-piano key that rings and fades
//   guitar  : a plucked steel-string guitar (Karplus-Strong string model, tuned exactly)
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

// A mellow digital piano, in the spirit of a Yamaha or Roland stage piano: round and warm, a soft attack, a few
// gentle overtones that fade faster than the main note, and no hard hammer thud. The key rings and fades by itself
// (no extra sustain pedal), which is easy on the ears for singing along.
export function renderPiano(freq, secs = 2.4, sr = 44100) {
  const out = new Float32Array(Math.floor(sr * (secs + 0.35)));
  const low = Math.min(1, Math.max(0, Math.log2(freq / 65) / 6));  // 0 bass .. 1 treble
  const base = 2.6 - 0.9 * low;                                     // seconds for the main tone to fall by a factor e
  const amps = [1, 0.42, 0.2, 0.09, 0.05, 0.025];                   // gentle overtones, rolling off quickly
  for (let s = 0; s < 2; s++) {                                     // two very slightly detuned strings: warmth, not wobble
    const f0 = freq * 2 ** ((s === 0 ? -0.25 : 0.25) / 1200);
    for (let k = 1; k <= amps.length; k++) {
      const fk = f0 * k;
      if (fk > Math.min(7000, sr / 2 - 200)) break;
      addPartial(out, fk, amps[k - 1] * 0.5, sr, base / (1 + 0.9 * (k - 1)));
    }
  }
  // a very soft touch of the key (barely there)
  let seed = 4242, lp = 0;
  const thud = Math.floor(sr * 0.012);
  for (let i = 0; i < thud; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; lp += 0.12 * ((seed / 4294967296 - 0.5) - lp); out[i] += lp * 0.25 * (1 - i / thud); }
  // soften the top: a gentle low-pass, so nothing is sharp or tiring
  const fc = Math.min(3200, Math.max(900, freq * 6));
  const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
  let y = 0;
  for (let i = 0; i < out.length; i++) { y += a * (out[i] - y); out[i] = y; }
  // a soft attack, and the key is let go at `secs`
  const atk = Math.floor(sr * 0.006);
  for (let i = 0; i < atk; i++) out[i] *= i / atk;
  const rel = Math.floor(sr * secs);
  for (let i = rel; i < out.length; i++) out[i] *= Math.exp(-(i - rel) / (sr * 0.1));
  return peakNormalise(fade(out, sr, 0.15), 0.5);
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

// Mix a note into a longer track at a time (seconds), with a gain.
export function mixInto(track, note, at, sr, gain = 1) {
  const from = Math.floor(at * sr);
  for (let i = 0; i < note.length && from + i < track.length; i++) track[from + i] += note[i] * gain;
}

export const RENDERERS = { piano: renderPiano, guitar: renderGuitar };
