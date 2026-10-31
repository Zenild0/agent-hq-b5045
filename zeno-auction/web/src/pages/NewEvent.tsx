import { Loader2, Rocket } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsForm } from '../components/SettingsForm';
import { Logo, useToast } from '../components/ui';
import { createEvent } from '../lib/api';
import { saveEvent } from '../lib/session';
import type { EventSettings } from '../../../shared/types';

// Mirrors the server defaults so the form is filled in before the first round-trip.
const DEFAULTS: EventSettings = {
  name: 'Office Premier League',
  sport: 'Cricket',
  tagline: 'The Zeno team auction',
  accent: '#ffc933',
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
  const nav = useNavigate();
  const { toast } = useToast();

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
    <div className="mx-auto max-w-3xl p-4 pb-32 sm:p-8">
      <Logo />
      <h1 className="mb-1 mt-8 font-display text-5xl tracking-wide">NEW AUCTION</h1>
      <p className="mb-6 text-slate-400">Set the rules once. You can change almost everything later, even mid-auction.</p>
      <SettingsForm value={settings} onChange={setSettings} />
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink-950/90 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <p className="hidden text-sm text-slate-400 sm:block">Next: add your teams and players.</p>
          <button className="btn-primary ml-auto !px-6 !py-3 text-base" onClick={create} disabled={busy || !settings.name.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Create auction
          </button>
        </div>
      </div>
    </div>
  );
}
