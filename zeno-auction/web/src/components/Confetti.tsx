import { useMemo } from 'react';

const COLORS = ['#ffc933', '#ff3d81', '#29e0ff', '#7cf29a', '#b388ff', '#ffffff'];

/** A one-off burst of falling confetti. Change `burstKey` to fire it again. */
export function Confetti({ burstKey, count = 70 }: { burstKey: string | number; count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: COLORS[i % COLORS.length],
        dx: `${(Math.random() - 0.5) * 30}vw`,
        rot: `${(Math.random() - 0.5) * 1440}deg`,
        dur: `${2.2 + Math.random() * 2}s`,
        delay: `${Math.random() * 0.5}s`,
        w: 6 + Math.random() * 8,
        h: 10 + Math.random() * 10,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey, count],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 animate-confetti rounded-[2px]"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              '--dx': p.dx,
              '--rot': p.rot,
              '--dur': p.dur,
              '--delay': p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
