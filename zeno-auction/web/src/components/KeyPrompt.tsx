import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from './ui';

/** Shown when a role page is opened without (or with a wrong) key. */
export function KeyPrompt({ title, hint, upper = false }: { title: string; hint: string; upper?: boolean }) {
  const [value, setValue] = useState('');
  const nav = useNavigate();
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form
        className="card w-full max-w-md space-y-4 p-7"
        onSubmit={(e) => {
          e.preventDefault();
          const k = value.trim();
          if (k) nav(`?k=${encodeURIComponent(upper ? k.toUpperCase() : k)}`, { replace: true });
        }}
      >
        <Logo />
        <h1 className="font-display text-4xl tracking-wide">{title}</h1>
        <p className="text-sm text-slate-400">{hint}</p>
        <input
          autoFocus
          className={`input ${upper ? 'text-center font-display text-2xl tracking-[0.3em]' : ''}`}
          value={value}
          onChange={(e) => setValue(upper ? e.target.value.toUpperCase() : e.target.value)}
          placeholder={upper ? '••••••' : 'Paste your key'}
        />
        <button className="btn-primary w-full" disabled={!value.trim()}>
          <KeyRound className="h-4 w-4" /> Continue
        </button>
      </form>
    </div>
  );
}
