import { Gavel, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatMoney } from '../../../shared/money';
import { checkBid, maxBid, nextBidAmount, stepFor, teamStats } from '../../../shared/rules';
import type { Snapshot } from '../../../shared/types';
import { KeyPrompt } from '../components/KeyPrompt';
import { RoomGate, SoundControls } from '../components/RoomGate';
import { Stage } from '../components/Stage';
import { TeamBoard, TeamStrip } from '../components/TeamBoard';
import { Logo, PlayerAvatar, Tabs } from '../components/ui';
import { usePageKey } from '../lib/session';
import { useAuctionSound, useSoundPrefs } from '../lib/sound';
import { useRoom } from '../lib/useRoom';

export default function Captain() {
  const code = useParams().code!.toUpperCase();
  const key = usePageKey(code, 'captain');
  const room = useRoom(code, key);
  const [prefs, updatePrefs] = useSoundPrefs({ sfx: false, voice: false });
  const [tab, setTab] = useState<'squad' | 'teams'>('squad');
  const [busy, setBusy] = useState(false);
  useAuctionSound(room.snap, prefs);

  return (
    <RoomGate room={room} code={code}>
      {(snap) => {
        if (snap.me.role !== 'captain' || !snap.me.captainId)
          return <KeyPrompt upper title="CAPTAIN LOGIN" hint="Enter the 6-character PIN from the link the host sent you." />;

        const me = snap.captains.find((c) => c.id === snap.me.captainId);
        if (!me) return <KeyPrompt upper title="CAPTAIN LOGIN" hint="Your team was removed from this auction." />;

        const st = teamStats(snap, me);
        const { live, settings } = snap;
        const player = snap.players.find((p) => p.id === live.playerId);
        const top = live.bids[live.bids.length - 1];
        const iLead = top?.captainId === me.id;
        const iBidOnThis = live.bids.some((b) => b.captainId === me.id);
        const min = player ? nextBidAmount(settings, player, live.bids) : 0;
        const open = live.phase === 'bidding' && !!player;
        const block = open ? checkBid(snap, me, min) : { ok: false as const, reason: 'Waiting for the next player' };
        const limit = maxBid(snap, me, live.playerId);

        // "jump" amounts above the minimum, following the increment tiers
        const jumps: number[] = [];
        let a = min;
        for (let i = 0; i < 3 && open; i++) {
          a += stepFor(settings.increments, a);
          jumps.push(a);
        }

        const place = async (amount: number) => {
          if (busy) return;
          setBusy(true);
          const ok = await room.act('bid', { amount });
          setBusy(false);
          if (ok && navigator.vibrate) navigator.vibrate(30);
        };

        return (
          <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-3 pb-44 sm:p-5 sm:pb-44" style={{ ['--accent' as string]: me.color }}>
            <header className="flex items-center justify-between gap-2">
              <Logo />
              <SoundControls prefs={prefs} update={updatePrefs} />
            </header>

            <section className="card relative overflow-hidden p-4">
              <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: me.color }} />
              <div className="flex items-center justify-between gap-3 pl-2">
                <div className="min-w-0">
                  <div className="truncate font-display text-3xl tracking-wide" style={{ color: me.color }}>
                    {me.team}
                  </div>
                  <div className="text-xs text-slate-400">
                    {me.name ? `Captain ${me.name} · ` : ''}Squad {st.count}
                    {settings.maxSquad ? `/${settings.maxSquad}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <Wallet className="h-3 w-3" /> Purse left
                  </div>
                  <div className="font-display text-4xl leading-none">{formatMoney(st.remaining, settings)}</div>
                  <div className="text-[11px] text-slate-400">Max bid {formatMoney(Math.max(0, limit), settings)}</div>
                </div>
              </div>
            </section>

            {snap.live.screen === 'board' && live.phase === 'idle' ? (
              <TeamBoard snap={snap} highlightId={me.id} />
            ) : (
              <Stage snap={snap} serverNow={room.serverNow} compact tickSound={prefs.sfx} />
            )}

            <TeamStrip snap={snap} leaderId={top?.captainId} />

            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'squad', label: `My squad (${st.count})` },
                { id: 'teams', label: 'All teams' },
              ]}
            />
            {tab === 'squad' ? (
              <div className="space-y-2">
                {st.players.length === 0 && <p className="card p-6 text-center text-sm text-slate-400">No players yet — go win some!</p>}
                {st.players.map((p) => (
                  <div key={p.id} className="card flex items-center gap-3 p-2.5">
                    <PlayerAvatar player={p} showPhoto={settings.display.showPhoto} className="h-12 w-12 rounded-xl text-xs" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="truncate text-xs text-slate-400">{p.role}</div>
                    </div>
                    <div className="font-bold text-gold">{formatMoney(p.price, settings)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <TeamBoard snap={snap} highlightId={me.id} />
            )}

            {/* ---- bid bar ---- */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/95 p-3 backdrop-blur sm:p-4">
              <div className="mx-auto max-w-3xl">
                <StatusLine open={open} iLead={iLead} outbid={open && iBidOnThis && !iLead} reason={block.ok ? '' : block.reason} />
                <button
                  disabled={!block.ok || busy}
                  onClick={() => place(min)}
                  className="relative w-full overflow-hidden rounded-2xl py-4 font-display text-3xl tracking-wide text-ink-950 transition active:scale-[0.98] disabled:opacity-35"
                  style={{ background: block.ok ? me.color : '#475569' }}
                >
                  <Gavel className="mr-2 inline h-7 w-7 -translate-y-0.5" />
                  {open ? (block.ok ? `BID ${formatMoney(min, settings)}` : iLead ? 'YOU LEAD' : 'CAN’T BID') : 'WAITING…'}
                </button>
                {block.ok && jumps.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {jumps.map((j) => (
                      <button
                        key={j}
                        disabled={busy || !checkBid(snap, me, j).ok}
                        onClick={() => place(j)}
                        className="btn-ghost !py-2 !text-sm"
                      >
                        Jump {formatMoney(j, settings)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }}
    </RoomGate>
  );
}

function StatusLine({ open, iLead, outbid, reason }: { open: boolean; iLead: boolean; outbid: boolean; reason: string }) {
  let text = '';
  let cls = 'text-slate-400';
  if (iLead) (text = '🎯 You hold the top bid'), (cls = 'text-emerald-300');
  else if (outbid) (text = '⚡ You were outbid!'), (cls = 'text-hot animate-shake');
  else if (open && reason) text = reason;
  else if (!open) text = 'Bidding opens when the next player is on the block';
  return <div className={`mb-2 text-center text-xs font-semibold ${cls}`}>{text || ' '}</div>;
}

export type { Snapshot };
