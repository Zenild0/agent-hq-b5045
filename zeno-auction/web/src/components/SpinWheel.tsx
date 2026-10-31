import { useEffect, useMemo, useRef, useState } from 'react';
import type { Player } from '../../../shared/types';
import { sfx } from '../lib/sound';

const PALETTE = ['#ff3d81', '#29e0ff', '#ffc933', '#7cf29a', '#b388ff', '#ff8a3d', '#4d8bff'];
const R = 188;
const C = 200;

const point = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)] as const;
};

function clip(name: string, n: number) {
  const max = n <= 8 ? 18 : n <= 14 ? 15 : 12;
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

/**
 * The server decides the winner; every screen animates the wheel to land on it, timed from the
 * server's clock so the big screen and the captains see it stop together.
 */
export function SpinWheel({
  players,
  targetId,
  startedAt,
  stopAt,
  serverNow,
  tickSound,
  size = 'min(78vw, 52vh, 560px)',
  hideWinner = false,
}: {
  players: Player[];
  targetId: string;
  startedAt: number;
  stopAt: number;
  serverNow: () => number;
  tickSound: boolean;
  size?: string;
  hideWinner?: boolean;
}) {
  const n = players.length;
  const seg = 360 / n;
  const targetIdx = Math.max(0, players.findIndex((p) => p.id === targetId));
  const jitter = ((startedAt % 9) / 9 - 0.5) * seg * 0.6;
  const final = 360 * 6 - (targetIdx + 0.5) * seg + jitter;

  const [anim, setAnim] = useState({ rot: 0, ms: 0 });
  const [stopped, setStopped] = useState(false);
  const tickRef = useRef(tickSound);
  tickRef.current = tickSound;

  useEffect(() => {
    const remaining = stopAt - serverNow();
    setStopped(remaining <= 0);
    if (remaining <= 0) {
      setAnim({ rot: final, ms: 0 });
      return;
    }
    setAnim({ rot: 0, ms: 0 });
    const t0 = performance.now();
    let raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnim({ rot: final, ms: remaining });
        let last = 0;
        const loop = () => {
          const p = Math.min(1, (performance.now() - t0) / remaining);
          const angle = final * (1 - (1 - p) ** 3); // matches the CSS ease-out-cubic below
          const idx = Math.floor(angle / seg);
          if (idx !== last && tickRef.current) sfx.tick();
          last = idx;
          if (p < 1) raf = requestAnimationFrame(loop);
          else setStopped(true);
        };
        raf = requestAnimationFrame(loop);
      }),
    );
    return () => cancelAnimationFrame(raf);
  }, [startedAt, stopAt, final, seg, serverNow]);

  const slices = useMemo(
    () =>
      players.map((p, i) => {
        const a0 = i * seg;
        const a1 = (i + 1) * seg;
        const [x0, y0] = point(a0, R);
        const [x1, y1] = point(a1, R);
        let color = PALETTE[i % PALETTE.length];
        if (i === n - 1 && n > 1 && color === PALETTE[0]) color = PALETTE[(i + 3) % PALETTE.length];
        return { p, d: `M${C} ${C} L${x0} ${y0} A${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${x1} ${y1} Z`, color, mid: a0 + seg / 2 };
      }),
    [players, seg, n],
  );

  const fontSize = n <= 8 ? 19 : n <= 14 ? 15 : 12;
  const winner = players[targetIdx];

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* pointer */}
      <svg viewBox="0 0 40 50" className="absolute left-1/2 top-[-3%] z-10 w-[9%] -translate-x-1/2 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
        <path d="M20 48 L3 6 Q20 -4 37 6 Z" fill="#ffc933" stroke="#07071a" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <svg
        viewBox="0 0 400 400"
        className={`h-full w-full ${stopped ? 'drop-shadow-[0_0_40px_rgba(255,201,51,0.55)]' : ''}`}
        style={{
          transform: `rotate(${anim.rot}deg)`,
          transition: anim.ms ? `transform ${anim.ms}ms cubic-bezier(0.215, 0.61, 0.355, 1)` : 'none',
        }}
      >
        <circle cx={C} cy={C} r={R + 8} fill="#0d0d24" stroke="#ffc933" strokeWidth="4" />
        {slices.map(({ p, d, color, mid }) => (
          <g key={p.id}>
            <path d={d} fill={color} stroke="#07071a" strokeWidth="2" opacity={stopped && p.id !== targetId ? 0.35 : 1} />
            <text
              transform={`rotate(${mid - 90} ${C} ${C})`}
              x={C + R - 14}
              y={C}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={fontSize}
              fontWeight={800}
              fill="#07071a"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {clip(p.name, n)}
            </text>
          </g>
        ))}
        <circle cx={C} cy={C} r="34" fill="#07071a" stroke="#ffc933" strokeWidth="5" />
        <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize="22" fill="#ffc933" style={{ fontFamily: 'Anton, Impact, sans-serif' }}>
          ZB
        </text>
      </svg>

      {stopped && winner && !hideWinner && (
        <div className="pointer-events-none absolute inset-x-0 -bottom-[24%] text-center">
          <div className="inline-block animate-pop rounded-2xl border-4 border-gold bg-ink-950/95 px-8 py-2 shadow-[0_0_60px_rgba(255,201,51,0.5)]">
            <span className="animate-pulse font-display text-[clamp(1.8rem,5vw,3.6rem)] tracking-wide text-gold">{winner.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}
