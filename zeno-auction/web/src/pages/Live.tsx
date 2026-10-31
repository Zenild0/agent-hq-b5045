import { Maximize2, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { PracticeBanner } from '../components/PracticeBanner';
import { RoomGate, SoundControls } from '../components/RoomGate';
import { Arena } from '../components/Arena';
import { TeamBoard } from '../components/TeamBoard';
import { Logo } from '../components/ui';
import { useAuctionSound, useSoundPrefs } from '../lib/sound';
import { useRoom } from '../lib/useRoom';

/** The big-screen view: share this tab on Zoom. Follows whatever the auctioneer chooses to show. */
export default function Live({ forceBoard = false }: { forceBoard?: boolean }) {
  const code = useParams().code!.toUpperCase();
  const room = useRoom(code, null);
  const [prefs, updatePrefs] = useSoundPrefs();
  useAuctionSound(room.snap, prefs);

  return (
    <RoomGate room={room} code={code}>
      {(snap) => {
        const { live, settings } = snap;
        const onBreak = !!live.break;
        const showBoard = forceBoard || (live.screen === 'board' && !onBreak);
        const leader = live.bids[live.bids.length - 1]?.captainId;
        return (
          <>
          <PracticeBanner snap={snap} />
          <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-4 sm:p-6" style={{ ['--accent' as string]: settings.accent }}>
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <Logo />
                <div className="hidden border-l border-white/10 pl-4 sm:block">
                  <div className="text-lg font-bold leading-tight">{settings.name}</div>
                  <div className="text-xs text-slate-400">{settings.tagline}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="chip border-gold/40 bg-gold/10 font-bold text-gold">Join code {code}</span>
                <span className="chip">
                  <Users className="h-3.5 w-3.5" /> {snap.presence.viewers}
                </span>
                <SoundControls prefs={prefs} update={updatePrefs} />
                <button className="btn-ghost !px-3 !py-2" title="Full screen" onClick={() => document.documentElement.requestFullscreen?.()}>
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </header>

            <main className="flex min-h-0 flex-1 flex-col">
              {showBoard ? (
                <div>
                  <h2 className="mb-4 font-display text-4xl tracking-wide">
                    TEAM <span className="text-gold">BOARD</span>
                  </h2>
                  <TeamBoard snap={snap} big highlightId={leader} />
                </div>
              ) : (
                <Arena snap={snap} serverNow={room.serverNow} tickSound={prefs.sfx} />
              )}
            </main>

          </div>
          </>
        );
      }}
    </RoomGate>
  );
}
