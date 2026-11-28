// Chord sheets: chords written in [brackets] inside the lyrics ("[G]Amazing [C]grace"), the usual way chord sheets are kept.
// Pure functions (no page needed), so the server can check a sheet and the phone can transpose and draw it.
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_AT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

export const CHORD_TOKEN = /^[A-G][#b]?(?:m(?!aj)|maj|min|dim|aug|sus|add|M|\+|°|-)?\d{0,2}(?:(?:sus|add|maj|dim|aug)\d{0,2})?(?:\/[A-G][#b]?)?$/;
export const isChord = (t) => CHORD_TOKEN.test(t);
const rootAt = (n) => NOTE_AT[n[0]] + (n[1] === '#' ? 1 : n[1] === 'b' ? -1 : 0);
export const preferFlats = (key) => FLAT_KEYS.has(key);

// Move one chord up (+) or down (-) by semitones. Slash chords (G/B) move both parts.
export function transposeChord(chord, semi, flats = false) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(chord);
  if (!m || !semi) return chord;
  const names = flats ? FLAT : SHARP;
  const move = (n) => names[(((rootAt(n) + semi) % 12) + 12) % 12];
  return move(m[1]) + m[2] + (m[3] ? `/${move(m[3])}` : '');
}
export const keyAfter = (key, semi) => {
  if (!key || !isChord(key)) return key || '';
  const flat = transposeChord(key, semi, true);
  return preferFlats(flat) ? flat : transposeChord(key, semi, false);
};

// A line is a chord line when every word on it is a chord (bar lines and "x2" are allowed between them).
const FILLER = new Set(['|', '||', '/', '-', 'x2', 'x3', 'x4', '(x2)', '(x3)', 'N.C.', 'NC']);
const chordLine = (l) => { const w = l.trim().split(/\s+/).filter(Boolean); return w.some(isChord) && w.every((t) => isChord(t) || FILLER.has(t)); };
const isLabel = (l) => { const m = /^\[([^\]]+)\]$/.exec(l.trim()); return m && !isChord(m[1].trim()) ? m[1].trim() : ''; }; // "[Verse 1]" on its own line
// A chord typed over the middle of a word is moved to the start of that word when it is only a letter or two in
// (columns drift when a sheet is pasted); further in, it stays where it was, so a split like "A-ma-zing" survives.
function snapColumn(line, col) {
  if (col >= line.length) return col;
  if (line[col] === ' ') { let j = col; while (j < line.length && line[j] === ' ') j++; return j < line.length && j - col <= 3 ? j : col; }
  let k = col; while (k > 0 && line[k - 1] !== ' ') k--;
  return col - k <= 2 ? k : col;
}
// Accepts a sheet written either way, or a mix of both: chords above the words become [chords] before the words,
// and a line such as [Chorus] becomes a {Chorus} heading.
export function fromChordsOverLyrics(text) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const bracketed = (l) => l.trim().split(/\s+/).filter((t) => isChord(t)).map((c) => `[${c}]`).join(' ');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const label = isLabel(l);
    if (label) { out.push(`{${label}}`); continue; }
    if (!l.includes('[') && chordLine(l)) {
      const next = lines[i + 1];
      if (next !== undefined && next.trim() && !chordLine(next) && !isLabel(next) && !/^\{.*\}$/.test(next.trim())) {
        const lyric0 = next.padEnd(l.length + 1);
        const at = new Map(); // column in the words -> the chords that sit there, left to right
        for (const m of l.matchAll(/\S+/g)) {
          if (!isChord(m[0])) continue;
          const col = snapColumn(lyric0, m.index);
          at.set(col, [...(at.get(col) || []), m[0]]);
        }
        let lyric = lyric0;
        for (const col of [...at.keys()].sort((a, b) => b - a)) lyric = `${lyric.slice(0, col)}${at.get(col).map((c) => `[${c}]`).join('')}${lyric.slice(col)}`;
        out.push(lyric.replace(/^\s+(?=\[)/, '').replace(/ {2,}((?:\[[^\]]+\])+)\s*$/, ' $1').trimEnd()); // chords past the last word hang after one space
        i += 1;
      } else out.push(bracketed(l)); // chords with no words under them (an intro or an instrumental line)
    } else out.push(l);
  }
  return out.join('\n');
}
// What the teacher types or pastes becomes the stored sheet.
export const normaliseSheet = (text) => fromChordsOverLyrics(String(text ?? '').replace(/[ \t]+$/gm, '')).replace(/^\s+|\s+$/g, '');

