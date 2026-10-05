// Music notation for learners: draws notes on a treble-clef staff (as SVG), so children can learn to read music.
// Pure drawing code: no sound here. Letters are spelled with sharps or flats to suit the key.

const LETTERS = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const SHARPS = [['C', ''], ['C', '♯'], ['D', ''], ['D', '♯'], ['E', ''], ['F', ''], ['F', '♯'], ['G', ''], ['G', '♯'], ['A', ''], ['A', '♯'], ['B', '']];
const FLATS = [['C', ''], ['D', '♭'], ['D', ''], ['E', '♭'], ['E', ''], ['F', ''], ['G', '♭'], ['G', ''], ['A', '♭'], ['A', ''], ['B', '♭'], ['B', '']];

// Keys that are written with flats (major, or minor).
export const prefersFlats = (pc, minor = false) => (minor ? [0, 2, 3, 5, 7, 10] : [1, 3, 5, 6, 8, 10]).includes(((pc % 12) + 12) % 12);

// A MIDI note as a written note: { letter, acc, octave, name, pos } where pos counts steps above the bottom line
// of the staff (E4 in the treble clef, G2 in the bass clef).
export function spell(midi, flats = false, clef = 'treble') {
  const pc = ((midi % 12) + 12) % 12;
  const [letter, acc] = (flats ? FLATS : SHARPS)[pc];
  let octave = Math.floor(midi / 12) - 1;
  const pos = octave * 7 + LETTERS[letter] - (clef === 'bass' ? 2 * 7 + LETTERS.G : 4 * 7 + LETTERS.E);
  return { letter, acc, octave, name: `${letter}${acc}`, full: `${letter}${acc}${octave}`, pos };
}

let clefFont = false; // true once the music font has really loaded
if (typeof document !== 'undefined' && document.fonts?.load) {
  document.fonts.load('40px "Noto Music"', '\u{1D11E}\u{1D122}').then((f) => { clefFont = f.length > 0; }).catch(() => {});
}

const GAP = 5;            // half a staff space, in pixels: one step up or down
const BOTTOM = 92;        // y of the bottom line (E4)
const yOf = (pos) => BOTTOM - pos * GAP;

// notes: [{ midi }] ; options: { mode: 'chord' | 'seq', flats, current (index to highlight), labels (show letter names) }
export function staffSvg(notes, { mode = 'seq', flats = false, current = -1, labels = true, clef: clefName = 'treble' } = {}) {
  const bass = clefName === 'bass';
  const sp = notes.map((n) => spell(n.midi, flats, clefName));
  const clefW = 46, step = mode === 'chord' ? 0 : Math.max(20, Math.min(34, Math.floor((330 - clefW) / Math.max(1, notes.length))));
  const width = clefW + (mode === 'chord' ? 70 : notes.length * step + 14);
  const lo = Math.min(...sp.map((s) => s.pos)), hi = Math.max(...sp.map((s) => s.pos));
  const yTop = Math.min(yOf(8) - 26, yOf(Math.max(hi, 8)) - 14);
  const yBot = Math.max(yOf(0) + 22, yOf(Math.min(lo, 0)) + 14) + (labels ? 22 : 0);
  const lines = [0, 2, 4, 6, 8].map((p) => `<line x1="6" x2="${width - 4}" y1="${yOf(p)}" y2="${yOf(p)}" class="sl"/>`).join('');
  const clef = bass
    ? (clefFont
      ? `<text x="8" y="${yOf(6) + 1}" class="clef" font-size="60">\u{1D122}</text>`
      : `<g class="clef-path" transform="translate(14 ${yOf(6)})" fill="none" stroke-width="2.6" stroke-linecap="round"><path d="M0 -2 C10 -6 20 0 18 10 C16 22 8 30 -4 38"/><circle cx="26" cy="-4" r="2" fill="currentColor"/><circle cx="26" cy="8" r="2" fill="currentColor"/></g>`)
    : (clefFont
      ? `<text x="8" y="${yOf(2) + 1}" class="clef" font-size="66">\u{1D11E}</text>`
      : `<g class="clef-path" transform="translate(24 ${yOf(2)})" fill="none" stroke-width="2.6" stroke-linecap="round"><path d="M2 -48 C14 -40 12 -24 4 -14 C-6 -2 -2 10 8 8 C16 6 16 -6 6 -8 C-6 -10 -12 4 -6 18 C-2 26 2 34 0 40 C-2 46 -9 45 -9 40"/></g>`);
  const body = sp.map((s, i) => {
    const x = clefW + (mode === 'chord' ? 22 : i * step + step / 2 + 4);
    const y = yOf(s.pos);
    const ledgers = [];
    for (let p = -2; p >= Math.min(s.pos, -2) && s.pos <= -2; p -= 2) ledgers.push(p);
    for (let p = 10; p <= Math.max(s.pos, 10) && s.pos >= 10; p += 2) ledgers.push(p);
    const led = ledgers.map((p) => `<line x1="${x - 11}" x2="${x + 11}" y1="${yOf(p)}" y2="${yOf(p)}" class="sl"/>`).join('');
    const acc = s.acc ? `<text x="${x - 20}" y="${y + 6}" class="acc" font-size="19">${s.acc}</text>` : '';
    const lab = labels ? `<text x="${x}" y="${yBot - 4}" class="sn-label" text-anchor="middle" font-size="12">${s.name}</text>` : '';
    const on = i === current ? ' on' : '';
    return `<g class="sn${on}" data-i="${i}">${led}${acc}<ellipse cx="${x}" cy="${y}" rx="7.2" ry="5.2" transform="rotate(-18 ${x} ${y})" class="head"/>${lab}</g>`;
  }).join('');
  return `<svg class="staff" viewBox="0 ${yTop} ${width} ${yBot - yTop + 4}" width="${width}" role="img" aria-label="Notes on the staff: ${sp.map((s) => s.full).join(', ')}">${lines}${clef}${body}</svg>`;
}

// For a chord: letter names stacked on one line of text under the staff.
export const chordLetters = (midis, flats) => midis.map((m) => spell(m, flats).name).join(' · ');
