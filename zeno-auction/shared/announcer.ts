// What the announcer says, in each style. Pure text: the server turns it into a studio voice (server/tts.ts), or the
// browser speaks it (web/src/lib/sound.ts). Every style is an ORIGINAL host written in the manner of a kind of
// announcer (a ring announcer, a quiz-show host, a game-show host, a movie-trailer narrator, a cricket commentator…).
// None of them is a recording, copy or imitation of any real person's voice.
//
// The chosen host runs the whole auction: the wheel, each player, every bid, the calls, the sale, take-backs, breaks
// and new rounds. The host also reacts to what is happening: a bidding war heats up, a record price, a bargain, a team
// going all in, and how much a team has left.

import { spokenMoney, type MoneyFmt } from './money';

export type AnnouncerStyle = 'classic' | 'wwe' | 'kbc' | 'mk' | 'show' | 'velvet' | 'trailer' | 'cricket' | 'assistant';
export type SpeechKind = 'spin' | 'reveal' | 'bid' | 'call' | 'sold' | 'unsold' | 'undo' | 'break' | 'breakext' | 'breakend' | 'round';
export const SPEECH_KINDS: readonly SpeechKind[] = ['spin', 'reveal', 'bid', 'call', 'sold', 'unsold', 'undo', 'break', 'breakext', 'breakend', 'round'];
export const isSpeechKind = (v: unknown): v is SpeechKind => SPEECH_KINDS.includes(v as SpeechKind);

export const STYLES: { id: AnnouncerStyle; label: string; hint: string; lang: 'en' | 'hi' }[] = [
  { id: 'classic', label: 'Classic', hint: 'A clear, friendly announcer', lang: 'en' },
  { id: 'wwe', label: 'WWE hype', hint: 'Big, loud ring-announcer energy (English)', lang: 'en' },
  { id: 'kbc', label: 'KBC host', hint: 'Warm, dramatic quiz-show host who builds the suspense (Hindi)', lang: 'hi' },
  { id: 'mk', label: 'Mortal Kombat', hint: 'Deep arena narrator with gongs and drums (English)', lang: 'en' },
  { id: 'show', label: 'Game show host', hint: 'Glamorous, bubbly game-show host (English)', lang: 'en' },
  { id: 'velvet', label: 'Velvet', hint: 'Smooth, sultry late-night voice (English)', lang: 'en' },
  { id: 'trailer', label: 'Movie trailer', hint: 'Epic "In a world…" movie-trailer narrator (English)', lang: 'en' },
  { id: 'cricket', label: 'Cricket commentary', hint: 'Stadium commentary in Hindi: chauka, chhakka! (Hindi)', lang: 'hi' },
  { id: 'assistant', label: 'Smart assistant', hint: 'Friendly and clear, keeps everyone informed: purses, records, squads (English)', lang: 'en' },
];
export const isStyle = (v: unknown): v is AnnouncerStyle => STYLES.some((s) => s.id === v);

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
  /** how many bids this player has had so far (this one included): the more, the more excited the host */
  bids?: number;
  /** the team that was just outbid, when it is another team */
  rival?: string;
  /** the player's base price, to notice a price that has shot up (or a bargain) */
  base?: number;
  /** what the team has left to spend (after a sale) */
  left?: number;
  /** the highest price paid in this auction so far (a sale): a new record? */
  record?: boolean;
  /** the bid uses most of what the team has left */
  allIn?: boolean;
  /** how many players the team has now (after a sale) */
  squad?: number;
  /** break length in seconds (break / breakext) */
  seconds?: number;
  /** the round that is starting */
  round?: number;
}

/** How excited the host is: 0 = the first bid, 3 = a bidding war or a price far above the base. */
export function heatOf(c: Pick<AnnounceCtx, 'bids' | 'amount' | 'base'>): 0 | 1 | 2 | 3 {
  const n = c.bids ?? 1;
  let h = n <= 1 ? 0 : n <= 3 ? 1 : n <= 6 ? 2 : 3;
  if (c.base && c.amount && c.amount >= c.base * 4 && h < 3) h++;
  return h as 0 | 1 | 2 | 3;
}

/** What a screen (or the server) knows at a moment of the auction. */
export interface MomentSource {
  players: { id: string; name: string; basePrice: number; status?: string; teamId?: string | null; price?: number }[];
  captains: { id: string; team: string; budget?: number }[];
  settings: MoneyFmt & { defaultBasePrice: number };
  live: { bids: { captainId: string; amount: number }[] };
  round?: number;
}
export interface MomentEvent {
  seq: number;
  type: string;
  playerId?: string;
  captainId?: string;
  amount?: number;
  call?: number;
}

