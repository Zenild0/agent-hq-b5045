import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadLocalEnv } from './localEnv';

test('a private .env file fills in settings, without overriding ones already set', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'zeno-env-'));
  const file = path.join(dir, '.env');
  writeFileSync(file, '﻿# my keys\r\nGOOGLE_TTS_KEY=AIzaTEST123\r\nexport TTS_VOICE_KBC = "hi-IN-Chirp3-HD-Orus"\r\nPORT=9999\r\nnot a line\r\n');
  const env: NodeJS.ProcessEnv = { PORT: '8787' };
  assert.deepEqual(loadLocalEnv(file, env), ['GOOGLE_TTS_KEY', 'TTS_VOICE_KBC']);
  assert.equal(env.GOOGLE_TTS_KEY, 'AIzaTEST123');
  assert.equal(env.TTS_VOICE_KBC, 'hi-IN-Chirp3-HD-Orus');
  assert.equal(env.PORT, '8787', 'what is already set wins');
  assert.deepEqual(loadLocalEnv(path.join(dir, 'missing'), env), []);
});
