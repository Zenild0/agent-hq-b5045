import { formatMoney, type MoneyFmt } from '../../../shared/money';

/** A circular gauge of the purse still available: the arc shrinks as money is spent. */
export function PurseRing({ remaining, total, fmt, color = '#f2b84b', size = 124 }: { remaining: number; total: number; fmt: MoneyFmt; color?: string; size?: number }) {
  const r = size / 2 - 9;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const low = pct < 0.15;
  const arc = low ? '#ff5c7a' : color;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Purse left ${formatMoney(remaining, fmt)}`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(160,190,255,0.12)" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={arc}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.2,.8,.2,1), stroke 0.4s', filter: `drop-shadow(0 0 6px ${arc}99)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Purse left</div>
          <div className={`font-display text-[15px] font-extrabold leading-tight ${remaining < 0 ? 'text-hot' : ''}`}>{formatMoney(remaining, fmt)}</div>
        </div>
      </div>
    </div>
  );
}
