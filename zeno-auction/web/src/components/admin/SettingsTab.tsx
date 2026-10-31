import { useEffect, useRef, useState } from 'react';
import type { EventSettings, Snapshot } from '../../../../shared/types';
import type { Room } from '../../lib/useRoom';
import { SettingsForm } from '../SettingsForm';

export function SettingsTab({ snap, room }: { snap: Snapshot; room: Room }) {
  const [draft, setDraft] = useState<EventSettings>(snap.settings);
  const saved = useRef(JSON.stringify(snap.settings));
  const dirty = JSON.stringify(draft) !== saved.current;

  // Pick up changes made elsewhere only while the form is untouched.
  useEffect(() => {
    if (!dirty) {
      setDraft(snap.settings);
      saved.current = JSON.stringify(snap.settings);
    }
  }, [snap.settings]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-28">
      <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
        Changes apply immediately, even mid-auction — e.g. switch what the audience sees, or change the bid steps before round 2. Bids already placed keep their amounts.
      </p>
      <SettingsForm value={draft} onChange={setDraft} />

      <section className="card border-red-400/20 p-5">
        <h2 className="font-bold text-red-300">Danger zone</h2>
        <p className="mb-3 mt-1 text-sm text-slate-400">Start over: every player goes back to the pool, teams keep their purses, round resets to 1.</p>
        <button
          className="btn-danger"
          onClick={() => confirm('Reset the whole auction? All sales are undone.') && room.act('reset')}
        >
          Reset auction
        </button>
      </section>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink-950/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <span className="text-sm text-slate-300">You have unsaved changes.</span>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setDraft(JSON.parse(saved.current))}>
                Discard
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  if (await room.act('settings.update', { patch: draft })) saved.current = JSON.stringify(draft);
                }}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
