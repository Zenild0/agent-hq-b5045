// What the announcer says, in each style. Pure text: the browser turns it into speech and sound
// (web/src/lib/sound.ts). Styles are INSPIRED by a kind of announcer (a wrestling ring announcer, a quiz-show host,
// a fighting-game narrator): the wording, pace and effects. They are not recordings or copies of anyone's voice.

import { spokenMoney, type MoneyFmt } from './money';

export type AnnouncerStyle = 'classic' | 'wwe' | 'kbc' | 'mk';
export type SpeechKind = 'reveal' | 'bid' | 'call' | 'sold' | 'unsold';

export const STYLES: { id: AnnouncerStyle; label: string; hint: string; lang: 'en' | 'hi' }[] = [
  { id: 'classic', label: 'Classic', hint: 'A clear, friendly announcer', lang: 'en' },
  { id: 'wwe', label: 'WWE hype', hint: 'Big, loud ring-announcer energy (English)', lang: 'en' },
  { id: 'kbc', label: 'KBC host', hint: 'Slow, dramatic quiz-show host (Hindi)', lang: 'hi' },
  { id: 'mk', label: 'Mortal Kombat', hint: 'Deep arena narrator with gongs and drums (English)', lang: 'en' },
];

export interface SpeechLine {
  text: string;
  /** The same sentence in Latin letters, for a device that has no Hindi voice (an English voice reads it). */
  alt?: string;
  lang: 'en' | 'hi';
  /** undefined = use the app's default voice settings (classic) */
  pitch?: number;
  rate?: number;
  gender?: 'male' | 'female';
}

export interface AnnounceCtx {
  team?: string;
  player?: string;
  /** the bid / the price / the base price, depending on the kind */
  amount?: number;
  call?: number;
  fmt: MoneyFmt;
  /** changes from one announcement to the next so the lines are not always the same */
  variant: number;
}

// ---- Hindi numbers -------------------------------------------------------------------------------

const HI = '0 शून्य|एक|दो|तीन|चार|पाँच|छह|सात|आठ|नौ|दस|ग्यारह|बारह|तेरह|चौदह|पंद्रह|सोलह|सत्रह|अठारह|उन्नीस|बीस|इक्कीस|बाईस|तेईस|चौबीस|पच्चीस|छब्बीस|सत्ताईस|अट्ठाईस|उनतीस|तीस|इकतीस|बत्तीस|तैंतीस|चौंतीस|पैंतीस|छत्तीस|सैंतीस|अड़तीस|उनतालीस|चालीस|इकतालीस|बयालीस|तैंतालीस|चौवालीस|पैंतालीस|छियालीस|सैंतालीस|अड़तालीस|उनचास|पचास|इक्यावन|बावन|तिरपन|चौवन|पचपन|छप्पन|सत्तावन|अट्ठावन|उनसठ|साठ|इकसठ|बासठ|तिरसठ|चौंसठ|पैंसठ|छियासठ|सड़सठ|अड़सठ|उनहत्तर|सत्तर|इकहत्तर|बहत्तर|तिहत्तर|चौहत्तर|पचहत्तर|छिहत्तर|सतहत्तर|अठहत्तर|उन्यासी|अस्सी|इक्यासी|बयासी|तिरासी|चौरासी|पचासी|छियासी|सत्तासी|अट्ठासी|नवासी|नब्बे|इक्यानवे|बानवे|तिरानवे|चौरानवे|पंचानवे|छियानवे|सत्तानवे|अट्ठानवे|निन्यानवे'.replace(/^0 /, '').split('|');
const HI_LATIN = 'shoonya|ek|do|teen|chaar|paanch|chhah|saat|aath|nau|das|gyaarah|baarah|terah|chaudah|pandrah|solah|satrah|athaarah|unnees|bees|ikkees|baaees|teyees|chaubees|pachchees|chhabbees|sattaaees|atthaaees|unatees|tees|ikatees|battees|taintees|chauntees|paintees|chhattees|saintees|adtees|untaalees|chaalees|iktaalees|bayaalees|taintaalees|chauwaalees|paintaalees|chhiyaalees|saintaalees|adtaalees|unchaas|pachaas|ikyaavan|baavan|tirpan|chauwan|pachpan|chhappan|sattaavan|atthaavan|unsath|saath|iksath|baasath|tirsath|chaunsath|painsath|chhiyaasath|sadsath|adsath|unhattar|sattar|ikahattar|bahattar|tihattar|chauhattar|pachhattar|chhihattar|satahattar|athahattar|unyaasi|assi|ikyaasi|bayaasi|tiraasi|chauraasi|pachaasi|chhiyaasi|sattaasi|atthaasi|navaasi|nabbe|ikyaanave|baanave|tiraanave|chauraanave|panchaanave|chhiyaanave|sattaanave|atthaanave|ninyaanave'.split('|');

