import { useEffect, useRef, useState } from 'react';
import { formatMoney, spokenMoney } from '../../../shared/money';
import { SAMPLE_CTX, announce, heatOf, hostsEverything, isStyle, momentCtx, type AnnouncerStyle, type SpeechLine } from '../../../shared/announcer';
import { englishVoices, isFemaleVoice, pickStyleVoice, pickVoice } from '../../../shared/voice';
import type { Snapshot } from '../../../shared/types';
import { fmtDuration } from './useCountdown';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

let fxBus: GainNode | null = null;
/** Where the beeps, bells and gongs go: turned down while the announcer is talking, so the words stay clear. */
function fxOut(c: AudioContext): AudioNode {
  if (!fxBus || fxBus.context !== c) {
    fxBus = c.createGain();
    fxBus.connect(c.destination);
  }
  return fxBus;
}
function duck(seconds: number) {
  const c = audio();
  if (!c || !fxBus) return;
  const g = fxBus.gain, t = c.currentTime;
  g.cancelScheduledValues(t);
  g.setTargetAtTime(0.3, t, 0.04);
  g.setTargetAtTime(1, t + seconds, 0.2);
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.18, delay = 0, slideTo?: number) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(fxOut(c));
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, gain = 0.3, delay = 0) {
  const c = audio();
  if (!c) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(fxOut(c));
  src.start(c.currentTime + delay);
}

export const sfx = {
  unlock: () => void audio(),
  tick: () => tone(1400, 0.03, 'square', 0.05),
  bid: () => {
    tone(880, 0.12, 'triangle', 0.2);
    tone(1320, 0.18, 'triangle', 0.16, 0.08);
  },
  call: (n: number) => {
    // wood-block knocks: one, two or three
    for (let i = 0; i < n; i++) {
      tone(220, 0.09, 'square', 0.25, i * 0.22, 90);
      noise(0.05, 0.2, i * 0.22);
    }
  },
  reveal: () => {
    tone(523, 0.12, 'triangle', 0.18);
    tone(659, 0.12, 'triangle', 0.18, 0.1);
    tone(784, 0.25, 'triangle', 0.2, 0.2);
  },
  sold: () => {
    // gavel slam + fanfare
    tone(140, 0.35, 'sine', 0.5, 0, 50);
    noise(0.18, 0.5);
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.16, 0.3 + i * 0.11));
  },
  unsold: () => {
    tone(330, 0.25, 'sawtooth', 0.12);
    tone(220, 0.45, 'sawtooth', 0.12, 0.2, 150);
  },
};

// ---- sound effects for the announcer styles --------------------------------------------------------

