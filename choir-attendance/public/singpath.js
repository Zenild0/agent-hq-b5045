// Learn to sing: a step-by-step course, like a language app. Every unit has three parts:
//   1. a short LESSON (what it is, how to find it, and examples you can hear),
//   2. FREE PRACTICE (no score, no pressure, as long as you like),
//   3. a QUIZ (a short round; pass it to earn stars and open the next unit).
// Progress stays on this phone. Units 1 and 2 are free; the rest are part of the full version (or the free trial).
import { openAudio, micMessage } from './audio.js';
import { createPlayer } from './player.js';
import { staffSvg, spell } from './staff.js';
import { NAMES, shuffle } from './levels.js';

export const FREE_UNITS = 2;
const pcOf = (m) => ((m % 12) + 12) % 12;
const pick = (a, r) => a[Math.floor(r() * a.length)];
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const SOLFA = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti', 'Do'];
const IV_NAME = { 1: 'a half step', 2: 'a 2nd', 3: 'a minor 3rd', 4: 'a major 3rd', 5: 'a 4th', 7: 'a 5th', 9: 'a 6th', 12: 'an octave' };

// A challenge the player understands: hear a note (the start), then sing the target.
const base = (extra) => ({ kind: 'path', level: 0, timed: false, blind: false, limit: 40, ...extra });
const startNote = (r, lo = 60, hi = 67) => lo + Math.floor(r() * (hi - lo + 1));
const interval = (r, semis, dir = 1, wording = IV_NAME[Math.abs(semis)], lo = 60, hi = 66) => {
  const s = startNote(r, lo, hi);
  const target = pcOf(s + dir * semis);
  return base({ title: `You hear ${NAMES[pcOf(s)]}`, how: `Sing ${wording} ${dir > 0 ? 'above' : 'below'}`, play: { type: 'note', midi: s }, targets: [target], start: s, semis: dir * semis });
};

