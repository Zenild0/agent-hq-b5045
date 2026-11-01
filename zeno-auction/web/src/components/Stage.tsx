import { teamInk } from '../lib/appearance';
import { useEffect, useState } from 'react';
import { formatMoney } from '../../../shared/money';
import { effectiveBase, nextBidAmount, SPIN_FLASH_MS } from '../../../shared/rules';
import type { Player, Snapshot } from '../../../shared/types';
import { BreakView } from './BreakView';
import { Confetti } from './Confetti';
import { SpinWheel } from './SpinWheel';
import { TeamDot, PlayerAvatar } from './ui';

/** Re-render on an interval while `active` (used to notice the wheel stopping). */
function useTicker(active: boolean, ms = 200) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}

const CALL_TEXT = ['', 'GOING ONCE', 'GOING TWICE', 'GOING THRICE!'];
const CALL_COLOR = ['', 'text-gold', 'text-orange-400', 'text-red-500'];

export function Stage({
  snap,
  serverNow,
  compact = false,
  tickSound = false,
}: {
  snap: Snapshot;
  serverNow: () => number;
  compact?: boolean;
  tickSound?: boolean;
}) {
  const { live, settings } = snap;
  useTicker(live.phase === 'spinning');
  if (live.break) return <BreakView snap={snap} serverNow={serverNow} compact={compact} />;

  const player = snap.players.find((p) => p.id === live.playerId) ?? null;
  const spinning = live.phase === 'spinning' && live.spin;

  if (spinning && live.spin) {
    const candidates = live.spin.candidates.map((id) => snap.players.find((p) => p.id === id)).filter(Boolean) as Player[];
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
        <p className="mb-6 font-stage text-[clamp(1.6rem,3.6vw,2.9rem)] font-bold tracking-[0.2em] text-gold">DRAWING THE NEXT PLAYER…</p>
        <SpinWheel
          players={candidates}
          targetId={live.spin.targetId}
          startedAt={live.spin.startedAt}
          stopAt={live.spin.endsAt - SPIN_FLASH_MS}
          serverNow={serverNow}
          tickSound={tickSound}
          size={compact ? 'min(80vw, 340px)' : undefined}
        />
        <div className="h-28" />
      </div>
    );
  }

  if (!player) return <IdleStage snap={snap} compact={compact} />;

  const top = live.bids[live.bids.length - 1];
  const leader = top ? snap.captains.find((c) => c.id === top.captainId) : undefined;
  const base = effectiveBase(settings, player);
  const nextAmount = nextBidAmount(settings, player, live.bids);
  const result = live.result;
  const winner = result?.captainId ? snap.captains.find((c) => c.id === result.captainId) : undefined;
  const d = settings.display;
  const hasVisual = d.showPhoto;

  return (
    <div className={`relative grid flex-1 items-stretch gap-5 ${compact ? '' : 'lg:grid-cols-[1.05fr_1fr]'}`}>
      {/* ---- player ---- */}
      <div className="card relative overflow-hidden p-0">
        <div className={`flex ${compact ? 'flex-row' : hasVisual ? 'flex-col sm:flex-row lg:flex-col xl:flex-row' : 'flex-col'} h-full`}>
          {hasVisual && (
            <PlayerAvatar
              player={player}
              className={`${compact ? 'h-36 w-32' : 'min-h-[260px] w-full text-[clamp(1.5rem,3.2vw,3.5rem)] sm:w-[44%] lg:w-full xl:w-[46%]'} shrink-0`}
            />
          )}
          <div className={`flex flex-1 flex-col justify-center gap-3 p-5 sm:p-7 ${!hasVisual && !compact ? 'items-center text-center' : ''}`}>
            <div className={`flex flex-wrap items-center gap-2 ${!hasVisual && !compact ? 'justify-center' : ''}`}>
              <span className="chip border-gold/40 bg-gold/10 text-gold">Round {snap.round}</span>
              {d.showRole && player.role && <span className="chip">{player.role}</span>}
              {live.phase === 'bidding' && result === null && <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300">● Bidding open</span>}
            </div>
            <h2
              className={`font-stage font-extrabold uppercase leading-[0.92] tracking-tight ${
                compact ? 'text-4xl' : hasVisual ? 'text-[clamp(2.6rem,5.6vw,6rem)]' : 'text-[clamp(3.4rem,9vw,9rem)]'
              }`}
            >
              {player.name}
            </h2>
            {d.showDescription && player.description && (
              <p className={`text-slate-300 ${compact ? 'text-sm' : 'text-[clamp(1rem,1.6vw,1.5rem)]'}`}>{player.description}</p>
            )}
            {d.showBasePrice && (
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Base price <span className="text-slate-100">{formatMoney(base, settings)}</span>
              </p>
            )}
          </div>
        </div>

        {result && <ResultStamp snap={snap} compact={compact} winnerName={winner?.team} color={winner?.color} price={result.price} kind={result.kind} />}
      </div>

      {/* ---- bidding ---- */}
      <div className="flex flex-col gap-4">
        <div className="card relative flex flex-1 flex-col justify-center overflow-hidden p-5 text-center sm:p-7">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
            {result?.kind === 'sold' ? 'Sold for' : top ? 'Current bid' : 'Opening bid'}
          </div>
          <div
            key={top?.amount ?? 0}
            className={`font-display font-extrabold leading-none tracking-tight animate-bump ${
              compact ? 'my-2 text-6xl' : 'my-3 text-[clamp(4rem,10vw,10.5rem)]'
            }`}
            style={{ color: teamInk(leader?.color) ?? 'rgb(var(--white))' }}
          >
            {formatMoney(top?.amount ?? base, settings)}
          </div>

          {leader ? (
            <div className="mx-auto inline-flex items-center gap-2.5 rounded-full border px-5 py-2 text-lg font-bold" style={{ borderColor: leader.color, color: leader.color, background: `${leader.color}18` }}>
              {leader.logo ? <img src={leader.logo} alt="" className="h-7 w-7 rounded-full object-cover" /> : <TeamDot captain={leader} size={14} />}
              {leader.team}
              {leader.name && <span className="text-sm font-medium text-slate-300">· {leader.name}</span>}
            </div>
          ) : (
            <div className="text-slate-400">Waiting for the first bid…</div>
          )}

          {live.phase === 'bidding' && (
            <div className="mt-5 min-h-[3.5rem]">
              {live.call > 0 ? (
                <div key={live.call} className={`animate-slam ${CALL_COLOR[live.call]}`} style={{ transform: 'rotate(-3deg)' }}>
                  <div className={`font-stage font-extrabold tracking-[0.1em] ${compact ? 'text-4xl' : 'text-[clamp(2rem,4.4vw,4.5rem)]'}`}>{CALL_TEXT[live.call]}</div>
                  <div className="mt-1 flex justify-center gap-2">
                    {[1, 2, 3].map((i) => (
                      <span key={i} className={`h-3 w-3 rounded-full ${i <= live.call ? 'bg-current' : 'bg-white/15'}`} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">
                  Next bid <span className="font-bold text-slate-100">{formatMoney(nextAmount, settings)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {!compact && live.bids.length > 0 && (
          <div className="card p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Bid history</div>
            <ul className="space-y-1.5">
              {[...live.bids].reverse().slice(0, 4).map((b, i) => {
                const c = snap.captains.find((x) => x.id === b.captainId);
                return (
                  <li key={b.at + '-' + i} className={`flex items-center justify-between text-sm ${i === 0 ? 'font-bold' : 'text-slate-400'}`}>
                    <span className="flex items-center gap-2">
                      {c && <TeamDot captain={c} />}
                      {c?.team}
                    </span>
                    <span>{formatMoney(b.amount, settings)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {result?.kind === 'sold' && <Confetti burstKey={live.seq} />}
    </div>
  );
}

function ResultStamp({
  snap,
  kind,
  winnerName,
  color,
  price,
  compact,
}: {
  snap: Snapshot;
  kind: 'sold' | 'unsold';
  winnerName?: string;
  color?: string;
  price?: number;
  compact: boolean;
}) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-ink-950/70 backdrop-blur-[2px]">
      <div key={snap.live.seq} className="animate-slam text-center" style={{ transform: 'rotate(-12deg)' }}>
        <div
          className={`inline-block rounded-2xl border-[10px] px-8 py-0 font-stage font-extrabold tracking-[0.14em] ${
            kind === 'sold' ? 'border-red-500 text-red-500' : 'border-slate-400 text-slate-300'
          } ${compact ? 'text-6xl' : 'text-[clamp(3rem,7vw,7rem)]'}`}
          style={{ textShadow: '0 0 40px currentColor' }}
        >
          {kind === 'sold' ? 'SOLD!' : 'UNSOLD'}
        </div>
        {kind === 'sold' && winnerName && (
          <div className={`mt-3 font-stage font-bold tracking-wide ${compact ? 'text-3xl' : 'text-[clamp(1.3rem,2.4vw,2.6rem)]'}`} style={{ color }}>
            to {winnerName} · {formatMoney(price ?? 0, snap.settings)}
          </div>
        )}
      </div>
    </div>
  );
}

function IdleStage({ snap, compact }: { snap: Snapshot; compact: boolean }) {
  const available = snap.players.filter((p) => p.status === 'available').length;
  const unsold = snap.players.filter((p) => p.status === 'unsold').length;
  const sold = snap.players.filter((p) => p.status === 'sold').length;

  let title = 'Next player coming up…';
  let sub = `${available} player${available === 1 ? '' : 's'} left in round ${snap.round}`;
  if (snap.players.length === 0) {
    title = 'Waiting for players';
    sub = 'The host is still setting up the auction.';
  } else if (available === 0 && unsold > 0) {
    title = `Round ${snap.round} complete`;
    sub = `${unsold} unsold player${unsold === 1 ? '' : 's'} can go again in round ${snap.round + 1}.`;
  } else if (available === 0) {
    title = 'Auction complete!';
    sub = `${sold} players found a home.`;
  }

  return (
    <div className={`card grid flex-1 place-items-center text-center ${compact ? 'p-8' : 'min-h-[52vh] p-10'}`}>
      <div>
        <div className="mb-4 inline-grid h-20 w-20 place-items-center rounded-3xl bg-gold/10 text-5xl">🔨</div>
        <h2 className={`font-display font-extrabold ${compact ? 'text-2xl' : 'text-[clamp(2.2rem,5vw,4.6rem)]'}`}>{title}</h2>
        <p className="mt-2 text-lg text-slate-400">{sub}</p>
        <div className="mt-6 flex justify-center gap-3 text-sm">
          <span className="chip">{sold} sold</span>
          <span className="chip">{available} in pool</span>
          {unsold > 0 && <span className="chip">{unsold} unsold</span>}
        </div>
      </div>
    </div>
  );
}