const bell = (delay = 0, f = 1760) => {
  tone(f, 0.9, 'triangle', 0.25, delay);
  tone(f * 1.5, 0.6, 'sine', 0.12, delay);
};
const gong = (delay = 0) => {
  tone(65, 1.6, 'sine', 0.55, delay, 38);
  tone(130, 1.1, 'triangle', 0.18, delay + 0.02, 70);
  noise(0.5, 0.35, delay);
};
type FxSet = { bid: (heat?: number) => void; call: (n: number) => void; reveal: () => void; sold: () => void; unsold: () => void };
/** Arena bells and horns / a quiz-show heartbeat / gongs and war drums. All made in the browser: no recordings. */
const styleSfx: Record<Exclude<AnnouncerStyle, 'classic'>, FxSet> = {
  wwe: {
    bid: (h = 0) => (bell(), noise(0.25 + h * 0.2, 0.18 + h * 0.06)), // the crowd gets louder
    call: (n) => Array.from({ length: n }, (_, i) => bell(i * 0.28, 1400)),
    reveal: () => ([220, 277, 330].forEach((f) => tone(f, 0.6, 'sawtooth', 0.12)), noise(0.6, 0.15)),
    sold: () => (bell(0), bell(0.25), bell(0.5), noise(0.7, 0.3, 0.1)),
    unsold: () => tone(300, 0.7, 'sawtooth', 0.14, 0, 100),
  },
  kbc: {
    // a heartbeat that beats faster and more often as the bidding heats up
    bid: (h = 0) => Array.from({ length: 1 + h }, (_, i) => { const d = i * (0.42 - h * 0.06); tone(70, 0.16, 'sine', 0.42, d, 50); tone(64, 0.16, 'sine', 0.3, d + 0.18 - h * 0.02, 46); }),
    call: (n) => Array.from({ length: n }, (_, i) => (tone(60, 0.18, 'sine', 0.5, i * 0.5, 45), tone(60, 0.18, 'sine', 0.35, i * 0.5 + 0.22, 45))),
    reveal: () => [262, 330, 392, 523].forEach((f, i) => tone(f, 0.4, 'triangle', 0.16, i * 0.1)),
    sold: () => ([262, 330, 392, 523].forEach((f, i) => tone(f, 0.5, 'triangle', 0.18, i * 0.09)), tone(131, 0.9, 'sine', 0.3)),
    unsold: () => tone(147, 0.8, 'sine', 0.25, 0, 98),
  },
  mk: {
    bid: (h = 0) => (gong(), Array.from({ length: h * 2 }, (_, i) => tone(75, 0.18, 'sine', 0.55, 0.5 + i * 0.16, 35))), // war drums join in
    call: (n) => Array.from({ length: n }, (_, i) => (tone(75, 0.2, 'sine', 0.7, i * 0.26, 35), noise(0.08, 0.3, i * 0.26))),
    reveal: () => (gong(), tone(98, 0.8, 'sawtooth', 0.15, 0.1, 49)),
    sold: () => (gong(), [196, 147, 98, 65].forEach((f, i) => tone(f, 0.45, 'sawtooth', 0.18, 0.4 + i * 0.18)), noise(0.9, 0.4)),
    unsold: () => (tone(80, 1.0, 'sawtooth', 0.2, 0, 40), noise(0.4, 0.2)),
  },
  show: {
    // "ding!" — more dings as it heats up; a ticking clock for the calls; a sad trombone for no sale
    bid: (h = 0) => Array.from({ length: 1 + Math.min(h, 2) }, (_, i) => (tone(1568, 0.35, 'sine', 0.2, i * 0.14), tone(2093, 0.3, 'sine', 0.1, i * 0.14 + 0.02))),
    call: (n) => Array.from({ length: n * 2 }, (_, i) => tone(i % 2 ? 900 : 1200, 0.05, 'square', 0.06, i * 0.25)),
    reveal: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.15, i * 0.07)),
    sold: () => ([523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, 'square', 0.08, i * 0.1)), [1047, 1319, 1568].forEach((f) => tone(f, 0.9, 'triangle', 0.1, 0.45)), noise(0.8, 0.12, 0.45)),
    unsold: () => [392, 370, 349, 311].forEach((f, i) => tone(f, i === 3 ? 0.8 : 0.3, 'sawtooth', 0.1, i * 0.32, i === 3 ? 280 : undefined)),
  },
  velvet: {
    // soft vibraphone notes
    bid: (h = 0) => [659, 784, 988].slice(0, 1 + Math.min(h, 2)).forEach((f, i) => tone(f, 1.2, 'sine', 0.12, i * 0.18)),
    call: (n) => Array.from({ length: n }, (_, i) => tone(440, 0.9, 'sine', 0.1, i * 0.4)),
    reveal: () => [440, 554, 659].forEach((f, i) => tone(f, 1.4, 'sine', 0.09, i * 0.12)),
    sold: () => [440, 554, 659, 880].forEach((f, i) => tone(f, 1.8, 'sine', 0.09, i * 0.1)),
    unsold: () => tone(330, 1.2, 'sine', 0.1, 0, 247),
  },
  trailer: {
    // the deep cinema "braam", with more hits as the stakes rise
    bid: (h = 0) => Array.from({ length: 1 + Math.min(h, 2) }, (_, i) => (tone(55, 1.4, 'sawtooth', 0.22, i * 0.55, 41), tone(110, 1.0, 'sawtooth', 0.08, i * 0.55), noise(0.3, 0.2, i * 0.55))),
    call: (n) => Array.from({ length: n }, (_, i) => (tone(60, 0.5, 'sine', 0.5, i * 0.5, 40), noise(0.1, 0.25, i * 0.5))),
    reveal: () => (noise(1.2, 0.12), tone(110, 1.2, 'sawtooth', 0.06, 0, 440), tone(49, 1.8, 'sawtooth', 0.22, 1.1, 37)),
    sold: () => (tone(49, 2.2, 'sawtooth', 0.26, 0, 33), tone(98, 1.6, 'sawtooth', 0.1), noise(0.5, 0.3), tone(49, 2.2, 'sawtooth', 0.22, 0.9, 33)),
    unsold: () => tone(65, 1.6, 'sine', 0.3, 0, 40),
  },
  cricket: {
    // the crack of the bat, and a crowd that roars louder with each bid
    bid: (h = 0) => (noise(0.04, 0.6), tone(1800, 0.05, 'square', 0.12), noise(0.6 + h * 0.4, 0.08 + h * 0.06, 0.08)),
    call: (n) => Array.from({ length: n }, (_, i) => (tone(2600, 0.25, 'sine', 0.08, i * 0.35), tone(2900, 0.25, 'sine', 0.06, i * 0.35))),
    reveal: () => (noise(1.0, 0.12), tone(2800, 0.5, 'sine', 0.06, 0.3)),
    sold: () => (noise(0.04, 0.6), noise(1.6, 0.3, 0.05), [523, 659, 784].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, 0.2 + i * 0.1))),
    unsold: () => (noise(0.9, 0.1), tone(200, 0.7, 'sine', 0.12, 0, 120)),
  },
  assistant: {
    // gentle chimes
    bid: () => (tone(988, 0.18, 'sine', 0.12), tone(1319, 0.22, 'sine', 0.1, 0.09)),
    call: (n) => Array.from({ length: n }, (_, i) => tone(784, 0.15, 'sine', 0.1, i * 0.25)),
    reveal: () => [659, 988].forEach((f, i) => tone(f, 0.25, 'sine', 0.1, i * 0.12)),
    sold: () => [659, 831, 988, 1319].forEach((f, i) => tone(f, 0.35, 'sine', 0.11, i * 0.09)),
    unsold: () => tone(523, 0.4, 'sine', 0.1, 0, 392),
  },
};
const effects = (style: AnnouncerStyle): FxSet => (style === 'classic' ? sfx : styleSfx[style]);

