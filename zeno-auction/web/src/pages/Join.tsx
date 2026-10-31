import { ArrowRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Field, Logo } from '../components/ui';
import { lookupEvent } from '../lib/api';

export default function Join() {
  const params = useParams();
  const nav = useNavigate();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const found = await lookupEvent(code);
      nav(pin.trim() ? `/e/${found.code}/captain?k=${encodeURIComponent(pin.trim().toUpperCase())}` : `/e/${found.code}/live`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={go} className="card w-full max-w-md space-y-5 p-7">
        <Logo />
        <div>
          <h1 className="font-display text-4xl tracking-wide">JOIN THE AUCTION</h1>
          <p className="mt-1 text-sm text-slate-400">Enter the code shown on the big screen.</p>
        </div>
        <Field label="Auction code">
          <input
            autoFocus
            className="input text-center font-display text-3xl tracking-[0.4em]"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
          />
        </Field>
        <Field label="Captain PIN (captains only)" hint="Leave empty to just watch. Your PIN is on the link the host sent you.">
          <input className="input text-center font-display text-2xl tracking-[0.3em]" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.toUpperCase())} placeholder="••••••" />
        </Field>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <button className="btn-primary w-full !py-3 text-base" disabled={code.length < 6 || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {pin.trim() ? 'Enter as captain' : 'Watch live'}
        </button>
      </form>
    </div>
  );
}
