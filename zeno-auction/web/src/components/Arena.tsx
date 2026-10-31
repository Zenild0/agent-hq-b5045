import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { formatMoney } from '../../../shared/money';
import { checkBid, effectiveBase, maxBid, nextBidAmount, SPIN_FLASH_MS, teamStats } from '../../../shared/rules';
import type { Bid, Captain, Player, Snapshot } from '../../../shared/types';
import { BreakView } from './BreakView';
import { Confetti } from './Confetti';
import { SpinWheel } from './SpinWheel';
import { avatarGradient, PlayerAvatar, TeamDot } from './ui';

/**
 * The big-screen show: the player on the left, the bidding war on the right, and every team's
 * squad (with the price paid for each player) along the bottom.
 */
export function Arena({ snap, serverNow, tickSound, beat = 1.2 }: { snap: Snapshot; serverNow: () => number; tickSound: boolean; beat?: number }) {
  const { live } = snap;
  useTicker(live.phase === 'spinning');
  if (live.break) return <BreakView snap={snap} serverNow={serverNow} compact={false} />;

  const calling = live.phase === 'bidding' ? live.call : 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" style={{ ['--beat' as string]: `${beat}s` } as CSSProperties}>
      <div className="relative h-[clamp(400px,56vh,720px)] shrink-0">
        {live.phase === 'spinning' && live.spin ? (
          <SpinHero snap={snap} serverNow={serverNow} tickSound={tickSound} />
        ) : live.playerId ? (
          <BidHero snap={snap} />
        ) : (
          <IdleHero snap={snap} />
        )}
      </div>
      <TeamsRail snap={snap} />
      {calling > 0 && (
        <div
          key={calling}
          className={`pointer-events-none fixed inset-0 z-30 ${calling === 3 ? 'animate-edgepulse' : 'animate-edge'}`}
          style={{ ['--edge' as string]: calling === 1 ? '#ffc933' : calling === 2 ? '#ff8a3d' : '#ff2d55' } as CSSProperties}
        />
      )}
    </div>
  );
}

function useTicker(active: boolean, ms = 200) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}

// =============================================================================================
// Hero: spinning / idle / bidding
// =============================================================================================

