import { teamInk } from '../lib/appearance';
import { TrendingUp } from 'lucide-react';
import { formatMoney } from '../../../shared/money';
import type { Snapshot } from '../../../shared/types';

/** A stock-ticker strip: the latest sales scroll past like prices on a trading floor. */
export function Tape({ snap }: { snap: Snapshot }) {
  const { settings } = snap;
  const sales = [...snap.players]
    .filter((p) => p.status === 'sold' && p.teamId)
    .sort((a, b) => (b.soldAt ?? 0) - (a.soldAt ?? 0))
    .slice(0, 14);

  const items: { key: string; node: JSX.Element }[] = sales.map((p) => {
    const team = snap.captains.find((c) => c.id === p.teamId);
    return {
      key: p.id,
      node: (
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wide text-pearl">{p.name}</span>
          <span className="text-slate-500">→</span>
          <span className="font-semibold" style={{ color: teamInk(team?.color) }}>
            {team?.team}
          </span>
          <span className="num font-bold text-gold">{formatMoney(p.price, settings)}</span>
          <span className="text-emerald-400">▲</span>
        </span>
      ),
    };
  });
  if (items.length === 0) {
    items.push(
      { key: 'a', node: <span className="text-slate-300">Welcome to <b className="text-gold">{settings.name}</b></span> },
      { key: 'b', node: <span className="text-slate-300">Join code <b className="num text-gold">{snap.code}</b></span> },
      { key: 'c', node: <span className="text-slate-300">{snap.captains.length} teams · {snap.players.length} players</span> },
      { key: 'd', node: <span className="text-slate-300">Starting purse <b className="num text-gold">{formatMoney(settings.defaultBudget, settings)}</b></span> },
    );
  }
  // repeat so the loop is seamless and always wider than the screen
  const row = [...items, ...items, ...items, ...items].map((it, i) => (
    <span key={it.key + i} className="inline-flex shrink-0 items-center gap-8 pr-8 text-[13px]">
      {it.node}
      <span className="text-ink-500">◆</span>
    </span>
  ));
  const secs = Math.max(30, items.length * 7);

  return (
    <div className="relative flex items-center overflow-hidden rounded-xl border border-[var(--hairline)] bg-ink-900/70 py-2 backdrop-blur" aria-label="Latest sales">
      <div className="z-10 -ml-px flex shrink-0 items-center gap-1.5 bg-gradient-to-r from-ink-900 via-ink-900 to-transparent py-0.5 pl-3 pr-6 text-[11px] font-extrabold uppercase tracking-[0.2em] text-gold">
        <TrendingUp className="h-3.5 w-3.5" /> Live tape
      </div>
      <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)]">
        <div className="flex w-max animate-tape whitespace-nowrap hover:[animation-play-state:paused]" style={{ ['--tape' as string]: `${secs}s` } as React.CSSProperties}>
          {row}
        </div>
      </div>
    </div>
  );
}