/** Turns one moment of the auction into what the announcer needs. The server and the screens use the same rules. */
export function momentCtx(src: MomentSource, ev: MomentEvent): AnnounceCtx {
  const player = src.players.find((p) => p.id === ev.playerId);
  const teamName = (id?: string) => src.captains.find((c) => c.id === id)?.team;
  const spentBy = (id: string) => src.players.reduce((n, p) => (p.status === 'sold' && p.teamId === id ? n + (p.price ?? 0) : n), 0);
  const bids = src.live.bids;
  const top = bids[bids.length - 1];
  const prev = bids[bids.length - 2];
  const base = player ? player.basePrice || src.settings.defaultBasePrice : undefined;
  const ctx: AnnounceCtx = { team: teamName(ev.captainId), player: player?.name, amount: ev.amount, call: ev.call, fmt: src.settings, variant: ev.seq, bids: bids.length, base };
  if (ev.type === 'reveal') ctx.amount = base ?? 0;
  if (ev.type === 'bid') {
    if (prev && prev.captainId !== ev.captainId) ctx.rival = teamName(prev.captainId);
    const cap = src.captains.find((c) => c.id === ev.captainId);
    if (cap?.budget && ev.amount) {
      const free = cap.budget - spentBy(cap.id);
      ctx.allIn = free > 0 && ev.amount >= free * 0.8 && (bids.length > 1 || ev.amount > (base ?? 0));
    }
  }
  if (ev.type === 'call' && top) {
    ctx.amount = top.amount;
    ctx.team = teamName(top.captainId);
  }
  if (ev.type === 'sold' && ev.captainId) {
    const cap = src.captains.find((c) => c.id === ev.captainId);
    if (cap?.budget !== undefined) ctx.left = Math.max(0, cap.budget - spentBy(cap.id));
    ctx.squad = src.players.filter((p) => p.status === 'sold' && p.teamId === ev.captainId).length;
    const others = src.players.filter((p) => p.status === 'sold' && p.id !== ev.playerId);
    ctx.record = others.length >= 2 && (ev.amount ?? 0) > Math.max(...others.map((p) => p.price ?? 0));
  }
  if (ev.type === 'break' || ev.type === 'breakext') ctx.seconds = ev.amount;
  if (ev.type === 'round') ctx.round = src.round;
  return ctx;
}

/** The fixed sample behind the "Hear it" button: a bidding war, so the excitement can be heard. */
export const SAMPLE_CTX: AnnounceCtx = { team: 'Thunder Hawks', rival: 'Royal Lions', player: 'Aarav Mehta', amount: 12_000_000, base: 2_000_000, bids: 5, fmt: { symbol: '₹', moneyStyle: 'indian' }, variant: 0 };

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

// ---- the classic announcer (word for word what the app always said) ----------------------------------

const pick = <T,>(list: T[], variant: number): T => list[Math.abs(variant) % list.length];

function classic(kind: SpeechKind, c: AnnounceCtx): SpeechLine | null {
  const m = (n: number) => spokenMoney(n, c.fmt);
  switch (kind) {
    default: return null; // classic speaks the bidding; breaks keep their own plain announcements
    case 'reveal': return c.player ? { text: `Up next, ${c.player}. Base price ${m(c.amount ?? 0)}.`, lang: 'en' } : null;
    case 'bid': return c.team && c.amount ? { text: `${c.team}, ${m(c.amount)}`, lang: 'en' } : null;
    case 'call': return { text: ['', 'Going once!', 'Going twice!', 'Going thrice! Last call!'][c.call ?? 1] ?? '', lang: 'en' };
    case 'sold': return c.player && c.team && c.amount ? { text: `Sold! ${c.player} goes to ${c.team} for ${m(c.amount)}`, lang: 'en' } : null;
    case 'unsold': return c.player ? { text: `${c.player} goes unsold`, lang: 'en' } : null;
  }
}

// ---- the hosts -------------------------------------------------------------------------------------

/** The words a line can use. Money and durations are already in the host's language and script. */
interface V {
  t: string; r: string; p: string;
  a: string; left: string; dur: string; round: string;
  /** how many players the team has now */
  n: string;
  /** "<amount>... " before a call, or nothing when there is no bid */
  ap: string;
}
/** A line: [Hindi script, the same in Latin letters]. English hosts use the same function for both. */
type Pair = [(v: V) => string, (v: V) => string];
const en = (f: (v: V) => string): Pair => [f, f];
const hi = (d: (v: V) => string, l: (v: V) => string): Pair => [d, l];

interface Host {
  lang: 'en' | 'hi';
  voice: { pitch: number; rate: number; gender: 'male' | 'female' };
  spin: Pair[];
  reveal: Pair[];
  /** by excitement: first bid, warming up, heated, bidding war */
  bid: Pair[][];
  /** extra lines for the same levels, used when another team was just outbid */
  rivalBid: Pair[][];
  call: [Pair, Pair, Pair];
  sold: Pair;
  soldHot: Pair;
  unsold: Pair[];
  undo: Pair[];
  brk: Pair[];
  brkext: Pair[];
  brkend: Pair[];
  round: Pair[];
  /** the host reacting to what is happening */
  record: Pair;
  steal: Pair;
  left: Pair;
  allIn: Pair;
  squad?: Pair;
}