// ---- the announcer's voice: a clear female English voice by default, changeable ----------------

type Voice = SpeechSynthesisVoice;
const voiceListeners = new Set<() => void>();
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  // Chrome loads its voice list asynchronously; tell everyone when it arrives
  window.speechSynthesis.addEventListener?.('voiceschanged', () => voiceListeners.forEach((f) => f()));
}
const allVoices = (): Voice[] => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []);

/** The English voices installed on this computer, best (female) first, and the one that will be used. */
export function useVoices(preferred?: string) {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    voiceListeners.add(f);
    return () => void voiceListeners.delete(f);
  }, []);
  const voices = englishVoices(allVoices());
  const active = pickVoice(voices, preferred);
  return { voices, active };
}

export function speak(text: string, preferredVoice?: string) {
  if (!('speechSynthesis' in window)) return;
  turn++; // anything still on its way is no longer wanted
  hush();
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(englishVoices(synth.getVoices()), preferredVoice);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-IN';
  u.rate = 1.04;
  // a touch brighter for an upbeat announcer; lifted more if only a male voice is installed
  u.pitch = voice && !isFemaleVoice(voice) ? 1.3 : 1.08;
  synth.speak(u);
}

/**
 * Speaks one line of a style. Each style has its own pace and depth, and a male voice if the device has one.
 * A Hindi line needs a Hindi voice; if there is none, the same words in Latin letters are read by an Indian-English voice.
 */
