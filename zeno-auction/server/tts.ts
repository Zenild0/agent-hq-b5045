// Studio-quality announcer voices, made on the server with Google Cloud Text-to-Speech.
//
// Off unless GOOGLE_TTS_KEY is set in /etc/zenobid.env (a key the server owner creates and writes there
// themselves; never in the code, never on GitHub). Without it, screens fall back to the browser's own voices.
//
// Two kinds of voice, best first:
//  1. EXPRESSIVE (Gemini text-to-speech): an AI voice that takes a director's note with every line ("a breathless
//     bidding war", "a triumphant sale", "teasing the room"), so it laughs, roars, teases and celebrates like a real
//     host. Every host has a personality brief and every moment its own direction (shared/announcer.ts).
//  2. STUDIO (Chirp 3 HD and older neural voices): natural voices that read the line in one tone. Used whenever the
//     expressive voice is switched off, over its monthly allowance, slow or unavailable — automatically.
//
// Safety and cost:
//  - Screens never send text to be spoken. The server builds every sentence (and its direction) itself from the
//    auction's own events, so the key cannot be used to read out arbitrary text.
//  - Every sentence is made once and kept on disk (DATA_DIR/tts-cache); repeats cost nothing.
//  - Monthly character budgets: TTS_MONTHLY_CHARS (studio voices, default 300,000: inside Google's free allowance) and
//    TTS_EXPRESSIVE_MONTHLY_CHARS (expressive voices, default 40,000; a hard cap).
//  - The expressive voices are PAID per use, so they are OFF unless the owner adds TTS_EXPRESSIVE=on. By default
//    everything runs on the free studio voices.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AnnouncerStyle } from '../shared/announcer';

type HostStyle = Exclude<AnnouncerStyle, 'classic'>;

export interface TtsConfig {
  key: string;
  provider: 'google' | 'mock';
  dir: string;
  monthlyChars: number;
  voices: Record<HostStyle, string[]>;
  expressive: {
    on: boolean;
    model: string;
    monthlyChars: number;
    voices: Record<HostStyle, { lang: string; name: string }>;
  };
}

/** Studio voices to try, best first. If Google does not offer one (names change), the next is used. */
export const DEFAULT_VOICES: TtsConfig['voices'] = {
  kbc: ['hi-IN-Chirp3-HD-Charon', 'hi-IN-Chirp3-HD-Fenrir', 'hi-IN-Neural2-B', 'hi-IN-Wavenet-C', 'hi-IN-Standard-B'],
  // the most excitable free voice for the commentator
  cricket: ['hi-IN-Chirp3-HD-Fenrir', 'hi-IN-Chirp3-HD-Puck', 'hi-IN-Neural2-C', 'hi-IN-Wavenet-B', 'hi-IN-Standard-C'],
  // the deepest, most booming male voices for the ring announcer, the arena narrator and the trailer
  wwe: ['en-US-Chirp3-HD-Alnilam', 'en-US-Chirp3-HD-Orus', 'en-US-Chirp3-HD-Algenib', 'en-US-Neural2-D', 'en-US-Wavenet-D', 'en-US-Standard-D'],
  mk: ['en-US-Chirp3-HD-Algenib', 'en-US-Chirp3-HD-Charon', 'en-US-Neural2-D', 'en-US-Wavenet-B', 'en-US-Standard-B'],
  trailer: ['en-US-Chirp3-HD-Alnilam', 'en-US-Chirp3-HD-Iapetus', 'en-US-Neural2-D', 'en-US-Wavenet-D', 'en-US-Standard-B'],
  show: ['en-US-Chirp3-HD-Zephyr', 'en-US-Chirp3-HD-Aoede', 'en-US-Neural2-F', 'en-US-Wavenet-F', 'en-US-Standard-C'],
  velvet: ['en-US-Chirp3-HD-Sulafat', 'en-US-Chirp3-HD-Kore', 'en-US-Neural2-H', 'en-US-Wavenet-H', 'en-US-Standard-E'],
  assistant: ['en-IN-Chirp3-HD-Kore', 'en-IN-Chirp3-HD-Aoede', 'en-IN-Neural2-A', 'en-IN-Wavenet-A', 'en-IN-Standard-A'],
};

