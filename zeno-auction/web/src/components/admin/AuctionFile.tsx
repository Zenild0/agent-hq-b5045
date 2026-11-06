import { Download, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Snapshot } from '../../../../shared/types';
import { deleteEvent } from '../../lib/api';
import { downloadAuctionFile } from '../../lib/auctionFile';
import { forgetEvent } from '../../lib/session';
import { Modal, useToast } from '../ui';

/** Keep a copy of the whole auction on this computer. */
export function SaveFileCard({ snap }: { snap: Snapshot }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const adminKey = snap.secrets?.adminKey;
  return (
    <section className="card p-5">
      <h2 className="font-bold">Save a copy on your computer</h2>
      <p className="mb-3 mt-1 text-sm text-slate-400">
        One file with everything: settings, teams, players, who bought whom and for how much, photos and the history. You can bring it back later with{' '}
        <b className="text-slate-200">Restore from file</b> on the “New auction” page — handy because the server does not need to keep it.
      </p>
      <button
        className="btn-primary"
        disabled={busy || !adminKey}
        onClick={async () => {
          setBusy(true);
          try {
            const name = await downloadAuctionFile(snap.code, adminKey!, snap.settings.name);
            toast(`Saved “${name}” to your Downloads folder.`, 'success');
          } catch (err) {
            toast((err as Error).message, 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Download the whole auction file
      </button>
      <p className="mt-3 text-xs text-slate-500">The file contains team PINs — keep it private. For a spreadsheet of results, use the Excel export on the Players tab.</p>
    </section>
  );
}

/** Permanently removes the auction from the server, after a typed confirmation. */
export function DeleteAuction({ snap }: { snap: Snapshot }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const nav = useNavigate();
  const adminKey = snap.secrets?.adminKey;
  const expected = snap.settings.name.trim();
  const ok = typed.trim().toLowerCase() === expected.toLowerCase();

  const remove = async () => {
    if (!adminKey) return;
    setBusy(true);
    try {
      await deleteEvent(snap.code, adminKey);
      forgetEvent(snap.code, 'admin');
      for (const page of ['admin', 'host', 'captain']) localStorage.removeItem(`zeno:key:${snap.code}:${page}`);
      toast('Auction deleted from the server.', 'success');
      nav('/');
    } catch (err) {
      toast((err as Error).message, 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn-danger" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" /> Delete this auction
      </button>
      {open && (
        <Modal title="Delete this auction for good?" onClose={() => !busy && setOpen(false)}>
          <div className="space-y-4 text-sm text-slate-300">
            <p>
              This removes <b className="text-white">{expected}</b> from the server: teams, players, bids, results and photos. Everyone watching will be told it is gone.{' '}
              <b className="text-hot">It cannot be undone.</b>
            </p>
            <DownloadFirst snap={snap} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-400">
                To confirm, type the auction name: <span className="text-white">{expected}</span>
              </span>
              <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={expected} autoFocus aria-label="Type the auction name to confirm" />
            </label>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn-danger" disabled={!ok || busy} onClick={remove}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete forever
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function DownloadFirst({ snap }: { snap: Snapshot }) {
  const { toast } = useToast();
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
      <p className="text-slate-200">{done ? '✓ Saved to your computer.' : 'Want to keep it? Save a copy to this computer first.'}</p>
      {!done && (
        <button
          className="btn-ghost mt-2 !py-1.5"
          onClick={async () => {
            try {
              await downloadAuctionFile(snap.code, snap.secrets!.adminKey, snap.settings.name);
              setDone(true);
            } catch (err) {
              toast((err as Error).message, 'error');
            }
          }}
        >
          <Download className="h-4 w-4" /> Download the file
        </button>
      )}
    </div>
  );
}
