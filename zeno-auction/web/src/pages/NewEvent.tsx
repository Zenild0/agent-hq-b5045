import { Check, Loader2, Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuctionPreview } from '../components/AuctionPreview';
import { SECTIONS, SettingsForm } from '../components/SettingsForm';
import { Logo, useToast } from '../components/ui';
import { createEvent } from '../lib/api';
import { saveEvent } from '../lib/session';
import type { EventSettings } from '../../../shared/types';

// Mirrors the server defaults so the form is filled in before the first round-trip.
const DEFAULTS: EventSettings = {
  name: 'Office Premier League',
  sport: 'Cricket',
  tagline: 'The Zeno team auction',
  accent: '#f2b84b',
  symbol: '₹',
  moneyStyle: 'indian',
  defaultBudget: 120_000_000,
  defaultBasePrice: 2_000_000,
  increments: [
    { from: 0, step: 500_000 },
    { from: 10_000_000, step: 1_000_000 },
  ],
  display: { showPhoto: true, showDescription: true, showRole: true, showBasePrice: true },
  drawMode: 'random',
  minSquad: 0,
  maxSquad: 0,
  reserveRule: false,
  totalRounds: 2,
};

export default function NewEvent() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const nav = useNavigate();
  const { toast } = useToast();

  // highlight the step that is on screen
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(`sec-${s.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id.replace('sec-', ''));
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const res = await createEvent(settings);
      const now = Date.now();
      saveEvent({ code: res.code, name: settings.name, role: 'admin', key: res.adminKey, at: now });
      localStorage.setItem(`zeno:key:${res.code}:admin`, res.adminKey);
      localStorage.setItem(`zeno:key:${res.code}:host`, res.hostKey);
      nav(`/e/${res.code}/admin?k=${res.adminKey}`);
    } catch (err) {
      toast((err as Error).message, 'error');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-5 sm:px-8">
      <div className="flex items-center justify-between">
        <Logo />
        <Link to="/" className="text-sm font-semibold text-slate-400 hover:text-white">
          ← Back
        </Link>
      </div>

      <div className="mb-8 mt-8">
        <p className="eyebrow">New auction</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight">Set the stage</h1>
        <p className="mt-2 max-w-xl text-slate-400">Choose the rules once — you can change almost everything later, even mid-auction. The preview updates as you go.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_400px]">
        {/* step navigator */}
        <aside className="hidden lg:block">
          <nav className="sticky top-6 space-y-1" aria-label="Steps">
            {SECTIONS.map((s, i) => {
              const on = active === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${on ? 'bg-gold/10 text-gold' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${on ? 'text-ink-950' : 'border border-[var(--hairline)] text-slate-400'}`}
                    style={on ? { background: 'var(--gold-grad)' } : undefined}
                  >
                    {i + 1}
                  </span>
                  {s.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-5">
          <div className="xl:hidden">
            <p className="eyebrow mb-2">Live preview</p>
            <AuctionPreview settings={settings} />
          </div>
          <SettingsForm value={settings} onChange={setSettings} />
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-6 space-y-3">
            <p className="eyebrow">Live preview</p>
            <AuctionPreview settings={settings} />
            <p className="px-1 text-xs leading-relaxed text-slate-500">This is how each player appears on the big screen with your choices. Bid amounts follow your bid steps.</p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--hairline)] bg-ink-950/85 p-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-0 sm:px-4">
          <p className="hidden items-center gap-2 text-sm text-slate-400 sm:flex">
            <Check className="h-4 w-4 text-emerald-400" /> Next: add your teams and players.
          </p>
          <button className="btn-primary ml-auto !px-7 !py-3 text-base" onClick={create} disabled={busy || !settings.name.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Create auction
          </button>
        </div>
      </div>
    </div>
  );
}
