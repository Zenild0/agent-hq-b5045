import { HeartPulse } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Tempo } from '../lib/tempo';

/** An ECG trace whose speed follows the room's tempo: calm and slow, or racing. */
export function Heartbeat({ tempo, className = '', color = '#f2b84b' }: { tempo: Tempo; className?: string; color?: string }) {
  const d = 'M0 20 H34 l5 -2 l4 4 l5 -3 l4 0 l3 -13 l6 28 l4 -19 l4 4 H150 l5 -2 l4 4 l5 -3 l4 0 l3 -13 l6 28 l4 -19 l4 4 H260';
  return (
    <svg viewBox="0 0 260 40" preserveAspectRatio="none" className={className} aria-hidden style={{ ['--beat' as string]: `${tempo.beat}s` } as CSSProperties}>
      <path d={d} fill="none" stroke={color} strokeOpacity="0.18" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {/* the glow is a wider, fainter copy of the trace (cheap) rather than an animated SVG filter (costly) */}
      <path d={d} pathLength={260} fill="none" stroke={color} strokeOpacity="0.28" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="46 214" className="animate-ecg" vectorEffect="non-scaling-stroke" />
      <path d={d} pathLength={260} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="46 214" className="animate-ecg" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** "♥ 128 BPM · HOT" — a beating heart with the current tempo. */
export function HeartPill({ tempo, className = '' }: { tempo: Tempo; className?: string }) {
  const hot = tempo.intensity > 0.55;
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${hot ? 'border-hot/50 bg-hot/10 text-hot' : 'border-gold/35 bg-gold/10 text-gold'} ${className}`}
      style={{ ['--beat' as string]: `${tempo.beat}s` } as CSSProperties}
      title="The heartbeat of the room: it speeds up with every bid"
    >
      <span className="relative grid h-5 w-5 place-items-center">
        <span className={`absolute inset-0 rounded-full ${hot ? 'bg-hot/40' : 'bg-gold/40'} animate-ping`} />
        <HeartPulse className="relative h-4 w-4 animate-beat" />
      </span>
      <span className="num tabular-nums">{Math.round(tempo.bpm)} BPM</span>
      <span className="hidden font-semibold opacity-80 sm:inline">· {tempo.label}</span>
    </div>
  );
}