// The units of the course. `lessons` are cards with an optional demo (notes to hear and see on the staff).
export const UNITS = [
  {
    id: 1, name: 'Match a note', goal: 'Hear a note and sing the same note.', fact: 'Singers warm up by matching one note over and over. It trains the ear and the voice to agree.', tol: 45, hold: 450, count: 6,
    lessons: [
      { title: 'Your voice is an instrument', text: 'Stand tall, drop your shoulders and breathe low into your tummy. Sing a soft, open "Ahh". You do not need a big voice, just a steady one.' },
      { title: 'Hear it, then sing it', text: 'The phone plays a note. When the sound stops, sing the same note. A ring fills up when you are close. When it is green and full, you have matched the note.', demo: { notes: [60], label: 'This is C. Sing it back.' } },
      { title: 'Any octave is fine', text: 'Children, men and women sing the same note in different octaves. If the note is too low or too high for you, sing it higher or lower. It counts if it is the same note name.', demo: { notes: [60, 72], label: 'Both are C, one octave apart.' } },
    ],
    drill: (r) => { const m = startNote(r, 60, 67); return base({ title: `You hear ${NAMES[pcOf(m)]}`, how: 'Sing the same note', play: { type: 'note', midi: m }, targets: [pcOf(m)] }); },
  },
  {
    id: 2, name: 'Hold it steady', goal: 'Keep a note steady for two seconds.', fact: 'Long, steady notes build breath control. Choir singers practise them every rehearsal.', tol: 40, hold: 1500, count: 5,
    lessons: [
      { title: 'A steady note', text: 'Good singers do not wobble off the note. Breathe in slowly, then let the air out evenly, like slowly blowing on soup. Your tummy gently supports the sound.' },
      { title: 'Watch the ring', text: 'When you find the note, the ring starts to fill. Hold the note until it is full. If it drops, listen again and slide your voice gently until it comes back.', demo: { notes: [64], label: 'E. Hold it for two seconds.' } },
    ],
    drill: (r, strict) => { const m = startNote(r, 60, 67); return base({ title: `You hear ${NAMES[pcOf(m)]}`, how: 'Sing it and HOLD it steady', play: { type: 'note', midi: m }, targets: [pcOf(m)], hold: strict ? 2000 : 1500 }); },
  },
  {
    id: 3, name: 'Steps: seconds', goal: 'Sing the next note up (a 2nd).', fact: 'The steps of a scale are the smallest building blocks of nearly every tune you know.', tol: 40, hold: 450, count: 7,
    lessons: [
      { title: 'What is an interval?', text: 'An interval is the distance between two notes. We name it by counting the letters, starting with the first note as 1.' },
      { title: 'A 2nd: the next note', text: 'From C, the next letter is D. Count: C is 1, D is 2. A 2nd is a small step up. Think of "Do, re". Sing it smoothly, like walking up one stair.', demo: { notes: [60, 62], label: 'C to D: a step up (a 2nd).' } },
      { title: 'Try more steps', text: 'Steps go from any note to the next letter: D to E, E to F, G to A. Some steps are a little smaller (E to F), but your ear will know.', demo: { notes: [64, 65], label: 'E to F: a smaller step.' } },
    ],
    drill: (r) => interval(r, 2, 1),
  },
  {
    id: 4, name: 'Skips: thirds', goal: 'Skip one note: sing a 3rd.', fact: 'A major 3rd versus a minor 3rd is the difference between a happy chord and a sad one.', tol: 38, hold: 450, count: 7,
    lessons: [
      { title: 'What is a 3rd?', text: 'Skip a note! From C count C (1), D (2), E (3). A 3rd is a small jump up. It is the interval that makes chords sound happy or sad.', demo: { notes: [60, 64], label: 'C up to E: a major 3rd.' } },
      { title: 'Major 3rd: bright', text: 'A major 3rd is 4 semitones (4 piano keys up). It sounds bright and happy, like the first two notes of "Kumbaya" (C to E).', demo: { notes: [60, 64], label: 'Major 3rd. Happy.' } },
      { title: 'Minor 3rd: darker', text: 'A minor 3rd is 3 semitones. It sounds softer and a little sad, like the start of "Greensleeves" (A up to C).', demo: { notes: [69, 72], label: 'Minor 3rd. A little sad.' } },
    ],
    drill: (r) => (r() < 0.5 ? interval(r, 4, 1, 'a major 3rd') : interval(r, 3, 1, 'a minor 3rd')),
  },
  {
    id: 5, name: 'Fourths', goal: 'Sing a 4th above.', fact: 'A 4th is the sound of many hymn openings. Once you can hear it, you can find the next note faster.', tol: 36, hold: 500, count: 7,
    lessons: [
      { title: 'What is a 4th?', text: 'Count four letters: C (1), D (2), E (3), F (4). A 4th is five semitones. It is a strong, open jump up. Count it on your fingers: 1, 2, 3, 4.', demo: { notes: [60, 65], label: 'C up to F: a 4th.' } },
      { title: 'Songs that start with a 4th', text: '"Amazing Grace" begins with a 4th: "A-ma-zing" goes from D up to G. The wedding march "Here comes the bride" begins with a 4th too: G up to C. Hum these two notes and feel the jump.', demo: { notes: [62, 67], label: 'D to G: "A-ma-zing".' } },
      { title: 'How to find it', text: 'Hear the first note, then count up four letters in your head and aim for that note. Do not rush. Think of the sound: open and steady, like a bell.', demo: { notes: [67, 72], label: 'G to C: "Here comes the bride".' } },
    ],
    drill: (r) => interval(r, 5, 1, 'a 4th'),
  },
  {
    id: 6, name: 'Fifths', goal: 'Sing a 5th above.', fact: 'The 5th is the most stable interval after the octave. Choirs tune their chords from it.', tol: 34, hold: 500, count: 7,
    lessons: [
      { title: 'What is a 5th?', text: 'Count five letters: C (1), D (2), E (3), F (4), G (5). A 5th is seven semitones. It is a big, strong, hollow-sounding jump that feels very stable.', demo: { notes: [60, 67], label: 'C up to G: a 5th.' } },
      { title: 'A song that starts with a 5th', text: '"Twinkle, twinkle, little star": the first two notes ("Twin-kle") jump from C up to G. Sing it in your head before you sing the interval.', demo: { notes: [60, 67], label: 'Twin-kle: C to G.' } },
    ],
    drill: (r) => interval(r, 7, 1, 'a 5th'),
  },
  {
    id: 7, name: 'Sixths and octaves', goal: 'Sing a 6th and an octave.', fact: 'Singing in octaves is how a mixed choir sings the same note together: children, women and men.', tol: 32, hold: 500, count: 8,
    lessons: [
      { title: 'A 6th', text: 'C up to A is a 6th: C D E F G A, six letters. It is a warm, wide jump. "My Bonnie lies over the ocean" starts with a 6th ("My Bon-"): C up to A.', demo: { notes: [60, 69], label: 'C up to A: a 6th.' } },
      { title: 'The octave', text: 'An octave is the same note, higher or lower: eight letters (C to the next C). The two notes sound almost like one. Sing the same note name, up an octave.', demo: { notes: [60, 72], label: 'C to C: an octave.' } },
    ],
    drill: (r) => (r() < 0.5 ? interval(r, 9, 1, 'a 6th') : interval(r, 12, 1, 'an octave', 55, 62)),
  },
  {
    id: 8, name: 'Going down', goal: 'Sing intervals downward.', fact: 'Going down is often harder than going up, because the breath relaxes. Keep your support.', tol: 32, hold: 500, count: 8,
    lessons: [
      { title: 'Down is the mirror of up', text: 'The same intervals work in reverse. A 4th below C is G (count down: C 1, B 2, A 3, G 4). Aim your voice down gently, with the same breath.', demo: { notes: [67, 60], label: 'G down to C: a 5th below.' } },
      { title: 'Tips for singing down', text: 'Keep the sound light as you go down, so the note does not droop flat. Think of a smile inside your mouth, and keep your breath steady.', demo: { notes: [72, 67, 64, 60], label: 'C down to C: a gentle slide down the notes.' } },
    ],
    drill: (r) => interval(r, pick([2, 3, 4, 5, 7], r), -1, undefined, 64, 71),
  },
  {
    id: 9, name: 'Do, re, mi: the major scale', goal: 'Sing the notes of the major scale by name.', fact: 'Do-Re-Mi comes from an old hymn to St John, where each line began one note higher.', tol: 32, hold: 500, count: 8,
    lessons: [
      { title: 'The scale', text: 'A scale is a ladder of notes: Do Re Mi Fa Sol La Ti Do. In C major these are the white keys C D E F G A B C. The big steps and small steps always follow the same pattern.', demo: { notes: MAJOR.map((s) => 60 + s), label: 'The major scale, one key at a time.' } },
      { title: 'Home is Do', text: 'The first note, Do, is "home". The phone plays Do. Then it asks for another degree. Use the intervals you already know: Mi is a major 3rd above Do, Sol is a 5th, Fa is a 4th.', demo: { notes: [60, 64, 67], label: 'Do, Mi, Sol.' } },
    ],
    drill: (r) => { const s = startNote(r, 60, 66); const d = 1 + Math.floor(r() * 7); return base({ title: `Do is ${NAMES[pcOf(s)]}`, how: `Sing ${SOLFA[d]}`, play: { type: 'note', midi: s }, targets: [pcOf(s + MAJOR[d])], start: s, semis: MAJOR[d] }); },
  },
  {
    id: 10, name: 'Do, mi, sol: the chord', goal: 'Sing the notes of a major chord.', fact: 'When you can sing Do, Mi and Sol, you can sing every note of a major chord.', tol: 30, hold: 500, count: 8,
    lessons: [
      { title: 'A chord is notes together', text: 'Stack Do, Mi and Sol (1, 3 and 5) and you get a major chord. Singing the notes one at a time is called an arpeggio.', demo: { notes: [60, 64, 67, 72], label: 'The C major chord, one note at a time.' } },
      { title: 'Find each note', text: 'You will hear the chord. Then you will be asked for its first note, its third or its fifth. Use the jumps you know: the 3rd is a major 3rd above the root, the 5th is a 5th above.', demo: { notes: [60, 64, 67], label: 'Root, 3rd, 5th.' } },
    ],
    drill: (r) => { const s = startNote(r, 60, 66); const which = pick([['first note', 0], ['3rd', 4], ['5th', 7]], r); return base({ title: `${NAMES[pcOf(s)]} major`, how: `Sing the ${which[0]}`, play: { type: 'chord', root: s, quality: 'major' }, targets: [pcOf(s + which[1])], start: s, semis: which[1] }); },
  },
  {
    id: 11, name: 'Minor feeling', goal: 'Hear and sing the sad (minor) sound.', fact: 'Minor keys feel sad because the 3rd is lowered by one semitone. That tiny change turns the mood.', tol: 30, hold: 500, count: 8,
    lessons: [
      { title: 'Major and minor', text: 'A major chord sounds bright and happy. A minor chord sounds darker. The only difference is the middle note: the 3rd is one piano key lower in minor.', demo: { notes: [60, 64, 67], label: 'C major: bright.' } },
      { title: 'Listen to minor', text: 'Here is C minor. The middle note moved down from E to E-flat. Listen to how the mood changes, then sing that lower, darker 3rd.', demo: { notes: [60, 63, 67], label: 'C minor: darker.' } },
    ],
    drill: (r) => { const s = startNote(r, 60, 66); const which = pick([['first note', 0], ['minor 3rd', 3], ['5th', 7]], r); return base({ title: `${NAMES[pcOf(s)]} minor`, how: `Sing the ${which[0]}`, play: { type: 'chord', root: s, quality: 'minor' }, targets: [pcOf(s + which[1])], start: s, semis: which[1] }); },
  },
  {
    id: 12, name: 'Echo tunes', goal: 'Remember a short tune and sing it back.', fact: 'Remembering tunes by ear is how hymns and folk songs have been passed on for centuries.', tol: 30, hold: 400, count: 6,
    lessons: [
      { title: 'Listen, remember, sing', text: 'You will hear three or four notes. Hold them in your head, then sing them in order. Hum the tune once silently, then sing it. Music is memory!', demo: { notes: [60, 62, 64, 62], label: 'A little tune: up, up, back.' } },
      { title: 'Use what you know', text: 'Work out each jump: step, skip, or repeat. Your ear and your intervals work together. If you miss one, the next note still counts.', demo: { notes: [64, 67, 65, 62], label: 'Skip up, step down, step down.' } },
    ],
    drill: (r) => { const len = 3 + (r() < 0.4 ? 1 : 0); const notes = [startNote(r, 60, 65)]; for (let i = 1; i < len; i++) { let n = notes[i - 1] + pick([-4, -2, -1, 1, 2, 4], r); if (n < 57) n += 12; if (n > 74) n -= 12; notes.push(n); } return base({ title: 'Echo the tune', how: `${len} notes, in order`, play: { type: 'melody', notes }, targets: notes.map(pcOf), limit: 60 }); },
  },
];

