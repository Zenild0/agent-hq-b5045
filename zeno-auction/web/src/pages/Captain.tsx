import { Gavel } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatMoney } from '../../../shared/money';
import { checkBid, maxBid, nextBidAmount, stepFor, teamStats } from '../../../shared/rules';
import type { Snapshot } from '../../../shared/types';
import { HeartPill, Heartbeat } from '../components/Heartbeat';
import { KeyPrompt } from '../components/KeyPrompt';
import { PageTitle } from '../components/PageTitle';
import { PracticeBanner } from '../components/PracticeBanner';
import { PurseRing } from '../components/PurseRing';
import { StrategyTab } from '../components/StrategyTab';
import { RoomGate, SoundControls } from '../components/RoomGate';
import { Stage } from '../components/Stage';
import { TeamBoard, TeamStrip } from '../components/TeamBoard';
import { LogoMark, PlayerAvatar, Tabs } from '../components/ui';
import { usePageKey } from '../lib/session';
import { useAuctionSound, useSoundPrefs } from '../lib/sound';
import { useTempo } from '../lib/tempo';
import { useRoom } from '../lib/useRoom';

export default function Captain() {
  const code = useParams().code!.toUpperCase();
  const key = usePageKey(code, 'captain');
  const room = useRoom(code, key);
  const [prefs, updatePrefs] = useSoundPrefs({ sfx: false, voice: false });
  const [tab, setTab] = useState<'squad' | 'strategy' | 'teams'>('squad');
  const [busy, setBusy] = useState(false);
  useAuctionSound(room.snap, prefs);
  const tempo = useTempo(room.snap, room.serverNow);

  // When the auctioneer calls a strategy break, open the planning tab for the captain.
  const onBreak = !!room.snap?.live.break;
  useEffect(() => {
    if (onBreak) setTab('strategy');
  }, [onBreak]);

  return (
    <RoomGate room={room} code={code}>
      {(snap) => {
        if (snap.me.role !== 'captain' || !snap.me.captainId)
          return <KeyPrompt upper title="Captain login" hint="Enter the 6-character PIN from the link the host sent you." />;

        const me = snap.captains.find((c) => c.id === snap.me.captainId);
        if (!me) return <KeyPrompt upper title="Captain login" hint="Your team was removed from this auction." />;

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

        const planItem = open ? snap.strategy?.find((i) => i.playerId === live.playerId) : undefined;

        return (
          <>
          <PageTitle title={`${me.team} · Captain`} />
          <PracticeBanner snap={snap} />
          <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-3 pb-48 sm:p-5 sm:pb-48" style={{ ['--accent' as string]: me.color }}>
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <LogoMark size={32} />
                <span className="font-display text-lg font-extrabold tracking-tight">
                  Zeno<span className="text-gold-grad">Bid</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <HeartPill tempo={tempo} className="!px-2.5 !py-1" />
                <SoundControls prefs={prefs} update={updatePrefs} />
              </div>
            </header>

            <section className="card relative overflow-hidden p-4 sm:p-5" style={{ boxShadow: `0 1px 0 rgba(255,255,255,0.07) inset, 0 24px 48px -28px rgba(0,0,0,0.75), 0 0 60px -28px ${me.color}` }}>
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${me.color}, transparent)` }} />
              <div className="flex items-center gap-4">
                <PurseRing remaining={st.remaining} total={me.budget} fmt={settings} color={me.color} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-2xl font-extrabold leading-tight" style={{ color: me.color }}>
                    {me.team}
                  </div>
                  <div className="truncate text-xs text-slate-400">{me.name ? `Captain ${me.name}` : 'Captain'}</div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                    {[
                      ['Squad', `${st.count}${settings.maxSquad ? `/${settings.maxSquad}` : ''}`],
                      ['Max bid', formatMoney(Math.max(0, limit), settings)],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-ink-900/70 px-1.5 py-1.5">
                        <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{k}</dt>
                        <dd className="num truncate text-sm font-bold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </section>

            {planItem && (
              <div
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                  min > planItem.budget ? 'border-red-400/50 bg-red-500/10 text-red-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                }`}
              >
                <span>🎯 In your plan — up to {formatMoney(planItem.budget, settings)}</span>
                {min > planItem.budget && <span>Next bid is above your plan</span>}
              </div>
            )}

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
                { id: 'strategy', label: `Strategy (${snap.strategy?.length ?? 0})` },
                { id: 'teams', label: 'All teams' },
              ]}
            />
            {tab === 'strategy' ? (
              <StrategyTab snap={snap} room={room} me={me} />
            ) : tab === 'squad' ? (
              <div className="space-y-2">
                {st.players.length === 0 && <p className="card p-6 text-center text-sm text-slate-400">No players yet — go win some!</p>}
                {st.players.map((p) => (
                  <div key={p.id} className="card flex items-center gap-3 p-2.5">
                    <PlayerAvatar player={p} showPhoto={settings.display.showPhoto} className="h-12 w-12 rounded-xl text-xs" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="truncate text-xs text-slate-400">{p.role}</div>
                    </div>
                    <div className="num font-bold text-gold">{formatMoney(p.price, settings)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <TeamBoard snap={snap} highlightId={me.id} />
            )}

            {/* ---- bid bar ---- */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--hairline)] bg-ink-950/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-4" style={{ ['--beat' as string]: `${tempo.beat}s` } as React.CSSProperties}>
              <div className="mx-auto max-w-3xl">
                <Heartbeat tempo={tempo} color={tempo.intensity > 0.55 ? '#ff5c7a' : me.color} className="mb-1 h-5 w-full opacity-80" />
                <StatusLine open={open} iLead={iLead} outbid={open && iBidOnThis && !iLead} reason={block.ok ? '' : block.reason} />
                <button
                  disabled={!block.ok || busy}
                  onClick={() => place(min)}
                  className={`relative isolate w-full overflow-hidden rounded-2xl py-4 font-display text-2xl font-extrabold tracking-tight transition active:scale-[0.97] disabled:opacity-45 ${block.ok ? 'animate-beat text-ink-950' : iLead ? 'text-emerald-950' : 'text-slate-300'}`}
                  style={{
                    background: block.ok ? 'var(--gold-grad)' : iLead ? 'linear-gradient(135deg,#6ee7b7,#34d399 55%,#10b981)' : 'rgba(160,190,255,0.12)',
                    boxShadow: block.ok ? '0 1px 0 rgba(255,255,255,.6) inset, 0 12px 34px -8px rgba(242,184,75,.7)' : undefined,
                  }}
                >
                  {block.ok && <span className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-1/3 animate-shine bg-gradient-to-r from-transparent via-white/45 to-transparent" />}
                  <Gavel className="mr-2 inline h-6 w-6 -translate-y-0.5" />
                  {open ? (block.ok ? `BID ${formatMoney(min, settings)}` : iLead ? 'YOU LEAD' : 'CAN’T BID') : 'WAITING…'}
                </button>
                {block.ok && jumps.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {jumps.map((j) => (
                      <button key={j} disabled={busy || !checkBid(snap, me, j).ok} onClick={() => place(j)} className="btn-ghost !py-2 !text-sm">
                        Jump {formatMoney(j, settings)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </>
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