const SECTION = /^(verse|chorus|pre-?chorus|bridge|intro|outro|interlude|tag|refrain|instrumental|coda|ending)\b[^[\]]*:?$/i;
// A sheet becomes lines of pieces: { chord, text }. The chord sits above the words that follow it.
export function parseSheet(body) {
  return String(body ?? '').replace(/\r/g, '').split('\n').map((raw) => {
    const l = raw.trimEnd();
    if (!l.trim()) return { kind: 'blank' };
    const lone = /^\[([^\]]+)\]$/.exec(l.trim());
    if (lone && !isChord(lone[1].trim())) return { kind: 'section', text: lone[1].trim() };
    const braces = /^\{(.+)\}$/.exec(l.trim());
    if (braces) return { kind: 'section', text: braces[1].replace(/^(?:c|comment|soc|start_of_chorus)\s*:\s*/i, '').trim() };
    if (!l.includes('[') && SECTION.test(l.trim())) return { kind: 'section', text: l.trim().replace(/:$/, '') };
    const segs = [];
    let rest = l;
    const first = rest.indexOf('[');
    if (first > 0) { segs.push({ chord: '', text: rest.slice(0, first) }); rest = rest.slice(first); }
    for (const m of rest.matchAll(/\[([^\]]*)\]([^[]*)/g)) segs.push({ chord: m[1].trim(), text: m[2] });
    if (!segs.length) segs.push({ chord: '', text: l });
    return { kind: 'line', segs };
  });
}
export const chordsUsed = (body) => [...new Set([...String(body ?? '').matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim()).filter(isChord))];
export const sheetKey = (body) => chordsUsed(body)[0] || '';

