// "Say it to bid": turns what a captain says into their phone into a bid.
//
//   "raise" / "bid" / "boli" / "badhao"          → the next bid (the minimum step up)
//   "1 crore 20 lakh", "one crore twenty", "1.2 crore", "पचास लाख", "pachaas lakh", "75 thousand", "2 million"
//                                                 → that amount
//
// Anything else (people talking, the Zoom call in the background) is ignored. To keep a chatty room from bidding by
// accident, only SHORT phrases count, and an amount must name its size (crore / lakh / thousand / million) unless it is
// written out in full ("12,00,000").

import { HINDI_NUMBERS, HINDI_NUMBERS_LATIN } from './announcer';

export type HeardBid = { kind: 'raise' } | { kind: 'amount'; amount: number };

const UNITS: Record<string, number> = { crore: 1e7, lakh: 1e5, million: 1e6, billion: 1e9, thousand: 1e3 };
/** what a number left at the end means after a unit: "1 crore 20" = 1 crore 20 lakh */
const NEXT_DOWN: Record<string, number> = { crore: 1e5, lakh: 1e3, million: 1e3, billion: 1e6, thousand: 1 };

const SYNONYMS: [RegExp, string][] = [
  [/करोड़|करोड|crores?|karod|karor|cr\b/g, ' crore '],
  [/लाख|lakhs?|lacs?|laakh|lakhs/g, ' lakh '],
  [/हज़ार|हजार|thousands?|hazaar|hazar|hajar/g, ' thousand '],
  [/millions?|\bmn\b/g, ' million '],
  [/billions?/g, ' billion '],
  [/सौ|hundred|\bsau\b/g, ' hundred '],
  [/बोली|बढ़ाओ|बढ़ा दो|बढ़ाइए|raise|raised|badhao|badhaao|badha do|boli/g, ' raise '],
  [/\bbid\b|\bbids\b|\bbidding\b/g, ' raise '],
];
const ENGLISH: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, half: 0.5, a: 1, an: 1,
};
const HINDI = new Map<string, number>();
HINDI_NUMBERS.forEach((w, i) => HINDI.set(w, i));
HINDI_NUMBERS_LATIN.forEach((w, i) => HINDI.set(w, i));
HINDI.set('पांच', 5).set('paanch', 5).set('panch', 5).set('dedh', 1.5).set('डेढ़', 1.5).set('dhai', 2.5).set('ढाई', 2.5).set('sava', 1.25).set('सवा', 1.25);

/** A short phrase (a few words) is a command; a long sentence is someone talking. */
export const MAX_WORDS = 7;

export function parseSpokenBid(said: string): HeardBid | null {
  let t = ` ${said.toLowerCase()} `
    .replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))
    .replace(/(\d),(?=\d)/g, '$1') // 12,00,000 → 1200000
    .replace(/₹|rs\.?|rupees?|rupaye|रुपये|रुपए|dollars?|\$/g, ' ');
  if (t.trim().split(/\s+/).length > MAX_WORDS) return null;
  for (const [re, to] of SYNONYMS) t = t.replace(re, to);
  t = t.replace(/(\d)(crore|lakh|thousand|million|billion|k)\b/g, '$1 $2').replace(/\b(\d+(?:\.\d+)?) k\b/g, '$1 thousand');
  // a full stop ends a word, but the point in "1.2" stays
  const words = t.split(/[\s,!?-]+|\.(?!\d)/).filter(Boolean);

  let total = 0;
  let pending: number | null = null;
  let lastUnit = '';
  let units = 0;
  let bigDigits = 0;
  const number = (w: string): number | null => {
    if (/^\d+(\.\d+)?$/.test(w)) return Number(w);
    if (w in ENGLISH) return ENGLISH[w];
    return HINDI.has(w) ? HINDI.get(w)! : null;
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w in UNITS) {
      total += (pending ?? 1) * UNITS[w];
      pending = null;
      lastUnit = w;
      units++;
      continue;
    }
    if (w === 'hundred') {
      pending = (pending ?? 1) * 100;
      continue;
    }
    const n = number(w);
    if (n === null) continue;
    // "a" / "an" only count right before a size ("a crore")
    if ((w === 'a' || w === 'an') && !(words[i + 1] in UNITS)) continue;
    if (/^\d{6,}$/.test(w)) bigDigits = Math.max(bigDigits, n);
    // "twenty five" → 25
    if (pending !== null && pending >= 20 && pending % 10 === 0 && pending < 100 && n < 10) pending += n;
    else pending = n;
  }
  if (units > 0) {
    if (pending !== null) total += pending * (NEXT_DOWN[lastUnit] ?? 1);
    const amount = Math.round(total);
    if (amount > 0) return { kind: 'amount', amount };
  }
  if (bigDigits >= 1000) return { kind: 'amount', amount: Math.round(bigDigits) };
  return words.includes('raise') ? { kind: 'raise' } : null;
}

/** What to do with what was heard, given where the bidding is. */
export type VoiceDecision =
  | { act: 'bid'; amount: number }
  | { act: 'confirm'; amount: number } // much higher than expected: ask for a tap first
  | { act: 'ignore'; why: string };

export function decideVoiceBid(heard: HeardBid | null, min: number, limit: number): VoiceDecision {
  if (!heard) return { act: 'ignore', why: 'not a bid' };
  if (heard.kind === 'raise') return min <= limit ? { act: 'bid', amount: min } : { act: 'ignore', why: 'over your budget' };
  const a = heard.amount;
  if (a < min) return { act: 'ignore', why: 'below the next bid' };
  if (a > limit) return { act: 'ignore', why: 'over your budget' };
  // a big jump might be a mishearing ("20 crore" for "2 crore"): ask for a tap
  if (a > min * 2) return { act: 'confirm', amount: a };
  return { act: 'bid', amount: a };
}
