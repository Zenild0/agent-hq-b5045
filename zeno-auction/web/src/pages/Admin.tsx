import { Check, ExternalLink, FlaskConical, Gavel, LayoutGrid, ListChecks, Play, Settings as SettingsIcon, Share2, Sparkles, Users } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { formatMoney } from '../../../shared/money';
import type { Snapshot } from '../../../shared/types';
import { HostConsole } from '../components/HostConsole';
import { KeyPrompt } from '../components/KeyPrompt';
import { PageTitle } from '../components/PageTitle';
import { PracticeBanner } from '../components/PracticeBanner';
import { RoomGate, SoundControls } from '../components/RoomGate';
import { Logo, SquadSortToggle } from '../components/ui';
import { PlayersTab } from '../components/admin/PlayersTab';
import { SettingsTab } from '../components/admin/SettingsTab';
import { ShareTab } from '../components/admin/ShareTab';
import { TeamsTab } from '../components/admin/TeamsTab';
import { TeamBoard } from '../components/TeamBoard';
import { saveEvent, usePageKey } from '../lib/session';
import { useAuctionSound, useSoundPrefs } from '../lib/sound';
import { useRoom } from '../lib/useRoom';

type Tab = 'control' | 'teams' | 'players' | 'board' | 'settings' | 'share';