const HOSTS: Record<Exclude<AnnouncerStyle, 'classic'>, Host> = {
  // ------------------------------------------------------------------ ring announcer
  wwe: {
    lang: 'en', voice: { pitch: 0.8, rate: 1.12, gender: 'male' },
    spin: [en(() => `Here we go! Spin that wheel! Who's next into the ring?!`), en(() => `Let's get ready to... SPIN!`)],
    reveal: [en((v) => `Ladies and gentlemen! Making their way to the ring... ${v.p}! Opening bid, ${v.a}!`), en((v) => `Get on your feet! Next up... ${v.p}! We start at ${v.a}!`)],
    bid: [
      [en((v) => `And we have our first bid! ${v.t}! ${v.a}!`), en((v) => `${v.t} gets us started! ${v.a}!`)],
      [en((v) => `${v.t}! ${v.a}!`), en((v) => `And ${v.t} raises the stakes... ${v.a}!`)],
      [en((v) => `Oh my! ${v.t} slams it down! ${v.a}! Can anybody top that?!`), en((v) => `This is getting heated! ${v.t}... ${v.a}!`)],
      [en((v) => `OH MY! ${v.t}! ${v.a}! This place is about to EXPLODE!`), en((v) => `Unbelievable! ${v.t} with ${v.a}! We have an all-out WAR for ${v.p}!`), en((v) => `${v.t}! ${v.a}! Somebody stop this match!`)],
    ],
    rivalBid: [[], [en((v) => `${v.t} answers ${v.r}! ${v.a}!`)], [en((v) => `${v.r} is not happy! ${v.t} takes it to ${v.a}!`)], [en((v) => `${v.t} hits ${v.r} with ${v.a}! OH, THE HUMANITY!`)]],
    call: [en((v) => `${v.ap}Going once! Do I hear more?!`), en((v) => `${v.ap}Going twice! This is it!`), en((v) => `Last chance! ${v.ap}Going three times!`)],
    sold: en((v) => `${v.p}... is SOLD to ${v.t}, for ${v.a}! And the crowd goes WILD!`),
    soldHot: en((v) => `IT'S OVER! ${v.p}... is SOLD to ${v.t}, for ${v.a}! What a battle! And the crowd goes WILD!`),
    unsold: [en((v) => `Nobody wants ${v.p}?! Back to the locker room!`)],
    undo: [en(() => `Wait a minute! Wait a minute! That bid has been taken back!`), en(() => `Hold on! The referee says... that bid does not count!`)],
    brk: [en((v) => `Time out! The teams head to the back for ${v.dur}! Plan your attack!`)],
    brkext: [en((v) => `We need more time! Another ${v.dur}!`)],
    brkend: [en(() => `Break's over! Get back in that ring!`)],
    round: [en((v) => `Ladies and gentlemen... ROUND ${v.round}! Let's get it on!`)],
    record: en(() => `That is the BIGGEST buy of the night!`),
    steal: en(() => `What a STEAL!`),
    left: en((v) => `${v.t} has ${v.left} left in the tank!`),
    allIn: en((v) => `${v.t} is going ALL IN!`),
  },
  // ------------------------------------------------------------------ quiz-show host (Hindi)
  kbc: {
    lang: 'hi', voice: { pitch: 0.6, rate: 0.82, gender: 'male' },
    spin: [hi(() => `तो देवियों और सज्जनों... घूम रहा है पहिया... देखते हैं, किसकी क़िस्मत चमकती है!`, () => `To deviyon aur sajjano... ghoom raha hai pahiya... dekhte hain, kiski kismat chamakti hai!`)],
    reveal: [
      hi((v) => `देवियों और सज्जनों... अब मंच पर आ रहे हैं... ${v.p}! शुरुआती बोली... ${v.a}. तो चलिए... शुरू करते हैं!`, (v) => `Deviyon aur sajjano... ab manch par aa rahe hain... ${v.p}! Shuruaati boli... ${v.a}. To chaliye... shuru karte hain!`),
      hi((v) => `और अब... जिनका सबको इंतज़ार था... ${v.p}! बोली शुरू होती है... ${v.a} से!`, (v) => `Aur ab... jinka sabko intezaar tha... ${v.p}! Boli shuru hoti hai... ${v.a} se!`),
    ],
    bid: [
      [hi((v) => `और पहली बोली आई है... ${v.t} की तरफ़ से... ${v.a}!`, (v) => `Aur pehli boli aayi hai... ${v.t} ki taraf se... ${v.a}!`), hi((v) => `${v.t} ने खाता खोला है... ${v.a}!`, (v) => `${v.t} ne khaata khola hai... ${v.a}!`)],
      [hi((v) => `अरे वाह! ${v.t}... ${v.a}!`, (v) => `Arre waah! ${v.t}... ${v.a}!`), hi((v) => `बोली बढ़कर हुई... ${v.a}! ${v.t} के नाम!`, (v) => `Boli badhkar hui... ${v.a}! ${v.t} ke naam!`)],
      [hi((v) => `क्या बात है! मुक़ाबला कड़ा हो गया है! ${v.t}... ${v.a}!`, (v) => `Kya baat hai! Muqaabla kada ho gaya hai! ${v.t}... ${v.a}!`), hi((v) => `देखिए, देखिए! ${v.t} ने बोली पहुँचा दी... ${v.a} पर!`, (v) => `Dekhiye, dekhiye! ${v.t} ne boli pahuncha di... ${v.a} par!`)],
      [
        hi((v) => `अविश्वसनीय! अद्भुत! ${v.t}... ${v.a}! यह बोली अब रुकने वाली नहीं!`, (v) => `Avishvasneeya! Adbhut! ${v.t}... ${v.a}! Yeh boli ab rukne waali nahin!`),
        hi((v) => `दिल थाम के बैठिए, देवियों और सज्जनों! ${v.t}... ${v.a}!`, (v) => `Dil thaam ke baithiye, deviyon aur sajjano! ${v.t}... ${v.a}!`),
        hi((v) => `${v.p} के लिए जंग छिड़ गई है! ${v.t}... ${v.a}!`, (v) => `${v.p} ke liye jung chhid gayi hai! ${v.t}... ${v.a}!`),
      ],
    ],
    rivalBid: [[], [hi((v) => `${v.t} ने ${v.r} को पीछे छोड़ा... ${v.a}!`, (v) => `${v.t} ne ${v.r} ko peeche chhoda... ${v.a}!`)], [hi((v) => `${v.r} अब क्या करेंगे? ${v.t} ने बोली लगाई... ${v.a}!`, (v) => `${v.r} ab kya karenge? ${v.t} ne boli lagaayi... ${v.a}!`)], [hi((v) => `${v.r} और ${v.t} आमने-सामने! ${v.t}... ${v.a}!`, (v) => `${v.r} aur ${v.t} aamne-saamne! ${v.t}... ${v.a}!`)]],
    call: [hi((v) => `${v.ap}एक बार!`, (v) => `${v.ap}ek baar!`), hi((v) => `${v.ap}दो बार! कोई है... जो आगे बढ़े?`, (v) => `${v.ap}do baar! Koi hai... jo aage badhe?`), hi((v) => `${v.ap}तीसरी बार... यह आख़िरी मौक़ा है!`, (v) => `${v.ap}teesri baar... yeh aakhiri mauka hai!`)],
    sold: hi((v) => `सौदा पक्का! ${v.p} अब ${v.t} की टीम में हैं... ${v.a} में! बधाई हो!`, (v) => `Sauda pakka! ${v.p} ab ${v.t} ki team mein hain... ${v.a} mein! Badhaai ho!`),
    soldHot: hi((v) => `और... सौदा पक्का! क्या ज़बरदस्त मुक़ाबला था! ${v.p}... ${v.a} में... ${v.t} के नाम! बहुत-बहुत बधाई!`, (v) => `Aur... sauda pakka! Kya zabardast muqaabla tha! ${v.p}... ${v.a} mein... ${v.t} ke naam! Bahut bahut badhaai!`),
    unsold: [hi((v) => `अफ़सोस... ${v.p} के लिए आज कोई बोली नहीं लगी.`, (v) => `Afsos... ${v.p} ke liye aaj koi boli nahin lagi.`)],
    undo: [hi(() => `रुकिए, रुकिए... यह बोली वापस ले ली गई है.`, () => `Rukiye, rukiye... yeh boli wapas le li gayi hai.`)],
    brk: [hi((v) => `देवियों और सज्जनों... अब एक छोटा सा ब्रेक... ${v.dur} का. कप्तान अपनी रणनीति बनाइए... मिलते हैं ब्रेक के बाद!`, (v) => `Deviyon aur sajjano... ab ek chhota sa break... ${v.dur} ka. Captain apni ranneeti banaiye... milte hain break ke baad!`)],
    brkext: [hi((v) => `ब्रेक थोड़ा और... ${v.dur} और!`, (v) => `Break thoda aur... ${v.dur} aur!`)],
    brkend: [hi(() => `स्वागत है आपका वापस! तो चलिए... खेल फिर शुरू करते हैं!`, () => `Swaagat hai aapka wapas! To chaliye... khel phir shuru karte hain!`)],
    round: [hi((v) => `देवियों और सज्जनों... शुरू होता है... राउंड ${v.round}! नई उम्मीदें... नए मौक़े!`, (v) => `Deviyon aur sajjano... shuru hota hai... round ${v.round}! Nayi ummeedein... naye mauke!`)],
    record: hi(() => `और यह है आज की सबसे बड़ी बोली!`, () => `Aur yeh hai aaj ki sabse badi boli!`),
    steal: hi(() => `क्या सस्ता सौदा है!`, () => `Kya sasta sauda hai!`),
    left: hi((v) => `${v.t} के पास अब बचे हैं... ${v.left}.`, (v) => `${v.t} ke paas ab bache hain... ${v.left}.`),
    allIn: hi((v) => `${v.t} ने सब कुछ दाँव पर लगा दिया है!`, (v) => `${v.t} ne sab kuchh daanv par laga diya hai!`),
  },
  // ------------------------------------------------------------------ arena narrator
  mk: {
    lang: 'en', voice: { pitch: 0.25, rate: 0.78, gender: 'male' },
    spin: [en(() => `Choose your destiny...`), en(() => `The wheel turns... fate decides.`)],
    reveal: [en((v) => `${v.p}... enters the arena. Opening bid... ${v.a}.`), en((v) => `A new challenger approaches... ${v.p}! The bidding begins at ${v.a}.`)],
    bid: [
      [en((v) => `${v.t}... ${v.a}.`), en((v) => `${v.t} makes the first move... ${v.a}.`)],
      [en((v) => `${v.t} strikes... ${v.a}!`), en((v) => `${v.t}! ${v.a}!`)],
      [en((v) => `Brutal! ${v.t}... ${v.a}!`), en((v) => `${v.t}! ${v.a}! No mercy!`)],
      [en((v) => `${v.t} unleashes ${v.a}! The arena trembles!`), en((v) => `Outstanding! ${v.t}... ${v.a}! Who dares to fight back?!`), en((v) => `Fight! ${v.t}! ${v.a}! This battle is legendary!`)],
    ],
    rivalBid: [[], [en((v) => `${v.t} counters ${v.r}! ${v.a}!`)], [en((v) => `${v.r} is wounded! ${v.t}... ${v.a}!`)], [en((v) => `${v.t} versus ${v.r}! ${v.a}! Only one will survive!`)]],
    call: [en(() => `Prepare yourselves...`), en(() => `Last warning!`), en(() => `Finish him!`)],
    sold: en((v) => `${v.t} wins! ${v.p} is theirs... for ${v.a}! Flawless victory!`),
    soldHot: en((v) => `Fatality! ${v.t} claims ${v.p}... for ${v.a}! Flawless victory!`),
    unsold: [en((v) => `Nobody dares. ${v.p} remains unclaimed.`)],
    undo: [en(() => `The bid... is undone.`)],
    brk: [en((v) => `Warriors... rest. ${v.dur}. Prepare your strategy.`)],
    brkext: [en((v) => `The rest is extended... ${v.dur}.`)],
    brkend: [en(() => `The tournament resumes. Fight!`)],
    round: [en((v) => `Round ${v.round}... FIGHT!`)],
    record: en(() => `A new champion of the night!`),
    steal: en(() => `Taken... without a fight.`),
    left: en((v) => `${v.t}... ${v.left} remains.`),
    allIn: en((v) => `${v.t} risks everything!`),
  },
  // ------------------------------------------------------------------ game-show host
  show: {
    lang: 'en', voice: { pitch: 1.1, rate: 1.1, gender: 'female' },
    spin: [en(() => `Spin it to win it! Round and round it goes... where it stops, nobody knows!`), en(() => `Ooh, here comes the wheel! Fingers crossed, everybody!`)],
    reveal: [en((v) => `Welcome back, everybody! Our next contestant is... ${v.p}! The bidding opens at ${v.a}! Let's play!`), en((v) => `Ooh, here's a good one! Give it up for... ${v.p}! Starting at ${v.a}!`)],
    bid: [
      [en((v) => `And ${v.t} buzzes in first! ${v.a}!`), en((v) => `${v.t} is on the board with ${v.a}!`)],
      [en((v) => `${v.t}! ${v.a}! Ooh, I like it!`), en((v) => `Ding ding ding! ${v.t}, ${v.a}!`)],
      [en((v) => `Oh, this is getting good! ${v.t}... ${v.a}! The board is lighting up!`), en((v) => `Ooh! ${v.t} goes big! ${v.a}! Who's next?!`)],
      [en((v) => `Oh my goodness! ${v.t}! ${v.a}! This is the round of the night!`), en((v) => `Are you kidding me?! ${v.t} with ${v.a}! Somebody get these teams some water!`), en((v) => `${v.t}! ${v.a}! I have never seen anything like it!`)],
    ],
    rivalBid: [[], [en((v) => `${v.t} steals it from ${v.r}! ${v.a}!`)], [en((v) => `${v.r}, are you going to take that?! ${v.t}, ${v.a}!`)], [en((v) => `${v.t} and ${v.r} just won't stop! ${v.a}!`)]],
    call: [en((v) => `${v.ap}Going once... the clock is ticking!`), en((v) => `${v.ap}Going twice! Is that your final answer, everybody?`), en((v) => `${v.ap}Going three times... last chance, last chance!`)],
    sold: en((v) => `Sold! ${v.p} is going home with ${v.t}, for ${v.a}! Congratulations!`),
    soldHot: en((v) => `And THAT is the winning bid! ${v.p} goes to ${v.t} for ${v.a}! What a game! Give it up, everybody!`),
    unsold: [en((v) => `Aww! No takers for ${v.p}... maybe next round!`)],
    undo: [en(() => `Oops! The judges have taken that bid back!`)],
    brk: [en((v) => `We'll be right back after this short break! ${v.dur}, everybody. Teams, huddle up!`)],
    brkext: [en((v) => `Ooh, we're adding ${v.dur} to the clock!`)],
    brkend: [en(() => `And we're back! Let's play!`)],
    round: [en((v) => `Welcome to round ${v.round}! New players, new money, new chances to win!`)],
    record: en(() => `That's the highest score of the night!`),
    steal: en(() => `What a bargain!`),
    left: en((v) => `${v.t} has ${v.left} left to play with!`),
    allIn: en((v) => `${v.t} is betting it all!`),
    squad: en((v) => `That's player number ${v.n} for ${v.t}!`),
  },
  // ------------------------------------------------------------------ smooth late-night voice
  velvet: {
    lang: 'en', voice: { pitch: 0.95, rate: 0.88, gender: 'female' },
    spin: [en(() => `Mmm... let's see who the wheel picks for us tonight.`), en(() => `Round and round... who's next?`)],
    reveal: [en((v) => `Mmm... up next... ${v.p}. Starting at ${v.a}. Take your time... or don't.`), en((v) => `Well, hello... ${v.p}. The bidding opens at... ${v.a}.`)],
    bid: [
      [en((v) => `${v.t}... ${v.a}. Bold move.`), en((v) => `Oh... ${v.t}. ${v.a}. I noticed.`)],
      [en((v) => `${v.t}... ${v.a}. Now we're talking.`), en((v) => `Mmm... ${v.t}... ${v.a}.`)],
      [en((v) => `Oh, ${v.t}... ${v.a}. Somebody's feeling confident tonight.`), en((v) => `${v.t}... ${v.a}. It's getting warm in here.`)],
      [en((v) => `Ooh... ${v.t}. ${v.a}. Now that... is irresistible.`), en((v) => `${v.t}... ${v.a}. You really know how to make an entrance.`), en((v) => `${v.a}... from ${v.t}. I could listen to this all night.`)],
    ],
    rivalBid: [[], [en((v) => `${v.t} takes it from ${v.r}... ${v.a}. Smooth.`)], [en((v) => `${v.r}... are you going to let ${v.t} have this? ${v.a}.`)], [en((v) => `${v.t} and ${v.r}... this is getting interesting. ${v.a}.`)]],
    call: [en((v) => `${v.ap}Once.`), en(() => `Twice... don't keep me waiting.`), en(() => `Three times... last chance, darling.`)],
    sold: en((v) => `Sold... ${v.p}, to ${v.t}, for ${v.a}. Enjoy.`),
    soldHot: en((v) => `And... it's yours, ${v.t}. ${v.p}... for ${v.a}. Worth every bit.`),
    unsold: [en((v) => `Hmm... no one for ${v.p}? Their loss.`)],
    undo: [en(() => `Changed your mind? That bid is... taken back.`)],
    brk: [en((v) => `Let's take a little break... ${v.dur}. Relax. Plan something... clever.`)],
    brkext: [en((v) => `A little longer... ${v.dur} more.`)],
    brkend: [en(() => `Welcome back... where were we?`)],
    round: [en((v) => `Round ${v.round}... the night is still young.`)],
    record: en(() => `The most expensive one tonight... I'm impressed.`),
    steal: en(() => `A steal... lucky you.`),
    left: en((v) => `${v.t}... you have ${v.left} left. Spend it wisely.`),
    allIn: en((v) => `${v.t}... putting everything on the table. I like that.`),
  },
  // ------------------------------------------------------------------ movie-trailer narrator
  trailer: {
    lang: 'en', voice: { pitch: 0.4, rate: 0.8, gender: 'male' },
    spin: [en(() => `In a world... where fate spins the wheel...`), en(() => `One wheel... one spin... one destiny.`)],
    reveal: [en((v) => `In a world... where every team needs a hero... one player... ${v.p}. Opening bid... ${v.a}.`), en((v) => `This season... one name... ${v.p}. The bidding begins... at ${v.a}.`)],
    bid: [
      [en((v) => `${v.t}... makes their move. ${v.a}.`), en((v) => `One team... dared to bid first. ${v.t}... ${v.a}.`)],
      [en((v) => `${v.t}... ${v.a}.`), en((v) => `${v.t} raises the stakes... ${v.a}.`)],
      [en((v) => `The battle... intensifies. ${v.t}... ${v.a}!`), en((v) => `No one... saw this coming. ${v.t}... ${v.a}!`)],
      [en((v) => `This summer... the bidding war... of the century! ${v.t}... ${v.a}!`), en((v) => `Only one team... will survive. ${v.t}... ${v.a}!`), en((v) => `Legends... are made tonight. ${v.t}... ${v.a}!`)],
    ],
    rivalBid: [[], [en((v) => `${v.r} thought it was over... but ${v.t}... ${v.a}.`)], [en((v) => `${v.r}... versus ${v.t}... ${v.a}!`)], [en((v) => `Two teams. One player. ${v.t}... ${v.a}!`)]],
    call: [en((v) => `${v.ap}Going once.`), en(() => `Going twice... time is running out.`), en(() => `Going three times... this is... the final chapter.`)],
    sold: en((v) => `${v.p}... joins ${v.t}... for ${v.a}. The story... begins.`),
    soldHot: en((v) => `${v.t}... ${v.p}... ${v.a}. The legend... begins. Coming soon... to a squad near you.`),
    unsold: [en((v) => `${v.p}... will return. In the next round.`)],
    undo: [en(() => `But wait... the bid... was never meant to be.`)],
    brk: [en((v) => `Intermission. ${v.dur}. The teams... prepare.`)],
    brkext: [en((v) => `The intermission... continues. ${v.dur} more.`)],
    brkend: [en(() => `And now... the story continues.`)],
    round: [en((v) => `Part ${v.round}. The battle... returns.`)],
    record: en(() => `The biggest deal... of the night.`),
    steal: en(() => `A steal... nobody saw coming.`),
    left: en((v) => `${v.t}... ${v.left} remains.`),
    allIn: en((v) => `${v.t}... risks... everything.`),
  },
  // ------------------------------------------------------------------ cricket commentary (Hindi)
  cricket: {
    lang: 'hi', voice: { pitch: 0.9, rate: 1.08, gender: 'male' },
    spin: [hi(() => `टॉस हो रहा है... देखते हैं अगला खिलाड़ी कौन होगा!`, () => `Toss ho raha hai... dekhte hain agla khiladi kaun hoga!`)],
    reveal: [
      hi((v) => `और अब क्रीज़ पर आ रहे हैं... ${v.p}! बेस प्राइस... ${v.a}!`, (v) => `Aur ab crease par aa rahe hain... ${v.p}! Base price... ${v.a}!`),
      hi((v) => `नया खिलाड़ी, नई उम्मीदें... ${v.p}! बोली शुरू... ${v.a} से!`, (v) => `Naya khiladi, nayi ummeedein... ${v.p}! Boli shuru... ${v.a} se!`),
    ],
    bid: [
      [hi((v) => `${v.t} ने खाता खोला... ${v.a}! अच्छी शुरुआत!`, (v) => `${v.t} ne khaata khola... ${v.a}! Achhi shuruaat!`), hi((v) => `पहली गेंद, पहला रन! ${v.t}... ${v.a}!`, (v) => `Pehli gend, pehla run! ${v.t}... ${v.a}!`)],
      [hi((v) => `${v.t} ने मारा चौका! ${v.a}!`, (v) => `${v.t} ne maara chauka! ${v.a}!`), hi((v) => `बढ़िया शॉट! ${v.t}... ${v.a}!`, (v) => `Badhiya shot! ${v.t}... ${v.a}!`)],
      [hi((v) => `यह गया... छक्का! ${v.t}... ${v.a}!`, (v) => `Yeh gaya... chhakka! ${v.t}... ${v.a}!`), hi((v) => `क्या शॉट है! स्टेडियम में शोर! ${v.t}... ${v.a}!`, (v) => `Kya shot hai! Stadium mein shor! ${v.t}... ${v.a}!`)],
      [
        hi((v) => `अविश्वसनीय! लगातार छक्के! ${v.t}... ${v.a}! यह मैच नहीं, जंग है!`, (v) => `Avishvasneeya! Lagaataar chhakke! ${v.t}... ${v.a}! Yeh match nahin, jung hai!`),
        hi((v) => `गेंद स्टेडियम के बाहर! ${v.t}... ${v.a}!`, (v) => `Gend stadium ke bahar! ${v.t}... ${v.a}!`),
        hi((v) => `सुपर ओवर जैसा रोमांच! ${v.t}... ${v.a}!`, (v) => `Super over jaisa romaanch! ${v.t}... ${v.a}!`),
      ],
    ],
    rivalBid: [[], [hi((v) => `${v.t} ने ${v.r} की गेंद सीधे बाउंड्री के पार भेजी! ${v.a}!`, (v) => `${v.t} ne ${v.r} ki gend seedhe boundary ke paar bheji! ${v.a}!`)], [hi((v) => `${v.r} दबाव में! ${v.t}... ${v.a}!`, (v) => `${v.r} dabaav mein! ${v.t}... ${v.a}!`)], [hi((v) => `${v.t} बनाम ${v.r}... आख़िरी ओवर का रोमांच! ${v.a}!`, (v) => `${v.t} banaam ${v.r}... aakhiri over ka romaanch! ${v.a}!`)]],
    call: [hi((v) => `${v.ap}एक बार!`, (v) => `${v.ap}ek baar!`), hi((v) => `${v.ap}दो बार! आख़िरी ओवर चल रहा है!`, (v) => `${v.ap}do baar! Aakhiri over chal raha hai!`), hi((v) => `${v.ap}तीसरी बार... आख़िरी गेंद!`, (v) => `${v.ap}teesri baar... aakhiri gend!`)],
    sold: hi((v) => `सौदा पक्का! ${v.p}... ${v.t} की टीम में... ${v.a} में!`, (v) => `Sauda pakka! ${v.p}... ${v.t} ki team mein... ${v.a} mein!`),
    soldHot: hi((v) => `और यह... मैच ख़त्म! ${v.t} ने जीत लिया मुक़ाबला! ${v.p}... ${v.a} में! क्या मैच था!`, (v) => `Aur yeh... match khatam! ${v.t} ne jeet liya muqaabla! ${v.p}... ${v.a} mein! Kya match tha!`),
    unsold: [hi((v) => `ओह! ${v.p} के लिए कोई बोली नहीं... वापस पवेलियन.`, (v) => `Oh! ${v.p} ke liye koi boli nahin... wapas pavilion.`)],
    undo: [hi(() => `थर्ड अंपायर का फ़ैसला... यह बोली वापस!`, () => `Third umpire ka faisla... yeh boli wapas!`)],
    brk: [hi((v) => `ड्रिंक्स ब्रेक! ${v.dur}. कप्तान, अपनी फ़ील्डिंग सेट कीजिए!`, (v) => `Drinks break! ${v.dur}. Captain, apni fielding set kijiye!`)],
    brkext: [hi((v) => `ब्रेक बढ़ा... ${v.dur} और!`, (v) => `Break badha... ${v.dur} aur!`)],
    brkend: [hi(() => `खेल फिर शुरू! खिलाड़ी मैदान पर लौट आए हैं!`, () => `Khel phir shuru! Khiladi maidaan par laut aaye hain!`)],
    round: [hi((v) => `दूसरी पारी... माफ़ कीजिए, राउंड ${v.round} शुरू!`, (v) => `Doosri paari... maaf kijiye, round ${v.round} shuru!`)],
    record: hi(() => `आज की सबसे महँगी ख़रीद!`, () => `Aaj ki sabse mehngi khareed!`),
    steal: hi(() => `बिल्कुल सस्ते में! क्या चोरी है!`, () => `Bilkul saste mein! Kya chori hai!`),
    left: hi((v) => `${v.t} के पर्स में बचे... ${v.left}.`, (v) => `${v.t} ke purse mein bache... ${v.left}.`),
    allIn: hi((v) => `${v.t} ने पूरा पर्स झोंक दिया!`, (v) => `${v.t} ne poora purse jhonk diya!`),
  },
  // ------------------------------------------------------------------ friendly smart assistant
  assistant: {
    lang: 'en', voice: { pitch: 1, rate: 1.02, gender: 'female' },
    spin: [en(() => `Spinning the wheel now.`)],
    reveal: [en((v) => `Next up: ${v.p}. Base price, ${v.a}.`)],
    bid: [
      [en((v) => `First bid: ${v.t}, ${v.a}.`)],
      [en((v) => `New bid from ${v.t}: ${v.a}.`), en((v) => `${v.t} bids ${v.a}.`)],
      [en((v) => `${v.t} raises to ${v.a}. The bidding is picking up.`), en((v) => `${v.t}, ${v.a}. That's a big jump.`)],
      [en((v) => `${v.t}, ${v.a}! This is a real bidding war.`), en((v) => `Wow. ${v.t} bids ${v.a}. That's well above the base price.`)],
    ],
    rivalBid: [[], [en((v) => `${v.t} outbids ${v.r}: ${v.a}.`)], [en((v) => `${v.t} outbids ${v.r} again: ${v.a}.`)], [en((v) => `${v.t} and ${v.r} keep going. ${v.t}, ${v.a}!`)]],
    call: [en((v) => `${v.ap}Going once.`), en((v) => `${v.ap}Going twice.`), en((v) => `Final call: ${v.ap}going three times.`)],
    sold: en((v) => `Sold. ${v.p} joins ${v.t} for ${v.a}.`),
    soldHot: en((v) => `Sold! ${v.p} joins ${v.t} for ${v.a}. What a contest!`),
    unsold: [en((v) => `${v.p} is unsold. They may come back in the next round.`)],
    undo: [en(() => `The last bid has been taken back.`)],
    brk: [en((v) => `Starting a ${v.dur} strategy break. Captains, check your plans.`)],
    brkext: [en((v) => `The break has been extended by ${v.dur}.`)],
    brkend: [en(() => `The break is over. Let's continue.`)],
    round: [en((v) => `Round ${v.round} is starting. Purses have been updated.`)],
    record: en(() => `That's the highest price so far.`),
    steal: en(() => `That's a great deal at the base price.`),
    left: en((v) => `${v.t} now has ${v.left} left.`),
    allIn: en((v) => `Heads up: that's almost all of ${v.t}'s purse.`),
    squad: en((v) => `That's player number ${v.n} for ${v.t}.`),
  },
};

