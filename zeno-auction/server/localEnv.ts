// Settings kept in a private ".env" file next to the app (one NAME=value per line), so a key such as GOOGLE_TTS_KEY
// does not have to be typed into every new terminal window. The file is in .gitignore: it never goes to GitHub.
// Anything already set in the environment wins (the Google server uses /etc/zenobid.env instead).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function loadLocalEnv(file = path.join(process.cwd(), '.env'), env: NodeJS.ProcessEnv = process.env): string[] {
  if (!existsSync(file)) return [];
  const loaded: string[] = [];
  for (const raw of readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(raw);
    if (!m || raw.trim().startsWith('#')) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (env[m[1]] === undefined || env[m[1]] === '') {
      env[m[1]] = value;
      loaded.push(m[1]);
    }
  }
  return loaded;
}

const names = loadLocalEnv();
// names only, never values
if (names.length) console.log(`Settings read from .env: ${names.join(', ')}`);
