import { AlertTriangle, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMoney } from '../../../shared/money';
import { effectiveBase, teamStats } from '../../../shared/rules';
import type { Captain, Player, Snapshot } from '../../../shared/types';
import type { Room } from '../lib/useRoom';
import { MoneyInput } from './MoneyInput';
import { PlayerAvatar, TeamDot } from './ui';

type Kind = 'open' | 'onblock' | 'unsold' | 'mine' | 'gone';

/**
 * A captain's private plan: the players they are after and the most they would pay for each.
 * It re-checks itself against the live auction — purse left, players others have bought.
 */
export function StrategyTab({ snap, room, me }: { snap: Snapshot; room: Room; me: Captain }) {
  const { settings, live } = snap;
  const fmt = (n: number) => formatMoney(n, settings);
  const plan = snap.strategy ?? [];
  const st = teamStats(snap, me);
  const [search, setSearch] = useState('');

  const rows = plan
    .map((item) => {
      const player = snap.players.find((p) => p.id === item.playerId);
      if (!player) return null;
      const owner = player.status === 'sold' ? snap.captains.find((c) => c.id === player.teamId) : undefined;
      const kind: Kind =
        player.status === 'sold'
          ? player.teamId === me.id
            ? 'mine'
            : 'gone'
          : live.playerId === player.id && (live.phase === 'bidding' || live.phase === 'spinning')
            ? 'onblock'
            : player.status === 'unsold'
              ? 'unsold'
              : 'open';
      return { item, player, owner, kind };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Only targets that are still gettable need money set aside.
  const stillPlanned = rows.filter((r) => r.kind !== 'mine' && r.kind !== 'gone');
  const planned = stillPlanned.reduce((sum, r) => sum + r.item.budget, 0);
  const headroom = st.remaining - planned;
  const over = headroom < 0;
  const used = st.remaining > 0 ? Math.min(100, (planned / st.remaining) * 100) : planned > 0 ? 100 : 0;
  const gone = rows.filter((r) => r.kind === 'gone');

  const inPlan = new Set(plan.map((i) => i.playerId));
  const candidates = useMemo(
    () =>
      snap.players
        .filter((p) => p.status !== 'sold' && !inPlan.has(p.id))
        .filter((p) => !search || `${p.name} ${p.role}`.toLowerCase().includes(search.toLowerCase())),
    [snap.players, plan.length, search], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="space-y-4">
      {/* ---- the numbers ---- */}
      <section className={`card p-4 ${over ? 'border-red-400/50' : ''}`}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Purse left" value={fmt(st.remaining)} />
          <Stat label="Planned" value={fmt(planned)} sub={`${stillPlanned.length} target${stillPlanned.length === 1 ? '' : 's'}`} />
          <Stat label={over ? 'Over by' : 'Spare'} value={fmt(Math.abs(headroom))} tone={over ? 'bad' : 'good'} />
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-900">
          <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : used > 85 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${over ? 100 : used}%` }} />
        </div>
        {over && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Your plan is <b>{fmt(-headroom)}</b> more than your purse. Lower a budget or remove a target.
            </span>
          </p>
        )}
        {!over && plan.length > 0 && <p className="mt-2 text-xs text-slate-400">Only players you can still win count towards the plan. This list is private — nobody else can see it.</p>}
      </section>

      {gone.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <span>
            {gone.length} player{gone.length === 1 ? '' : 's'} on your list {gone.length === 1 ? 'was' : 'were'} bought by other teams.
          </span>
          <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => gone.forEach((r) => room.act('strategy.remove', { playerId: r.player.id }))}>
            Clear them
          </button>
        </div>
      )}

      {/* ---- the plan ---- */}
      <section className="space-y-2">
        <h3 className="px-1 text-xs font-bold uppercase tracking-widest text-slate-400">My targets ({rows.length})</h3>
        {rows.length === 0 && <p className="card p-6 text-center text-sm text-slate-400">No targets yet. Add players below and set the most you'd pay for each.</p>}
        {rows.map((r) => (
          <PlanRow key={r.player.id} r={r} snap={snap} room={room} fmt={fmt} />
        ))}
      </section>

      {/* ---- add players ---- */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Add players to your plan</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input className="input !w-40 !py-1.5 !pl-8 !text-xs" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {candidates.length === 0 && <li className="py-5 text-center text-sm text-slate-500">{search ? 'No match.' : 'Everyone available is already in your plan.'}</li>}
          {candidates.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 rounded-xl bg-ink-900/80 p-1.5 pr-2">
              <PlayerAvatar player={p} showPhoto={settings.display.showPhoto} className="h-9 w-9 shrink-0 rounded-lg text-[10px]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="truncate text-[11px] text-slate-400">
                  {p.role || '—'} · base {fmt(effectiveBase(settings, p))}
                </div>
              </div>
              <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => room.act('strategy.add', { playerId: p.id })}>
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl bg-ink-900 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`font-display text-2xl leading-tight ${tone === 'bad' ? 'text-red-400' : tone === 'good' ? 'text-emerald-300' : ''}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function PlanRow({ r, snap, room, fmt }: { r: { item: { playerId: string; budget: number; note: string }; player: Player; owner?: Captain; kind: Kind }; snap: Snapshot; room: Room; fmt: (n: number) => string }) {
  const { item, player, owner, kind } = r;
  const done = kind === 'mine' || kind === 'gone';
  const saved = kind === 'mine' ? item.budget - player.price : 0;
  const min = snap.live.bids.length ? snap.live.bids[snap.live.bids.length - 1].amount : 0;
  const lostToPrice = kind === 'onblock' && min > item.budget;

  return (
    <div className={`card p-3 ${kind === 'gone' ? 'opacity-60' : ''} ${kind === 'onblock' ? 'border-gold/60' : ''}`}>
      <div className="flex items-center gap-3">
        <PlayerAvatar player={player} showPhoto={snap.settings.display.showPhoto} className="h-12 w-12 shrink-0 rounded-xl text-xs" />
        <div className="min-w-0 flex-1">
          <div className={`truncate font-semibold ${kind === 'gone' ? 'line-through' : ''}`}>{player.name}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
            <span>{player.role || '—'}</span>
            <span>base {fmt(effectiveBase(snap.settings, player))}</span>
            {kind === 'onblock' && <span className="font-bold text-gold">● on the block now</span>}
            {kind === 'unsold' && <span className="text-red-300">unsold — may come back</span>}
            {kind === 'gone' && owner && (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                <TeamDot captain={owner} size={8} /> gone to {owner.team} for {fmt(player.price)}
              </span>
            )}
            {kind === 'mine' && (
              <span className="font-semibold text-emerald-300">
                ✓ bought for {fmt(player.price)} {saved > 0 ? `(${fmt(saved)} under plan)` : saved < 0 ? `(${fmt(-saved)} over plan)` : ''}
              </span>
            )}
          </div>
        </div>
        <button className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-300" aria-label={`Remove ${player.name}`} onClick={() => room.act('strategy.remove', { playerId: player.id })}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {!done && (
        <div className="mt-2 flex items-start gap-3 pl-[60px]">
          <div className="w-44">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Most I'd pay</span>
            <MoneyInput value={item.budget} fmt={snap.settings} allowZero onChange={() => {}} onCommit={(n) => n !== item.budget && void room.act("strategy.update", { playerId: player.id, budget: n })} />
          </div>
          {lostToPrice && <p className="mt-5 text-xs font-semibold text-red-300">Bidding is already above your plan.</p>}
        </div>
      )}
    </div>
  );
}
