import { useEffect, useState } from 'react';
import { formatMoney, parseMoney, type MoneyFmt } from '../../../shared/money';

/** Type "12cr", "5 lakh", "250k" or a plain number; shows what it understood. */
export function MoneyInput({
  value,
  onChange,
  fmt,
  placeholder,
  className = '',
  allowZero = false,
}: {
  value: number;
  onChange: (n: number) => void;
  fmt: MoneyFmt;
  placeholder?: string;
  className?: string;
  allowZero?: boolean;
}) {
  const [text, setText] = useState(value ? formatMoney(value, { ...fmt, symbol: '' }).trim() : '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value || allowZero ? (value ? formatMoney(value, { ...fmt, symbol: '' }).trim() : '0') : '');
  }, [value, focused, fmt.moneyStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = parseMoney(text);
  const invalid = text.trim() !== '' && parsed === null;

  return (
    <div className={className}>
      <input
        className={`input ${invalid ? '!border-red-400/60' : ''}`}
        value={text}
        placeholder={placeholder ?? 'e.g. 12cr, 5L, 250k'}
        inputMode="text"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseMoney(e.target.value);
          if (n !== null && (n > 0 || allowZero)) onChange(n);
        }}
      />
      <p className={`mt-1 text-xs ${invalid ? 'text-red-300' : 'text-slate-500'}`}>
        {invalid ? "Couldn't read that — try 12cr, 5L or 250k" : parsed !== null ? `= ${formatMoney(parsed, fmt)}` : ' '}
      </p>
    </div>
  );
}
