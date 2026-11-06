import { Check, Gift, KeyRound, Loader2, Lock, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ModeToggle } from '../components/Brand';
import { CopyButton, Field, Logo, useToast } from '../components/ui';
import { ApiError, devCall } from '../lib/api';

interface Row {
  code: string; name: string; createdAt: number; lastActivity: number; teams: number; players: number; sold: number; screens: number;
  status: 'free' | 'locked' | 'pending' | 'unlocked'; by: string; ref: string; payer: string; price: number; requestedAt: number;
}
interface Config { upiId: string; payeeName: string; price: number; note: string; operatorName: string; contact: string }
interface Overview { config: Config; gate: { required: boolean; price: number }; auctions: Row[]; limits: { events: number; screens: number } }

const ago = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const BADGE: Record<Row['status'], string> = {
  free: 'border-slate-500/40 text-slate-300',
  locked: 'border-hot/40 text-hot',
  pending: 'border-amber-400/50 text-amber-300',
  unlocked: 'border-emerald-400/50 text-emerald-300',
};

/** The developer's private page: payment settings, approvals, every auction on the server. Needs the DEV_KEY from /etc/zenobid.env. */
export default function Dev() {
  const { toast } = useToast();
  const [key, setKey] = useState(() => sessionStorage.getItem('zeno:dev') ?? '');
  const [typed, setTyped] = useState('');
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'denied' | 'off'>('idle');
  const [cfg, setCfg] = useState<Config | null>(null);
  const [made, setMade] = useState<{ code: string; adminKey: string; hostKey: string } | null>(null);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    if (!key) return;
    try {
      const d = await devCall<Overview>(key, '/overview');
      setData(d);
      setCfg((c) => c ?? d.config);
      setState('idle');
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 404) setState('off');
      else if (e.status === 403 || e.status === 429) {
        setState('denied');
        if (e.status === 403) sessionStorage.removeItem('zeno:dev');
        toast(e.message, 'error');
      }
    }
  }, [key, toast]);

  useEffect(() => {
    void load();
    const t = setInterval(() => !document.hidden && void load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (code: string, action: string) => {
    try {
      await devCall(key, `/auctions/${code}/${action}`, { method: 'POST', body: {} });
      toast('Done.', 'success');
      void load();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  if (state === 'off')
    return (
      <Shell>
        <p className="card p-6 text-slate-300">
          The developer page is switched off because no developer key is set on this server. On the server, add a line <code className="rounded bg-ink-900 px-1.5">DEV_KEY=…</code> to <code className="rounded bg-ink-900 px-1.5">/etc/zenobid.env</code> (at least 12 characters, written by you) and restart ZenoBid.
        </p>
      </Shell>
    );

  if (!key || state === 'denied' || !data)
    return (
      <Shell>
        <form
          className="card mx-auto max-w-md space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            sessionStorage.setItem('zeno:dev', typed.trim());
            setKey(typed.trim());
            setState('loading');
          }}
        >
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <KeyRound className="h-6 w-6 text-gold" /> Developer
          </h1>
          <p className="text-sm text-slate-400">Enter the developer key from <code>/etc/zenobid.env</code> on your server. It is kept only in this browser tab.</p>
          <input className="input" type="password" autoComplete="off" aria-label="Developer key" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          <button className="btn-primary w-full" disabled={typed.trim().length < 12}>
            {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open'}
          </button>
        </form>
      </Shell>
    );

  const pending = data.auctions.filter((a) => a.status === 'pending');
  const set = <K extends keyof Config>(k: K, v: Config[K]) => cfg && setCfg({ ...cfg, [k]: v });

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold">Developer</h1>
        <div className="flex items-center gap-2">
          <span className="chip">{data.auctions.length}/{data.limits.events} auctions</span>
          <button className="btn-ghost !py-2" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <section className="card mb-5 p-5">
        <h2 className="mb-1 font-bold">Payments {data.gate.required ? <span className="chip ml-2 border-emerald-400/40 text-emerald-300">ON · ₹{data.gate.price}</span> : <span className="chip ml-2">OFF · everything is free</span>}</h2>
        <p className="mb-4 text-sm text-slate-400">Set a price and your UPI id to charge for going live. Price 0 makes everything free. Auctions already created keep working as they are.</p>
        {cfg && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Price per auction (₹)" hint="0 = free for everyone">
              <input className="input" inputMode="numeric" value={cfg.price} onChange={(e) => set('price', Number(e.target.value.replace(/\D/g, '')) || 0)} />
            </Field>
            <Field label="Your UPI id" hint="e.g. yourname@okaxis">
              <input className="input" value={cfg.upiId} onChange={(e) => set('upiId', e.target.value)} placeholder="yourname@bank" />
            </Field>
            <Field label="Name shown in the payer's app">
              <input className="input" value={cfg.payeeName} onChange={(e) => set('payeeName', e.target.value)} maxLength={60} />
            </Field>
            <Field label="A line shown with the payment instructions">
              <input className="input" value={cfg.note} onChange={(e) => set('note', e.target.value)} maxLength={160} placeholder="Thank you for supporting ZenoBid!" />
            </Field>
            <Field label="Your name (Terms of use page)">
              <input className="input" value={cfg.operatorName} onChange={(e) => set('operatorName', e.target.value)} maxLength={80} />
            </Field>
            <Field label="Contact (Terms of use page)">
              <input className="input" value={cfg.contact} onChange={(e) => set('contact', e.target.value)} maxLength={120} placeholder="email or phone" />
            </Field>
          </div>
        )}
        <button
          className="btn-primary mt-4"
          onClick={async () => {
            try {
              const r = await devCall<{ config: Config }>(key, '/config', { method: 'PUT', body: cfg });
              setCfg(r.config);
              toast('Saved.', 'success');
              void load();
            } catch (err) {
              toast((err as Error).message, 'error');
            }
          }}
        >
          Save
        </button>
      </section>

      <section className="card mb-5 p-5">
        <h2 className="mb-3 font-bold">Waiting for your approval ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing waiting. Payments appear here with the reference number the admin typed in. Check it against your UPI app, then approve.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((a) => (
              <li key={a.code} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-ink-900/60 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{a.name} <span className="num text-xs text-slate-400">({a.code})</span></div>
                  <div className="text-xs text-slate-400">
                    ₹{a.price} · reference <b className="num text-white">{a.ref}</b>
                    {a.payer ? ` · from ${a.payer}` : ''} · {ago(a.requestedAt)}
                  </div>
                </div>
                <button className="btn-primary !py-1.5" onClick={() => act(a.code, 'approve')}>
                  <Check className="h-4 w-4" /> Approve
                </button>
                <button className="btn-ghost !py-1.5" onClick={() => act(a.code, 'reject')}>
                  <X className="h-4 w-4" /> Not received
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mb-5 p-5">
        <h2 className="mb-3 font-bold">Give someone a free, unlocked auction</h2>
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs" placeholder="Auction name" aria-label="Auction name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button
            className="btn-ghost"
            onClick={async () => {
              try {
                setMade(await devCall(key, '/create', { method: 'POST', body: { settings: newName.trim() ? { name: newName.trim() } : {} } }));
                void load();
              } catch (err) {
                toast((err as Error).message, 'error');
              }
            }}
          >
            <Plus className="h-4 w-4" /> Create
          </button>
        </div>
        {made && (
          <div className="mt-3 rounded-xl border border-[var(--hairline)] bg-ink-900/60 p-3 text-sm">
            <p className="mb-2 text-slate-300">Send them this admin link — it makes them the admin of this auction (you stay the developer):</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="num break-all rounded bg-ink-950 px-2 py-1 text-xs">{`${location.origin}/e/${made.code}/admin?k=${made.adminKey}`}</code>
              <CopyButton text={`${location.origin}/e/${made.code}/admin?k=${made.adminKey}`} label="Copy" />
            </div>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">All auctions</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-3">Auction</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Teams · players · sold</th><th className="pb-2 pr-3">Watching</th><th className="pb-2 pr-3">Last activity</th><th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {data.auctions.map((a) => (
                <tr key={a.code} className="border-t border-[var(--hairline)]">
                  <td className="py-2 pr-3"><div className="font-semibold">{a.name}</div><div className="num text-xs text-slate-400">{a.code}</div></td>
                  <td className="py-2 pr-3"><span className={`chip ${BADGE[a.status]}`}>{a.status === 'unlocked' ? (a.by === 'grant' ? 'unlocked · free' : 'unlocked · paid') : a.status}</span></td>
                  <td className="num py-2 pr-3">{a.teams} · {a.players} · {a.sold}</td>
                  <td className="num py-2 pr-3">{a.screens}</td>
                  <td className="py-2 pr-3 text-slate-400">{ago(a.lastActivity)}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {a.status !== 'unlocked' && a.status !== 'free' && (
                        <button className="btn-ghost !px-2.5 !py-1 !text-xs" title="Give free access" onClick={() => act(a.code, 'grant')}><Gift className="h-3.5 w-3.5" /> Grant free</button>
                      )}
                      {a.status === 'unlocked' && <button className="btn-ghost !px-2.5 !py-1 !text-xs" onClick={() => act(a.code, 'lock')}><Lock className="h-3.5 w-3.5" /> Take back</button>}
                      <button className="btn-danger !px-2.5 !py-1 !text-xs" onClick={() => confirm(`Delete “${a.name}” (${a.code}) for good?`) && act(a.code, 'delete')}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.auctions.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">No auctions on the server.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-8">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <ModeToggle />
      </div>
      {children}
    </div>
  );
}
