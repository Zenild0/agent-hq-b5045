// Studio-quality announcer voices, made on the server with Google Cloud Text-to-Speech.
//
// Off unless GOOGLE_TTS_KEY is set in /etc/zenobid.env (a key the server owner creates and writes there
// themselves; never in the code, never on GitHub). Without it, screens fall back to the browser's own voices.
//
// Safety and cost:
//  - Screens never send text to be spoken. The server builds every sentence itself from the auction's own
//    events, so the key cannot be used to read out arbitrary text.
//  - Every sentence is made once and kept on disk (DATA_DIR/tts-cache); repeats cost nothing.
//  - A monthly character budget (TTS_MONTHLY_CHARS, default 300,000) keeps usage far inside Google's free allowance.
//    When it is used up the server stops asking Google and the screens use their own voices until next month.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AnnouncerStyle } from '../shared/announcer';

export interface TtsConfig {
  key: string;
  provider: 'google' | 'mock';
  dir: string;
  monthlyChars: number;
  voices: Record<Exclude<AnnouncerStyle, 'classic'>, string[]>;
}

/** Voices to try, best first. If Google does not offer one (names change), the next is used. */
export const DEFAULT_VOICES: TtsConfig['voices'] = {
  kbc: ['hi-IN-Chirp3-HD-Charon', 'hi-IN-Chirp3-HD-Fenrir', 'hi-IN-Neural2-B', 'hi-IN-Wavenet-C', 'hi-IN-Standard-B'],
  wwe: ['en-US-Chirp3-HD-Fenrir', 'en-US-Chirp3-HD-Puck', 'en-US-Neural2-J', 'en-US-Wavenet-D', 'en-US-Standard-D'],
  mk: ['en-US-Chirp3-HD-Charon', 'en-US-Chirp3-HD-Algenib', 'en-US-Neural2-D', 'en-US-Wavenet-B', 'en-US-Standard-B'],
};

const lang = (voice: string) => voice.split('-').slice(0, 2).join('-');

export function ttsConfigFromEnv(env: NodeJS.ProcessEnv, dataDir: string): TtsConfig | null {
  const provider = env.TTS_PROVIDER === 'mock' ? 'mock' : 'google';
  const key = env.GOOGLE_TTS_KEY ?? '';
  if (provider === 'google' && key.length < 20) return null; // switched off
  const list = (v: string | undefined, d: string[]) => (v ? [...v.split(',').map((x) => x.trim()).filter(Boolean), ...d] : d);
  return {
    key,
    provider,
    dir: path.join(dataDir, 'tts-cache'),
    monthlyChars: Math.max(0, Number(env.TTS_MONTHLY_CHARS ?? 300_000) || 0),
    voices: { kbc: list(env.TTS_VOICE_KBC, DEFAULT_VOICES.kbc), wwe: list(env.TTS_VOICE_WWE, DEFAULT_VOICES.wwe), mk: list(env.TTS_VOICE_MK, DEFAULT_VOICES.mk) },
  };
}

/** A short, valid WAV (a soft tone) used by the "mock" provider in tests. */
export function mockWav(seconds = 0.25): Buffer {
  const rate = 8000, n = Math.floor(rate * seconds);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 330) * 4000), 44 + i * 2);
  return b;
}

type Fetch = typeof fetch;

export class Tts {
  private inflight = new Map<string, Promise<{ audio: Buffer; type: string }>>();
  /** voices Google refused, so they are not tried again */
  private badVoices = new Set<string>();
  constructor(private cfg: TtsConfig, private fetcher: Fetch = fetch, private now = () => new Date()) {
    mkdirSync(cfg.dir, { recursive: true });
  }

  get enabled() {
    return this.remaining() > 0;
  }

  private usageFile() {
    return path.join(this.cfg.dir, 'usage.json');
  }
  private month() {
    return this.now().toISOString().slice(0, 7);
  }
  /** Characters used this month. */
  used(): number {
    try {
      const u = JSON.parse(readFileSync(this.usageFile(), 'utf8'));
      return u.month === this.month() ? Number(u.chars) || 0 : 0;
    } catch {
      return 0;
    }
  }
  remaining() {
    return Math.max(0, this.cfg.monthlyChars - this.used());
  }
  private addUsage(chars: number) {
    const tmp = `${this.usageFile()}.tmp`;
    writeFileSync(tmp, JSON.stringify({ month: this.month(), chars: this.used() + chars }));
    renameSync(tmp, this.usageFile());
  }

  private fileFor(style: string, text: string) {
    const id = createHash('sha256').update(`${style}\n${text}`).digest('hex').slice(0, 32);
    return path.join(this.cfg.dir, `${id}.${this.cfg.provider === 'mock' ? 'wav' : 'mp3'}`);
  }

  /** Already made (costs nothing to serve again)? */
  has(style: string, text: string) {
    return existsSync(this.fileFor(style, text));
  }

  /** The sentence as audio, from the cache or freshly made. Throws when it cannot (the screen then uses its own voice). */
  async speak(style: Exclude<AnnouncerStyle, 'classic'>, text: string, rate = 1): Promise<{ audio: Buffer; type: string }> {
    const file = this.fileFor(style, text);
    const type = this.cfg.provider === 'mock' ? 'audio/wav' : 'audio/mpeg';
    if (existsSync(file)) return { audio: readFileSync(file), type };
    const running = this.inflight.get(file);
    if (running) return running;
    const job = (async () => {
      if (text.length > this.remaining()) throw new Error('monthly voice budget used up');
      const audio = this.cfg.provider === 'mock' ? mockWav() : await this.google(style, text, rate);
      this.addUsage(text.length);
      writeFileSync(file, audio);
      return { audio, type };
    })().finally(() => this.inflight.delete(file));
    this.inflight.set(file, job);
    return job;
  }

  private async google(style: Exclude<AnnouncerStyle, 'classic'>, text: string, rate: number): Promise<Buffer> {
    let lastError = 'no voice available';
    for (const name of this.cfg.voices[style]) {
      if (this.badVoices.has(name)) continue;
      // Chirp voices choose their own pace; the older voices take a speaking rate
      const audioConfig: Record<string, unknown> = { audioEncoding: 'MP3', ...(name.includes('Chirp') ? {} : { speakingRate: rate }) };
      const res = await this.fetcher(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(this.cfg.key)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: { text }, voice: { languageCode: lang(name), name }, audioConfig }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const body = (await res.json()) as { audioContent?: string };
        if (body.audioContent) return Buffer.from(body.audioContent, 'base64');
        lastError = 'empty answer';
        continue;
      }
      const err = await res.text().catch(() => '');
      lastError = `${res.status} ${err.slice(0, 200)}`;
      // a voice that does not exist (or does not fit the text) is skipped from now on; a key or quota problem stops here
      if (res.status === 400 || res.status === 404) this.badVoices.add(name);
      else break;
    }
    throw new Error(`Google voice failed: ${lastError}`);
  }

  /** Keeps the cache small: removes the oldest files beyond `maxMb`. */
  prune(maxMb = 60) {
    const files = readdirSync(this.cfg.dir)
      .filter((f) => f.endsWith('.mp3') || f.endsWith('.wav'))
      .map((f) => ({ f, s: statSync(path.join(this.cfg.dir, f)) }))
      .sort((a, b) => b.s.mtimeMs - a.s.mtimeMs);
    let total = 0;
    for (const { f, s } of files) {
      total += s.size;
      if (total > maxMb * 1024 * 1024) rmSync(path.join(this.cfg.dir, f), { force: true });
    }
  }
}