// ---- durations and small numbers, spoken -----------------------------------------------------------

function durationWords(sec: number, script: 'en' | 'deva' | 'latin'): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60), r = s % 60;
  if (script === 'en') {
    const mm = m ? `${m} minute${m === 1 ? '' : 's'}` : '';
    const ss = r ? `${r} second${r === 1 ? '' : 's'}` : '';
    return [mm, ss].filter(Boolean).join(' ') || '0 seconds';
  }
  const w = (n: number) => (n < 100 ? words(n, script) : String(n));
  const mm = m ? `${w(m)} ${script === 'deva' ? 'मिनट' : 'minute'}` : '';
  const ss = r ? `${w(r)} ${script === 'deva' ? 'सेकंड' : 'second'}` : '';
  return [mm, ss].filter(Boolean).join(' ') || w(0);
}

/** Excitement, record, bargain, all in, what is left: the host reacting to the moment. */
function reactions(h: Host, kind: SpeechKind, c: AnnounceCtx): Pair[] {
  const out: Pair[] = [];
  if (kind === 'bid' && c.allIn) out.push(h.allIn);
  if (kind === 'sold') {
    if (c.record) out.push(h.record);
    else if ((c.bids ?? 0) <= 1 && c.base && c.amount && c.amount <= c.base) out.push(h.steal);
    if (h.squad && c.squad && c.squad > 1) out.push(h.squad);
    if (c.left !== undefined && c.team) out.push(h.left);
  }
  return out;
}

