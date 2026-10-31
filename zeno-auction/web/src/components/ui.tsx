import { Check, Copy, Gavel, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Captain, Player } from '../../../shared/types';

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
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md animate-rise rounded-xl border px-4 py-2.5 text-sm font-medium shadow-2xl ${
              t.kind === 'error'
                ? 'border-red-400/40 bg-red-950/95 text-red-100'
                : t.kind === 'success'
                  ? 'border-emerald-400/40 bg-emerald-950/95 text-emerald-100'
                  : 'border-white/15 bg-ink-700/95 text-slate-100'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---- brand ----------------------------------------------------------------------------------

export function Logo({ to = '/', size = 'md' }: { to?: string; size?: 'md' | 'lg' }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5">
      <span className={`grid place-items-center rounded-xl bg-gold text-ink-950 ${size === 'lg' ? 'h-12 w-12' : 'h-9 w-9'}`}>
        <Gavel className={size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'} strokeWidth={2.5} />
      </span>
      <span className={`font-display tracking-wide ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}>
        ZENO<span className="text-gold">BID</span>
      </span>
    </Link>
  );
}

// ---- form bits ------------------------------------------------------------------------------

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
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
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-ink-900 px-3.5 py-3 text-left transition hover:border-white/25"
    >
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-gold' : 'bg-ink-600'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
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
            value === o.value ? 'border-gold bg-gold/10' : 'border-white/10 bg-ink-900 hover:border-white/25'
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
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-ink-900/80 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
            value === t.id ? 'bg-gold text-ink-950' : 'text-slate-300 hover:bg-white/5'
          }`}
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className={`card max-h-[92vh] w-full overflow-y-auto p-5 shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
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
      <div>
        <Logo />
        <h1 className="mt-8 font-display text-4xl tracking-wide">{title}</h1>
        <div className="mt-3 text-slate-400">{children}</div>
      </div>
    </div>
  );
}

// ---- avatars --------------------------------------------------------------------------------

function hue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** The coloured backdrop used for players without a photo. */
export function avatarGradient(name: string): string {
  const h = hue(name);
  return `linear-gradient(135deg, hsl(${h} 70% 38%), hsl(${(h + 50) % 360} 70% 20%))`;
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
  const h = hue(player.name);
  return (
    <div
      className={`grid place-items-center font-display text-white ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${h} 70% 45%), hsl(${(h + 50) % 360} 70% 30%))` }}
    >
      <span className="select-none" style={{ fontSize: '2.4em' }}>
        {initials(player.name)}
      </span>
    </div>
  );
}

export function TeamDot({ captain, size = 10 }: { captain: Pick<Captain, 'color'>; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ background: captain.color, width: size, height: size }} />;
}

export function TeamBadge({ captain, className = '' }: { captain: Pick<Captain, 'team' | 'color' | 'logo'>; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className}`}>
      {captain.logo ? (
        <img src={captain.logo} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <TeamDot captain={captain} size={12} />
      )}
      {captain.team}
    </span>
  );
}
