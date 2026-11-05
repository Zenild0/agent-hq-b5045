import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_VOICES, Tts, mockWav, ttsConfigFromEnv, type TtsConfig } from './tts';

const dir = () => mkdtempSync(path.join(tmpdir(), 'zeno-tts-'));
const cfg = (over: Partial<TtsConfig> = {}): TtsConfig => ({
  key: 'k'.repeat(39),
  provider: 'google',
  dir: path.join(dir(), 'tts-cache'),
  monthlyChars: 1000,
  voices: DEFAULT_VOICES,
  ...over,
});

/** A pretend Google: records what was asked and answers per voice name. */
function fakeGoogle(answer: (voice: string) => number = () => 200) {
  const calls: { voice: string; body: any; url: string }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ voice: body.voice.name, body, url });
    const status = answer(body.voice.name);
    if (status !== 200) return new Response('{"error":"nope"}', { status });
    return new Response(JSON.stringify({ audioContent: Buffer.from(`mp3:${body.voice.name}:${body.input.text}`).toString('base64') }), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

test('switched off without a key; on with a key or the test provider', () => {
  assert.equal(ttsConfigFromEnv({}, '/tmp/x'), null);
  assert.equal(ttsConfigFromEnv({ GOOGLE_TTS_KEY: 'short' }, '/tmp/x'), null);
  const on = ttsConfigFromEnv({ GOOGLE_TTS_KEY: 'A'.repeat(39), TTS_MONTHLY_CHARS: '5000', TTS_VOICE_KBC: 'hi-IN-Custom-A' }, '/data');
  assert.ok(on);
  assert.equal(on.provider, 'google');
  assert.equal(on.monthlyChars, 5000);
  assert.equal(on.dir, path.join('/data', 'tts-cache'));
  assert.equal(on.voices.kbc[0], 'hi-IN-Custom-A'); // the owner's choice first, the defaults after it
  assert.equal(on.voices.kbc[1], DEFAULT_VOICES.kbc[0]);
  assert.equal(ttsConfigFromEnv({ TTS_PROVIDER: 'mock' }, '/data')?.provider, 'mock');
  // a default budget that stays well inside the free allowance
  assert.equal(on && ttsConfigFromEnv({ GOOGLE_TTS_KEY: 'A'.repeat(39) }, '/d')?.monthlyChars, 300_000);
});

test('each sentence is made once and then served from disk', async () => {
  const g = fakeGoogle();
  const t = new Tts(cfg(), g.fetcher);
  const a = await t.speak('wwe', 'Thunder Hawks bid one crore!');
  assert.equal(a.type, 'audio/mpeg');
  assert.match(a.audio.toString(), /^mp3:en-US-Chirp3-HD-Algenib:Thunder Hawks bid one crore!$/);
  assert.equal(t.has('wwe', 'Thunder Hawks bid one crore!'), true);
  const b = await t.speak('wwe', 'Thunder Hawks bid one crore!');
  assert.deepEqual(b.audio, a.audio);
  assert.equal(g.calls.length, 1); // the repeat cost nothing
  assert.equal(t.used(), 'Thunder Hawks bid one crore!'.length);
  // the same words in another style are a different recording
  await t.speak('mk', 'Thunder Hawks bid one crore!');
  assert.equal(g.calls.length, 2);
  assert.equal(g.calls[1].voice, 'en-US-Chirp3-HD-Charon');
  // the key travels to Google only, and the text sent is exactly the sentence
  assert.match(g.calls[0].url, /^https:\/\/texttospeech\.googleapis\.com\/v1\/text:synthesize\?key=k+$/);
  assert.equal(g.calls[0].body.input.text, 'Thunder Hawks bid one crore!');
});

test('two screens asking for the same new line at once make one request', async () => {
  const g = fakeGoogle();
  const t = new Tts(cfg(), g.fetcher);
  const [a, b, c] = await Promise.all([t.speak('kbc', 'ek crore'), t.speak('kbc', 'ek crore'), t.speak('kbc', 'ek crore')]);
  assert.equal(g.calls.length, 1);
  assert.deepEqual(a.audio, b.audio);
  assert.deepEqual(b.audio, c.audio);
  assert.equal(t.used(), 'ek crore'.length);
});

test('a voice Google does not have is skipped (and remembered); a key problem stops at once', async () => {
  const g = fakeGoogle((v) => (v.includes('Chirp3') ? 400 : 200));
  const t = new Tts(cfg(), g.fetcher);
  const a = await t.speak('kbc', 'pachaas lakh');
  assert.match(a.audio.toString(), /hi-IN-Neural2-B/);
  assert.deepEqual(g.calls.map((c) => c.voice), ['hi-IN-Chirp3-HD-Charon', 'hi-IN-Chirp3-HD-Fenrir', 'hi-IN-Neural2-B']);
  // normal pace: nothing extra is asked
  assert.equal(g.calls[0].body.audioConfig.speakingRate, undefined);
  assert.equal(g.calls[2].body.voice.languageCode, 'hi-IN');
  await t.speak('kbc', 'saath lakh');
  assert.equal(g.calls.length, 4); // went straight to the voice that works

  const denied = fakeGoogle(() => 403);
  const t2 = new Tts(cfg(), denied.fetcher);
  await assert.rejects(t2.speak('wwe', 'hello'), /403/);
  assert.equal(denied.calls.length, 1);
  assert.equal(t2.used(), 0); // nothing counted for a failure
  assert.equal(t2.has('wwe', 'hello'), false);
});

test('the monthly budget is never passed, and starts again next month', async () => {
  let now = new Date('2026-11-20T10:00:00Z');
  const g = fakeGoogle();
  const t = new Tts(cfg({ monthlyChars: 20 }), g.fetcher, () => now);
  await t.speak('wwe', 'a'.repeat(15));
  assert.equal(t.remaining(), 5);
  assert.equal(t.enabled, true);
  await assert.rejects(t.speak('wwe', 'b'.repeat(6)), /budget/);
  assert.equal(g.calls.length, 1);
  // what is already made still plays when the budget is used up
  assert.equal((await t.speak('wwe', 'a'.repeat(15))).audio.length > 0, true);
  await t.speak('wwe', 'c'.repeat(5));
  assert.equal(t.enabled, false);
  now = new Date('2026-12-01T00:00:01Z');
  assert.equal(t.remaining(), 20);
  assert.equal(t.enabled, true);
});

test('the test provider makes a real WAV without any network', async () => {
  const fetcher = (() => {
    throw new Error('no network in mock mode');
  }) as unknown as typeof fetch;
  const t = new Tts(cfg({ provider: 'mock', key: '' }), fetcher);
  const a = await t.speak('mk', 'Finish him');
  assert.equal(a.type, 'audio/wav');
  assert.equal(a.audio.subarray(0, 4).toString(), 'RIFF');
  assert.equal(a.audio.subarray(8, 12).toString(), 'WAVE');
  assert.deepEqual(a.audio, mockWav());
});

test('the cache is kept small by removing the oldest recordings', () => {
  const c = cfg();
  const t = new Tts(c, fakeGoogle().fetcher);
  const big = Buffer.alloc(400 * 1024);
  for (let i = 0; i < 5; i++) {
    const f = path.join(c.dir, `old${i}.mp3`);
    writeFileSync(f, big);
    const when = new Date(Date.UTC(2026, 0, 1 + i));
    utimesSync(f, when, when);
  }
  writeFileSync(path.join(c.dir, 'usage.json'), '{"month":"2026-11","chars":3}');
  t.prune(1); // 1 MB: keeps the two newest (800 KB)
  const left = readdirSync(c.dir).sort();
  assert.deepEqual(left, ['old3.mp3', 'old4.mp3', 'usage.json']);
  assert.ok(existsSync(path.join(c.dir, 'usage.json')));
});

test('a faster pace is asked for (and kept apart in the cache); a voice that refuses a pace is asked without one', async () => {
  const g = fakeGoogle();
  const t = new Tts(cfg(), g.fetcher);
  await t.speak('cricket', 'Chhakka!', 1.23);
  assert.equal(g.calls[0].body.audioConfig.speakingRate, 1.23);
  assert.equal(t.has('cricket', 'Chhakka!', 1.23), true);
  assert.equal(t.has('cricket', 'Chhakka!'), false, 'the same words at another pace are another recording');
  await t.speak('cricket', 'Chhakka!', 1.23);
  assert.equal(g.calls.length, 1);

  // a voice that answers 400 to a pace, but works without one
  const calls: any[] = [];
  const picky = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push(body);
    if (body.audioConfig.speakingRate) return new Response('{"error":"no pace"}', { status: 400 });
    return new Response(JSON.stringify({ audioContent: Buffer.from('ok').toString('base64') }), { status: 200 });
  }) as unknown as typeof fetch;
  const t2 = new Tts(cfg(), picky);
  await t2.speak('kbc', 'ek baar', 1.1);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].voice.name, calls[0].voice.name, 'the same (best) voice, not a worse one');
  await t2.speak('kbc', 'do baar', 1.1);
  assert.equal(calls.length, 3, 'next time it goes straight to "no pace" for that voice');
  assert.equal(calls[2].audioConfig.speakingRate, undefined);
});
