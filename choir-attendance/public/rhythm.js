// Rhythm trainer: the music and the marking (no sound or screen here, so it can be tested).
// A pattern is a list of lengths in beats: 1 = quarter note, 2 = half note, 0.5 = eighth note; a minus sign is a rest.
// The child hears it, then taps it back. Every tap is compared with when the note should have come.

export const BEATS_PER_BAR = 4;
export const ROUND_SIZE = 5;
export const FREE_RHYTHM_LEVELS = 2;
export const RLEVELS = [
  { id: 1, emoji: '🥁', name: 'Steady Beat', how: 'Tap on every beat, like a heartbeat.', bpm: 76, bars: 1, cells: [[1]] },
  { id: 2, emoji: '🎵', name: 'Long and Short', how: 'Quarter notes (one beat) and half notes (two beats).', bpm: 80, bars: 1, cells: [[1], [1], [2]] },
  { id: 3, emoji: '🤫', name: 'Rest Stop', how: 'A rest means silence: do not tap!', bpm: 80, bars: 1, cells: [[1], [1], [-1], [2]] },
  { id: 4, emoji: '🏃', name: 'Running Eighths', how: 'Two quick notes in one beat: ti-ti.', bpm: 84, bars: 1, cells: [[1], [0.5, 0.5], [0.5, 0.5], [2]] },
  { id: 5, emoji: '🎶', name: 'Two Bars', how: 'A longer rhythm: eight beats.', bpm: 88, bars: 2, cells: [[1], [0.5, 0.5], [-1], [2]] },
  { id: 6, emoji: '💃', name: 'Off the Beat', how: 'Syncopation: some notes land between the beats.', bpm: 88, bars: 1, cells: [[1], [0.5, 0.5], [0.5, 1, 0.5], [-0.5, 0.5]] },
  { id: 7, emoji: '⚡', name: 'Speed Up', how: 'Everything so far, a little faster.', bpm: 104, bars: 2, cells: [[1], [0.5, 0.5], [-1], [2], [0.5, 1, 0.5]] },
  { id: 8, emoji: '👑', name: 'Rhythm Legend', how: 'Two fast bars with rests and off-beats.', bpm: 116, bars: 2, cells: [[1], [0.5, 0.5], [-1], [0.5, 1, 0.5], [-0.5, 0.5], [2]] },
];
export const levelR = (id) => RLEVELS.find((l) => l.id === id) ?? RLEVELS[0];

const cellLen = (c) => c.reduce((a, d) => a + Math.abs(d), 0);
// One pattern for a level: whole bars, at least two notes, never two rests in a row.
export function makePattern(level, rng = Math.random) {
  for (let tries = 0; tries < 50; tries++) {
    const out = [];
    for (let bar = 0; bar < level.bars; bar++) {
      let left = BEATS_PER_BAR;
      while (left > 0) {
        const fits = level.cells.filter((c) => cellLen(c) <= left && !(c[0] < 0 && out.length && out.at(-1) < 0));
        const c = fits[Math.floor(rng() * fits.length)] ?? [1];
        out.push(...c); left -= cellLen(c);
      }
    }
    const notes = out.filter((d) => d > 0).length;
    if (notes >= 2 && out[0] > 0) return out;
  }
  return Array(BEATS_PER_BAR * level.bars).fill(1);
}
// A round: the first pattern of level 1 is simply four beats; the rest are mixed, with no pattern twice in a row.
export function makeRound(levelId, rng = Math.random) {
  const lv = levelR(levelId), out = [];
  for (let tries = 0; out.length < ROUND_SIZE; tries++) {
    const p = levelId === 1 && !out.length ? [1, 1, 1, 1] : makePattern(lv, rng);
    if (!out.length || out.at(-1).join() !== p.join() || tries > 40) out.push(p); // a level with only one rhythm may repeat it
  }
  return out;
}

// When each note starts, in beats from the start of the pattern.
export function onsets(pattern) {
  const out = []; let t = 0;
  for (const d of pattern) { if (d > 0) out.push(t); t += Math.abs(d); }
  return out;
}
export const patternBeats = (pattern) => pattern.reduce((a, d) => a + Math.abs(d), 0);

export const GRADES = [{ id: 'perfect', ms: 70, score: 1 }, { id: 'good', ms: 140, score: 0.75 }, { id: 'ok', ms: 230, score: 0.45 }];
const WINDOW_MS = 320;
// expected and taps are times in seconds. Each expected note takes the nearest unused tap within the window.
export function scoreTaps(expected, taps) {
  const used = new Set();
  const notes = expected.map((e) => {
    let best = -1, bestD = Infinity;
    taps.forEach((t, i) => { const d = Math.abs(t - e); if (!used.has(i) && d < bestD) { bestD = d; best = i; } });
    if (best < 0 || bestD * 1000 > WINDOW_MS) return { grade: 'miss', score: 0, err: null };
    used.add(best);
    const err = Math.round((taps[best] - e) * 1000), g = GRADES.find((x) => Math.abs(err) <= x.ms);
    return g ? { grade: g.id, score: g.score, err } : { grade: 'miss', score: 0, err };
  });
  const extra = taps.length - used.size;
  const hit = notes.filter((n) => n.err != null);
  const mean = hit.length ? Math.round(hit.reduce((a, n) => a + n.err, 0) / hit.length) : 0;
  const base = notes.length ? notes.reduce((a, n) => a + n.score, 0) / notes.length : 0;
  return { notes, extra, accuracy: Math.max(0, Math.round(100 * base - 8 * extra)), lean: Math.abs(mean) < 50 ? 'on' : mean < 0 ? 'early' : 'late', mean };
}
export const rhythmStars = (acc) => (acc >= 90 ? 3 : acc >= 75 ? 2 : acc >= 55 ? 1 : 0);
export const rhythmFeedback = (r) => (r.accuracy >= 90 ? 'Perfect timing! 🎯' : r.accuracy >= 75 ? 'Great rhythm! 🥁'
  : r.extra > 1 ? 'Careful: tap only for the notes, stay quiet on rests.' : r.lean === 'early' ? 'A little early: wait for the beat.' : r.lean === 'late' ? 'A little late: tap right on the beat.' : 'Good try! Listen once more, then go again.');
