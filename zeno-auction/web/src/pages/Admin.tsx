import { Check, ExternalLink, FlaskConical, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HostConsole } from '../components/HostConsole';
import { KeyPrompt } from '../components/KeyPrompt';
import { PracticeBanner } from '../components/PracticeBanner';
import { RoomGate, SoundControls } from '../components/RoomGate';
import { Logo, Tabs } from '../components/ui';
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
        if (snap.me.role !== 'admin') return <KeyPrompt title="ADMIN LOGIN" hint="Paste the admin key from the link you got when you created this auction." />;
        const players = snap.players.length;
        const ready = snap.captains.length >= 2 && players > 0;
        const left = snap.players.filter((p) => p.status === 'available').length;
        return (
          <>
          <PracticeBanner snap={snap} room={room} />
          <div className="mx-auto max-w-[1700px] space-y-5 p-4 sm:p-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <Logo />
                <div className="border-l border-white/10 pl-4">
                  <div className="font-bold leading-tight">{snap.settings.name}</div>
                  <div className="text-xs text-slate-400">
                    {snap.settings.sport} · code <b className="text-gold">{code}</b> · round {snap.round}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SoundControls prefs={prefs} update={updatePrefs} />
                <a className="btn-ghost !py-2" href={`/e/${code}/live`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Big screen
                </a>
              </div>
            </header>

            {!ready && (
              <div className="card flex flex-wrap items-center gap-x-8 gap-y-3 border-gold/30 bg-gold/5 p-4">
                <div className="font-bold">Get ready to auction</div>
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

            <Tabs
              value={tab}
              onChange={pick}
              tabs={[
                { id: 'control', label: 'Run the auction' },
                { id: 'teams', label: `Teams (${snap.captains.length})` },
                { id: 'players', label: `Players (${players})` },
                { id: 'board', label: 'Team board' },
                { id: 'settings', label: 'Settings' },
                { id: 'share', label: 'Share & links' },
              ]}
            />

            {tab === 'control' && ready && !snap.practice && (
              <div className="card flex flex-wrap items-center gap-4 border-amber-400/30 bg-amber-400/5 p-4">
                <FlaskConical className="h-6 w-6 shrink-0 text-amber-300" />
                <div className="min-w-[240px] flex-1">
                  <div className="font-bold">Practice run</div>
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
            {tab === 'control' && (ready || snap.live.phase !== 'idle' ? <HostConsole snap={snap} room={room} tickSound={prefs.sfx} /> : <p className="card p-10 text-center text-slate-400">Add at least two teams and a few players, then come back here to run the auction. ({left} in the pool)</p>)}
            {tab === 'teams' && <TeamsTab snap={snap} room={room} adminKey={key!} />}
            {tab === 'players' && <PlayersTab snap={snap} room={room} adminKey={key!} />}
            {tab === 'board' && <TeamBoard snap={snap} highlightId={snap.live.bids[snap.live.bids.length - 1]?.captainId} />}
            {tab === 'settings' && <SettingsTab snap={snap} room={room} />}
            {tab === 'share' && <ShareTab snap={snap} />}
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
