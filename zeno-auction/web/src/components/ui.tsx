import { AlertCircle, Check, CheckCircle2, Copy, Info, X } from 'lucide-react';
import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Captain, Player, SquadSort } from '../../../shared/types';

// ---- toasts ---------------------------------------------------------------------------------

type ToastKind = 'info' | 'error' | 'success';
const ToastCtx = createContext<{ toast: (msg: string, kind?: ToastKind) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: ToastKind }[]>([]);
  const nextId = useRef(1);
  const toast = useCallback((msg: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setItems((xs) => [...xs.slice(-3), { id, msg, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 5500 : 3200);
  }, []);
  const Icon = { info: Info, error: AlertCircle, success: CheckCircle2 };
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex max-w-md animate-rise items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl ${
                t.kind === 'error'
                  ? 'border-hot/40 bg-[#2a0d1a]/95 text-red-100'
                  : t.kind === 'success'
                    ? 'border-emerald-400/40 bg-[#062a22]/95 text-emerald-100'
                    : 'border-royal/40 bg-ink-800/95 text-pearl'
              }`}
            >
              <I className={`mt-0.5 h-4 w-4 shrink-0 ${t.kind === 'error' ? 'text-hot' : t.kind === 'success' ? 'text-emerald-400' : 'text-royal-300'}`} />
              <span>{t.msg}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

// ---- brand ----------------------------------------------------------------------------------

/** The ZenoBid mark: a gavel over a pulse line, in a navy tile with a gold edge. */
export function LogoMark({ size = 36 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0 drop-shadow-[0_6px_14px_rgba(242,184,75,0.35)]">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe9ac" />
          <stop offset=".5" stopColor="#f2b84b" />
          <stop offset="1" stopColor="#c98a12" />
        </linearGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2f63" />
          <stop offset="1" stopColor="#070f26" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill={`url(#b${id})`} stroke={`url(#g${id})`} strokeWidth="1.6" />
      <g transform="rotate(-38 24 20)">
        <rect x="11" y="8" width="24" height="11" rx="3.2" fill={`url(#g${id})`} />
        <rect x="21" y="18" width="5" height="17" rx="2.5" fill={`url(#g${id})`} />
      </g>
      <path d="M7 38h9l3-5 4 9 3-7h15" fill="none" stroke="#5b8cff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ to = '/', size = 'md' }: { to?: string; size?: 'md' | 'lg' }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label="ZenoBid home">
      <LogoMark size={size === 'lg' ? 46 : 36} />
      <span className={`font-display font-extrabold tracking-tight ${size === 'lg' ? 'text-4xl' : 'text-[1.4rem]'}`}>
        Zeno<span className="text-gold-grad">Bid</span>
      </span>
    </Link>
  );
}

// ---- form bits ------------------------------------------------------------------------------

/** Gives the first form control inside a Field the id its label points at (so screen readers announce it). */
function linkControl(children: ReactNode, id: string): ReactNode {
  let done = false;
  return Children.map(children, (child) => {
    if (done || !isValidElement(child)) return child;
    const el = child as ReactElement<{ id?: string }>;
    const isControl = ['input', 'select', 'textarea'].includes(el.type as string) || (typeof el.type !== 'string' && 'fmt' in (el.props as object));
    if (!isControl || el.props.id) return child;
    done = true;
    return cloneElement(el, { id });
  });
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {linkControl(children, id)}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-4 rounded-xl border px-3.5 py-3 text-left transition ${
        checked ? 'border-gold/40 bg-gold/[0.07]' : 'border-[var(--hairline)] bg-ink-900/60 hover:border-royal-300/30'
      }`}
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-gold' : 'bg-ink-600'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-xl border px-3 py-2.5 text-left transition ${
            value === o.value ? 'border-gold/70 bg-gold/[0.09] shadow-[0_0_24px_-8px_rgba(242,184,75,0.6)]' : 'border-[var(--hairline)] bg-ink-900/60 hover:border-royal-300/30'
          }`}
        >
          <span className="block text-sm font-semibold">{o.label}</span>
          {o.hint && <span className="block text-xs text-slate-400">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string; badge?: ReactNode }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-ink-900/70 p-1 backdrop-blur" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
            value === t.id ? 'text-ink-950 shadow-[0_6px_18px_-8px_rgba(242,184,75,0.8)]' : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
          style={value === t.id ? { background: 'var(--gold-grad)' } : undefined}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/75 p-4 backdrop-blur-md" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`card max-h-[92vh] w-full animate-pop overflow-y-auto p-5 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CopyButton({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn-ghost !px-3 !py-1.5 !text-xs ${className}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copied' : label}
    </button>
  );
}

export function FullScreenMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div className="max-w-md animate-rise">
        <Logo />
        <h1 className="mt-8 font-display text-3xl font-extrabold tracking-tight">{title}</h1>
        <div className="mt-3 text-slate-400">{children}</div>
      </div>
    </div>
  );
}

// ---- avatars --------------------------------------------------------------------------------

// A curated set of deep jewel tones so photo-less players still look premium (no neon).
const JEWELS = [222, 262, 340, 162, 200, 34, 188, 352];
function hue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return JEWELS[h % JEWELS.length];
}

/** The coloured backdrop used for players without a photo. */
export function avatarGradient(name: string): string {
  const h = hue(name);
  return `radial-gradient(120% 90% at 20% 0%, hsl(${h} 70% 52% / .9), transparent 60%), linear-gradient(145deg, hsl(${h} 58% 30%), hsl(${(h + 28) % 360} 62% 14%))`;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

export function PlayerAvatar({ player, className = '', showPhoto = true }: { player: Pick<Player, 'name' | 'photo'>; className?: string; showPhoto?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [player.photo]);
  if (showPhoto && player.photo && !broken) {
    return <img src={player.photo} alt={player.name} onError={() => setBroken(true)} className={`object-cover ${className}`} draggable={false} />;
  }
  return (
    <div className={`grid place-items-center font-display font-bold text-white/95 ${className}`} style={{ background: avatarGradient(player.name) }}>
      <span className="select-none" style={{ fontSize: '2.2em' }}>
        {initials(player.name)}
      </span>
    </div>
  );
}

export function TeamDot({ captain, size = 10 }: { captain: Pick<Captain, 'color'>; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ background: captain.color, width: size, height: size, boxShadow: `0 0 10px ${captain.color}88` }} />;
}

export function TeamBadge({ captain, className = '' }: { captain: Pick<Captain, 'team' | 'color' | 'logo'>; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className}`}>
      {captain.logo ? <img src={captain.logo} alt="" className="h-6 w-6 rounded-full object-cover" /> : <TeamDot captain={captain} size={12} />}
      {captain.team}
    </span>
  );
}

/** Two small buttons to order a team's players by price or by the order they were bought. */
export function SquadSortToggle({ value, onChange, className = '' }: { value: SquadSort; onChange: (v: SquadSort) => void; className?: string }) {
  const opts: { v: SquadSort; label: string }[] = [
    { v: 'price', label: 'Highest price' },
    { v: 'added', label: 'Order bought' },
  ];
  return (
    <div className={`inline-flex rounded-xl border border-[var(--hairline)] bg-ink-900/60 p-0.5 text-xs font-semibold ${className}`} role="group" aria-label="Order of players in each team">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-lg px-3 py-1.5 transition ${value === o.v ? 'bg-gold/15 text-gold' : 'text-slate-400 hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
