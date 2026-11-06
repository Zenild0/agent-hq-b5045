import { ExternalLink } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { HostConsole } from '../components/HostConsole';
import { HeartPill } from '../components/Heartbeat';
import { KeyPrompt } from '../components/KeyPrompt';
import { PageTitle } from '../components/PageTitle';
import { PracticeBanner } from '../components/PracticeBanner';
import { RoomGate, SoundControls } from '../components/RoomGate';
import { EventLogo } from '../components/Brand';
import { usePageKey } from '../lib/session';
import { useAuctionSound, useSoundPrefs } from '../lib/sound';
import { useTempo } from '../lib/tempo';
import { useEventAppearance } from '../lib/appearance';
import { useRoom } from '../lib/useRoom';

/** The auctioneer's console: calls the bids, sells the players, moves the show along. */
export default function Host() {
  const code = useParams().code!.toUpperCase();
  const key = usePageKey(code, 'host');
  const room = useRoom(code, key);
  const [prefs, updatePrefs] = useSoundPrefs();
  useAuctionSound(room.snap, prefs);
  const tempo = useTempo(room.snap, room.serverNow);
  useEventAppearance(room.snap?.settings);

  return (
    <RoomGate room={room} code={code}>
      {(snap) => {
        if (snap.me.role !== 'host' && snap.me.role !== 'admin')
          return <KeyPrompt title="Auctioneer login" hint="Paste the auctioneer key from the admin's Share tab." />;
        return (
          <>
          <PageTitle title={`Auctioneer · ${snap.settings.name}`} />
          <PracticeBanner snap={snap} />
          <div className="mx-auto max-w-[1700px] space-y-5 p-4 sm:p-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <EventLogo settings={snap.settings} />
                <div className="border-l border-[var(--hairline)] pl-4">
                  <div className="font-display font-bold leading-tight">{snap.settings.name}</div>
                  <div className="text-xs text-slate-400">Auctioneer console · code <span className="num tracking-widest text-gold">{code}</span></div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <HeartPill tempo={tempo} />
                <SoundControls prefs={prefs} update={updatePrefs} />
                <a className="btn-ghost !py-2" href={`/e/${code}/live`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open big screen
                </a>
              </div>
            </header>
            <HostConsole snap={snap} room={room} tickSound={prefs.sfx} />
          </div>
          </>
        );
      }}
    </RoomGate>
  );
}