export function speakLine(line: SpeechLine) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = synth.getVoices();
  let text = line.text;
  let lang: 'en' | 'hi' = line.lang;
  let voice = pickStyleVoice(voices, lang, line.gender ?? 'male');
  if (line.lang === 'hi') {
    // A male host needs a male voice. If the only Hindi voice is female, a male Indian-English voice reading the same
    // words in Latin letters sounds far better than a female voice forced down (which sounds like an old woman).
    const indianEnglish = voices.filter((v) => /en[-_]in/i.test(v.lang));
    const gender = line.gender ?? 'male';
    const english = pickStyleVoice(indianEnglish.length ? indianEnglish : voices, 'en', gender);
    const wrongGender = (v: SpeechSynthesisVoice) => isFemaleVoice(v) !== (gender === 'female');
    if (!voice || (wrongGender(voice) && english && !wrongGender(english))) {
      text = line.alt ?? line.text;
      lang = 'en';
      voice = english;
    }
  }
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? (lang === 'hi' ? 'hi-IN' : 'en-IN');
  // never push a female voice deep: it only sounds strange. Keep her natural, a little slower for drama.
  const female = voice ? isFemaleVoice(voice) : false;
  u.rate = female ? Math.min(1.05, Math.max(0.9, line.rate ?? 1)) : (line.rate ?? 1);
  u.pitch = female ? 1 : (line.pitch ?? 1);
  synth.speak(u);
}

// ---- studio voices from the server (when it has them), played through each style's sound stage ----------------

let serverVoice: boolean | null = null;
/** Whether this server makes studio voices (asked once per page). */
async function studioVoices(): Promise<boolean> {
  if (serverVoice !== null) return serverVoice;
  try {
    const r = await fetch('/api/platform', { cache: 'no-store' });
    serverVoice = !!(await r.json()).voice;
  } catch {
    serverVoice = false;
  }
  return serverVoice;
}

function impulse(c: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}
/** The room each style is heard in: an arena, a TV studio, a dark temple. Hotter bidding = a little faster and louder. */
const STAGE = {
  wwe: { rate: 1.0, verb: 2.2, wet: 0.26, bass: 3, drive: 0, gain: 1.1 },
  kbc: { rate: 1.0, verb: 1.2, wet: 0.16, bass: 4, drive: 0, gain: 1.05 },
  mk: { rate: 0.9, verb: 3.2, wet: 0.4, bass: 6, drive: 0.3, gain: 1.15 },
  show: { rate: 1.0, verb: 1.0, wet: 0.14, bass: 1, drive: 0, gain: 1.05 },
  velvet: { rate: 0.97, verb: 1.6, wet: 0.2, bass: 3, drive: 0, gain: 1.0 },
  trailer: { rate: 0.93, verb: 3.0, wet: 0.34, bass: 7, drive: 0.12, gain: 1.15 },
  cricket: { rate: 1.0, verb: 2.6, wet: 0.24, bass: 2, drive: 0, gain: 1.1 },
  assistant: { rate: 1.0, verb: 0.6, wet: 0.06, bass: 0, drive: 0, gain: 1.0 },
} as const;
/** the line playing now (one at a time: a new line fades the old one out) */
let current: { src: AudioBufferSourceNode; out: GainNode } | null = null;
/** bumps with every new announcement; a recording that arrives late for an older one is dropped */
let turn = 0;