type Script = 'deva' | 'latin';
const words = (n: number, s: Script): string => (s === 'deva' ? HI : HI_LATIN)[n] ?? String(n);

/** 0–999 in Hindi words ("एक सौ पच्चीस"). */
function below1000(n: number, s: Script): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const hundred = s === 'deva' ? 'सौ' : 'sau';
  return [h ? `${words(h, s)} ${hundred}` : '', rest || !h ? words(rest, s) : ''].filter(Boolean).join(' ');
}

const CURRENCY: Record<string, [string, string]> = { '₹': ['रुपये', 'rupaye'], $: ['डॉलर', 'dollar'], '€': ['यूरो', 'euro'], '£': ['पाउंड', 'pound'], pts: ['पॉइंट्स', 'points'] };

/** "एक करोड़ बीस लाख रुपये" (or in Latin letters: "ek crore bees lakh rupaye"). Falls back to English words when it cannot. */
export function hindiMoney(amount: number, fmt: MoneyFmt, s: Script = 'deva'): string {
  if (fmt.moneyStyle !== 'indian' || amount >= 1e9) return spokenMoney(amount, fmt);
  let n = Math.round(amount);
  const units: [number, string, string][] = [[1e7, 'करोड़', 'crore'], [1e5, 'लाख', 'lakh'], [1e3, 'हज़ार', 'hazaar']];
  const parts: string[] = [];
  for (const [size, deva, latin] of units) {
    const q = Math.floor(n / size);
    if (q > 0) {
      parts.push(`${q > 99 ? String(q) : words(q, s)} ${s === 'deva' ? deva : latin}`);
      n -= q * size;
    }
  }
  if (n > 0 || parts.length === 0) parts.push(below1000(n, s));
  const cur = CURRENCY[fmt.symbol]?.[s === 'deva' ? 0 : 1];
  return (parts.join(' ') + (cur ? ' ' + cur : '')).trim();
}

// ---- the lines -----------------------------------------------------------------------------------

const pick = <T,>(list: T[], variant: number): T => list[Math.abs(variant) % list.length];

function classic(kind: SpeechKind, c: AnnounceCtx): SpeechLine | null {
  const m = (n: number) => spokenMoney(n, c.fmt);
  switch (kind) {
    case 'reveal': return c.player ? { text: `Up next, ${c.player}. Base price ${m(c.amount ?? 0)}.`, lang: 'en' } : null;
    case 'bid': return c.team && c.amount ? { text: `${c.team}, ${m(c.amount)}`, lang: 'en' } : null;
    case 'call': return { text: ['', 'Going once!', 'Going twice!', 'Going thrice! Last call!'][c.call ?? 1] ?? '', lang: 'en' };
    case 'sold': return c.player && c.team && c.amount ? { text: `Sold! ${c.player} goes to ${c.team} for ${m(c.amount)}`, lang: 'en' } : null;
    case 'unsold': return c.player ? { text: `${c.player} goes unsold`, lang: 'en' } : null;
  }
}

/** Ring-announcer hype: short, punchy, lots of exclamation. */
function wwe(kind: SpeechKind, c: AnnounceCtx): SpeechLine | null {
  const m = (n: number) => spokenMoney(n, c.fmt);
  const base = { lang: 'en' as const, pitch: 0.8, rate: 1.12, gender: 'male' as const };
  switch (kind) {
    case 'reveal': return c.player ? { ...base, text: `Ladies and gentlemen! Making their way to the ring... ${c.player}! Opening bid, ${m(c.amount ?? 0)}!` } : null;
    case 'bid': {
      if (!c.team || !c.amount) return null;
      const t = c.team, a = m(c.amount);
      return { ...base, text: pick([`${t}! ${a}!`, `And ${t} raises the stakes... ${a}!`, `${t} slams it down! ${a}! Can anybody top that?!`, `${t} is IN the ring with ${a}! Oh, what a bid!`], c.variant) };
    }
    case 'call': return { ...base, text: ['', 'Going once! Do I hear more?!', 'Going twice! This is it!', 'Last chance! Going three times!'][c.call ?? 1] ?? '' };
    case 'sold': return c.player && c.team && c.amount ? { ...base, text: `${c.player}... is SOLD to ${c.team}, for ${m(c.amount)}! And the crowd goes WILD!` } : null;
    case 'unsold': return c.player ? { ...base, text: `Nobody wants ${c.player}?! Back to the locker room!` } : null;
  }
}

