import { useEffect, useState } from 'react';
import type { Snapshot } from '../../../shared/types';

export interface Tempo {
  bpm: number;
  label: string;
  /** seconds per beat — feed to the --beat CSS variable */
  beat: number;
  /** 0 (calm) … 1 (frenzy) */
  intensity: number;
}

const calm = (bpm: number, label: string): Tempo => ({ bpm, label, beat: 60 / bpm, intensity: Math.max(0, Math.min(1, (bpm - 50) / 130)) });

/**
 * The "heartbeat" of the room. It idles slow, quickens with every bid in the last few seconds,
 * races through going once / twice / thrice, and settles after the hammer falls.
 */
export function tempoOf(snap: Snapshot, now: number): Tempo {
  const { live } = snap;
  if (live.break) return calm(48, 'BREAK');
  if (live.phase === 'spinning') return calm(118, 'SPINNING');
  if (live.phase === 'sold') return calm(46, 'SOLD');
  if (live.phase === 'unsold') return calm(52, 'NO SALE');
  if (live.phase === 'idle') return calm(58, 'WARMING UP');
  // bidding
  if (live.call === 3) return calm(172, 'FINAL CALL');
  if (live.call === 2) return calm(150, 'GOING TWICE');
  if (live.call === 1) return calm(132, 'GOING ONCE');
  const recent = live.bids.filter((b) => now - b.at < 15_000).length;
  const bpm = 68 + Math.min(8, recent) * 11;
  return calm(bpm, bpm < 84 ? 'WARM' : bpm < 112 ? 'HEATING UP' : bpm < 140 ? 'HOT' : 'FRENZY');
}

/** Recomputes every second so the tempo eases back down when the bidding goes quiet. */
export function useTempo(snap: Snapshot | null, serverNow: () => number): Tempo {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return snap ? tempoOf(snap, serverNow()) : calm(58, 'WARMING UP');
}
