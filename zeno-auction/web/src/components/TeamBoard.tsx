import { formatMoney } from '../../../shared/money';
import { maxBid, teamStats } from '../../../shared/rules';
import type { Snapshot } from '../../../shared/types';
import { PlayerAvatar } from './ui';

/** Full team-by-team view: purse left, spend, squad. Meant for the big screen or a quick look. */
export function TeamBoard({ snap, big = false, highlightId }: { snap: Snapshot; big?: boolean; highlightId?: string }) {
  const { settings, captains } = snap;
  const online = new Set(snap.presence.captains);
  const cols = captains.length <= 2 ? 'md:grid-cols-2' : captains.length === 3 ? 'md:grid-cols-3' : captains.length <= 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-3';

  if (captains.length === 0) return <div className="card p-10 text-center text-slate-400">No teams yet.</div>;

  return (
    <div className={`grid gap-4 ${cols}`}>
      {captains.map((c) => {
        const st = teamStats(snap, c);
        const pct = c.budget > 0 ? Math.max(0, Math.min(100, (st.remaining / c.budget) * 100)) : 0;
        const limit = maxBid(snap, c, snap.live.playerId);
        const full = settings.maxSquad > 0 && st.count >= settings.maxSquad;
        return (
          <div
            key={c.id}
            className={`card relative overflow-hidden p-4 transition ${highlightId === c.id ? 'ring-2' : ''}`}
            style={{ ['--tw-ring-color' as string]: c.color }}
          >
            <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: c.color }} />
            <div className="mt-1 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {c.logo && <img src={c.logo} alt="" className="h-7 w-7 rounded-full object-cover" />}
                  <h3 className={`truncate font-display font-extrabold ${big ? 'text-xl xl:text-2xl' : 'text-xl'}`} style={{ color: c.color }}>
                    {c.team}
                  </h3>
                </div>
                {c.name && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${online.has(c.id) ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    Captain {c.name}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Purse left</div>
                <div className={`whitespace-nowrap font-display font-extrabold leading-none ${big ? 'text-3xl xl:text-4xl' : 'text-3xl'} ${st.remaining < 0 ? 'text-red-400' : ''}`}>
                  {formatMoney(st.remaining, settings)}
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-900">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c.color }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-xs text-slate-400">
              <span>Spent {formatMoney(st.spent, settings)}</span>
              <span>
                Squad {st.count}
                {settings.maxSquad > 0 ? `/${settings.maxSquad}` : ''}
                {settings.minSquad > 0 && st.count < settings.minSquad ? ` (min ${settings.minSquad})` : ''}
              </span>
              <span>{full ? 'Squad full' : `Max bid ${formatMoney(Math.max(0, limit), settings)}`}</span>
            </div>

            <ul className="mt-3 space-y-1.5">
              {st.players.length === 0 && <li className="py-3 text-center text-xs text-slate-500">No players yet</li>}
              {st.players.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 rounded-lg bg-ink-900/80 p-1.5 pr-3">
                  <PlayerAvatar player={p} showPhoto={settings.display.showPhoto} className="h-9 w-9 shrink-0 rounded-lg text-[10px]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    {settings.display.showRole && p.role && <div className="truncate text-[11px] text-slate-400">{p.role}</div>}
                  </div>
                  <div className="text-sm font-bold text-gold">{formatMoney(p.price, settings)}</div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Compact one-line-per-team strip shown under the stage. */
export function TeamStrip({ snap, leaderId }: { snap: Snapshot; leaderId?: string }) {
  const { settings } = snap;
  return (
    <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1">
      {snap.captains.map((c) => {
        const st = teamStats(snap, c);
        const lead = leaderId === c.id;
        return (
          <div
            key={c.id}
            className={`min-w-[150px] flex-1 rounded-xl border bg-ink-800/80 px-3 py-2 transition ${lead ? 'animate-glow border-transparent' : 'border-white/10'}`}
            style={{ ['--glow' as string]: `${c.color}88`, borderColor: lead ? c.color : undefined }}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: c.color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              <span className="truncate">{c.team}</span>
              <span className="ml-auto text-slate-400">{st.count}</span>
            </div>
            <div className="font-display text-lg font-bold leading-tight">{formatMoney(st.remaining, settings)}</div>
          </div>
        );
      })}
    </div>
  );
}
