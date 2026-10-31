import { useEffect, useRef, useState } from 'react';
import { formatMoney, spokenMoney } from '../../../shared/money';
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

export function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  u.voice = voices.find((v) => v.lang === 'en-IN') ?? voices.find((v) => v.lang.startsWith('en')) ?? null;
  u.rate = 1.02;
  u.pitch = 0.95;
  synth.speak(u);
}

// ---------------------------------------------------------------------------------------------

export interface SoundPrefs {
  sfx: boolean;
  voice: boolean;
}

const PREF_KEY = 'zeno:sound';

export function useSoundPrefs(defaults: SoundPrefs = { sfx: false, voice: false }) {
  const [prefs, setPrefs] = useState<SoundPrefs>(() => {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') };
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
    const say = (text: string) => prefs.voice && speak(text);

    switch (ev.type) {
      case 'spin':
        if (prefs.sfx) sfx.reveal();
        break;
      case 'reveal':
        if (prefs.sfx) sfx.reveal();
        if (player) say(`Up next, ${player.name}. Base price ${spokenMoney(player.basePrice || snap.settings.defaultBasePrice, fmt)}.`);
        break;
      case 'bid':
        if (prefs.sfx) sfx.bid();
        if (team && ev.amount) say(`${team.team}, ${spokenMoney(ev.amount, fmt)}`);
        break;
      case 'call':
        if (prefs.sfx) sfx.call(ev.call ?? 1);
        say(['', 'Going once!', 'Going twice!', 'Going thrice! Last call!'][ev.call ?? 1]);
        break;
      case 'sold':
        if (prefs.sfx) sfx.sold();
        if (player && team && ev.amount) say(`Sold! ${player.name} goes to ${team.team} for ${spokenMoney(ev.amount, fmt)}`);
        break;
      case 'unsold':
        if (prefs.sfx) sfx.unsold();
        if (player) say(`${player.name} goes unsold`);
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