function hush() {
  const c = audio();
  if (current && c) {
    const { src, out } = current;
    out.gain.setTargetAtTime(0, c.currentTime, 0.05); // a quick fade, not a click
    try {
      src.stop(c.currentTime + 0.25);
    } catch {
      /* already ended */
    }
  }
  current = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function playStaged(buf: AudioBuffer, style: Exclude<AnnouncerStyle, 'classic'>, heat = 0) {
  const c = audio();
  if (!c) return;
  hush();
  const P = STAGE[style];
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = P.rate + heat * 0.02; // slower = deeper; the host speeds up as the excitement builds
  const bass = c.createBiquadFilter();
  bass.type = 'lowshelf';
  bass.frequency.value = 180;
  bass.gain.value = P.bass;
  let tail: AudioNode = bass;
  src.connect(bass);
  if (P.drive > 0) {
    const shaper = c.createWaveShaper();
    const k = P.drive * 60;
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / curve.length) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    shaper.curve = curve;
    bass.connect(shaper);
    tail = shaper;
  }
  const comp = c.createDynamicsCompressor();
  tail.connect(comp);
  const out = c.createGain(); // everything of this line, echo included, so it can be faded as one
  out.gain.value = 1;
  out.connect(c.destination);
  const dry = c.createGain();
  dry.gain.value = P.gain + heat * 0.08;
  const verb = c.createConvolver();
  verb.buffer = impulse(c, P.verb, 2.6);
  const wet = c.createGain();
  wet.gain.value = P.wet;
  comp.connect(dry).connect(out);
  comp.connect(verb).connect(wet).connect(out);
  src.start();
  duck(buf.duration / src.playbackRate.value);
  current = { src, out };
  src.onended = () => {
    if (current?.src === src) current = null;
  };
}

/**
 * Says one line: the studio recording from the server when it has one, otherwise this device's own voice.
 * Only the newest line is ever heard: whatever was playing stops, and a recording that arrives too late is dropped.
 */
function sayLine(line: SpeechLine, url: string, style: Exclude<AnnouncerStyle, 'classic'>, heat: number) {
  const my = ++turn;
  void (async () => {
    const c = audio();
    if (c && (await studioVoices())) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const buf = await c.decodeAudioData(await res.arrayBuffer());
          if (my === turn) playStaged(buf, style, heat);
          return;
        }
      } catch {
        /* fall through to the device voice */
      }
    }
    if (my !== turn) return;
    hush();
    speakLine(line);
  })();
}

/** What the "Hear it" button plays: a bidding war in the chosen style. */
export function previewAnnouncer(style: AnnouncerStyle, voiceName?: string) {
  const line = announce(style, 'bid', SAMPLE_CTX);
  const heat = heatOf(SAMPLE_CTX);
  effects(style).bid(heat);
  if (!line) return;
  if (style === 'classic') return speak(line.text, voiceName);
  sayLine(line, `/api/voice-sample/${style}`, style, heat);
}

// ---- one announcer per browser ---------------------------------------------------------------------
// The big screen, the admin page and the auctioneer page can be open side by side in one browser. Only one of them
// may speak (and ring) for each moment, or the voices pile on top of each other. The big screen goes first.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function claimMoment(code: string, seq: number, primary: boolean): Promise<boolean> {
  if (!primary) await sleep(300);
  const key = `zeno:said:${code}`;
  const take = () => {
    try {
      const [last, at] = (localStorage.getItem(key) ?? '0:0').split(':').map(Number);
      if (last >= seq && Date.now() - at < 600_000) return false;
      localStorage.setItem(key, `${seq}:${Date.now()}`);
    } catch {
      /* storage blocked: every tab speaks for itself */
    }
    return true;
  };
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return take();
  try {
    return await locks.request(`zeno-say:${code}`, async () => take());
  } catch {
    return take();
  }
}

// ---------------------------------------------------------------------------------------------

export interface SoundPrefs {
  sfx: boolean;
  voice: boolean;
  /** the announcer voice the person picked (empty = best female voice) */
  voiceName?: string;
  /** how the announcer talks: classic, WWE hype, KBC host (Hindi) or Mortal Kombat */
  style?: AnnouncerStyle;
}

