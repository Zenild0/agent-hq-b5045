import type { MoneyStyle } from './types';

export interface MoneyFmt {
  symbol: string;
  moneyStyle: MoneyStyle;
}

const INDIAN = [
  { v: 1e7, s: ' Cr', dec: 2 },
  { v: 1e5, s: ' L', dec: 2 },
];
const WESTERN = [
  { v: 1e6, s: 'M', dec: 3 },
  { v: 1e3, s: 'K', dec: 2 },
];

function group(n: number, style: MoneyStyle): string {
  return Math.round(n).toLocaleString(style === 'indian' ? 'en-IN' : 'en-US');
}

function withSymbol(body: string, symbol: string): string {
  if (!symbol) return body;
  // Word-like symbols ("pts") read better after the number.
  return /^[A-Za-z]+$/.test(symbol) ? `${body} ${symbol}` : `${symbol}${body}`;
}

/** ₹1.25 Cr, ₹95 L, $2.5M, $750K — falls back to the exact figure when a short form would round. */
export function formatMoney(amount: number, fmt: MoneyFmt): string {
  const n = Math.round(amount);
  const units = fmt.moneyStyle === 'indian' ? INDIAN : WESTERN;
  if (n < 0) return '-' + formatMoney(-n, fmt);
  for (const u of units) {
    if (n < u.v) continue;
    const q = n / u.v;
    for (let d = 0; d <= u.dec; d++) {
      const scaled = q * 10 ** d;
      if (Math.abs(scaled - Math.round(scaled)) < 1e-6) {
        return withSymbol(Number(q.toFixed(d)).toString() + u.s, fmt.symbol);
      }
    }
  }
  return withSymbol(group(n, fmt.moneyStyle), fmt.symbol);
}

const SUFFIX: Record<string, number> = {
  cr: 1e7, crore: 1e7, crores: 1e7,
  l: 1e5, lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5,
  k: 1e3, thousand: 1e3,
  m: 1e6, mn: 1e6, mil: 1e6, million: 1e6,
  b: 1e9, bn: 1e9, billion: 1e9,
};

/** "12cr", "5 lakh", "1.5m", "750k", "1,200,000" → number. Returns null when it can't be read. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[₹$€£,\s]+/g, '').toLowerCase();
  const m = /^(\d*\.?\d+)([a-z]*)$/.exec(cleaned);
  if (!m) return null;
  const mult = m[2] ? SUFFIX[m[2]] : 1;
  if (!mult) return null;
  const value = Math.round(parseFloat(m[1]) * mult);
  return Number.isFinite(value) ? value : null;
}

function currencyWord(symbol: string): string {
  switch (symbol) {
    case '₹': return 'rupees';
    case '$': return 'dollars';
    case '€': return 'euros';
    case '£': return 'pounds';
    default: return /^[A-Za-z]+$/.test(symbol) ? 'points' : '';
  }
}

/** Text for speech synthesis: "one crore twenty lakh rupees". */
export function spokenMoney(amount: number, fmt: MoneyFmt): string {
  let n = Math.round(amount);
  const parts: string[] = [];
  const take = (size: number, word: string) => {
    const q = Math.floor(n / size);
    if (q > 0) {
      parts.push(`${q} ${word}`);
      n -= q * size;
    }
  };
  if (fmt.moneyStyle === 'indian') {
    take(1e7, 'crore');
    take(1e5, 'lakh');
    take(1e3, 'thousand');
  } else {
    take(1e6, 'million');
    take(1e3, 'thousand');
  }
  if (n > 0 || parts.length === 0) parts.push(String(n));
  const word = currencyWord(fmt.symbol);
  return (parts.join(' ') + (word ? ' ' + word : '')).trim();
}
