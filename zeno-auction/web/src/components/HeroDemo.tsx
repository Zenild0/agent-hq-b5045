import { useEffect, useState } from 'react';
import { formatMoney } from '../../../shared/money';
import { Heartbeat } from './Heartbeat';
import { tempoOf } from '../lib/tempo';
import type { Snapshot } from '../../../shared/types';

const FMT = { symbol: '₹', moneyStyle: 'indian' as const };
const TEAMS = [
  { name: 'Royal Rockets', color: '#ff6b8b' },
  { name: 'Thunder Hawks', color: '#5cc8ff' },
  { name: 'Neon Ninjas', color: '#f2b84b' },
];
// each step: who bid what (index into TEAMS), then the going-once/twice/thrice calls, then SOLD
const BIDS: [number, number][] = [[1, 20], [0, 25], [1, 30], [2, 35], [1, 40], [0, 45], [1, 50]];
const STEPS = BIDS.length + 4; // bids + once + twice + thrice + sold + pause

/** A looping, self-playing mini-auction for the landing page: shows the whole product in seconds. */
export function HeroDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % (STEPS + 1)), 1250);
    return () => clearInterval(id);
  }, []);

  const bidsShown = Math.min(step + 1, BIDS.length);
  const bids = BIDS.slice(0, bidsShown);
  const top = bids[bids.length - 1];
  const call = step >= BIDS.length ? Math.min(3, step - BIDS.length + 1) : 0;
  const sold = step >= BIDS.length + 3;
  const best = TEAMS.map((_, i) => Math.max(0, ...bids.filter((b) => b[0] === i).map((b) => b[1])));

  const bpm = sold ? 46 : call ? 120 + call * 20 : 66 + bidsShown * 11;
  const tempo = { bpm, label: '', beat: 60 / bpm, intensity: Math.min(1, (bpm - 50) / 130) } as ReturnType<typeof tempoOf>;
  const leader = TEAMS[top[0]];

  return (
    <div className="relative mx-auto w-full max-w-[520px] animate-floaty" style={{ ['--beat' as string]: `${60 / bpm}s` } as React.CSSProperties}>
      <div className="absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,rgba(47,107,255,0.35),transparent)] blur-2xl" />
      <div className="card overflow-hidden p-0 shadow-[0_50px_90px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(242,184,75,0.12)]">
        <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live
          </span>
          <Heartbeat tempo={tempo} color={call === 3 ? '#ff5c7a' : '#f2b84b'} className="h-7 min-w-0 flex-1" />
          <span className="num text-[11px] font-bold text-slate-400">{bpm} BPM</span>
        </div>

        <div className="relative px-5 pb-5 pt-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Now bidding</p>
              <h3 className="truncate font-stage text-5xl font-extrabold uppercase leading-[0.95]">Aarav Mehta</h3>
              <p className="mt-0.5 text-xs text-slate-400">All-rounder · base ₹20 L</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{sold ? 'Sold for' : 'Current bid'}</p>
              <div key={top[1]} className="animate-bump font-display text-4xl font-extrabold leading-none" style={{ color: leader.color }}>
                {formatMoney(top[1] * 100_000, FMT)}
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-1.5">
            {TEAMS.map((t, i) => {
              const lead = top[0] === i;
              return (
                <li key={t.name} className="relative flex items-center justify-between overflow-hidden rounded-xl bg-ink-900/80 px-3 py-2" style={{ outline: lead ? `1.5px solid ${t.color}` : '1px solid rgba(160,190,255,0.1)' }}>
                  <div className="absolute inset-y-0 left-0 transition-all duration-500" style={{ width: `${best[i] ? (best[i] / top[1]) * 100 : 0}%`, background: `linear-gradient(90deg, ${t.color}40, ${t.color}10)` }} />
                  <span className="relative flex items-center gap-2 text-sm font-bold" style={{ color: t.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: t.color }} /> {t.name} {lead && '👑'}
                  </span>
                  <span className="num relative font-display text-sm font-bold">{best[i] ? formatMoney(best[i] * 100_000, FMT) : <span className="text-xs font-medium text-slate-500">—</span>}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex h-9 items-center justify-center">
            {call > 0 && !sold && (
              <span key={call} className={`animate-pop font-stage text-2xl font-extrabold tracking-[0.12em] ${call === 1 ? 'text-gold' : call === 2 ? 'text-orange-400' : 'text-hot'}`}>
                {['', 'GOING ONCE…', 'GOING TWICE…', 'GOING THRICE!'][call]}
              </span>
            )}
            {!call && <span className="text-xs text-slate-400">Captains are bidding live…</span>}
          </div>

          {sold && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-ink-950/75 backdrop-blur-[2px]">
              <div className="animate-slam text-center" key="sold">
                <div className="inline-block rounded-2xl border-[6px] border-hot px-6 font-stage text-6xl font-extrabold tracking-[0.14em] text-hot" style={{ textShadow: '0 0 30px currentColor' }}>
                  SOLD!
                </div>
                <div className="mt-1 font-stage text-xl font-bold tracking-wide" style={{ color: leader.color }}>
                  to {leader.name}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
