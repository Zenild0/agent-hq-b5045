import { Plus, Trash2 } from 'lucide-react';
import { formatMoney } from '../../../shared/money';
import type { EventSettings } from '../../../shared/types';
import { MoneyInput } from './MoneyInput';
import { Field, Segmented, Toggle } from './ui';

const SPORTS = ['Cricket', 'Football', 'Basketball', 'Kabaddi', 'Volleyball', 'Esports', 'Hackathon', 'Other'];
const CURRENCIES = [
  { id: 'INR', label: '₹ Rupees', symbol: '₹', moneyStyle: 'indian' as const },
  { id: 'USD', label: '$ Dollars', symbol: '$', moneyStyle: 'western' as const },
  { id: 'EUR', label: '€ Euros', symbol: '€', moneyStyle: 'western' as const },
  { id: 'GBP', label: '£ Pounds', symbol: '£', moneyStyle: 'western' as const },
  { id: 'PTS', label: 'Points', symbol: 'pts', moneyStyle: 'western' as const },
];
const ACCENTS = ['#f2b84b', '#5b8cff', '#5cc8ff', '#34d399', '#b388ff', '#ff7d95'];

/** The sections of the form, in order (the create page builds its step navigator from this). */
export const SECTIONS = [
  { id: 'event', label: 'The event' },
  { id: 'money', label: 'Money' },
  { id: 'audience', label: 'What the audience sees' },
  { id: 'next', label: 'Who comes next' },
  { id: 'squad', label: 'Squad rules' },
] as const;

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={`sec-${id}`} className="card scroll-mt-24 p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      {hint && <p className="mb-4 mt-0.5 text-sm text-slate-400">{hint}</p>}
      {!hint && <div className="mb-4" />}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function SettingsForm({ value, onChange }: { value: EventSettings; onChange: (next: EventSettings) => void }) {
  const set = <K extends keyof EventSettings>(key: K, v: EventSettings[K]) => onChange({ ...value, [key]: v });
  const fmt = value;
  const currency = CURRENCIES.find((c) => c.symbol === value.symbol && c.moneyStyle === value.moneyStyle)?.id ?? 'custom';

  const setTier = (i: number, patch: Partial<{ from: number; step: number }>) =>
    set('increments', value.increments.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-5">
      <Section id="event" title="The event">
        <Field label="Event name">
          <input className="input" value={value.name} maxLength={80} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sport / theme" hint="Just a label — this works for any kind of team draft.">
            <input className="input" value={value.sport} maxLength={40} onChange={(e) => set('sport', e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SPORTS.map((s) => (
                <button key={s} type="button" className="chip hover:bg-white/10" onClick={() => set('sport', s === 'Other' ? '' : s)}>
                  {s}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Tagline" hint="Shown on the big screen.">
            <input className="input" value={value.tagline} maxLength={140} onChange={(e) => set('tagline', e.target.value)} />
            <div className="mt-3 flex items-center gap-2">
              <span className="label !mb-0">Accent</span>
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Accent ${c}`}
                  onClick={() => set('accent', c)}
                  className={`h-7 w-7 rounded-full border-2 ${value.accent === c ? 'border-white' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
        </div>
      </Section>

      <Section id="money" title="Money" hint="Every team gets the same starting purse; you can top up or cut any team's purse during the auction.">
        <Field label="Currency">
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange({ ...value, symbol: c.symbol, moneyStyle: c.moneyStyle })}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${currency === c.id ? 'border-gold bg-gold/10' : 'border-white/10 bg-ink-900 hover:border-white/25'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="hint">{value.moneyStyle === 'indian' ? 'Amounts show as lakh / crore (₹95 L, ₹1.25 Cr).' : 'Amounts show as K / M ($750K, $2.5M).'}</p>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starting purse per team">
            <MoneyInput value={value.defaultBudget} fmt={fmt} onChange={(n) => set('defaultBudget', n)} />
          </Field>
          <Field label="Default base price">
            <MoneyInput value={value.defaultBasePrice} fmt={fmt} onChange={(n) => set('defaultBasePrice', n)} />
            <p className="hint -mt-0.5">Players can have their own base price when you add them.</p>
          </Field>
        </div>

        <Field label="How much each bid goes up" hint="The step is picked by the current bid: a tier applies once the bid has reached its “from” amount.">
          <div className="space-y-2">
            {value.increments.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                <div>
                  <span className="mb-1 block text-xs text-slate-500">{i === 0 ? 'From the start' : 'Once the bid reaches'}</span>
                  {i === 0 ? (
                    <div className="input !bg-ink-800 text-slate-400">{formatMoney(0, fmt)}</div>
                  ) : (
                    <MoneyInput value={t.from} fmt={fmt} onChange={(n) => setTier(i, { from: n })} />
                  )}
                </div>
                <div>
                  <span className="mb-1 block text-xs text-slate-500">Each bid goes up by</span>
                  <MoneyInput value={t.step} fmt={fmt} onChange={(n) => setTier(i, { step: n })} />
                </div>
                <button
                  type="button"
                  disabled={i === 0}
                  className="btn-ghost mt-6 !p-2.5 disabled:invisible"
                  onClick={() => set('increments', value.increments.filter((_, j) => j !== i))}
                  aria-label="Remove tier"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-ghost !py-2 text-xs"
              onClick={() => {
                const last = value.increments[value.increments.length - 1];
                set('increments', [...value.increments, { from: Math.max(last.from * 2, value.defaultBudget / 10), step: last.step * 2 }]);
              }}
            >
              <Plus className="h-4 w-4" /> Add a tier
            </button>
            <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
              Example:{' '}
              {value.increments
                .map((t, i) => `${i === 0 ? 'Up to' : 'From'} ${i === 0 && value.increments[1] ? formatMoney(value.increments[1].from, fmt) : formatMoney(t.from, fmt)} → +${formatMoney(t.step, fmt)}`)
                .join('  ·  ')}
            </p>
          </div>
        </Field>
      </Section>

      <Section id="audience" title="What the audience sees" hint="Choose how each player is shown when they come on the block.">
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Player photo" hint="Face on the big screen" checked={value.display.showPhoto} onChange={(v) => set('display', { ...value.display, showPhoto: v })} />
          <Toggle label="Description" hint="A line about the player" checked={value.display.showDescription} onChange={(v) => set('display', { ...value.display, showDescription: v })} />
          <Toggle label="Role / category" hint="Batter, Striker, Designer…" checked={value.display.showRole} onChange={(v) => set('display', { ...value.display, showRole: v })} />
          <Toggle label="Base price" hint="Show the opening price" checked={value.display.showBasePrice} onChange={(v) => set('display', { ...value.display, showBasePrice: v })} />
        </div>
        <p className="hint">The player's name is always shown.</p>
      </Section>

      <Section id="next" title="Who comes up next">
        <Segmented
          value={value.drawMode}
          onChange={(v) => set('drawMode', v)}
          options={[
            { value: 'random', label: 'Random spin', hint: 'A wheel spins and lands on a player' },
            { value: 'manual', label: 'Auctioneer picks', hint: 'Choose each player yourself' },
            { value: 'sequential', label: 'In list order', hint: 'Top to bottom' },
          ]}
        />
        <Field label="Planned rounds" hint="Players nobody buys go back into the pool when you start the next round.">
          <input className="input !w-28" type="number" min={1} max={9} value={value.totalRounds} onChange={(e) => set('totalRounds', Math.max(1, Number(e.target.value) || 1))} />
        </Field>
      </Section>

      <Section id="squad" title="Squad rules" hint="Optional. Leave at 0 for no limit.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum squad size">
            <input className="input" type="number" min={0} value={value.minSquad} onChange={(e) => set('minSquad', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Maximum squad size">
            <input className="input" type="number" min={0} value={value.maxSquad} onChange={(e) => set('maxSquad', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
        </div>
        <Toggle
          label="Keep money back for the minimum squad"
          hint="A team can't spend so much that it can't afford the cheapest players it still needs."
          checked={value.reserveRule}
          onChange={(v) => set('reserveRule', v)}
        />
      </Section>
    </div>
  );
}