// A round of challenges for a unit. Like a good lesson, a quiz mostly practises the new skill, but keeps
// revising earlier units too (about a third of it, leaning on the most recent ones), so nothing is forgotten.
// relaxed = free practice (wider margin, never scored).
export function pathDeck(unitId, { rng = Math.random, relaxed = false, count } = {}) {
  const u = UNITS.find((x) => x.id === unitId);
  if (!u) throw new Error('unknown unit');
  const n = count ?? (relaxed ? 10 : u.count);
  const earlier = UNITS.filter((x) => x.id < unitId);
  const reviewN = earlier.length ? Math.min(n - 1, Math.round(n * (relaxed ? 0.2 : 0.34))) : 0;
  const slots = shuffle(Array.from({ length: n }, (_, i) => i).slice(1), rng).slice(0, reviewN); // the first one is always the new skill
  const isReview = new Set(slots);
  const out = [];
  for (let i = 0; i < n; i++) {
    let src = u;
    if (isReview.has(i)) {
      const recent = earlier.slice(-2);
      src = rng() < 0.55 ? pick(recent, rng) : pick(earlier, rng); // recent units come up more often
    }
    let c = src.drill(rng, !relaxed);
    if (i && c.targets.length === 1 && out[i - 1].targets.length === 1 && c.targets[0] === out[i - 1].targets[0] && c.start === out[i - 1].start) c = src.drill(rng, !relaxed); // not the same twice
    out.push({ ...c, review: src !== u, from: src.id, how: src !== u ? `Review · ${c.how}` : c.how, tol: Math.min(50, src.tol + (relaxed ? 12 : 0)), hold: c.hold ?? src.hold, level: 100 + u.id });
  }
  return out;
}

