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

// A line is a chord line when every word on it is a chord (used to turn "chords above lyrics" pastes into [brackets]).
const chordLine = (l) => { const w = l.trim().split(/\s+/).filter(Boolean); return w.length > 0 && w.every(isChord); };
export function fromChordsOverLyrics(text) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (chordLine(l) && lines[i + 1] !== undefined && lines[i + 1].trim() && !chordLine(lines[i + 1])) {
      let lyric = lines[i + 1].padEnd(l.length + 1);
      const marks = [...l.matchAll(/\S+/g)].map((m) => ({ at: m.index, chord: m[0] })).reverse();
      for (const { at, chord } of marks) lyric = `${lyric.slice(0, at)}[${chord}]${lyric.slice(at)}`;
      out.push(lyric.trimEnd());
      i += 1;
    } else if (chordLine(l)) out.push(l.trim().split(/\s+/).map((c) => `[${c}]`).join(' ')); // an instrumental line
    else out.push(l);
  }
  return out.join('\n');
}
// What the teacher types or pastes becomes the stored sheet.
export const normaliseSheet = (text) => { const t = String(text ?? '').replace(/\r/g, '').replace(/[ \t]+$/gm, '').trim(); return t.includes('[') ? t : fromChordsOverLyrics(t); };

const SECTION = /^(verse|chorus|pre-?chorus|bridge|intro|outro|interlude|tag|refrain|instrumental|coda|ending)\b[^[\]]*:?$/i;
// A sheet becomes lines of pieces: { chord, text }. The chord sits above the words that follow it.
export function parseSheet(body) {
  return String(body ?? '').replace(/\r/g, '').split('\n').map((raw) => {
    const l = raw.trimEnd();
    if (!l.trim()) return { kind: 'blank' };
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
export function chordSvg(shape) {
  const frets = shape.frets;
  const played = frets.filter((f) => f > 0);
  const low = played.length ? Math.min(...played) : 1;
  const base = Math.max(...frets) <= 5 ? 1 : low;
  const X = (i) => 14 + i * 20, Y = (f) => 22 + f * 20;
  let s = `<svg viewBox="0 0 130 128" width="130" height="128" role="img" aria-label="${shape.label} fingering">`;
  for (let i = 0; i < 6; i++) s += `<line x1="${X(i)}" y1="${Y(0)}" x2="${X(i)}" y2="${Y(5)}" stroke="currentColor" stroke-width="1.2" opacity=".6"/>`;
  for (let f = 0; f <= 5; f++) s += `<line x1="${X(0)}" y1="${Y(f)}" x2="${X(5)}" y2="${Y(f)}" stroke="currentColor" stroke-width="${f === 0 && base === 1 ? 4 : 1.2}" opacity="${f === 0 && base === 1 ? 1 : 0.6}"/>`;
  if (base > 1) s += `<text x="${X(5) + 6}" y="${Y(1) - 5}" font-size="11" fill="currentColor">${base}fr</text>`;
  frets.forEach((f, i) => {
    if (f < 0) s += `<text x="${X(i)}" y="14" font-size="12" text-anchor="middle" fill="currentColor">×</text>`;
    else if (f === 0) s += `<circle cx="${X(i)}" cy="10" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
    else s += `<circle cx="${X(i)}" cy="${Y(f - base + 1) - 10}" r="7" fill="#C8FF3D" stroke="#0E0B1F" stroke-width="1"/>`;
  });
  return `${s}</svg>`;
}
