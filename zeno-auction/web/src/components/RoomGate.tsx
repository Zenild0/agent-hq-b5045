import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Room } from '../lib/useRoom';
import { sfx, speak, useVoices, type SoundPrefs } from '../lib/sound';
import { ModeToggle } from './Brand';
import { FullScreenMessage, Logo } from './ui';

export function RoomGate({ room, code, children }: { room: Room; code: string; children: (snap: NonNullable<Room['snap']>) => ReactNode }) {
  if (room.status === 'deleted')
    return (
      <FullScreenMessage title="This auction was deleted">
        <p>The admin removed <b className="text-white">{code}</b> from the server. If you were part of it, ask them for the results file.</p>
        <Link to="/" className="btn-primary mt-6">
          Go to the home page
        </Link>
      </FullScreenMessage>
    );
  if (room.status === 'missing')
    return (
      <FullScreenMessage title="Auction not found">
        <p>
          There's no auction with code <b className="text-white">{code}</b>.
        </p>
        <Link to="/join" className="btn-primary mt-6">
          Try another code
        </Link>
      </FullScreenMessage>
    );
  if (!room.snap && room.status === 'blocked')
    return (
      <FullScreenMessage title="Too many wrong keys">
        <p>This connection tried too many wrong keys or PINs. Wait a minute — this page will retry by itself — then check your link or PIN.</p>
        <Link to="/join" className="btn-primary mt-6">
          Back to join
        </Link>
      </FullScreenMessage>
    );
  if (!room.snap)
    return (
      <div className="grid min-h-screen place-items-center p-6" aria-busy="true" aria-label="Loading the auction">
        <div className="w-full max-w-md space-y-5">
          <div className="flex justify-center">
            <Logo />
          </div>
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-40 w-full" />
          <div className="grid grid-cols-3 gap-3">
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
          </div>
        </div>
      </div>
    );
  return (
    <>
      {room.status === 'offline' && (
        <div className="fixed inset-x-0 top-0 z-[90] bg-gradient-to-r from-hot to-[#e0334f] py-1.5 text-center text-xs font-bold text-[#fff]">Connection lost — reconnecting…</div>
      )}
      {children(room.snap)}
    </>
  );
}

export function SoundControls({ prefs, update }: { prefs: SoundPrefs; update: (p: Partial<SoundPrefs>) => void }) {
  const { voices, active } = useVoices(prefs.voiceName);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        className={`btn-ghost !px-3 !py-2 ${prefs.sfx ? '!border-gold/60 !text-gold' : ''}`}
        title="Sound effects"
        aria-pressed={prefs.sfx}
        onClick={() => {
          update({ sfx: !prefs.sfx });
          if (!prefs.sfx) setTimeout(sfx.bid, 50);
        }}
      >
        {prefs.sfx ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        <span className="hidden sm:inline">Sounds</span>
      </button>
      <button
        className={`btn-ghost !px-3 !py-2 ${prefs.voice ? '!border-gold/60 !text-gold' : ''}`}
        title="Announcer voice"
        aria-pressed={prefs.voice}
        onClick={() => {
          update({ voice: !prefs.voice });
          if (!prefs.voice) setTimeout(() => speak("Hello! I'm your auctioneer. Let's begin.", prefs.voiceName), 80);
        }}
      >
        {prefs.voice ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        <span className="hidden sm:inline">Announcer</span>
      </button>
      {prefs.voice && voices.length > 1 && (
        <select
          aria-label="Announcer voice"
          title="Choose the announcer's voice"
          className="input !w-auto max-w-[190px] !py-2 !text-xs"
          value={prefs.voiceName ?? ''}
          onChange={(e) => {
            update({ voiceName: e.target.value || undefined });
            const name = e.target.value || undefined;
            setTimeout(() => speak('Going once, going twice, sold!', name), 60);
          }}
        >
          <option value="">Best voice{active ? ` · ${active.name.replace(/^(Microsoft|Google)\s+/i, '')}` : ''}</option>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name.replace(/^(Microsoft|Google)\s+/i, '')} ({v.lang})
            </option>
          ))}
        </select>
      )}
      <ModeToggle />
    </div>
  );
}
