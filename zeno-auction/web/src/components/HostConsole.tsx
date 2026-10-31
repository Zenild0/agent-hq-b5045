import { Eye, LayoutGrid, Search, Shuffle, Undo2, Gavel, SkipForward, RotateCcw, ListOrdered, Timer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '../../../shared/money';
import { checkBid, effectiveBase, nextBidAmount } from '../../../shared/rules';
import type { Snapshot } from '../../../shared/types';
import { fmtClock, useCountdown } from '../lib/useCountdown';
import type { Room } from '../lib/useRoom';
import { Stage } from './Stage';
import { TeamStrip } from './TeamBoard';
import { PlayerAvatar, TeamDot } from './ui';

const CALL_LABEL = ['GOING ONCE…', 'GOING TWICE…', 'GOING THRICE…', 'SOLD! 🔨'];
const CALL_STYLE = ['bg-gold text-ink-950', 'bg-orange-500 text-white', 'bg-red-600 text-white', 'bg-emerald-500 text-ink-950'];

export function HostConsole({ snap, room, tickSound }: { snap: Snapshot; room: Room; tickSound: boolean }) {
  const { live, settings } = snap;
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');

  const player = snap.players.find((p) => p.id === live.playerId);
  const onBlock = live.phase === 'spinning' || live.phase === 'bidding' ? live.playerId : null;
  const pool = snap.players.filter((p) => p.status === 'available' && p.id !== onBlock);
  const unsold = snap.players.filter((p) => p.status === 'unsold');
  const roles = useMemo(() => [...new Set(pool.map((p) => p.role).filter(Boolean))].sort(), [pool.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = live.bids[live.bids.length - 1];
  const hasBids = live.bids.length > 0;
  const spinning = live.phase === 'spinning';
  const bidding = live.phase === 'bidding';
  const finished = live.phase === 'sold' || live.phase === 'unsold';
  const onBreak = !!live.break;
  const canDraw = (live.phase === 'idle' || finished) && !onBreak;

  const run = async (action: string, params: unknown = {}) => {
    if (busy) return;
    setBusy(true);
    await room.act(action, params);
    setBusy(false);
  };

  // The one big button the auctioneer keeps hitting.
  const primary = (() => {
    if (onBreak) return { label: 'END BREAK ▶', disabled: false, style: 'bg-emerald-500 text-ink-950', onClick: () => run('break.end') };
    if (spinning) return { label: 'Wheel spinning…', disabled: true, style: 'bg-ink-600 text-slate-300', onClick: () => {} };
    if (bidding) {
      if (!hasBids) return { label: 'Waiting for a bid…', disabled: true, style: 'bg-ink-600 text-slate-300', onClick: () => {} };
      return { label: CALL_LABEL[live.call], disabled: false, style: CALL_STYLE[live.call], onClick: () => run(live.call >= 3 ? 'sold' : 'call') };
    }
    if (finished) {
      const label = settings.drawMode === 'random' ? 'SPIN FOR NEXT PLAYER' : settings.drawMode === 'sequential' ? 'NEXT PLAYER' : 'NEXT';
      return { label: `${label} ▶`, disabled: false, style: 'bg-gold text-ink-950', onClick: () => run('next') };
    }
    if (pool.length === 0) return { label: unsold.length ? `Round ${snap.round} complete` : 'No players left', disabled: true, style: 'bg-ink-600 text-slate-300', onClick: () => {} };
    if (settings.drawMode === 'manual') return { label: 'Pick a player below ↓', disabled: true, style: 'bg-ink-600 text-slate-300', onClick: () => {} };
    return {
      label: settings.drawMode === 'random' ? '🎡 SPIN THE WHEEL' : 'NEXT PLAYER ▶',
      disabled: false,
      style: 'bg-gold text-ink-950',
      onClick: () => run('draw', role ? { role } : {}),
    };
  })();

  // Space bar = the big button, for a hands-free-ish auctioneer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== 'Space' || /INPUT|TEXTAREA|SELECT|BUTTON/.test(el.tagName)) return;
      e.preventDefault();
      if (!primary.disabled) primary.onClick();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const visiblePool = pool.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.role.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      {/* ---------------- what the room sees ---------------- */}
      <div className="min-w-0 space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-bold uppercase tracking-widest">Preview of the big screen</span>
          <span>
            Round {snap.round} · {pool.length} in pool · {unsold.length} unsold · {snap.players.filter((p) => p.status === 'sold').length} sold
          </span>
        </div>
        <Stage snap={snap} serverNow={room.serverNow} compact tickSound={tickSound} />
        <TeamStrip snap={snap} leaderId={top?.captainId} />
      </div>

      {/* ---------------- controls ---------------- */}
      <div className="min-w-0 space-y-4">
        <div className="card space-y-3 p-4">
          <button
            disabled={primary.disabled || busy}
            onClick={primary.onClick}
            className={`w-full rounded-2xl px-4 py-6 font-display text-[clamp(1.8rem,3.2vw,2.8rem)] tracking-wide transition active:scale-[0.98] disabled:opacity-60 ${primary.style}`}
          >
            {primary.label}
          </button>
          <p className="text-center text-xs text-slate-500">
            Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono">Space</kbd> to do this from the keyboard
          </p>

          {bidding && (
            <div className="grid grid-cols-3 gap-2">
              <button className="btn-ghost !text-xs" disabled={!hasBids || busy} onClick={() => run('undoBid')}>
                <Undo2 className="h-4 w-4" /> Undo bid
              </button>
              <button className="btn-ghost !text-xs" disabled={!hasBids || busy} onClick={() => run('sold')}>
                <Gavel className="h-4 w-4" /> Sell now
              </button>
              <button className="btn-danger !text-xs" disabled={hasBids || busy} onClick={() => run('unsold')}>
                <SkipForward className="h-4 w-4" /> No sale
              </button>
            </div>
          )}

          {finished && (
            <button className="btn-ghost w-full !text-xs" disabled={busy} onClick={() => run('reopen')}>
              <RotateCcw className="h-4 w-4" /> Take that back (re-open this player)
            </button>
          )}

          {player && (spinning || bidding || finished) && (
            <button
              className="btn-danger w-full !text-xs"
              disabled={busy}
              onClick={() => {
                const n = live.bids.length;
                const sold = live.phase === 'sold';
                const warn = sold
                  ? `Undo the sale and send ${player.name} back to the pool? ${snap.captains.find((c) => c.id === live.result?.captainId)?.team ?? 'The team'} gets the money back.`
                  : n > 0
                    ? `Send ${player.name} back to the pool? The ${n} bid${n === 1 ? '' : 's'} so far will be discarded.`
                    : '';
                if (!warn || confirm(warn)) run('unblock');
              }}
            >
              <Undo2 className="h-4 w-4" /> Send {player.name} back to the pool &amp; reset the screen
            </button>
          )}

          {canDraw && pool.length > 0 && (
            <div className="flex items-center gap-2">
              <Shuffle className="h-4 w-4 shrink-0 text-slate-400" />
              <select className="input !py-2" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Draw from">
                <option value="">Spin from everyone ({pool.length})</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    Only {r} ({pool.filter((p) => p.role === r).length})
                  </option>
                ))}
              </select>
              <button className="btn-ghost !whitespace-nowrap !py-2 !text-xs" disabled={busy} onClick={() => run('draw', { mode: 'random', ...(role ? { role } : {}) })}>
                Spin
              </button>
              <button className="btn-ghost !whitespace-nowrap !py-2 !text-xs" disabled={busy} onClick={() => run('draw', { mode: 'sequential', ...(role ? { role } : {}) })}>
                <ListOrdered className="h-4 w-4" /> In order
              </button>
            </div>
          )}

          {canDraw && pool.length === 0 && unsold.length > 0 && (
            <div className="rounded-xl border border-gold/30 bg-gold/10 p-4 text-center">
              <p className="font-bold">Round {snap.round} is done.</p>
              <p className="mb-3 text-sm text-slate-300">
                {unsold.length} unsold player{unsold.length === 1 ? '' : 's'} are waiting. Top up purses in the Teams tab first if you like.
              </p>
              <button className="btn-primary" disabled={busy} onClick={() => run('round.next')}>
                Start round {snap.round + 1}
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              className={`btn-ghost flex-1 !py-2 !text-xs ${live.screen === 'stage' ? '!border-gold/50 !text-gold' : ''}`}
              onClick={() => run('screen.set', { screen: 'stage' })}
            >
              <Eye className="h-4 w-4" /> Big screen: auction
            </button>
            <button
              className={`btn-ghost flex-1 !py-2 !text-xs ${live.screen === 'board' ? '!border-gold/50 !text-gold' : ''}`}
              onClick={() => run('screen.set', { screen: 'board' })}
            >
              <LayoutGrid className="h-4 w-4" /> Big screen: team board
            </button>
          </div>
        </div>

        {(onBreak || live.phase === 'idle' || finished) && <BreakControls snap={snap} room={room} busy={busy} run={run} />}

        {/* ---- bid on behalf ---- */}
        {bidding && player && (
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Bid for a captain</h3>
              <span className="text-xs text-slate-500">When they shout it on Zoom</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {snap.captains.map((c) => {
                const amount = nextBidAmount(settings, player, live.bids);
                const verdict = checkBid(snap, c, amount);
                return (
                  <button
                    key={c.id}
                    disabled={!verdict.ok || busy}
                    onClick={() => run('bid', { captainId: c.id, amount })}
                    title={verdict.ok ? '' : verdict.reason}
                    className="flex items-center justify-between gap-2 rounded-xl border bg-ink-900 px-3 py-2.5 text-left transition hover:bg-ink-700 active:scale-[0.97] disabled:opacity-35"
                    style={{ borderColor: c.color + '88' }}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
                      <TeamDot captain={c} />
                      <span className="truncate">{c.team}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-gold">{formatMoney(amount, settings)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- pick from the pool ---- */}
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Players in the pool ({pool.length})</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input className="input !w-40 !py-1.5 !pl-8 !text-xs" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <ul className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
            {visiblePool.length === 0 && <li className="py-6 text-center text-sm text-slate-500">{pool.length === 0 ? 'Pool is empty.' : 'No match.'}</li>}
            {visiblePool.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 rounded-xl bg-ink-900/80 p-1.5 pr-2">
                <PlayerAvatar player={p} className="h-9 w-9 shrink-0 rounded-lg text-[10px]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="truncate text-[11px] text-slate-400">
                    {p.role || '—'} · base {formatMoney(effectiveBase(settings, p), settings)}
                  </div>
                </div>
                <button className="btn-ghost !px-3 !py-1.5 !text-xs" disabled={!canDraw || busy} onClick={() => run('pick', { playerId: p.id })}>
                  Bring on
                </button>
              </li>
            ))}
          </ul>
          {unsold.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs font-semibold text-slate-400">Unsold this round ({unsold.length})</summary>
              <ul className="mt-2 space-y-1.5">
                {unsold.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-xl bg-ink-900/80 px-3 py-1.5">
                    <span className="text-sm">{p.name}</span>
                    <button className="btn-ghost !px-3 !py-1 !text-xs" disabled={!canDraw || busy} onClick={() => run('pick', { playerId: p.id })}>
                      Try again now
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function BreakControls({ snap, room, busy, run }: { snap: Snapshot; room: Room; busy: boolean; run: (action: string, params?: unknown) => Promise<void> }) {
  const b = snap.live.break;
  const left = useCountdown(b?.endsAt ?? null, room.serverNow);
  const [mins, setMins] = useState('5');
  const [secs, setSecs] = useState('0');
  const seconds = Math.round((Number(mins) || 0) * 60 + (Number(secs) || 0));
  const valid = seconds >= 10 && seconds <= 7200;

  if (b) {
    return (
      <div className="card border-emerald-400/30 p-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300">
          <Timer className="h-4 w-4" /> {b.label} is running
        </div>
        <div className="my-2 text-center font-display text-7xl leading-none tracking-wide text-gold">{left > 0 ? fmtClock(left) : '0:00'}</div>
        <p className="mb-3 text-center text-xs text-slate-400">Everyone sees this countdown and the team board.</p>
        <div className="grid grid-cols-3 gap-2">
          <button className="btn-ghost !text-xs" disabled={busy} onClick={() => run('break.extend', { seconds: 60 })}>
            + 1 min
          </button>
          <button className="btn-ghost !text-xs" disabled={busy} onClick={() => run('break.extend', { seconds: 300 })}>
            + 5 min
          </button>
          <button className="btn-primary !text-xs" disabled={busy} onClick={() => run('break.end')}>
            End break now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
        <Timer className="h-4 w-4" /> Strategy break
      </h3>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[2, 5, 10, 15].map((m) => (
          <button
            key={m}
            className={`chip hover:bg-white/10 ${Number(mins) === m && Number(secs) === 0 ? '!border-gold !bg-gold/15 !text-gold' : ''}`}
            onClick={() => (setMins(String(m)), setSecs('0'))}
          >
            {m} min
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="label">Minutes</span>
          <input className="input" type="number" min={0} max={120} value={mins} onChange={(e) => setMins(e.target.value)} />
        </label>
        <label className="flex-1">
          <span className="label">Seconds</span>
          <input className="input" type="number" min={0} max={59} value={secs} onChange={(e) => setSecs(e.target.value)} />
        </label>
        <button className="btn-primary !py-2.5" disabled={!valid || busy} onClick={() => run('break.start', { seconds })}>
          Start break
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {valid ? `${fmtClock(seconds * 1000)} countdown on every screen, with the teams bought so far. You can end it early.` : 'Choose between 10 seconds and 2 hours.'}
      </p>
    </div>
  );
}