/** Slow, deep, dramatic quiz-show host, in Hindi. */
function kbc(kind: SpeechKind, c: AnnounceCtx): SpeechLine | null {
  const base = { lang: 'hi' as const, pitch: 0.6, rate: 0.82, gender: 'male' as const };
  const hi = (n: number) => hindiMoney(n, c.fmt, 'deva');
  const la = (n: number) => hindiMoney(n, c.fmt, 'latin');
  const both = (deva: (a: string) => string, latin: (a: string) => string, amount: number) => ({ text: deva(hi(amount)), alt: latin(la(amount)) });
  switch (kind) {
    case 'reveal':
      return c.player ? { ...base, ...both((a) => `देवियों और सज्जनों... हमारे अगले खिलाड़ी हैं... ${c.player}. शुरुआती बोली... ${a}.`, (a) => `Deviyon aur sajjano... humare agle khiladi hain... ${c.player}. Shuruaati boli... ${a}.`, c.amount ?? 0) } : null;
    case 'bid': {
      if (!c.team || !c.amount) return null;
      const t = c.team;
      return { ...base, ...pick([
        both((a) => `${t} ने लगाई बोली... ${a}!`, (a) => `${t} ne lagaayi boli... ${a}!`, c.amount),
        both((a) => `${a}! ${t} की तरफ़ से... क्या कोई और है जो इस बोली को चुनौती दे?`, (a) => `${a}! ${t} ki taraf se... kya koi aur hai jo is boli ko chunauti de?`, c.amount),
        both((a) => `बोली बढ़कर हुई... ${a}! ${t} के नाम.`, (a) => `Boli badhkar hui... ${a}! ${t} ke naam.`, c.amount),
      ], c.variant) };
    }
    case 'call': {
      const n = c.call ?? 1;
      return { ...base, text: ['', 'एक बार...', 'दो बार...', 'तीसरी बार... यह आख़िरी मौक़ा है!'][n] ?? '', alt: ['', 'Ek baar...', 'Do baar...', 'Teesri baar... yeh aakhiri mauka hai!'][n] ?? '' };
    }
    case 'sold':
      return c.player && c.team && c.amount ? { ...base, ...both((a) => `${c.player} अब ${c.team} की टीम में हैं. ${a} में सौदा पक्का!`, (a) => `${c.player} ab ${c.team} ki team mein hain. ${a} mein sauda pakka!`, c.amount) } : null;
    case 'unsold':
      return c.player ? { ...base, text: `${c.player} के लिए कोई बोली नहीं लगी.`, alt: `${c.player} ke liye koi boli nahin lagi.` } : null;
  }
}

/** A deep arena narrator. */
function mk(kind: SpeechKind, c: AnnounceCtx): SpeechLine | null {
  const m = (n: number) => spokenMoney(n, c.fmt);
  const base = { lang: 'en' as const, pitch: 0.25, rate: 0.78, gender: 'male' as const };
  switch (kind) {
    case 'reveal': return c.player ? { ...base, text: `${c.player}... enters the arena. Opening bid... ${m(c.amount ?? 0)}.` } : null;
    case 'bid': {
      if (!c.team || !c.amount) return null;
      const t = c.team, a = m(c.amount);
      return { ...base, text: pick([`${t}... ${a}!`, `Brutal! ${t}... ${a}!`, `${t} strikes... ${a}!`, `${t}! ${a}! No mercy!`], c.variant) };
    }
    case 'call': return { ...base, text: ['', 'Prepare yourselves...', 'Last warning!', 'Finish him!'][c.call ?? 1] ?? '' };
    case 'sold': return c.player && c.team && c.amount ? { ...base, text: `${c.team} wins! ${c.player} is theirs... for ${m(c.amount)}! Flawless victory!` } : null;
    case 'unsold': return c.player ? { ...base, text: `Nobody dares. ${c.player} remains unclaimed.` } : null;
  }
}

export function announce(style: AnnouncerStyle, kind: SpeechKind, ctx: AnnounceCtx): SpeechLine | null {
  const line = (style === 'wwe' ? wwe : style === 'kbc' ? kbc : style === 'mk' ? mk : classic)(kind, ctx);
  return line && line.text ? line : null;
}

export const isStyle = (v: unknown): v is AnnouncerStyle => v === 'classic' || v === 'wwe' || v === 'kbc' || v === 'mk';
