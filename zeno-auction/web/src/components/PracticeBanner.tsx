import { FlaskConical, Play, RotateCcw } from 'lucide-react';
import type { Snapshot } from '../../../shared/types';
import type { Room } from '../lib/useRoom';

/** Shown on every screen during a practice run so nobody mistakes it for the real thing. */
export function PracticeBanner({ snap, room }: { snap: Snapshot; room?: Room }) {
  if (!snap.practice) return null;
  const admin = snap.me.role === 'admin' && room;
  return (
    <div className="sticky top-0 z-[80] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-amber-400 px-4 py-2 text-sm font-bold text-ink-950">
      <span className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4" /> PRACTICE RUN — nothing here counts. The real auction is untouched.
      </span>
      {admin && (
        <span className="flex gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink-950/10 px-3 py-1 hover:bg-ink-950/20"
            onClick={() => confirm('Restart the practice run? All practice sales are cleared.') && room.act('reset')}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restart practice
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink-950 px-3 py-1 text-gold hover:brightness-125"
            onClick={() => confirm('Go live? The practice run is discarded and the real auction comes back exactly as it was.') && room.act('practice.end')}
          >
            <Play className="h-3.5 w-3.5" /> Go live
          </button>
        </span>
      )}
    </div>
  );
}
