import { formatMoney } from '../../../shared/money';
import type { EventSettings } from '../../../shared/types';
import { Heartbeat } from './Heartbeat';
import { avatarGradient } from './ui';

/** A miniature of the big screen, rendered from the settings being edited — so you see the result as you choose. */
export function AuctionPreview({ settings, className = '' }: { settings: EventSettings; className?: string }) {
  const d = settings.display;
  const fmt = (n: number) => formatMoney(n, settings);
  const base = settings.defaultBasePrice;
  const tiers = settings.increments;
  // an example ladder following the real step rules
  const ladder: number[] = [base];
  const stepFor = (cur: number) => [...tiers].reverse().find((t) => cur >= t.from)?.step ?? tiers[0].step;
  for (let i = 0; i < 3; i++) ladder.push(ladder[ladder.length - 1] + stepFor(ladder[ladder.length - 1]));
  const tempo = { bpm: 92, label: '', beat: 0.65, intensity: 0.4 };

  return (
    <div className={`card overflow-hidden p-0 ${className}`} style={{ boxShadow: `0 30px 60px -30px rgba(0,0,0,.8), 0 0 0 1px ${settings.accent}30, 0 0 60px -20px ${settings.accent}55` }}>
      <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4 py-2.5">
        <span className="chip !py-0.5 text-[11px] font-bold" style={{ color: settings.accent, borderColor: `${settings.accent}55` }}>
          {settings.sport || 'Auction'}
        </span>
        <span className="min-w-0 flex-1 truncate font-display text-sm font-bold">{settings.name || 'Your auction'}</span>
        <Heartbeat tempo={tempo} color={settings.accent} className="h-6 w-20" />
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-3 p-3">
        <div className="relative flex min-h-[170px] flex-col justify-end overflow-hidden rounded-xl">
          <div className="absolute inset-0" style={{ background: d.showPhoto ? avatarGradient('Aarav Mehta') : `radial-gradient(240px 160px at 30% 20%, ${settings.accent}33, transparent 70%), #0b1636` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent" />
          <div className="relative space-y-1 p-3">
            {d.showRole && <span className="chip !py-0 text-[10px]">All-rounder</span>}
            <div className="font-stage text-3xl font-extrabold uppercase leading-[0.9]">Aarav Mehta</div>
            {d.showDescription && <p className="line-clamp-2 text-[10px] text-slate-300">Opens the innings and never leaves the crease.</p>}
            {d.showBasePrice && <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Base {fmt(base)}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-ink-900/70 p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Opening bid</p>
            <div className="font-display text-2xl font-extrabold leading-tight text-gold-grad">{fmt(base)}</div>
          </div>
          <ul className="space-y-1">
            {ladder.slice(1).map((v, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-ink-900/60 px-2.5 py-1 text-[11px]">
                <span className="text-slate-400">Bid {i + 1}</span>
                <span className="num font-bold text-pearl">{fmt(v)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--hairline)] bg-ink-900/40 px-4 py-2 text-[11px] text-slate-400">
        <span>
          Each team starts with <b className="num text-gold">{fmt(settings.defaultBudget)}</b>
        </span>
        <span>{settings.drawMode === 'random' ? '🎡 Random spin' : settings.drawMode === 'manual' ? '🎯 Auctioneer picks' : '↓ List order'}</span>
      </div>
    </div>
  );
}
