import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CodeBoxes } from './CodeBoxes';
import { Logo } from './ui';

/** Shown when a role page is opened without (or with a wrong) key. */
export function KeyPrompt({ title, hint, upper = false }: { title: string; hint: string; upper?: boolean }) {
  const [value, setValue] = useState('');
  const nav = useNavigate();
  const submit = () => {
    const k = value.trim();
    if (k) nav(`?k=${encodeURIComponent(upper ? k.toUpperCase() : k)}`, { replace: true });
  };
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form
        className="card w-full max-w-md animate-rise space-y-5 p-7 sm:p-9"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Logo />
        <div>
          <p className="eyebrow">Secure access</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-400">{hint}</p>
        </div>
        {upper ? (
          <CodeBoxes label="PIN" value={value} onChange={setValue} autoFocus onEnter={submit} />
        ) : (
          <input autoFocus className="input" aria-label="Access key" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste your key" />
        )}
        <button className="btn-primary w-full !py-3" disabled={!value.trim() || (upper && value.length < 6)}>
          <KeyRound className="h-4 w-4" /> Continue
        </button>
      </form>
    </div>
  );
}
