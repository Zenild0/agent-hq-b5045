import { ArrowRight, Eye, Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CodeBoxes } from '../components/CodeBoxes';
import { Logo } from '../components/ui';
import { lookupEvent } from '../lib/api';

export default function Join() {
  const params = useParams();
  const nav = useNavigate();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [pin, setPin] = useState('');
  const [captain, setCaptain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async () => {
    if (code.length < 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const found = await lookupEvent(code);
      nav(captain && pin.trim() ? `/e/${found.code}/captain?k=${encodeURIComponent(pin.trim().toUpperCase())}` : `/e/${found.code}/live`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
        className="card w-full max-w-md animate-rise space-y-6 p-7 sm:p-9"
      >
        <div className="flex items-center justify-between">
          <Logo />
          <Link to="/" className="text-xs font-semibold text-slate-400 hover:text-white">
            ← Home
          </Link>
        </div>
        <div>
          <p className="eyebrow">Join the room</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Enter your auction code</h1>
          <p className="mt-1.5 text-sm text-slate-400">It's the 6-character code on the big screen or in your invite.</p>
        </div>

        <CodeBoxes label="Auction code" value={code} onChange={setCode} autoFocus onEnter={go} />

        <div className="rounded-2xl border border-[var(--hairline)] bg-ink-900/50 p-4">
          <button type="button" onClick={() => setCaptain((c) => !c)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={captain}>
            <span className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-gold" />
              <span>
                <span className="block text-sm font-semibold">I'm a team captain</span>
                <span className="block text-xs text-slate-400">Enter your personal PIN to bid</span>
              </span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${captain ? 'bg-gold' : 'bg-ink-600'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all ${captain ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
          </button>
          {captain && (
            <div className="mt-4 animate-rise">
              <CodeBoxes label="Captain PIN" value={pin} onChange={setPin} onEnter={go} />
            </div>
          )}
        </div>

        {error && <p className="rounded-xl border border-hot/30 bg-hot/10 px-3 py-2 text-sm text-red-200">{error}</p>}

        <button className="btn-primary w-full !py-3.5 text-base" disabled={code.length < 6 || busy || (captain && pin.length < 6)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : captain ? <ArrowRight className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {captain ? 'Enter as captain' : 'Watch live'}
        </button>
      </form>
    </div>
  );
}
