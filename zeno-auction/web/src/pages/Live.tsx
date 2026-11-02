import { Maximize2, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Arena } from '../components/Arena';
import { HeartPill, Heartbeat } from '../components/Heartbeat';
import { PageTitle } from '../components/PageTitle';
import { PracticeBanner } from '../components/PracticeBanner';
import { RoomGate, SoundControls } from '../components/RoomGate';
import { Tape } from '../components/Tape';
import { TeamBoard } from '../components/TeamBoard';
import { EventBanner, EventLogo, EventSideLogo, PoweredBy, hasBrand } from '../components/Brand';
import { useAuctionSound, useSoundPrefs } from '../lib/sound';
import { useTempo } from '../lib/tempo';
import { GOLD, HOT, useEventAppearance } from '../lib/appearance';
import { useRoom } from '../lib/useRoom';

/** The big-screen view: share this tab on Zoom. Follows whatever the auctioneer chooses to show. */
export default function Live({ forceBoard = false }: { forceBoard?: boolean }) {
  const code = useParams().code!.toUpperCase();
  const room = useRoom(code, null);
  const [prefs, updatePrefs] = useSoundPrefs();
  useAuctionSound(room.snap, prefs);
  const tempo = useTempo(room.snap, room.serverNow);
  useEventAppearance(room.snap?.settings);

  return (
    <RoomGate room={room} code={code}>
      {(snap) => {
        const { live, settings } = snap;
        const onBreak = !!live.break;
        const showBoard = forceBoard || (live.screen === 'board' && !onBreak);
        const leader = live.bids[live.bids.length - 1]?.captainId;
        return (
          <>
            <PageTitle title={`${settings.name} · Live`} />
            <PracticeBanner snap={snap} />
            <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-3 p-4 sm:p-6">
              <EventBanner settings={settings} />
              <header className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="flex min-w-0 items-center gap-4">
                  <EventLogo settings={settings} />
                  <div className="hidden min-w-0 border-l border-[var(--hairline)] pl-4 sm:block">
                    <div className="truncate font-display text-base font-bold leading-tight">{settings.name}</div>
                    <div className="truncate text-xs text-slate-400">{settings.tagline}</div>
                  </div>
                </div>

                {/* the room's heartbeat: slow when calm, racing in a bidding war */}
                <Heartbeat tempo={tempo} color={tempo.intensity > 0.55 ? HOT : GOLD} className="order-last h-9 w-full min-w-0 flex-1 md:order-none md:w-auto" />

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <EventSideLogo settings={settings} />
                  <HeartPill tempo={tempo} />
                  <span className="chip border-gold/40 bg-gold/10 font-bold text-gold">
                    Join code <span className="num tracking-widest">{code}</span>
                  </span>
                  <span className="chip" title="People watching">
                    <Users className="h-3.5 w-3.5" /> {snap.presence.viewers}
                  </span>
                  <SoundControls prefs={prefs} update={updatePrefs} />
                  <button className="btn-ghost !px-3 !py-2" title="Full screen" aria-label="Full screen" onClick={() => document.documentElement.requestFullscreen?.()}>
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              </header>

              {!showBoard && !onBreak && <Tape snap={snap} />}

              <main className="flex min-h-0 flex-1 flex-col">
                {showBoard ? (
                  <div>
                    <h2 className="mb-4 font-display text-3xl font-extrabold">
                      Team <span className="text-gold-grad">board</span>
                    </h2>
                    <TeamBoard snap={snap} big highlightId={leader} />
                  </div>
                ) : (
                  <Arena snap={snap} serverNow={room.serverNow} tickSound={prefs.sfx} beat={tempo.beat} />
                )}
              </main>
              {hasBrand(settings) && <PoweredBy className="self-center pb-1 sm:hidden" />}
            </div>
          </>
        );
      }}
    </RoomGate>
  );
}
