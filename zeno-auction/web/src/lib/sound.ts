import { useEffect, useRef, useState } from 'react';
import { formatMoney, spokenMoney } from '../../../shared/money';
import { announce, isStyle, type AnnouncerStyle, type SpeechLine } from '../../../shared/announcer';
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
  osc.connect(g).connect(c.destination);
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
  src.connect(g).connect(c.destination);
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
type FxSet = { bid: () => void; call: (n: number) => void; reveal: () => void; sold: () => void; unsold: () => void };
/** Arena bells and horns / a quiz-show heartbeat / gongs and war drums. All made in the browser: no recordings. */
const styleSfx: Record<Exclude<AnnouncerStyle, 'classic'>, FxSet> = {
  wwe: {
    bid: () => (bell(), noise(0.25, 0.18)),
    call: (n) => Array.from({ length: n }, (_, i) => bell(i * 0.28, 1400)),
    reveal: () => ([220, 277, 330].forEach((f) => tone(f, 0.6, 'sawtooth', 0.12)), noise(0.6, 0.15)),
    sold: () => (bell(0), bell(0.25), bell(0.5), noise(0.7, 0.3, 0.1)),
    unsold: () => tone(300, 0.7, 'sawtooth', 0.14, 0, 100),
  },
  kbc: {
    bid: () => (tone(98, 0.5, 'sine', 0.35, 0, 70), tone(196, 0.35, 'triangle', 0.12, 0.02)),
    call: (n) => Array.from({ length: n }, (_, i) => (tone(60, 0.18, 'sine', 0.5, i * 0.5, 45), tone(60, 0.18, 'sine', 0.35, i * 0.5 + 0.22, 45))),
    reveal: () => [262, 330, 392, 523].forEach((f, i) => tone(f, 0.4, 'triangle', 0.16, i * 0.1)),
    sold: () => ([262, 330, 392, 523].forEach((f, i) => tone(f, 0.5, 'triangle', 0.18, i * 0.09)), tone(131, 0.9, 'sine', 0.3)),
    unsold: () => tone(147, 0.8, 'sine', 0.25, 0, 98),
  },
  mk: {
    bid: () => gong(),
    call: (n) => Array.from({ length: n }, (_, i) => (tone(75, 0.2, 'sine', 0.7, i * 0.26, 35), noise(0.08, 0.3, i * 0.26))),
    reveal: () => (gong(), tone(98, 0.8, 'sawtooth', 0.15, 0.1, 49)),
    sold: () => (gong(), [196, 147, 98, 65].forEach((f, i) => tone(f, 0.45, 'sawtooth', 0.18, 0.4 + i * 0.18)), noise(0.9, 0.4)),
    unsold: () => (tone(80, 1.0, 'sawtooth', 0.2, 0, 40), noise(0.4, 0.2)),
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
  if (line.lang === 'hi' && !voice) {
    text = line.alt ?? line.text;
    lang = 'en';
    voice = pickStyleVoice(voices.filter((v) => /en[-_]in/i.test(v.lang)).length ? voices.filter((v) => /en[-_]in/i.test(v.lang)) : voices, 'en', line.gender ?? 'male');
  }
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? (lang === 'hi' ? 'hi-IN' : 'en-IN');
  u.rate = line.rate ?? 1;
  u.pitch = line.pitch ?? 1;
  synth.speak(u);
}

/** What the "Hear it" button plays: a bid in the chosen style. */
export function previewAnnouncer(style: AnnouncerStyle, voiceName?: string) {
  const fmt = { symbol: '₹', moneyStyle: 'indian' as const };
  const line = announce(style, 'bid', { team: 'Thunder Hawks', amount: 12_000_000, fmt, variant: 0 });
  effects(style).bid();
  if (!line) return;
  if (style === 'classic') speak(line.text, voiceName);
  else setTimeout(() => speakLine(line), 350);
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
export function useAuctionSound(snap: Snapshot | null, prefs: SoundPrefs) {
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

    const fmt = snap.settings;
    const player = snap.players.find((p) => p.id === ev.playerId);
    const team = snap.captains.find((c) => c.id === ev.captainId);
    const style = prefs.style ?? 'classic';
    const say = (text: string) => prefs.voice && speak(text, prefs.voiceName);
    const ctx = { team: team?.team, player: player?.name, amount: ev.amount, call: ev.call, fmt, variant: ev.seq };
    /** speaks the style's line for this kind of moment (classic keeps the original voice) */
    const sayStyled = (kind: Parameters<typeof announce>[1], amount = ev.amount) => {
      if (!prefs.voice) return;
      const line = announce(style, kind, { ...ctx, amount });
      if (!line) return;
      if (style === 'classic') speak(line.text, prefs.voiceName);
      else speakLine(line);
    };
    const fx = prefs.sfx ? effects(style) : null;

    switch (ev.type) {
      case 'spin':
        fx?.reveal();
        break;
      case 'reveal':
        fx?.reveal();
        if (player) sayStyled('reveal', player.basePrice || snap.settings.defaultBasePrice);
        break;
      case 'bid':
        fx?.bid();
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
      case 'break':
        if (prefs.sfx) sfx.reveal();
        say(`${snap.live.break?.label ?? 'Strategy break'}. ${fmtDuration(ev.amount ?? 60)}.`);
        break;
      case 'breakext':
        say(`Break extended by ${fmtDuration(ev.amount ?? 60)}.`);
        break;
      case 'breakend':
        if (prefs.sfx) sfx.reveal();
        say('The break is over. Back to the auction!');
        break;
    }
  }, [snap, prefs]);
}

export const money = (n: number, snap: Pick<Snapshot, 'settings'>) => formatMoney(n, snap.settings);
