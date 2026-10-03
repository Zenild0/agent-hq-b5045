import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomInt } from 'node:crypto';
import { DEFAULT_SETTINGS } from './logic.js';

// No 0/O/1/I/L so codes are easy to read out over the phone.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newCode(db) {
  for (;;) {
    let code = '';
    for (let i = 0; i < 8; i += 1) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
    if (!db.children.some((c) => c.code === code)) return code;
  }
}

export const PROFILE_DEFAULTS = {
  standard: '', joinedYear: null, contact: '', address: '',
  emergencyName: '', emergencyPhone: '', photoVersion: 0,
  leaveDecisions: {}, // { [season]: { status: 'keep' | 'out', on: 'YYYY-MM-DD' } }
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
  for (const s of Object.values(db.sessions)) {
    if (!('event' in s)) { s.event = ''; changed = true; }
  }
  return changed;
}

// Tiny JSON-file store. Writes are atomic (tmp file + rename).
export function openStore(file) {
  let db = { settings: { ...DEFAULT_SETTINGS }, children: [], sessions: {} };
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