/** The expressive (Gemini) voice for each host: the same voice characters, now able to act. */
export const DEFAULT_EXPRESSIVE_VOICES: TtsConfig['expressive']['voices'] = {
  kbc: { lang: 'hi-IN', name: 'Charon' },
  cricket: { lang: 'hi-IN', name: 'Fenrir' },
  wwe: { lang: 'en-US', name: 'Alnilam' },
  mk: { lang: 'en-US', name: 'Algenib' },
  trailer: { lang: 'en-US', name: 'Alnilam' },
  show: { lang: 'en-US', name: 'Zephyr' },
  velvet: { lang: 'en-US', name: 'Sulafat' },
  assistant: { lang: 'en-IN', name: 'Kore' },
};

const lang = (voice: string) => voice.split('-').slice(0, 2).join('-');
const STYLES = Object.keys(DEFAULT_VOICES) as HostStyle[];

export function ttsConfigFromEnv(env: NodeJS.ProcessEnv, dataDir: string): TtsConfig | null {
  const provider = env.TTS_PROVIDER === 'mock' ? 'mock' : 'google';
  const key = env.GOOGLE_TTS_KEY ?? '';
  if (provider === 'google' && key.length < 20) return null; // switched off
  const list = (v: string | undefined, d: string[]) => (v ? [...v.split(',').map((x) => x.trim()).filter(Boolean), ...d] : d);
  const count = (v: string | undefined, d: number) => Math.max(0, Number(v ?? d) || 0);
  return {
    key,
    provider,
    dir: path.join(dataDir, 'tts-cache'),
    monthlyChars: count(env.TTS_MONTHLY_CHARS, 300_000),
    // TTS_VOICE_KBC, TTS_VOICE_SHOW, …: a studio voice of the owner's choice goes first for that host
    voices: Object.fromEntries(STYLES.map((s) => [s, list(env[`TTS_VOICE_${s.toUpperCase()}`], DEFAULT_VOICES[s])])) as TtsConfig['voices'],
    expressive: {
      // paid per use, so OFF unless the owner explicitly switches it on (TTS_EXPRESSIVE=on)
      on: /^(on|1|true|yes)$/i.test(env.TTS_EXPRESSIVE ?? ''),
      model: env.TTS_EXPRESSIVE_MODEL || 'gemini-2.5-flash-tts',
      monthlyChars: count(env.TTS_EXPRESSIVE_MONTHLY_CHARS, 40_000),
      // TTS_EXPRESSIVE_VOICE_CRICKET=Fenrir (or hi-IN:Fenrir) swaps a host's expressive voice
      voices: Object.fromEntries(
        STYLES.map((s) => {
          const v = env[`TTS_EXPRESSIVE_VOICE_${s.toUpperCase()}`];
          const d = DEFAULT_EXPRESSIVE_VOICES[s];
          if (!v) return [s, d];
          const [a, b] = v.includes(':') ? v.split(':') : [d.lang, v];
          return [s, { lang: a.trim(), name: b.trim() }];
        }),
      ) as TtsConfig['expressive']['voices'],
    },
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
export interface SpeakOptions {
  /** the director's note for the expressive voice (how to say it) */
  direction?: string;
  /** a bid or a call: must be heard quickly, so the expressive voice gets less time before the studio voice steps in */
  urgent?: boolean;
  /** speaking rate for the studio voices (1 = normal) */
  rate?: number;
}
export interface Spoken {
  audio: Buffer;
  type: string;
  /** which voice made it */
  kind: 'expressive' | 'studio';
}

const API = 'https://texttospeech.googleapis.com/v1/text:synthesize';

export class Tts {
  private inflight = new Map<string, Promise<Spoken>>();
  /** studio voices Google refused, so they are not tried again */
  private badVoices = new Set<string>();
  /** the expressive voice rests after a problem (ms timestamp), then is tried again */
  private expressiveRestUntil = 0;
  /** the last reason the expressive voice was not used (shown in the server's log once, never the key) */
  lastExpressiveError = '';

  constructor(private cfg: TtsConfig, private fetcher: Fetch = fetch, private now = () => new Date()) {
    mkdirSync(cfg.dir, { recursive: true });
  }

  get enabled() {
    return this.remaining() > 0 || this.expressiveRemaining() > 0;
  }

  // ---- monthly budgets ------------------------------------------------------------------------
  private usageFile() {
    return path.join(this.cfg.dir, 'usage.json');
  }
  private month() {
    return this.now().toISOString().slice(0, 7);
  }
  private usage(): { chars: number; ex: number } {
    try {
      const u = JSON.parse(readFileSync(this.usageFile(), 'utf8'));
      return u.month === this.month() ? { chars: Number(u.chars) || 0, ex: Number(u.ex) || 0 } : { chars: 0, ex: 0 };
    } catch {
      return { chars: 0, ex: 0 };
    }
  }
  /** Studio-voice characters used this month. */
  used(): number {
    return this.usage().chars;
  }
  /** Expressive-voice characters used this month. */
  expressiveUsed(): number {
    return this.usage().ex;
  }
  remaining() {
    return Math.max(0, this.cfg.monthlyChars - this.used());
  }
  expressiveRemaining() {
    return this.cfg.expressive.on ? Math.max(0, this.cfg.expressive.monthlyChars - this.expressiveUsed()) : 0;
  }
  private addUsage(kind: Spoken['kind'], chars: number) {
    const u = this.usage();
    if (kind === 'expressive') u.ex += chars;
    else u.chars += chars;
    const tmp = `${this.usageFile()}.tmp`;
    writeFileSync(tmp, JSON.stringify({ month: this.month(), ...u }));
    renameSync(tmp, this.usageFile());
  }

  // ---- the cache ----------------------------------------------------------------------------------
  private ext() {
    return this.cfg.provider === 'mock' ? 'wav' : 'mp3';
  }
  private studioFile(style: string, text: string, rate = 1) {
    const id = createHash('sha256').update(`${style}\n${rate === 1 ? '' : `${rate}\n`}${text}`).digest('hex').slice(0, 32);
    return path.join(this.cfg.dir, `${id}.${this.ext()}`);
  }
  private expressiveFile(style: HostStyle, text: string, direction: string) {
    const v = this.cfg.expressive.voices[style];
    const id = createHash('sha256').update(`x\n${this.cfg.expressive.model}\n${v.lang}:${v.name}\n${direction}\n${text}`).digest('hex').slice(0, 32);
    return path.join(this.cfg.dir, `x-${id}.${this.ext()}`);
  }

  /** Already made (costs nothing to serve again)? */
  has(style: HostStyle, text: string, opts: SpeakOptions = {}) {
    return (!!opts.direction && existsSync(this.expressiveFile(style, text, opts.direction))) || existsSync(this.studioFile(style, text, opts.rate ?? 1));
  }

  private expressiveReady(text: string) {
    return this.cfg.expressive.on && Date.now() >= this.expressiveRestUntil && text.length <= this.expressiveRemaining();
  }

  /**
   * The sentence as audio: the expressive recording if there is one (or it can be made now), otherwise the studio
   * recording. Throws only when neither can be had (the screen then stays quiet rather than sounding robotic).
   */
  async speak(style: HostStyle, text: string, opts: SpeakOptions = {}): Promise<Spoken> {
    const type = this.cfg.provider === 'mock' ? 'audio/wav' : 'audio/mpeg';
    const xFile = opts.direction ? this.expressiveFile(style, text, opts.direction) : '';
    if (xFile && existsSync(xFile)) return { audio: readFileSync(xFile), type, kind: 'expressive' };
    const sFile = this.studioFile(style, text, opts.rate ?? 1);
    const tryExpressive = !!opts.direction && this.expressiveReady(text);
    if (!tryExpressive && existsSync(sFile)) return { audio: readFileSync(sFile), type, kind: 'studio' };

    const jobKey = tryExpressive ? xFile : sFile;
    const running = this.inflight.get(jobKey);
    if (running) return running;
    const job = (async (): Promise<Spoken> => {
      if (tryExpressive) {
        try {
          const audio = this.cfg.provider === 'mock' ? mockWav(0.3) : await this.gemini(style, text, opts.direction!, opts.urgent ? 4500 : 9000);
          this.addUsage('expressive', text.length);
          writeFileSync(xFile, audio);
          return { audio, type, kind: 'expressive' };
        } catch (err) {
          this.restExpressive(err as Error);
        }
      }
      if (existsSync(sFile)) return { audio: readFileSync(sFile), type, kind: 'studio' };
      if (text.length > this.remaining()) throw new Error('monthly voice budget used up');
      const audio = this.cfg.provider === 'mock' ? mockWav() : await this.studio(style, text, opts.rate ?? 1);
      this.addUsage('studio', text.length);
      writeFileSync(sFile, audio);
      return { audio, type, kind: 'studio' };
    })().finally(() => this.inflight.delete(jobKey));
    this.inflight.set(jobKey, job);
    return job;
  }

  /** After a problem the expressive voice rests: an hour for a refusal (not enabled, wrong model), 2 minutes otherwise. */
  private restExpressive(err: Error & { status?: number }) {
    const refused = err.status === 400 || err.status === 403 || err.status === 404;
    this.expressiveRestUntil = Date.now() + (refused ? 3_600_000 : 120_000);
    const why = err.message.slice(0, 240);
    if (why !== this.lastExpressiveError) console.warn(`Expressive voice not used (${refused ? 'resting 1 h' : 'resting 2 min'}): ${why}. The studio voice speaks instead.`);
    this.lastExpressiveError = why;
  }

  private post(body: unknown, timeoutMs: number) {
    return this.fetcher(`${API}?key=${encodeURIComponent(this.cfg.key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  /** The expressive (Gemini) voice: the text, plus a director's note on how to say it. */
  private async gemini(style: HostStyle, text: string, direction: string, timeoutMs: number): Promise<Buffer> {
    const v = this.cfg.expressive.voices[style];
    let res: Response;
    try {
      res = await this.post({ input: { prompt: direction, text }, voice: { languageCode: v.lang, name: v.name, modelName: this.cfg.expressive.model }, audioConfig: { audioEncoding: 'MP3' } }, timeoutMs);
    } catch (e) {
      throw Object.assign(new Error(`no answer in time (${(e as Error).name})`), { status: 0 });
    }
    if (!res.ok) {
      const msg = (await res.text().catch(() => '')).replace(/\s+/g, ' ');
      throw Object.assign(new Error(`${res.status} ${msg.slice(0, 200)}`), { status: res.status });
    }
    const body = (await res.json()) as { audioContent?: string };
    if (!body.audioContent) throw Object.assign(new Error('empty answer'), { status: 0 });
    return Buffer.from(body.audioContent, 'base64');
  }

  /** The studio voices, best first. */
  private async studio(style: HostStyle, text: string, rate: number): Promise<Buffer> {
    let lastError = 'no voice available';
    for (const name of this.cfg.voices[style]) {
      if (this.badVoices.has(name)) continue;
      const res = await this.post({ input: { text }, voice: { languageCode: lang(name), name }, audioConfig: { audioEncoding: 'MP3', ...(rate !== 1 ? { speakingRate: rate } : {}) } }, 8000);
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
  prune(maxMb = 80) {
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
