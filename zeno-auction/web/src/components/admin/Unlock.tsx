import { CheckCircle2, Clock, Lock, Loader2, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Snapshot } from '../../../../shared/types';
import { requestUnlock } from '../../lib/api';
import { CopyButton, Modal, useToast } from '../ui';

/** A one-line reminder at the top of the admin page while the auction cannot go live yet. */
export function UnlockBanner({ snap }: { snap: Snapshot }) {
  const [open, setOpen] = useState(false);
  const u = snap.unlock;
  if (!u || u.status === 'free' || u.status === 'unlocked') return null;
  return (
    <>
      <div className="card mb-5 flex flex-wrap items-center gap-3 border-gold/40 p-3.5 text-sm" style={{ background: 'linear-gradient(90deg, rgb(var(--accent)/0.1), transparent)' }}>
        {u.status === 'pending' ? <Clock className="h-5 w-5 shrink-0 text-gold" /> : <Lock className="h-5 w-5 shrink-0 text-gold" />}
        <p className="min-w-0 flex-1 text-slate-300">
          {u.status === 'pending' ? (
            <>
              <b className="text-white">Payment received — waiting for approval.</b> You can keep setting up and practising meanwhile.
            </>
          ) : (
            <>
              <b className="text-white">Set-up and practice are free.</b> To start the real auction, unlock it (₹{u.price}).
            </>
          )}
        </p>
        <button className="btn-primary !py-2" onClick={() => setOpen(true)}>
          {u.status === 'pending' ? 'See details' : 'Unlock to go live'}
        </button>
      </div>
      {open && <UnlockModal snap={snap} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Pay by UPI (scan or tap), then enter the reference so it can be approved. */
export function UnlockModal({ snap, onClose }: { snap: Snapshot; onClose: () => void }) {
  const u = snap.unlock;
  const { toast } = useToast();
  const [qr, setQr] = useState('');
  const [ref, setRef] = useState('');
  const [payer, setPayer] = useState('');
  const [busy, setBusy] = useState(false);
  const payee = u.payee;
  const link = payee ? `upi://pay?pa=${encodeURIComponent(payee.upiId)}&pn=${encodeURIComponent(payee.payeeName || 'ZenoBid')}&am=${u.price}&cu=INR&tn=${encodeURIComponent(`ZenoBid ${snap.code}`)}` : '';

  useEffect(() => {
    if (!link) return;
    let live = true;
    void import('qrcode').then(({ default: QR }) => QR.toDataURL(link, { margin: 1, width: 320, errorCorrectionLevel: 'M', color: { dark: '#0b1020', light: '#ffffff' } })).then((url) => live && setQr(url));
    return () => {
      live = false;
    };
  }, [link]);

  // when the developer approves, the screen updates by itself
  useEffect(() => {
    if (u.status === 'unlocked' || u.status === 'free') {
      toast('Unlocked — you can go live now.', 'success');
      onClose();
    }
  }, [u.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!snap.secrets) return;
    setBusy(true);
    try {
      await requestUnlock(snap.code, snap.secrets.adminKey, ref.trim(), payer.trim());
      toast('Thank you! Your payment is waiting for approval.', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Unlock this auction to go live" onClose={onClose}>
      {u.status === 'pending' ? (
        <div className="space-y-3 text-sm text-slate-300">
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <span>
              Your payment reference <b className="num text-white">{u.ref}</b> has been sent. As soon as it is approved this page unlocks by itself, no need to refresh. You can keep setting up and practising.
            </span>
          </p>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      ) : !payee ? (
        <p className="text-sm text-slate-300">Payment details are not available right now. Please try again in a moment.</p>
      ) : (
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            Set-up, adding teams and players, and <b className="text-white">practice runs are free</b>. Going live with the real auction needs a one-off contribution of{' '}
            <b className="num text-gold">₹{u.price}</b> per auction. It helps cover the server and keeps ZenoBid running. {payee.note && <span className="text-slate-400">{payee.note}</span>}
          </p>

          <div className="grid gap-4 sm:grid-cols-[170px_1fr]">
            <div className="mx-auto grid h-[170px] w-[170px] place-items-center rounded-xl bg-white p-2">
              {qr ? <img src={qr} alt={`UPI QR code to pay ₹${u.price}`} className="h-full w-full" /> : <Loader2 className="h-6 w-6 animate-spin text-slate-500" />}
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-white">1. Pay ₹{u.price} with any UPI app</p>
              <p className="text-xs text-slate-400">Scan the code, or send to this UPI ID:</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="num rounded-lg bg-ink-900 px-2 py-1 text-xs text-white">{payee.upiId}</code>
                <CopyButton text={payee.upiId} label="Copy" />
              </div>
              <p className="text-xs text-slate-400">
                Paying to <b className="text-slate-200">{payee.payeeName || 'ZenoBid'}</b>. In the note, write <b className="text-slate-200">ZenoBid {snap.code}</b>.
              </p>
              <a className="btn-ghost !py-1.5 !text-xs sm:hidden" href={link}>
                <Smartphone className="h-3.5 w-3.5" /> Open my UPI app
              </a>
            </div>
          </div>

          <div>
            <p className="mb-1.5 font-semibold text-white">2. Enter the payment reference</p>
            <p className="mb-2 text-xs text-slate-400">It is shown in your UPI app after paying, called UTR, UPI Ref or Transaction ID (usually 12 digits).</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input" placeholder="UPI reference / UTR" aria-label="UPI reference" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={40} />
              <input className="input" placeholder="Your name (optional)" aria-label="Your name" value={payer} onChange={(e) => setPayer(e.target.value)} maxLength={60} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              By unlocking you agree to the{' '}
              <Link to="/terms" target="_blank" className="text-gold underline">
                Terms of use
              </Link>
              . Approval is done by hand, so it can take a little while.
            </p>
            <button className="btn-primary" disabled={busy || ref.trim().length < 6} onClick={submit}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} I have paid
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