export default function Admin() {
  const code = useParams().code!.toUpperCase();
  const key = usePageKey(code, 'admin');
  const room = useRoom(code, key);
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem(`zeno:tab:${code}`) as Tab) || 'teams');
  const [prefs, updatePrefs] = useSoundPrefs();
  useAuctionSound(room.snap, prefs);

  const name = room.snap?.settings.name;
  useEffect(() => {
    if (key && name && room.snap?.me.role === 'admin') saveEvent({ code, name, role: 'admin', key, at: Date.now() });
  }, [code, key, name, room.snap?.me.role]);

  const pick = (t: Tab) => {
    setTab(t);
    localStorage.setItem(`zeno:tab:${code}`, t);
  };

  return (
    <RoomGate room={room} code={code}>
      {(snap) => {
        if (snap.me.role !== 'admin') return <KeyPrompt title="Admin login" hint="Paste the admin key from the link you got when you created this auction." />;
        const players = snap.players.length;
        const ready = snap.captains.length >= 2 && players > 0;
        const left = snap.players.filter((p) => p.status === 'available').length;
        const sold = snap.players.filter((p) => p.status === 'sold');
        const phase = snap.live.break ? 'Break' : snap.live.phase === 'spinning' || snap.live.phase === 'bidding' ? 'Live' : snap.live.phase === 'idle' ? 'Idle' : 'Between players';

        const nav: { id: Tab; label: string; icon: ReactNode }[] = [
          { id: 'control', label: 'Run the auction', icon: <Play className="h-4 w-4" /> },
          { id: 'teams', label: `Teams (${snap.captains.length})`, icon: <Users className="h-4 w-4" /> },
          { id: 'players', label: `Players (${players})`, icon: <ListChecks className="h-4 w-4" /> },
          { id: 'board', label: 'Team board', icon: <LayoutGrid className="h-4 w-4" /> },
          { id: 'settings', label: 'Settings', icon: <SettingsIcon className="h-4 w-4" /> },
          { id: 'share', label: 'Share & links', icon: <Share2 className="h-4 w-4" /> },
        ];

        return (
          <>
            <PageTitle title={`Admin · ${snap.settings.name}`} />
            <PracticeBanner snap={snap} room={room} />
            <div className="mx-auto max-w-[1700px] gap-8 p-4 sm:p-6 lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
              {/* ------------------------------- navigation ------------------------------- */}
              <aside className="mb-5 lg:mb-0">
                <div className="lg:sticky lg:top-6 lg:space-y-5">
                  <div className="mb-4 flex items-center justify-between lg:mb-0">
                    <Logo />
                    <div className="lg:hidden">
                      <SoundControls prefs={prefs} update={updatePrefs} />
                    </div>
                  </div>

                  <div className="card hidden p-4 lg:block">
                    <div className="truncate font-display text-base font-extrabold leading-tight">{snap.settings.name}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {snap.settings.sport} · round {snap.round}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="chip border-gold/40 bg-gold/10 text-gold">
                        <span className="num font-bold tracking-widest">{code}</span>
                      </span>
                      <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${phase === 'Live' ? 'text-emerald-400' : 'text-slate-400'}`}>
                        <span className={`h-2 w-2 rounded-full ${phase === 'Live' ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`} />
                        {snap.practice ? 'Practice' : phase}
                      </span>
                    </div>
                  </div>

                  <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-ink-900/70 p-1 backdrop-blur lg:flex-col lg:overflow-visible lg:p-1.5" aria-label="Admin sections" role="tablist">
                    {nav.map((n) => {
                      const on = tab === n.id;
                      return (
                        <button
                          key={n.id}
                          role="tab"
                          aria-selected={on}
                          onClick={() => pick(n.id)}
                          className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition ${on ? 'text-ink-950 shadow-[0_8px_20px_-10px_rgba(242,184,75,0.9)]' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                          style={on ? { background: 'var(--gold-grad)' } : undefined}
                        >
                          {n.icon}
                          {n.label}
                        </button>
                      );
                    })}
                  </nav>

                  <div className="hidden space-y-2 lg:block">
                    <a className="btn-ghost w-full !justify-start" href={`/e/${code}/live`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Open big screen
                    </a>
                    <a className="btn-ghost w-full !justify-start" href={`/e/${code}/host?k=${snap.secrets?.hostKey ?? ''}`} target="_blank" rel="noreferrer">
                      <Gavel className="h-4 w-4" /> Auctioneer console
                    </a>
                    <SoundControls prefs={prefs} update={updatePrefs} />
                  </div>
                </div>
              </aside>

              {/* ------------------------------- content ------------------------------- */}
              <main className="min-w-0 space-y-5">
                <KpiStrip snap={snap} />

                {!ready && (
                  <div className="card flex flex-wrap items-center gap-x-8 gap-y-3 border-gold/30 p-4" style={{ background: 'linear-gradient(90deg, rgba(242,184,75,0.09), transparent)' }}>
                    <div className="font-display font-bold">Get ready to auction</div>
                    <Step done={snap.captains.length >= 2} label={`Add at least 2 teams (${snap.captains.length})`} onClick={() => pick('teams')} />
                    <Step done={players > 0} label={`Add players (${players})`} onClick={() => pick('players')} />
                    <Step done={false} label="Share the links" onClick={() => pick('share')} />
                    {snap.captains.length === 0 && players === 0 && (
                      <button className="btn-ghost ml-auto !py-2 !text-xs" onClick={() => room.act('demo.load')}>
                        <Sparkles className="h-4 w-4" /> Load sample teams & players
                      </button>
                    )}
                  </div>
                )}

                {tab === 'control' && ready && !snap.practice && (
                  <div className="card flex flex-wrap items-center gap-4 border-amber-400/30 p-4" style={{ background: 'linear-gradient(90deg, rgba(251,191,36,0.07), transparent)' }}>
                    <FlaskConical className="h-6 w-6 shrink-0 text-amber-300" />
                    <div className="min-w-[240px] flex-1">
                      <div className="font-display font-bold">Practice run</div>
                      <p className="text-sm text-slate-400">
                        Let the auctioneer and captains rehearse with the real teams and players so they know their screens and buttons. Nothing is saved — when you click <b>Go live</b> the real auction comes back exactly as it is now.
                      </p>
                    </div>
                    <button className="btn-primary" onClick={() => room.act('practice.start')}>
                      Start a practice run
                    </button>
                  </div>
                )}
                {(tab === 'teams' || tab === 'players') && snap.practice && (
                  <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    Adding or editing teams, purses and players is locked during a practice run so the real auction stays safe. Click <b>Go live</b> at the top to edit them again. You can still change a player's status for the practice.
                  </p>
                )}

                {tab === 'control' &&
                  (ready || snap.live.phase !== 'idle' ? (
                    <HostConsole snap={snap} room={room} tickSound={prefs.sfx} />
                  ) : (
                    <p className="card p-10 text-center text-slate-400">Add at least two teams and a few players, then come back here to run the auction. ({left} in the pool)</p>
                  ))}
                {tab === 'teams' && <TeamsTab snap={snap} room={room} adminKey={key!} />}
                {tab === 'players' && <PlayersTab snap={snap} room={room} adminKey={key!} />}
                {tab === 'board' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
                      <span>Order of players in each team (also what the big screen shows)</span>
                      <SquadSortToggle value={snap.live.squadSort ?? 'price'} onChange={(v) => room.act('squad.sort', { sort: v })} />
                    </div>
                    <TeamBoard snap={snap} highlightId={snap.live.bids[snap.live.bids.length - 1]?.captainId} />
                  </div>
                )}
                {tab === 'settings' && <SettingsTab snap={snap} room={room} />}
                {tab === 'share' && <ShareTab snap={snap} />}
              </main>
            </div>
          </>
        );
      }}
    </RoomGate>
  );
}

function Step({ done, label, onClick }: { done: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
      <span className={`grid h-5 w-5 place-items-center rounded-full border ${done ? 'border-emerald-400 bg-emerald-400 text-ink-950' : 'border-white/30'}`}>{done && <Check className="h-3 w-3" strokeWidth={3} />}</span>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// KPI strip — the dashboard numbers at a glance
// ---------------------------------------------------------------------------------------------

function Sparkline({ values, color = '#f2b84b' }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-8" />;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 26}`).join(' ');
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,32 ${pts} 100,32`} fill="url(#spark)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function KpiStrip({ snap }: { snap: Snapshot }) {
  const { settings } = snap;
  const sold = snap.players.filter((p) => p.status === 'sold');
  const spent = sold.reduce((a, p) => a + p.price, 0);
  const ordered = [...sold].sort((a, b) => (a.soldAt ?? 0) - (b.soldAt ?? 0));
  let run = 0;
  const cumulative = ordered.map((p) => (run += p.price));
  const top = [...sold].sort((a, b) => b.price - a.price)[0];
  const cards = [
    { label: 'Teams', value: String(snap.captains.length), sub: 'in the auction' },
    { label: 'Players', value: String(snap.players.length), sub: `${snap.players.filter((p) => p.status === 'available').length} in the pool` },
    { label: 'Sold', value: String(sold.length), sub: `${snap.players.filter((p) => p.status === 'unsold').length} unsold` },
    { label: 'Total spent', value: formatMoney(spent, settings), sub: top ? `Top buy ${formatMoney(top.price, settings)}` : 'No sales yet', spark: cumulative },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="card overflow-hidden p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-royal-300/80">{c.label}</div>
          <div className="mt-1 truncate font-display text-2xl font-extrabold">{c.value}</div>
          <div className="truncate text-xs text-slate-400">{c.sub}</div>
          {c.spark && <div className="mt-1.5">
            <Sparkline values={c.spark} />
          </div>}
        </div>
      ))}
    </div>
  );
}
