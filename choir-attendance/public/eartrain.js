// Ear Detective: listening questions, the heart of ear-training apps. No microphone: hear two notes, tap the answer.
// The questions only (no sound or screen), so they can be tested.

export const EAR_ROUND = 10;
export const FREE_EAR_LEVELS = 2;
export const EAR_LEVELS = [
  { id: 1, emoji: '⬆️', name: 'Higher or lower?', how: 'Two notes. Was the second one higher or lower?' },
  { id: 2, emoji: '🔍', name: 'Closer notes', how: 'The same question, but the notes are close together. Listen hard!' },
  { id: 3, emoji: '👯', name: 'Same or different?', how: 'Are the two notes exactly the same?' },
  { id: 4, emoji: '↕️', name: 'Up, down or same?', how: 'Did the tune go up, go down, or stay?' },
  { id: 5, emoji: '🪜', name: 'Step or leap?', how: 'A small step (next door) or a big leap?' },
  { id: 6, emoji: '🕵️', name: 'Name the jump', how: 'How far did the tune jump? Do-Re, Do-Mi, Do-Sol or Do-Do.' },
];
export const earLevel = (id) => EAR_LEVELS.find((l) => l.id === id) ?? EAR_LEVELS[0];

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const ANS = {
  up: { id: 'up', label: 'Higher', icon: '⬆️' }, down: { id: 'down', label: 'Lower', icon: '⬇️' }, same: { id: 'same', label: 'Same', icon: '🟰' },
  diff: { id: 'diff', label: 'Different', icon: '↔️' }, step: { id: 'step', label: 'Step', icon: '👣' }, leap: { id: 'leap', label: 'Leap', icon: '🦘' },
};
export const JUMPS = [{ id: 'second', semis: 2, label: '2nd', sub: 'Do-Re' }, { id: 'third', semis: 4, label: '3rd', sub: 'Do-Mi' }, { id: 'fifth', semis: 7, label: '5th', sub: 'Do-Sol' }, { id: 'octave', semis: 12, label: 'Octave', sub: 'Do-Do' }];

// One question: { notes: [midi, midi], answer, choices: [{ id, label, icon }] }. Notes stay in a comfortable range (G3 to E5).
export function makeEarQuestion(levelId, rng = Math.random) {
  const base = 55 + Math.floor(rng() * 12); // G3..F#4
  const sign = rng() < 0.5 ? -1 : 1;
  const two = (gap) => { let a = base, b = base + gap; if (b > 76) { a -= 12; b -= 12; } if (b < 52) { a += 12; b += 12; } return [a, b]; };
  switch (levelId) {
    case 1: { const g = pick(rng, [5, 7, 9, 12]) * sign; return { notes: two(g), answer: g > 0 ? 'up' : 'down', choices: [ANS.up, ANS.down] }; }
    case 2: { const g = pick(rng, [1, 2, 3, 4]) * sign; return { notes: two(g), answer: g > 0 ? 'up' : 'down', choices: [ANS.up, ANS.down] }; }
    case 3: { const same = rng() < 0.45, g = same ? 0 : pick(rng, [1, 2]) * sign; return { notes: two(g), answer: same ? 'same' : 'diff', choices: [ANS.same, ANS.diff] }; }
    case 4: { const r = rng(), g = r < 0.3 ? 0 : pick(rng, [1, 2, 3]) * sign; return { notes: two(g), answer: g === 0 ? 'same' : g > 0 ? 'up' : 'down', choices: [ANS.up, ANS.same, ANS.down] }; }
    case 5: { const step = rng() < 0.5, g = (step ? pick(rng, [1, 2]) : pick(rng, [5, 7, 8, 12])) * sign; return { notes: two(g), answer: step ? 'step' : 'leap', choices: [ANS.step, ANS.leap] }; }
    default: { const j = pick(rng, JUMPS); return { notes: two(j.semis), answer: j.id, choices: JUMPS.map((x) => ({ id: x.id, label: x.label, icon: x.sub })) }; }
  }
}
// A round of questions, never the same pair of notes twice in a row.
export function makeEarRound(levelId, rng = Math.random) {
  const out = [];
  for (let tries = 0; out.length < EAR_ROUND && tries < 200; tries++) {
    const q = makeEarQuestion(levelId, rng);
    if (!out.length || out.at(-1).notes.join() !== q.notes.join()) out.push(q);
  }
  return out;
}
export const earStars = (right, total = EAR_ROUND) => { const r = right / total; return r >= 0.9 ? 3 : r >= 0.7 ? 2 : r >= 0.5 ? 1 : 0; };