const KEY = 'choir-singpath';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };
export const pathProgress = () => { const p = read(); const done = UNITS.filter((u) => p[u.id]?.stars).length; const next = UNITS.find((u) => !p[u.id]?.stars) ?? null; return { done, total: UNITS.length, next }; };
const stars = (n) => '⭐'.repeat(n) + '☆'.repeat(3 - n);

export function mountSingPath(host, { full = true, onExit } = {}) {
  const root = document.createElement('div'); // its own container, so listeners from an earlier visit never pile up
  host.replaceChildren(root);
  let audio = null, current = null, view = 'home', unitId = 1, card = 0, learnAudio = null, deckUsed = [];
  const closeLearn = () => { learnAudio?.close(); learnAudio = null; };
  const state = () => read();
  const unlocked = (u, p) => (u.id === 1 || p[u.id - 1]?.stars);

  function home() {
    closeLearn(); view = 'home';
    const p = state();
    root.innerHTML = `
      <div class="card gm-hero">
        <div class="row between"><h2 class="gm-title" style="margin:0">Learn to sing</h2><button class="btn small" data-p="exit">‹ Back</button></div>
        <div class="muted">A step-by-step course. Each unit has a short lesson, free practice, and then a quiz. ${UNITS.filter((u) => p[u.id]?.stars).length} of ${UNITS.length} units done.</div>
        <div class="gm-note">🎧 Headphones help the phone hear only your voice.</div>
      </div>
      <div class="gm-list">${UNITS.map((u) => {
    const lockedPay = u.id > FREE_UNITS && !full;
    const lockedOrder = !unlocked(u, p);
    const why = lockedPay ? 'Part of the full version' : lockedOrder ? 'Finish the unit before this one first' : u.goal;
    return `<button class="gm-lvcard${lockedPay || lockedOrder ? ' lock' : ''}${p[u.id]?.stars ? ' done' : ''}" data-unit="${u.id}"><span class="gm-n">${u.id}</span><span class="gm-lvt"><b>${u.name}</b><small>${why}</small></span><span class="gm-pips">${lockedPay || lockedOrder ? '🔒' : p[u.id]?.stars ? stars(p[u.id].stars) : '☆☆☆'}</span></button>`;
  }).join('')}</div>`;
  }

  function unit(id) {
    closeLearn(); view = 'unit'; unitId = id;
    const u = UNITS.find((x) => x.id === id), p = state();
    const seen = p[id]?.seen;
    root.innerHTML = `
      <div class="card">
        <div class="row between"><div><div class="muted">Unit ${u.id}</div><h2 style="margin:0">${u.name}</h2></div><button class="btn small" data-p="home">‹ Course</button></div>
        <p style="margin:8px 0"><b>${u.goal}</b></p>
        <div class="path-steps">
          <button class="path-step ${seen ? 'done' : 'now'}" data-p="lesson"><span class="ps-n">1</span><span class="grow"><b>Lesson</b><span class="muted">${u.lessons.length} short cards with examples you can hear</span></span><span>${seen ? '✓' : '›'}</span></button>
          <button class="path-step ${seen ? '' : 'lock'}" data-p="practice"><span class="ps-n">2</span><span class="grow"><b>Free practice</b><span class="muted">No score. Try as many as you like.</span></span><span>›</span></button>
          <button class="path-step ${seen ? '' : 'lock'}" data-p="quiz"><span class="ps-n">3</span><span class="grow"><b>Quiz</b><span class="muted">${u.count} notes, some of them revision from earlier units. Get 70% to pass${p[id]?.stars ? ` · best ${stars(p[id].stars)}` : ''}</span></span><span>${p[id]?.stars ? '✓' : '›'}</span></button>
        </div>
        ${seen ? '' : '<div class="muted" style="margin-top:6px">Start with the lesson. Practice and the quiz open after it.</div>'}
      </div>`;
  }

  async function playDemo(notes) {
    try { learnAudio ||= await openAudio(); await learnAudio.ensure(); learnAudio.stop(); learnAudio.sound.melody(notes, notes.length > 4 ? 0.9 : 1.4, notes.length > 4 ? 0.9 : 1.3); } catch { /* no sound available */ }
  }

  function lesson(id, i = 0) {
    view = 'lesson'; unitId = id; card = i;
    const u = UNITS.find((x) => x.id === id), c = u.lessons[i];
    const last = i >= u.lessons.length - 1;
    root.innerHTML = `
      <div class="card">
        <div class="row between"><div><div class="muted">${u.name} · lesson ${i + 1} of ${u.lessons.length}</div><h2 style="margin:0">${c.title}</h2></div><button class="btn small" data-p="unit">✕</button></div>
        <p style="margin:10px 0;font-size:1.05rem">${c.text}</p>
        ${c.demo ? `<div class="wu-staff">${staffSvg(c.demo.notes.map((m) => ({ midi: m })), { mode: 'seq', flats: false })}</div>
          <div class="row" style="margin:8px 0"><button class="btn primary" data-p="hear">🔊 Hear it</button><span class="muted">${c.demo.label}</span></div>` : ''}
        <div class="path-dots">${u.lessons.map((_, k) => `<i class="${k === i ? 'now' : k < i ? 'done' : ''}"></i>`).join('')}</div>
        <div class="row" style="margin-top:10px">${i > 0 ? '<button class="btn" data-p="prev">‹ Back</button>' : ''}${last ? '<button class="btn primary" data-p="finish">Got it! Go to practice ›</button>' : '<button class="btn primary" data-p="next">Next ›</button>'}</div>
      </div>`;
  }

  async function run(kind) {
    closeLearn();
    const u = UNITS.find((x) => x.id === unitId);
    try { audio = await openAudio(); } catch (e) { root.insertAdjacentHTML('afterbegin', `<div class="alert bad">${micMessage(e)}</div>`); return; }
    view = kind;
    const relaxed = kind === 'practice';
    current = createPlayer(root, {
      audio, deck: (deckUsed = pathDeck(u.id, { relaxed })), heading: `${u.name} · ${relaxed ? 'free practice' : 'quiz'}`,
      onExit: () => { current = null; audio?.close(); audio = null; unit(u.id); },
      onDone: (results) => { current?.destroy(); current = null; audio?.close(); audio = null; relaxed ? practiceDone(u, results) : quizDone(u, results); },
    });
  }

  function practiceDone(u, results) {
    view = 'result';
    const won = results.filter((r) => r.won).length;
    root.innerHTML = `
      <div class="card gm-result"><div class="gm-praise gm-try">Nice practice!</div>
        <div><b>${won} of ${results.length}</b> found. There is no score here, it is just for learning.</div>
        <div class="row" style="justify-content:center"><button class="btn" data-p="practice">🔁 Practise more</button><button class="btn primary" data-p="quiz">Take the quiz</button><button class="btn" data-p="unit">Back</button></div></div>`;
  }

  function quizDone(u, results) {
    view = 'result';
    const won = results.filter((r) => r.won).length;
    const share = results.length ? won / results.length : 0;
    const helped = results.filter((r) => r.hints > 0).length;
    const n = share >= 0.9 && helped <= 1 ? 3 : share >= 0.7 ? 2 : 0;
    const p = state(); const passed = share >= 0.7;
    p[u.id] = { ...(p[u.id] || {}), seen: true };
    if (passed && n > (p[u.id].stars ?? 0)) { p[u.id].stars = n; p[u.id].on = new Date().toISOString().slice(0, 10); }
    write(p);
    const next = UNITS.find((x) => x.id === u.id + 1);
    root.innerHTML = `
      <div class="card gm-result"><div class="gm-praise ${passed ? '' : 'gm-try'}">${n === 3 ? 'Perfect! You have got this.' : passed ? 'Well done! Unit complete.' : 'Good try. Review the lesson, practise, then try again.'}</div>
        <div class="gm-big">${passed ? stars(n) : ''}</div>
        <div><b>${won} of ${results.length}</b> correct${helped ? ` · ${helped} with help` : ''}</div>
        ${(() => { const rv = results.map((r, i) => ({ r, c: deckUsed[i] })).filter((x) => x.c?.review); return rv.length ? `<div class="muted">Revision from earlier units: ${rv.filter((x) => x.r.won).length} of ${rv.length} right.</div>` : ''; })()}
        ${u.fact ? `<div class="gm-note">💡 Did you know? ${u.fact}</div>` : ''}
        ${passed && next ? `<div class="muted">Coming next: <b>${next.name}</b>. ${next.goal}</div>` : ''}
        <div class="row" style="justify-content:center">
          ${passed && next && (next.id <= FREE_UNITS || full) ? `<button class="btn primary" data-unit="${next.id}">Next unit: ${next.name}</button>` : ''}
          ${!passed ? '<button class="btn primary" data-p="lesson">📖 Review the lesson</button><button class="btn" data-p="practice">Practise</button>' : ''}
          <button class="btn${passed ? '' : ''}" data-p="quiz">🔁 ${passed ? 'Play again' : 'Try again'}</button><button class="btn" data-p="home">Course</button></div></div>`;
  }

  root.addEventListener('click', (e) => {
    const un = e.target.closest('[data-unit]');
    if (un) {
      const u = UNITS.find((x) => x.id === Number(un.dataset.unit));
      const p = state();
      if (u.id > FREE_UNITS && !full) { root.insertAdjacentHTML('afterbegin', '<div class="alert warn" data-pay>This unit is part of the full version. The free trial opens every unit for a few days.</div>'); setTimeout(() => root.querySelector('[data-pay]')?.remove(), 5000); return; }
      if (!unlocked(u, p)) return;
      return unit(u.id);
    }
    const a = e.target.closest('[data-p]')?.dataset.p;
    if (!a) return;
    const p = state();
    if (a === 'exit') { onExit?.(); return; }
    if (a === 'home') return home();
    if (a === 'unit') return unit(unitId);
    if (a === 'lesson') return lesson(unitId, 0);
    if (a === 'next') return lesson(unitId, card + 1);
    if (a === 'prev') return lesson(unitId, card - 1);
    if (a === 'hear') return playDemo(UNITS.find((x) => x.id === unitId).lessons[card].demo.notes);
    if (a === 'finish') { p[unitId] = { ...(p[unitId] || {}), seen: true }; write(p); return unit(unitId); }
    if (a === 'practice' || a === 'quiz') { if (!p[unitId]?.seen) return lesson(unitId, 0); return run(a); }
  });
  home();
  return {
    destroy() { current?.destroy?.(); audio?.close(); closeLearn(); },
    back() { // the phone's Back button
      if (view === 'practice' || view === 'quiz') { current?.destroy?.(); current = null; audio?.close(); audio = null; unit(unitId); return true; }
      if (view === 'lesson' || view === 'result') return unit(unitId), true;
      if (view === 'unit') return home(), true;
      return false;
    },
  };
}
