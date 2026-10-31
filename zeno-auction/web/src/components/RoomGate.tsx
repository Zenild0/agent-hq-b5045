import { Loader2, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Room } from '../lib/useRoom';
import { sfx, type SoundPrefs } from '../lib/sound';
import { FullScreenMessage } from './ui';

export function RoomGate({ room, code, children }: { room: Room; code: string; children: (snap: NonNullable<Room['snap']>) => ReactNode }) {
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
  if (!room.snap)
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  return (
    <>
      {room.status === 'offline' && (
        <div className="fixed inset-x-0 top-0 z-[90] bg-red-600 py-1.5 text-center text-xs font-bold">Connection lost — reconnecting…</div>
      )}
      {children(room.snap)}
    </>
  );
}

export function SoundControls({ prefs, update }: { prefs: SoundPrefs; update: (p: Partial<SoundPrefs>) => void }) {
  return (
    <div className="flex gap-1.5">
      <button
        className={`btn-ghost !px-3 !py-2 ${prefs.sfx ? '!border-gold/60 !text-gold' : ''}`}
        title="Sound effects"
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
        onClick={() => update({ voice: !prefs.voice })}
      >
        {prefs.voice ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        <span className="hidden sm:inline">Announcer</span>
      </button>
    </div>
  );
}