const PREF_KEY = 'zeno:sound';

export function useSoundPrefs(defaults: SoundPrefs = { sfx: false, voice: false }) {
  const [prefs, setPrefs] = useState<SoundPrefs>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}');
      return { ...defaults, ...saved, style: isStyle(saved.style) ? saved.style : 'classic' };
    } catch {
      return defaults;
    }
  });
  const update = (patch: Partial<SoundPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
      if (next.sfx || next.voice) sfx.unlock();
      return next;
    });
  };
  return [prefs, update] as const;
}

/**
 * Plays the auction's sound track from the server's event stream: bid pings, "going once…",
 * the gavel on SOLD. Each browser decides for itself whether to make noise.
 */
export function useAuctionSound(snap: Snapshot | null, prefs: SoundPrefs, opts: { primary?: boolean } = {}) {
  const lastSeq = useRef<number | null>(null);
  useEffect(() => {
    if (!snap) return;
    const ev = snap.live.lastEvent;
    if (lastSeq.current === null) {
      lastSeq.current = snap.live.seq; // don't replay history on first load
      return;
    }
    if (!ev || ev.seq === lastSeq.current) return;
    lastSeq.current = ev.seq;
    if (snap.now - ev.at > 15_000) return; // stale (e.g. tab was asleep) — don't replay old calls
    if (!prefs.sfx && !prefs.voice) return;

    const style = prefs.style ?? 'classic';
    const say = (text: string) => prefs.voice && speak(text, prefs.voiceName);
    const ctx = momentCtx(snap, ev);
    const heat = heatOf(ctx);
    /** speaks the style's line for this kind of moment (classic keeps the original voice) */
    const sayStyled = (kind: Parameters<typeof announce>[1]) => {
      if (!prefs.voice) return;
      const line = announce(style, kind, ctx);
      if (!line) return;
      if (style === 'classic') return speak(line.text, prefs.voiceName);
      sayLine(line, `/api/events/${encodeURIComponent(snap.code)}/voice/${ev.seq}?style=${style}`, style, heat);
    };
    const fx = prefs.sfx ? effects(style) : null;
    /** the chosen host runs every part of the auction; classic keeps its original plain announcements */
    const hosted = hostsEverything(style);

    void claimMoment(snap.code, ev.seq, !!opts.primary).then((mine) => {
      if (!mine) return; // another tab in this browser is the announcer for this moment
      switch (ev.type) {
        case 'spin':
          fx?.reveal();
          if (hosted) sayStyled('spin');
          break;
        case 'reveal':
          fx?.reveal();
          sayStyled('reveal');
          break;
        case 'bid':
          fx?.bid(heat);
          sayStyled('bid'); // "who bid how much"
          break;
        case 'call':
          fx?.call(ev.call ?? 1);
          sayStyled('call');
          break;
        case 'sold':
          fx?.sold();
          sayStyled('sold');
          break;
        case 'unsold':
          fx?.unsold();
          sayStyled('unsold');
          break;
        case 'undo':
          if (hosted) sayStyled('undo');
          break;
        case 'round':
          fx?.reveal();
          if (hosted) sayStyled('round');
          break;
        case 'break':
          if (prefs.sfx) sfx.reveal();
          if (hosted) sayStyled('break');
          else say(`${snap.live.break?.label ?? 'Strategy break'}. ${fmtDuration(ev.amount ?? 60)}.`);
          break;
        case 'breakext':
          if (hosted) sayStyled('breakext');
          else say(`Break extended by ${fmtDuration(ev.amount ?? 60)}.`);
          break;
        case 'breakend':
          if (prefs.sfx) sfx.reveal();
          if (hosted) sayStyled('breakend');
          else say('The break is over. Back to the auction!');
          break;
      }
    });
  }, [snap, prefs, opts.primary]);
}

export const money = (n: number, snap: Pick<Snapshot, 'settings'>) => formatMoney(n, snap.settings);
