import { Timer } from 'lucide-react';
import type { Snapshot } from '../../../shared/types';
import { fmtClock, useCountdown } from '../lib/useCountdown';
import { TeamBoard } from './TeamBoard';

/** A strategy break: a big countdown for everyone, with the team board underneath on the big screen. */
export function BreakView({ snap, serverNow, compact }: { snap: Snapshot; serverNow: () => number; compact: boolean }) {
  const b = snap.live.break!;
  const left = useCountdown(b.endsAt, serverNow);
  const total = Math.max(1, b.endsAt - b.startedAt);
  const pct = Math.max(0, Math.min(1, left / total));
  const urgent = left > 0 && left <= 10_000;
  const over = left <= 0;

  const size = compact ? 190 : 340;
  const r = size / 2 - 14;
  const circ = 2 * Math.PI * r;
  const color = over ? '#7cf29a' : urgent ? '#ff3d81' : '#ffc933';

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className={`card flex flex-col items-center justify-center text-center ${compact ? 'p-5' : 'px-6 py-8'}`}>
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-slate-400">
          <Timer className="h-4 w-4" /> {b.label}
        </div>
        <div className="relative" style={{ width: size, height: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct)}
              style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s' }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div
              className={`font-display tracking-wide ${urgent ? 'animate-pulse' : ''} ${compact ? 'text-6xl' : 'text-[clamp(4.5rem,9vw,8rem)]'}`}
              style={{ color }}
            >
              {over ? '0:00' : fmtClock(left)}
            </div>
          </div>
        </div>
        <p className={`mt-4 text-slate-300 ${compact ? 'text-sm' : 'text-lg'}`}>
          {over ? 'Break over — back to the auction in a moment…' : 'Captains: time to plan your next picks.'}
        </p>
      </div>

      {!compact && (
        <div>
          <h2 className="mb-3 font-display text-3xl tracking-wide">
            TEAMS <span className="text-gold">SO FAR</span>
          </h2>
          <TeamBoard snap={snap} big />
        </div>
      )}
    </div>
  );
}