function SpinHero({ snap, serverNow, tickSound }: { snap: Snapshot; serverNow: () => number; tickSound: boolean }) {
  const spin = snap.live.spin!;
  const candidates = spin.candidates.map((id) => snap.players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const winner = snap.players.find((p) => p.id === spin.targetId);
  const stopAt = spin.endsAt - SPIN_FLASH_MS;
  const stopped = serverNow() >= stopAt;
  return (
    <div className="card grid h-full grid-cols-[auto_1fr] items-center gap-6 overflow-hidden px-8 py-4 lg:gap-12">
      <div className="pl-2">
        <SpinWheel players={candidates} targetId={spin.targetId} startedAt={spin.startedAt} stopAt={stopAt} serverNow={serverNow} tickSound={tickSound} size="min(38vh, 36vw)" hideWinner />
      </div>
      <div className="min-w-0">
        <p className="font-stage text-[clamp(1.6rem,3vw,3rem)] font-bold tracking-[0.22em] text-gold">{stopped ? 'AND THE NEXT PLAYER IS…' : 'DRAWING THE NEXT PLAYER…'}</p>
        {stopped && winner ? (
          <div key="winner" className="mt-3 animate-pop">
            <div className="animate-pulse font-stage text-[clamp(3.4rem,9vw,9.5rem)] font-extrabold uppercase leading-[0.92] tracking-tight">{winner.name}</div>
            {snap.settings.display.showRole && winner.role && <span className="chip mt-3 text-base">{winner.role}</span>}
          </div>
        ) : (
          <p className="mt-3 text-[clamp(1rem,1.6vw,1.6rem)] text-slate-400">The wheel is spinning…</p>
        )}
      </div>
    </div>
  );
}

function IdleHero({ snap }: { snap: Snapshot }) {
  const available = snap.players.filter((p) => p.status === 'available').length;
  const unsold = snap.players.filter((p) => p.status === 'unsold').length;
  const sold = snap.players.filter((p) => p.status === 'sold');
  const recent = [...sold].sort((a, b) => (b.soldAt ?? 0) - (a.soldAt ?? 0)).slice(0, 5);

  let title = 'Next player coming up…';
  let sub = `${available} player${available === 1 ? '' : 's'} left in round ${snap.round}`;
  if (snap.players.length === 0) (title = 'Waiting for players'), (sub = 'The host is still setting up the auction.');
  else if (available === 0 && unsold > 0) (title = `Round ${snap.round} complete`), (sub = `${unsold} unsold player${unsold === 1 ? '' : 's'} can go again in round ${snap.round + 1}.`);
  else if (available === 0) (title = 'Auction complete!'), (sub = `${sold.length} players found a home.`);

  return (
    <div className="grid h-full gap-4 lg:grid-cols-[44fr_56fr]">
      <div className="card grid place-items-center p-6 text-center">
        <div>
          <div className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-3xl bg-gold/10 text-5xl">🔨</div>
          <h2 className="font-display text-[clamp(1.8rem,3.2vw,3.4rem)] font-extrabold leading-[1.05]">{title}</h2>
          <p className="mt-3 text-lg text-slate-400">{sub}</p>
          <div className="mt-5 flex justify-center gap-3 text-sm">
            <span className="chip">{sold.length} sold</span>
            <span className="chip">{available} in pool</span>
            {unsold > 0 && <span className="chip">{unsold} unsold</span>}
          </div>
        </div>
      </div>
      <div className="card flex min-h-0 flex-col p-5">
        <h3 className="mb-3 font-display text-xl font-extrabold">
          LATEST <span className="text-gold">BUYS</span>
        </h3>
        {recent.length === 0 ? (
          <p className="m-auto text-center text-lg text-slate-400">No sales yet — the first player is about to hit the block. 🔥</p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col justify-around gap-2">
            {recent.map((p, i) => {
              const team = snap.captains.find((c) => c.id === p.teamId);
              return (
                <li key={p.id} className="flex animate-rise items-center gap-3 rounded-xl bg-ink-900/80 p-2 pr-4" style={{ animationDelay: `${i * 60}ms`, borderLeft: `5px solid ${team?.color ?? '#555'}` }}>
                  <PlayerAvatar player={p} showPhoto={snap.settings.display.showPhoto} className="h-12 w-12 shrink-0 rounded-lg text-[10px]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-bold">{p.name}</div>
                    <div className="truncate text-sm font-semibold" style={{ color: team?.color }}>
                      {team?.team}
                    </div>
                  </div>
                  <div className="font-display text-2xl font-bold text-gold">{formatMoney(p.price, snap.settings)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function BidHero({ snap }: { snap: Snapshot }) {
  const { live } = snap;
  const player = snap.players.find((p) => p.id === live.playerId)!;
  const result = live.result;
  const winner = result?.captainId ? snap.captains.find((c) => c.id === result.captainId) : undefined;
  return (
    <div className="relative grid h-full gap-4 lg:grid-cols-[44fr_56fr]">
      <PlayerCard snap={snap} player={player} />
      <BidWar snap={snap} player={player} />
      {result && (
        <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-ink-950/80 backdrop-blur-[3px]">
          <div key={live.seq} className="animate-slam text-center" style={{ transform: 'rotate(-8deg)' }}>
            <div
              className={`inline-block rounded-3xl border-[12px] px-10 py-0 font-stage font-extrabold tracking-[0.14em] text-[clamp(4.5rem,11vw,11rem)] ${
                result.kind === 'sold' ? 'border-red-500 text-red-500' : 'border-slate-400 text-slate-300'
              }`}
              style={{ textShadow: '0 0 50px currentColor' }}
            >
              {result.kind === 'sold' ? 'SOLD!' : 'UNSOLD'}
            </div>
            {result.kind === 'sold' && winner && (
              <div className="mt-4 font-stage text-[clamp(2rem,4.4vw,4.6rem)] font-bold tracking-wide" style={{ color: winner.color }}>
                {player.name} → {winner.team}
                <div className="text-[0.8em] text-white">for {formatMoney(result.price ?? 0, snap.settings)}</div>
              </div>
            )}
          </div>
        </div>
      )}
      {result?.kind === 'sold' && <Confetti burstKey={live.seq} count={90} />}
    </div>
  );
}

// =============================================================================================
// Left: the player
// =============================================================================================

function PlayerCard({ snap, player }: { snap: Snapshot; player: Player }) {
  const { settings, live } = snap;
  const d = settings.display;
  const longest = Math.max(...player.name.split(/\s+/).map((w) => w.length), player.name.length / 2.2);
  // shrink for long single words AND for long names overall, so nothing is ever cut off
  const vw = Math.max(1.7, Math.min(8.2, 76 / longest, 170 / Math.max(player.name.length, 1)));
  const bidding = live.phase === 'bidding' && !live.result;

  return (
    <div className="card relative flex h-full flex-col justify-end overflow-hidden p-0">
      {d.showPhoto && player.photo ? (
        <PlayerAvatar player={player} className="absolute inset-0 h-full w-full text-[clamp(2rem,6vw,6rem)] opacity-90" />
      ) : d.showPhoto ? (
        <div className="absolute inset-0" style={{ background: avatarGradient(player.name) }} />
      ) : (
        <div className="absolute inset-0" style={{ background: `radial-gradient(600px 400px at 30% 20%, ${settings.accent}33, transparent 70%)` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/5" />
      <div className="relative z-10 flex flex-col gap-2 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip border-gold/40 bg-gold/15 text-gold">Round {snap.round}</span>
          {d.showRole && player.role && <span className="chip bg-black/40">{player.role}</span>}
          {bidding && <span className="chip border-emerald-400/40 bg-emerald-400/15 text-emerald-300">● LIVE</span>}
        </div>
        <h2 className="font-stage font-extrabold uppercase leading-[0.9] tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]" style={{ fontSize: `min(${vw}vw, 15vh)` }}>
          {player.name}
        </h2>
        {d.showDescription && player.description && <p className="line-clamp-3 max-w-[40ch] text-[clamp(0.95rem,1.35vw,1.4rem)] text-slate-200">{player.description}</p>}
        {d.showBasePrice && (
          <p className="text-sm font-bold uppercase tracking-widest text-slate-300">
            Base price <span className="text-white">{formatMoney(effectiveBase(settings, player), settings)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================================
// Right: the bidding war
// =============================================================================================

/** Notices the standing bid moving up (new bid) or down (a bid was undone) for the same player. */
function useBidMotion(playerId: string | null, amount: number) {
  const prev = useRef<{ pid: string | null; amount: number } | null>(null);
  const [motion, setMotion] = useState<{ dir: 'up' | 'down'; delta: number; key: number } | null>(null);
  useEffect(() => {
    const p = prev.current;
    if (p && p.pid === playerId && p.amount !== amount) setMotion({ dir: amount > p.amount ? 'up' : 'down', delta: Math.abs(amount - p.amount), key: Date.now() });
    else if (!p || p.pid !== playerId) setMotion(null);
    prev.current = { pid: playerId, amount };
  }, [playerId, amount]);
  return motion;
}

const CALL_TEXT = ['', 'GOING ONCE…', 'GOING TWICE…', 'GOING THRICE!'];
const CALL_COLOR = ['', 'text-gold', 'text-orange-400', 'text-red-500'];

function hypeTags(snap: Snapshot, player: Player, bids: Bid[]): string[] {
  const tags: string[] = [];
  const top = bids[bids.length - 1];
  if (bids.length === 0) return ['👀 WHO WILL OPEN THE BIDDING?'];
  const record = Math.max(0, ...snap.players.filter((p) => p.status === 'sold' && p.id !== player.id).map((p) => p.price));
  if (record > 0 && top.amount > record) tags.push('🏆 NEW RECORD PRICE');
  const last4 = bids.slice(-4);
  if (last4.length === 4 && last4[0].captainId === last4[2].captainId && last4[1].captainId === last4[3].captainId && last4[0].captainId !== last4[1].captainId) {
    const a = snap.captains.find((c) => c.id === last4[2].captainId)?.team;
    const b = snap.captains.find((c) => c.id === last4[3].captainId)?.team;
    tags.push(`⚔️ ${a} vs ${b}`);
  }
  if (bids.length >= 6) tags.push('🔥 BIDDING WAR');
  if (top.amount >= effectiveBase(snap.settings, player) * 5) tags.push('💎 PREMIUM PLAYER');
  if (snap.live.call === 3) tags.push('⏳ LAST CALL');
  return tags.slice(0, 3);
}

function BidWar({ snap, player }: { snap: Snapshot; player: Player }) {
  const { live, settings } = snap;
  const fmt = (n: number) => formatMoney(n, settings);
  const top = live.bids[live.bids.length - 1];
  const leader = top ? snap.captains.find((c) => c.id === top.captainId) : undefined;
  const base = effectiveBase(settings, player);
  const shown = top?.amount ?? base;
  const motion = useBidMotion(player.id, shown);
  const nextAmount = nextBidAmount(settings, player, live.bids);
  const sold = live.result?.kind === 'sold';
  const open = live.phase === 'bidding' && !live.result;
  const tags = open ? hypeTags(snap, player, live.bids) : [];

  const ev = live.lastEvent;
  const freshBid = ev?.type === 'bid' && snap.now - ev.at < 2500 ? ev.seq : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* ---- the number ---- */}
      <div className="card relative flex flex-[1.45] flex-col items-center justify-center overflow-hidden px-4 py-1.5 text-center">
        {leader && <div className="pointer-events-none absolute inset-0 opacity-25 transition-colors duration-500" style={{ background: `radial-gradient(500px 260px at 50% 55%, ${leader.color}, transparent 70%)` }} />}
        <div className="relative flex w-full flex-wrap items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
          <span>{sold ? 'Sold for' : top ? 'Current bid' : 'Opening bid'}</span>
          {live.bids.length > 0 && <span className="chip !text-[11px] tracking-normal">{live.bids.length} bid{live.bids.length === 1 ? '' : 's'}</span>}
        </div>

        <div className={`relative my-1 ${open ? 'animate-beat' : ''}`}>
          <div
            key={`${shown}-${motion?.key ?? 0}`}
            className={`font-display font-extrabold leading-none tracking-tight ${motion?.dir === 'down' ? 'animate-dropflash' : 'animate-bump'}`}
            style={{ fontSize: 'min(6vw, 10vh)', color: motion?.dir === 'down' ? '#ff3d57' : (leader?.color ?? '#fff'), textShadow: leader ? `0 0 50px ${leader.color}66` : undefined }}
          >
            {fmt(shown)}
          </div>
          {motion && (
            <div
              key={motion.key}
              className={`pointer-events-none absolute -right-2 top-0 translate-x-full font-display font-bold text-[clamp(1.2rem,2.2vw,2.2rem)] ${
                motion.dir === 'up' ? 'animate-floatup text-emerald-400' : 'animate-fall text-red-400'
              }`}
            >
              {motion.dir === 'up' ? '▲ +' : '▼ −'}
              {fmt(motion.delta)}
            </div>
          )}
          {freshBid > 0 && <Sparks key={freshBid} color={leader?.color} />}
        </div>

        {leader ? (
          <div className="relative inline-flex items-center gap-2.5 rounded-full border-2 px-5 py-1 text-[clamp(1rem,1.6vw,1.6rem)] font-bold" style={{ borderColor: leader.color, color: leader.color, background: `${leader.color}1f` }}>
            <span>👑</span>
            {leader.logo ? <img src={leader.logo} alt="" className="h-7 w-7 rounded-full object-cover" /> : <TeamDot captain={leader} size={14} />}
            {leader.team}
            {leader.name && <span className="text-[0.75em] font-medium text-slate-300">· {leader.name}</span>}
          </div>
        ) : (
          <div className="relative text-lg text-slate-400">Waiting for the first bid…</div>
        )}

        <div className="relative mt-1 flex min-h-[3rem] items-center justify-center">
          {open && live.call > 0 ? (
            <div key={live.call} className={`animate-pop ${CALL_COLOR[live.call]}`}>
              <span className="font-stage text-[clamp(2rem,3.8vw,4rem)] font-extrabold tracking-[0.1em]">{CALL_TEXT[live.call]}</span>
              <span className="ml-3 inline-flex gap-1.5 align-middle">
                {[1, 2, 3].map((i) => (
                  <span key={i} className={`h-3 w-3 rounded-full ${i <= live.call ? 'bg-current' : 'bg-white/15'}`} />
                ))}
              </span>
            </div>
          ) : open ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {tags.map((t) => (
                <span key={t} className="animate-pop rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-bold text-gold">
                  {t}
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-sm text-slate-400">
                  Next bid <b className="text-white">{fmt(nextAmount)}</b>
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* ---- who is bidding what ---- */}
      <BidLadder snap={snap} player={player} nextAmount={nextAmount} />
    </div>
  );
}

function Sparks({ color }: { color?: string }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        emoji: ['🔥', '💰', '⚡', '✨', '🎯'][i % 5],
        sx: `${(Math.random() - 0.5) * 380}px`,
        sy: `${-60 - Math.random() * 150}px`,
        sr: `${(Math.random() - 0.5) * 120}deg`,
        dur: `${0.9 + Math.random() * 0.7}s`,
        size: 18 + Math.random() * 22,
        left: 20 + Math.random() * 60,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden style={{ filter: color ? `drop-shadow(0 0 6px ${color})` : undefined }}>
      {bits.map((b) => (
        <span key={b.id} className="absolute top-1/2 animate-spark" style={{ left: `${b.left}%`, fontSize: b.size, ['--sx' as string]: b.sx, ['--sy' as string]: b.sy, ['--sr' as string]: b.sr, ['--dur' as string]: b.dur } as CSSProperties}>
          {b.emoji}
        </span>
      ))}
    </div>
  );
}

function BidLadder({ snap, player, nextAmount }: { snap: Snapshot; player: Player; nextAmount: number }) {
  const { live, settings } = snap;
  const fmt = (n: number) => formatMoney(n, settings);
  const top = live.bids[live.bids.length - 1];
  const open = live.phase === 'bidding' && !live.result;
  const ev = live.lastEvent;
  const justBid = ev?.type === 'bid' && snap.now - ev.at < 2500 ? ev : null;

  // each team's best bid on this player
  const best = new Map<string, number>();
  for (const b of live.bids) best.set(b.captainId, Math.max(best.get(b.captainId) ?? 0, b.amount));
  const topAmount = top?.amount ?? 0;

  const rows = snap.captains
    .map((c) => {
      const amount = best.get(c.id) ?? 0;
      let state: 'leading' | 'bidding' | 'in' | 'out' = amount > 0 ? 'bidding' : 'in';
      if (top?.captainId === c.id) state = 'leading';
      else if (open && !checkBid(snap, c, nextAmount).ok) state = 'out';
      return { c, amount, state };
    })
    .sort((a, b) => b.amount - a.amount || (a.state === 'out' ? 1 : 0) - (b.state === 'out' ? 1 : 0));

  const MAX_ROWS = 6;
  const shownRows = rows.slice(0, MAX_ROWS);
  const hidden = rows.slice(MAX_ROWS);

  return (
    <div className="card flex min-h-0 flex-1 flex-col p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
        <span>Who's bidding</span>
        {open && <span className="normal-case tracking-normal text-slate-500">Next bid {fmt(nextAmount)}</span>}
      </div>
      <ul className="flex min-h-0 flex-1 flex-col justify-around gap-1.5">
        {shownRows.map(({ c, amount, state }, i) => {
          const pct = topAmount > 0 ? Math.max(6, (amount / topAmount) * 100) : 0;
          const lead = state === 'leading';
          const flash = justBid?.captainId === c.id;
          return (
            <li
              key={c.id}
              className={`relative flex min-h-0 flex-1 items-center gap-3 overflow-hidden rounded-xl px-3 transition-opacity ${state === 'out' ? 'opacity-35' : ''} ${lead ? 'animate-glow' : ''}`}
              style={{ background: '#0d0d24', ['--glow' as string]: `${c.color}66`, outline: lead ? `2px solid ${c.color}` : '1px solid rgba(255,255,255,0.06)' } as CSSProperties}
            >
              <div className="absolute inset-y-0 left-0 transition-all duration-500 ease-out" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c.color}55, ${c.color}15)` }} />
              <span className="relative w-5 text-center font-display text-sm font-bold text-slate-500">{amount > 0 ? i + 1 : ''}</span>
              <span className="relative flex min-w-0 flex-1 items-center gap-2">
                {c.logo ? <img src={c.logo} alt="" className="h-6 w-6 rounded-full object-cover" /> : <TeamDot captain={c} size={12} />}
                <span className="truncate font-bold" style={{ color: c.color, fontSize: 'min(1.5vw, 3.1vh)' }}>
                  {c.team}
                </span>
                {c.name && <span className="hidden truncate text-sm text-slate-400 xl:inline">· {c.name}</span>}
                {lead && <span>👑</span>}
              </span>
              <span className="relative text-right">
                {amount > 0 ? (
                  <span key={flash ? ev!.seq : 'x'} className={`inline-block font-display font-bold leading-none ${flash ? 'animate-bump' : ''}`} style={{ fontSize: 'min(2.2vw, 4.4vh)' }}>
                    {fmt(amount)}
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-slate-500">{state === 'out' ? 'OUT · can’t afford' : open ? 'not bid yet' : '—'}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {hidden.length > 0 && (
        <p className="mt-1.5 truncate text-xs text-slate-500">
          Also in: {hidden.map((r) => r.c.team).join(', ')}
        </p>
      )}
    </div>
  );
}

// =============================================================================================
// Bottom: every team's squad
// =============================================================================================

function TeamsRail({ snap }: { snap: Snapshot }) {
  const { captains, live } = snap;
  const leaderId = live.phase === 'bidding' ? live.bids[live.bids.length - 1]?.captainId : undefined;
  const justSold = live.result?.kind === 'sold' ? live.result : null;
  // With many teams there is no room to list every squad, so show one compact tile per team
  // (the full squads are on the Team board screen).
  const compact = captains.length > 8;
  const cols = captains.length <= 5 ? captains.length || 1 : Math.ceil(captains.length / 2);

  if (captains.length === 0) return null;
  if (compact) {
    return (
      <AutoScroll className="min-h-[260px] flex-1">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
          {captains.map((c) => (
            <TeamCard key={c.id} snap={snap} captain={c} compact leading={leaderId === c.id} justSoldId={justSold?.captainId === c.id ? justSold.playerId : undefined} />
          ))}
        </div>
      </AutoScroll>
    );
  }
  return (
    <div className="grid min-h-[260px] flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {captains.map((c) => (
        <TeamCard key={c.id} snap={snap} captain={c} leading={leaderId === c.id} justSoldId={justSold?.captainId === c.id ? justSold.playerId : undefined} />
      ))}
    </div>
  );
}

function TeamCard({ snap, captain: c, leading, justSoldId, compact = false }: { snap: Snapshot; captain: Captain; leading: boolean; justSoldId?: string; compact?: boolean }) {
  const { settings } = snap;
  const st = teamStats(snap, c);
  const squad = [...st.players].sort((a, b) => b.price - a.price);
  const pct = c.budget > 0 ? Math.max(0, Math.min(100, (st.remaining / c.budget) * 100)) : 0;
  const limit = maxBid(snap, c, snap.live.playerId);
  return (
    <div
      className={`card relative flex min-h-0 flex-col overflow-hidden p-3 transition ${leading ? 'animate-glow' : ''}`}
      style={{ ['--glow' as string]: `${c.color}77`, borderColor: leading || justSoldId ? c.color : undefined } as CSSProperties}
    >
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: c.color }} />
      <div className="mt-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {c.logo && <img src={c.logo} alt="" className="h-6 w-6 rounded-full object-cover" />}
            <h3 className="truncate font-display text-[clamp(1.05rem,1.7vw,1.7rem)] font-extrabold leading-tight" style={{ color: c.color }}>
              {c.team}
            </h3>
          </div>
          <p className="truncate text-[11px] text-slate-400">
            {c.name ? `${c.name} · ` : ''}
            {st.count} player{st.count === 1 ? '' : 's'} · spent {formatMoney(st.spent, settings)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Purse left</div>
          <div className={`font-display text-[clamp(1.1rem,1.9vw,1.9rem)] font-bold leading-none ${st.remaining < 0 ? 'text-red-400' : ''}`}>{formatMoney(st.remaining, settings)}</div>
        </div>
      </div>
      <div className="mt-2 h-1.5 shrink-0 overflow-hidden rounded-full bg-ink-900">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c.color }} />
      </div>
      {compact && (
        <p className="mt-1.5 flex shrink-0 justify-between text-[11px] text-slate-400">
          <span>{st.count} players</span>
          <span>Max bid {formatMoney(Math.max(0, limit), settings)}</span>
        </p>
      )}
      {!compact && <p className="mt-1 shrink-0 text-[10px] text-slate-500">Max bid {formatMoney(Math.max(0, limit), settings)}</p>}

      {!compact && (
      <AutoScroll className="mt-1.5 min-h-0 flex-1">
        {squad.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">No players yet</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
            {squad.map((p) => {
              const fresh = p.id === justSoldId;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-1.5 rounded-lg bg-ink-900/90 p-1 pr-2 ${fresh ? 'animate-pop ring-2 ring-gold' : ''}`}
                  style={fresh ? { boxShadow: `0 0 24px ${c.color}` } : undefined}
                >
                  <PlayerAvatar player={p} showPhoto={settings.display.showPhoto} className="h-7 w-7 shrink-0 rounded-md text-[7px]" />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{p.name}</span>
                  <span className="shrink-0 text-xs font-bold text-gold">{formatMoney(p.price, settings)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </AutoScroll>
      )}
    </div>
  );
}

/** If a squad is longer than its card, drift slowly up and down so every player gets seen. */
function AutoScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let running = false;
    let pos = 0;
    let dir = 1;
    let pause = 2000;
    let last = 0;
    const loop = (t: number) => {
      const dt = Math.min(64, t - last);
      last = t;
      const max = el.scrollHeight - el.clientHeight;
      if (pause > 0) pause -= dt;
      else {
        pos = Math.max(0, Math.min(max, pos + dir * dt * 0.03));
        el.scrollTop = pos;
        if (pos >= max || pos <= 0) {
          dir = -dir;
          pause = 2500;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    // Only animate when there is something to scroll; otherwise stay completely idle.
    const check = () => {
      const needs = el.scrollHeight - el.clientHeight > 4;
      if (needs && !running) {
        running = true;
        last = performance.now();
        pos = el.scrollTop;
        raf = requestAnimationFrame(loop);
      } else if (!needs && running) {
        running = false;
        cancelAnimationFrame(raf);
        pos = 0;
        el.scrollTop = 0;
      }
    };
    const id = setInterval(check, 1000);
    check();
    return () => {
      clearInterval(id);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className={`overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {children}
    </div>
  );
}
