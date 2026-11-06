import { useRef } from 'react';

/** A row of single-character boxes (like a bank one-time code): type, paste, backspace all behave. */
export function CodeBoxes({
  value,
  onChange,
  length = 6,
  label,
  autoFocus = false,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  label: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(length, ' ').slice(0, length).split('');
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const set = (i: number, ch: string) => {
    const next = chars.slice();
    next[i] = ch || ' ';
    onChange(next.join('').replace(/\s+$/g, ''));
  };

  return (
    <div role="group" aria-label={label} className="flex justify-center gap-2 sm:gap-2.5">
      {chars.map((ch, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          autoFocus={autoFocus && i === 0}
          aria-label={`${label}, character ${i + 1}`}
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={1}
          value={ch.trim()}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const v = clean(e.target.value).slice(-1);
            set(i, v);
            if (v && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !chars[i].trim() && i > 0) {
              set(i - 1, '');
              refs.current[i - 1]?.focus();
              e.preventDefault();
            } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
            else if (e.key === 'Enter') onEnter?.();
          }}
          onPaste={(e) => {
            const pasted = clean(e.clipboardData.getData('text')).slice(0, length);
            if (!pasted) return;
            e.preventDefault();
            onChange(pasted);
            refs.current[Math.min(pasted.length, length - 1)]?.focus();
          }}
          className={`h-14 w-10 rounded-xl border text-center font-display text-2xl font-bold uppercase text-pearl transition focus:outline-none sm:h-16 sm:w-12 sm:text-3xl ${
            ch.trim() ? 'border-gold/60 bg-gold/[0.08]' : 'border-[var(--hairline)] bg-ink-900/70'
          } focus:border-gold focus:shadow-[0_0_0_3px_rgb(var(--accent)/0.2)]`}
        />
      ))}
    </div>
  );
}