function hosted(style: Exclude<AnnouncerStyle, 'classic'>, kind: SpeechKind, c: AnnounceCtx): SpeechLine | null {
  const h = HOSTS[style];
  const heat = heatOf(c);
  const money = (n: number | undefined, s: 'deva' | 'latin') => (h.lang === 'hi' ? hindiMoney(n ?? 0, c.fmt, s) : spokenMoney(n ?? 0, c.fmt));
  const vars = (s: 'deva' | 'latin'): V => {
    const script = h.lang === 'hi' ? s : 'en';
    const a = money(c.amount, s);
    return {
      t: c.team ?? '', r: c.rival ?? '', p: c.player ?? '',
      a, ap: c.amount ? `${a}... ` : '',
      left: money(c.left, s),
      dur: durationWords(c.seconds ?? 60, script),
      round: String(c.round ?? 2),
      n: String(c.squad ?? ''),
    };
  };
  let line: Pair | undefined;
  switch (kind) {
    case 'spin': line = pick(h.spin, c.variant); break;
    case 'reveal': if (c.player) line = pick(h.reveal, c.variant); break;
    case 'bid':
      if (c.team && c.amount) {
        const level = Math.min(heat, h.bid.length - 1);
        line = pick([...h.bid[level], ...(c.rival ? h.rivalBid[level] ?? [] : [])], c.variant);
      }
      break;
    case 'call': line = h.call[Math.min(2, Math.max(0, (c.call ?? 1) - 1))]; break;
    case 'sold': if (c.player && c.team && c.amount) line = heat >= 2 ? h.soldHot : h.sold; break;
    case 'unsold': if (c.player) line = pick(h.unsold, c.variant); break;
    case 'undo': line = pick(h.undo, c.variant); break;
    case 'break': line = pick(h.brk, c.variant); break;
    case 'breakext': line = pick(h.brkext, c.variant); break;
    case 'breakend': line = pick(h.brkend, c.variant); break;
    case 'round': line = pick(h.round, c.variant); break;
  }
  if (!line) return null;
  const parts = [line, ...reactions(h, kind, c)];
  const vd = vars('deva'), vl = vars('latin');
  const text = parts.map((p) => p[0](vd)).join(' ');
  const alt = h.lang === 'hi' ? parts.map((p) => p[1](vl)).join(' ') : undefined;
  return { text, ...(alt ? { alt } : {}), lang: h.lang, ...h.voice };
}

export function announce(style: AnnouncerStyle, kind: SpeechKind, ctx: AnnounceCtx): SpeechLine | null {
  const line = style === 'classic' ? classic(kind, ctx) : hosted(style, kind, ctx);
  return line && line.text ? line : null;
}

/** Whether the style has a host line for every part of the auction (classic only speaks the bidding itself). */
export const hostsEverything = (style: AnnouncerStyle) => style !== 'classic';
