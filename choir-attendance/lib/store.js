import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_SETTINGS } from './logic.js';

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
  return { get db() { return db; }, save };
}
