import { Check } from 'lucide-react';
import { THEMES, buildPalette, type Mode } from '../../../shared/themes';

const GROUPS = ['Classic', 'Sports', 'Antique', 'Stock market', 'Festive', 'More'] as const;

/** A card per theme showing its real colours and typeface; click to choose. */
export function ThemePicker({ value, onChange, mode }: { value: string; onChange: (id: string) => void; mode: Mode }) {
  return (
    <div className="space-y-5" role="radiogroup" aria-label="Theme">
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="eyebrow mb-2">{group}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {THEMES.filter((t) => t.group === group).map((t) => {
              const p = buildPalette(t, mode);
              const on = value === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(t.id)}
                  className={`group relative overflow-hidden rounded-xl border p-0 text-left transition ${on ? 'border-gold ring-2 ring-gold/50' : 'border-[var(--hairline)] hover:border-royal-300/50'}`}
                >
                  <div className="px-3 pb-2.5 pt-3" style={{ background: p.hex.bg, color: p.hex.text }}>
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full" style={{ background: p.hex.accent }} />
                      <span className="h-3 w-3 rounded-full" style={{ background: p.hex.accent2 }} />
                      <span className="h-3 w-3 rounded-full" style={{ background: p.hex.hot }} />
                      <span className="ml-auto h-3 w-8 rounded" style={{ background: p.hex.card, outline: `1px solid ${p.hex.muted}55` }} />
                    </div>
                    <div className="truncate text-sm font-bold" style={{ fontFamily: p.font }}>
                      {t.name}
                    </div>
                    <div className="num text-xs font-bold" style={{ color: p.hex.accentText, fontFamily: p.font }}>
                      ₹1.20 Cr
                    </div>
                  </div>
                  {on && (
                    <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gold text-onaccent">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