// ---- key detection: which key do the chords of this sheet belong to? ----
const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
function chordKind(c) {
  const m = /^([A-G][#b]?)([^/]*)/.exec(c);
  if (!m) return null;
  const q = m[2];
  const minor = /^(m(?!aj)|min|-)/.test(q);
  const dim = /^(dim|°)/.test(q);
  return { pc: rootAt(m[1]), kind: dim ? 'dim' : minor ? 'min' : 'maj', dom7: /^7/.test(q) || /^9|^11|^13/.test(q) };
}
// Each chord of the song scores for a key when it belongs to that key (I ii iii IV V vi for a major key; i III iv v VI VII
// and the major V for a minor key). The first and last chords and the tonic chord itself count extra.
export function detectKey(body) {
  const seq = [...String(body ?? '').matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim()).filter(isChord).map(chordKind).filter(Boolean);
  if (!seq.length) return '';
  const MAJ = new Map([[0, 'maj'], [2, 'min'], [4, 'min'], [5, 'maj'], [7, 'maj'], [9, 'min'], [11, 'dim']]);
  const MIN = new Map([[0, 'min'], [2, 'dim'], [3, 'maj'], [5, 'min'], [7, 'min'], [8, 'maj'], [10, 'maj']]);
  let best = { score: -1e9, key: '' };
  for (const minor of [false, true]) {
    for (let t = 0; t < 12; t++) {
      const table = minor ? MIN : MAJ;
      let score = 0;
      seq.forEach((c, i) => {
        const deg = (c.pc - t + 12) % 12;
        const want = table.get(deg);
        if (want === c.kind) score += c.dom7 && deg !== 7 ? 0.4 : 1;
        else if (minor && deg === 7 && c.kind === 'maj') score += 0.8; // the major V of a minor key
        else if (want && c.kind === 'maj' && c.dom7) score += 0.3;
        else score -= 0.5;
        if (deg === 0 && c.kind === (minor ? 'min' : 'maj')) score += 0.5;
        if (i === 0 && deg === 0 && c.kind === (minor ? 'min' : 'maj')) score += 2;
        if (i === seq.length - 1 && deg === 0 && c.kind === (minor ? 'min' : 'maj')) score += 1.5;
      });
      if (score > best.score + 1e-9) best = { score, key: minor ? MINOR_NAMES[t] : MAJOR_NAMES[t] };
    }
  }
  return best.key;
}

// ---- guitar fingering: open shapes for the common chords, a moveable barre shape for the rest ----
// Six numbers, low E to high e: fret, or -1 when that string is not played.
const OPEN = {
  C: [-1, 3, 2, 0, 1, 0], D: [-1, -1, 0, 2, 3, 2], E: [0, 2, 2, 1, 0, 0], G: [3, 2, 0, 0, 0, 3], A: [-1, 0, 2, 2, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0], Dm: [-1, -1, 0, 2, 3, 1], Em: [0, 2, 2, 0, 0, 0],
  G7: [3, 2, 0, 0, 0, 1], C7: [-1, 3, 2, 3, 1, 0], D7: [-1, -1, 0, 2, 1, 2], E7: [0, 2, 0, 1, 0, 0], A7: [-1, 0, 2, 0, 2, 0], B7: [-1, 2, 1, 2, 0, 2],
  Am7: [-1, 0, 2, 0, 1, 0], Dm7: [-1, -1, 0, 2, 1, 1], Em7: [0, 2, 0, 0, 0, 0],
  Cmaj7: [-1, 3, 2, 0, 0, 0], Gmaj7: [3, 2, 0, 0, 0, 2], Dmaj7: [-1, -1, 0, 2, 2, 2], Amaj7: [-1, 0, 2, 1, 2, 0], Fmaj7: [-1, -1, 3, 2, 1, 0],
  Asus4: [-1, 0, 2, 2, 3, 0], Dsus4: [-1, -1, 0, 2, 3, 3], Esus4: [0, 2, 2, 2, 0, 0], Asus2: [-1, 0, 2, 2, 0, 0], Dsus2: [-1, -1, 0, 2, 3, 0],
};
const QUALITY = { '': '', m: 'm', min: 'm', '-': 'm', 7: '7', m7: 'm7', min7: 'm7', maj7: 'maj7', M7: 'maj7', sus4: 'sus4', sus2: 'sus2', sus: 'sus4' };
export function chordShape(name) {
  const m = /^([A-G][#b]?)([^/]*)/.exec(name);
  if (!m || !(m[2] in QUALITY)) return null;
  const q = QUALITY[m[2]];
  const root = SHARP[rootAt(m[1])];
  const flat = FLAT[rootAt(m[1])];
  const open = OPEN[root + q] || OPEN[flat + q];
  if (open) return { frets: open, label: name };
  const idx = rootAt(m[1]);
  const eFret = (idx - 4 + 12) % 12, aFret = (idx - 9 + 12) % 12;
  const E = { '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], 7: [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0] };
  const A = { '': [-1, 0, 2, 2, 2, 0], m: [-1, 0, 2, 2, 1, 0], 7: [-1, 0, 2, 0, 2, 0], m7: [-1, 0, 2, 0, 1, 0], maj7: [-1, 0, 2, 1, 2, 0] };
  const useE = q in E && (eFret <= aFret || !(q in A));
  const shape = useE ? E[q] : A[q];
  if (!shape) return null;
  const n = useE ? eFret : aFret;
  if (n === 0 && !OPEN[root + q]) return null;
  return { frets: shape.map((f) => (f < 0 ? -1 : f + n)), label: name };
}
// Which finger plays each fretted string. A barre chord (no open strings) lays finger 1 across the lowest fret;
// otherwise the fingers go 1, 2, 3, 4 from the lowest fret up (and from the low string within one fret).
export function fingersFor(frets) {
  const f = frets.map(() => 0);
  const notes = frets.map((fr, i) => ({ i, fr })).filter((n) => n.fr > 0);
  if (!notes.length) return { fingers: f, barre: null };
  const minF = Math.min(...notes.map((n) => n.fr));
  const low = notes.filter((n) => n.fr === minF);
  const played = frets.filter((x) => x >= 0);
  const barre = low.length >= 2 && !played.includes(0) ? { fret: minF, from: low[0].i, to: low.at(-1).i } : null;
  let next = barre ? 2 : 1;
  if (barre) for (const n of low) f[n.i] = 1;
  for (const n of notes.filter((x) => !barre || x.fr !== minF).sort((a, b) => a.fr - b.fr || a.i - b.i)) f[n.i] = Math.min(4, next++);
  return { fingers: f, barre };
}

// A guitar fingering picture: x = not played, o = open string, numbered dots for the fingers, a bar for a barre.
export function chordSvg(shape) {
  const frets = shape.frets;
  const { fingers, barre } = fingersFor(frets);
  const played = frets.filter((x) => x > 0);
  const base = played.length && Math.max(...played) > 5 ? Math.min(...played) : 1;
  const X = (i) => 12 + i * 13.4, Y = (row) => 28 + row * 17; // row 0 is the nut
  const rowOf = (fr) => fr - base + 1;
  let o = `<svg viewBox="0 0 90 122" width="90" height="122" role="img" aria-label="${shape.label} fingering" class="cb-svg">`;
  frets.forEach((fr, i) => {
    if (fr < 0) o += `<text x="${X(i)}" y="18" font-size="12" font-weight="700" text-anchor="middle" fill="currentColor">×</text>`;
    else if (fr === 0) o += `<circle cx="${X(i)}" cy="14" r="3.8" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
  });
  for (let i = 0; i < 6; i++) o += `<line x1="${X(i)}" y1="${Y(0)}" x2="${X(i)}" y2="${Y(5)}" stroke="currentColor" stroke-width="1.1" opacity=".55"/>`;
  for (let r = 0; r <= 5; r++) o += `<line x1="${X(0)}" y1="${Y(r)}" x2="${X(5)}" y2="${Y(r)}" stroke="currentColor" stroke-width="${r === 0 && base === 1 ? 4 : 1.1}" opacity="${r === 0 && base === 1 ? 1 : 0.55}"/>`;
  if (base > 1) o += `<text x="${X(5) + 4}" y="${Y(1) - 4}" font-size="10" font-weight="700" fill="currentColor">${base}</text>`;
  if (barre) o += `<rect x="${X(barre.from) - 5}" y="${Y(rowOf(barre.fret)) - 12}" width="${X(barre.to) - X(barre.from) + 10}" height="10" rx="5" fill="currentColor"/>`;
  frets.forEach((fr, i) => {
    if (fr <= 0 || (barre && fr === barre.fret)) return;
    o += `<circle cx="${X(i)}" cy="${Y(rowOf(fr)) - 8.5}" r="6.4" fill="currentColor"/><text x="${X(i)}" y="${Y(rowOf(fr)) - 4.6}" font-size="9.5" font-weight="800" text-anchor="middle" fill="var(--card, #fff)">${fingers[i]}</text>`;
  });
  if (barre) o += `<text x="${X(barre.from) + 0}" y="${Y(rowOf(barre.fret)) - 4}" font-size="9" font-weight="800" fill="var(--card, #fff)" text-anchor="middle">1</text>`;
  return `${o}</svg>`;
}
