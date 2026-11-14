// Pitch detection and note maths for the singing game. Everything runs on the phone: sound is
// analysed live and thrown away. Nothing is recorded, stored or sent anywhere.

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

// YIN pitch detection. `buf` is a Float32Array of samples. Returns { freq, clarity } or null.
export function detectPitch(buf, sampleRate, { minHz = 80, maxHz = 1200, threshold = 0.15 } = {}) {
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.floor(sampleRate / minHz);
  const W = Math.floor(buf.length / 2);
  if (W + tauMax > buf.length) return null;
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) { const x = buf[j] - buf[j + tau]; sum += x * x; }
    d[tau] = sum;
  }
  // cumulative mean normalised difference
  const cm = new Float32Array(tauMax + 1);
  cm[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; cm[tau] = run ? (d[tau] * tau) / run : 1; }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cm[t] < threshold) { while (t + 1 <= tauMax && cm[t + 1] < cm[t]) t++; tau = t; break; }
  }
  if (tau < 0) return null;
  const a = cm[tau - 1] ?? cm[tau], c = cm[tau + 1] ?? cm[tau];
  const denom = a + c - 2 * cm[tau];
  const shift = denom ? (a - c) / (2 * denom) : 0; // parabolic interpolation
  return { freq: sampleRate / (tau + shift), clarity: 1 - cm[tau] };
}

export const rms = (buf) => { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); };

// Frequency -> nearest note: { midi, pc (0=C..11=B), octave, name, cents (-50..50 from that note) }
export function noteFromFreq(freq, a4 = 440) {
  const exact = 69 + 12 * Math.log2(freq / a4);
  const midi = Math.round(exact);
  const pc = ((midi % 12) + 12) % 12;
  return { midi, pc, octave: Math.floor(midi / 12) - 1, name: NOTE_NAMES[pc], cents: Math.round((exact - midi) * 100) };
}

// A sung note matches a target when it is the same note name, in ANY octave (children sing higher
// than a piano) and within `tolerance` cents of in tune.
export const matches = (note, targetPc, tolerance = 40) => note.pc === targetPc && Math.abs(note.cents) <= tolerance;

export const freqOfMidi = (m, a4 = 440) => a4 * 2 ** ((m - 69) / 12);

// Chord shapes in semitones above the root (the child sings the ROOT).
export const CHORDS = { major: [0, 4, 7], minor: [0, 3, 7] };

// ---- Background noise ----
// Fans, traffic and air conditioners make a low rumble that the pitch finder mistakes for a very low note, and chatter and hiss
// make a real voice look "unclear". So the microphone is filtered before it is listened to: low rumble and high hiss are cut,
// more strongly for higher voices (chosen in "My voice"). A voice has to be clearly louder than the room to count.
export const MIC_FILTERS = { low: { hp: 100, stages: 2 }, mid: { hp: 130, stages: 3 }, high: { hp: 150, stages: 4 } };
export const MIC_LOWPASS = 2500;
export const micFilterFor = (range) => MIC_FILTERS[range] ?? MIC_FILTERS.mid;

export const GATE_MIN = 0.01, GATE_MAX = 0.05;
// The quietest the room has been, learned from the moments with no clear note (never from the child's own voice).
export const nextFloor = (floor, vol, hadPitch) => (hadPitch ? floor : floor + (vol - floor) * 0.05);
export const gateFor = (floor) => Math.min(GATE_MAX, Math.max(GATE_MIN, floor * 2.5));
// Is this reading the child's voice? Clear and loud enough; a strong, near voice may be a little less "clean" when the room is noisy.
export function acceptPitch(p, vol, floor = 0) {
  const gate = gateFor(floor);
  if (!p || vol <= gate) return false;
  return p.clarity > (vol > gate * 3 ? 0.72 : 0.85);
}
