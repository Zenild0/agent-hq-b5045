import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS, OCCASION_TYPES, seasonOf, slug } from './logic.js';

// No 0/O/1/I/L so codes are easy to read out over the phone.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Short, roll-number style codes (4 characters). Teachers can also type their own, e.g. 1001 or CC01.
export function newCode(db, length = 4) {
  for (;;) {
    let code = '';
    for (let i = 0; i < length; i += 1) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
    if (!db.children.some((c) => c.code === code)) return code;
  }
}

export const PROFILE_DEFAULTS = {
  standard: '', joinedYear: null, contact: '', address: '',
  emergencyName: '', emergencyPhone: '', photoVersion: 0,
  leaveDecisions: {}, // { [season]: { status: 'keep' | 'out', on: 'YYYY-MM-DD' } }
  guest: false, // true = not in the main choir, only listed for special occasions
};

// Fill in fields added in newer versions so older db.json files keep working.
function migrate(db) {
  let changed = false;
  for (const c of db.children) {
    for (const [k, v] of Object.entries(PROFILE_DEFAULTS)) {
      if (!(k in c)) { c[k] = structuredClone(v); changed = true; }
    }
    if (c.joinedYear === null && c.joinedOn) { c.joinedYear = Number(c.joinedOn.slice(0, 4)); changed = true; }
    if (!c.code) { c.code = newCode(db); changed = true; }
  }
  // One-time: older versions made longer codes. Shorten them (the teacher can still edit any code).
  if (!db.codesShortened) {
    for (const c of db.children) if (c.code.length > 4) c.code = newCode(db);
    db.codesShortened = true;
    changed = true;
  }
  for (const s of Object.values(db.sessions)) {
    if (!('event' in s)) { s.event = ''; changed = true; }
  }
  // Occasions (feasts) have their own roster. Older data had none: create them from recorded sessions.
  for (const s of Object.values(db.sessions)) {
    if (!OCCASION_TYPES.includes(s.type) || !s.event) continue;
    const season = seasonOf(s.date);
    let occ = db.occasions.find((o) => o.season === season && slug(o.name) === slug(s.event));
    if (!occ) {
      occ = { id: randomUUID().slice(0, 8), season, name: s.event, members: db.children.filter((c) => c.active && !c.guest).map((c) => c.id) };
      db.occasions.push(occ);
      changed = true;
    }
    for (const id of Object.keys(s.entries)) if (!occ.members.includes(id)) { occ.members.push(id); changed = true; }
  }
  return changed;
}

// Tiny JSON-file store. Writes are atomic (tmp file + rename).
export function openStore(file) {
  let db = { settings: { ...DEFAULT_SETTINGS }, children: [], sessions: {}, occasions: [], hymns: [], codesShortened: false };
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    db = { ...db, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } };
  }
  mkdirSync(dirname(file), { recursive: true });
  const save = () => {
    writeFileSync(`${file}.tmp`, JSON.stringify(db, null, 2));
    renameSync(`${file}.tmp`, file);
  };
  if (migrate(db)) save();
  return { get db() { return db; }, save };
}
