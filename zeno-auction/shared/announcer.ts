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
  /** the organiser's own words for the last call ("going thrice") */
  lastCall?: string;
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
  settings: MoneyFmt & { defaultBasePrice: number; lastCall?: string };
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
  if (ev.type === 'call' && ev.call === 3 && src.settings.lastCall) ctx.lastCall = src.settings.lastCall;
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

/** Hindi number words 0–99, in Devanagari and in Latin letters (index = the number). */
export const HINDI_NUMBERS: readonly string[] = HI;
export const HINDI_NUMBERS_LATIN: readonly string[] = HI_LATIN;

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
    case 'call': return { text: c.call === 3 && c.lastCall ? `Going thrice! ${c.lastCall}` : ['', 'Going once!', 'Going twice!', 'Going thrice! Last call!'][c.call ?? 1] ?? '', lang: 'en' };
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
  /** going once / twice / three times: a few ways of saying each */
  call: [Pair[], Pair[], Pair[]];
  sold: Pair[];
  soldHot: Pair[];
  unsold: Pair[];
  undo: Pair[];
  brk: Pair[];
  brkext: Pair[];
  brkend: Pair[];
  round: Pair[];
  /** the host reacting to what is happening */
  record: Pair[];
  steal: Pair[];
  left: Pair[];
  allIn: Pair[];
  squad?: Pair[];
}

const HOSTS: Record<Exclude<AnnouncerStyle, 'classic'>, Host> = {
  // ------------------------------------------------------------------ ring announcer: deep, booming, larger than life
  wwe: {
    lang: 'en', voice: { pitch: 0.7, rate: 1, gender: 'male' },
    spin: [
      en(() => `Here we go! Spin that wheel! Who's next into the ring?!`),
      en(() => `Ladies and gentlemen... it is time... to SPIN!`),
      en(() => `The wheel is turning! Somebody's name is about to be called!`),
      en(() => `Round and round! Who will step into the ring next?!`),
    ],
    reveal: [
      en((v) => `Ladies and gentlemen! Making their way to the ring... ${v.p}! Opening bid, ${v.a}!`),
      en((v) => `Get on your feet! Next up... ${v.p}! We start at ${v.a}!`),
      en((v) => `In this corner... weighing in at ${v.a}... ${v.p}!`),
      en((v) => `Put your hands together for... ${v.p}! The bidding opens at ${v.a}!`),
      en((v) => `Here comes ${v.p}! And this crowd is ready! Opening bid... ${v.a}!`),
    ],
    bid: [
      [
        en((v) => `And we have our first bid! ${v.t}! ${v.a}!`),
        en((v) => `${v.t} gets us started! ${v.a}!`),
        en((v) => `${v.t} steps into the ring first! ${v.a}!`),
        en((v) => `First blood to ${v.t}! ${v.a}!`),
        en((v) => `${v.t} throws the first punch! ${v.a}!`),
      ],
      [
        en((v) => `${v.t}! ${v.a}!`),
        en((v) => `And ${v.t} raises the stakes... ${v.a}!`),
        en((v) => `${v.t} fires back! ${v.a}!`),
        en((v) => `Here comes ${v.t}! ${v.a}!`),
        en((v) => `${v.t} wants this one! ${v.a}!`),
        en((v) => `Look out! ${v.t} with ${v.a}!`),
      ],
      [
        en((v) => `Oh my! ${v.t} slams it down! ${v.a}! Can anybody top that?!`),
        en((v) => `This is getting heated! ${v.t}... ${v.a}!`),
        en((v) => `${v.t} is not backing down! ${v.a}!`),
        en((v) => `Good heavens! ${v.t} with ${v.a}!`),
        en((v) => `The crowd is on its feet! ${v.t}, ${v.a}!`),
        en((v) => `${v.t} goes to the top rope! ${v.a}!`),
      ],
      [
        en((v) => `OH MY! ${v.t}! ${v.a}! This place is about to EXPLODE!`),
        en((v) => `Unbelievable! ${v.t} with ${v.a}! We have an all-out WAR!`),
        en((v) => `${v.t}! ${v.a}! Somebody stop this match!`),
        en((v) => `Are you kidding me?! ${v.t} with ${v.a}! This is a main event!`),
        en((v) => `${v.t}! ${v.a}! I have never seen anything like this in my life!`),
        en((v) => `The roof is coming off! ${v.t}, ${v.a}!`),
      ],
    ],
    rivalBid: [
      [],
      [en((v) => `${v.t} answers ${v.r}! ${v.a}!`), en((v) => `${v.r} had it... but ${v.t} takes it back! ${v.a}!`)],
      [en((v) => `${v.r} is not happy! ${v.t} takes it to ${v.a}!`), en((v) => `${v.t} and ${v.r}, toe to toe! ${v.a}!`)],
      [en((v) => `${v.t} hits ${v.r} with ${v.a}! What a counter!`), en((v) => `${v.r}, you got anything left?! ${v.t} says ${v.a}!`)],
    ],
    call: [
      [en((v) => `${v.ap}Going once! Do I hear more?!`), en((v) => `${v.ap}Going once! Anybody?!`), en((v) => `Going once at ${v.a}! Who wants it?!`)],
      [en((v) => `${v.ap}Going twice! This is it!`), en((v) => `Going twice! Last chance to get in this ring!`), en((v) => `${v.ap}Going twice! Speak now!`)],
      [en((v) => `Last chance! ${v.ap}Going three times!`), en((v) => `Going three times! The referee is counting!`), en((v) => `${v.ap}Going three times! One... two...`)],
    ],
    sold: [
      en((v) => `${v.p}... is SOLD to ${v.t}, for ${v.a}! And the crowd goes WILD!`),
      en((v) => `Ding ding ding! ${v.p} belongs to ${v.t}! ${v.a}!`),
      en((v) => `It's official! ${v.t} gets ${v.p} for ${v.a}!`),
      en((v) => `Your winner... ${v.t}! ${v.p} for ${v.a}!`),
    ],
    soldHot: [
      en((v) => `IT'S OVER! ${v.p}... is SOLD to ${v.t}, for ${v.a}! What a battle! And the crowd goes WILD!`),
      en((v) => `After an absolute war... ${v.t} takes ${v.p}! ${v.a}! Unbelievable!`),
      en((v) => `What a main event! ${v.p} goes to ${v.t}, for ${v.a}! Give it up!`),
      en((v) => `And the NEW member of ${v.t}... ${v.p}! ${v.a}! What a fight!`),
    ],
    unsold: [en((v) => `Nobody wants ${v.p}?! Back to the locker room!`), en((v) => `No takers for ${v.p}! We'll see them in the next round!`), en((v) => `${v.p} walks back up the ramp... unsold!`)],
    undo: [en(() => `Wait a minute! Wait a minute! That bid has been taken back!`), en(() => `Hold on! The referee says... that bid does not count!`), en(() => `Whoa! That bid is off the board!`)],
    brk: [en((v) => `Time out! The teams head to the back for ${v.dur}! Plan your attack!`), en((v) => `We'll take a ${v.dur} break! Don't go anywhere!`)],
    brkext: [en((v) => `We need more time! Another ${v.dur}!`), en((v) => `The break goes on! ${v.dur} more!`)],
    brkend: [en(() => `Break's over! Get back in that ring!`), en(() => `We're back! And this crowd is ready!`)],
    round: [en((v) => `Ladies and gentlemen... ROUND ${v.round}! Let's get it on!`), en((v) => `Here we go! Round ${v.round}! Fresh money, fresh fighters!`)],
    record: [en(() => `That is the BIGGEST buy of the night!`), en(() => `A new record tonight!`), en(() => `Nobody has paid more tonight!`)],
    steal: [en(() => `What a STEAL!`), en(() => `That's a bargain, baby!`), en(() => `Robbery! What a deal!`)],
    left: [en((v) => `${v.t} has ${v.left} left in the tank!`), en((v) => `${v.t} still has ${v.left} to fight with!`), en((v) => `${v.left} left for ${v.t}!`)],
    allIn: [en((v) => `${v.t} is going ALL IN!`), en((v) => `${v.t} is putting everything on the line!`), en((v) => `${v.t} just emptied the wallet!`)],
  },
  // ------------------------------------------------------------------ quiz-show host (Hindi): warm, personal, dramatic
  kbc: {
    lang: 'hi', voice: { pitch: 0.6, rate: 1, gender: 'male' },
    spin: [
      hi(() => `तो देवियों और सज्जनों... घूम रहा है पहिया... देखते हैं, किसकी क़िस्मत चमकती है!`, () => `To deviyon aur sajjano... ghoom raha hai pahiya... dekhte hain, kiski kismat chamakti hai!`),
      hi(() => `पहिया घूम रहा है... और आपकी धड़कनें भी!`, () => `Pahiya ghoom raha hai... aur aapki dhadkanein bhi!`),
      hi(() => `चलिए देखते हैं... आज क़िस्मत किस पर मेहरबान है!`, () => `Chaliye dekhte hain... aaj kismat kis par meharbaan hai!`),
    ],
    reveal: [
      hi((v) => `देवियों और सज्जनों... अब मंच पर आ रहे हैं... ${v.p}! शुरुआती बोली... ${v.a}. तो चलिए... शुरू करते हैं!`, (v) => `Deviyon aur sajjano... ab manch par aa rahe hain... ${v.p}! Shuruaati boli... ${v.a}. To chaliye... shuru karte hain!`),
      hi((v) => `और अब... जिनका सबको इंतज़ार था... ${v.p}! बोली शुरू होती है... ${v.a} से!`, (v) => `Aur ab... jinka sabko intezaar tha... ${v.p}! Boli shuru hoti hai... ${v.a} se!`),
      hi((v) => `आपके सामने हैं... ${v.p}! शुरुआती बोली ${v.a}. बताइए... कौन है तैयार?`, (v) => `Aapke saamne hain... ${v.p}! Shuruaati boli ${v.a}. Bataiye... kaun hai taiyaar?`),
      hi((v) => `तालियों से स्वागत कीजिए... ${v.p} का! बोली... ${v.a} से.`, (v) => `Taaliyon se swaagat kijiye... ${v.p} ka! Boli... ${v.a} se.`),
      hi((v) => `अगला नाम है... ${v.p}! और बोली की शुरुआत... ${v.a}.`, (v) => `Agla naam hai... ${v.p}! Aur boli ki shuruaat... ${v.a}.`),
    ],
    bid: [
      [
        hi((v) => `और पहली बोली आई है... ${v.t} की तरफ़ से... ${v.a}!`, (v) => `Aur pehli boli aayi hai... ${v.t} ki taraf se... ${v.a}!`),
        hi((v) => `${v.t} ने खाता खोला है... ${v.a}!`, (v) => `${v.t} ne khaata khola hai... ${v.a}!`),
        hi((v) => `शुरुआत ${v.t} ने की है... ${v.a}!`, (v) => `Shuruaat ${v.t} ne ki hai... ${v.a}!`),
        hi((v) => `${v.t}, आपकी बोली... ${v.a}. बहुत ख़ूब!`, (v) => `${v.t}, aapki boli... ${v.a}. Bahut khoob!`),
        hi((v) => `पहला हाथ उठा है... ${v.t} का! ${v.a}!`, (v) => `Pehla haath utha hai... ${v.t} ka! ${v.a}!`),
      ],
      [
        hi((v) => `अरे वाह! ${v.t}... ${v.a}!`, (v) => `Arre waah! ${v.t}... ${v.a}!`),
        hi((v) => `बोली बढ़कर हुई... ${v.a}! ${v.t} के नाम!`, (v) => `Boli badhkar hui... ${v.a}! ${v.t} ke naam!`),
        hi((v) => `${v.t} पीछे हटने वाले नहीं हैं... ${v.a}!`, (v) => `${v.t} peeche hatne waale nahin hain... ${v.a}!`),
        hi((v) => `सुनिए, सुनिए! ${v.t}... ${v.a}!`, (v) => `Suniye, suniye! ${v.t}... ${v.a}!`),
        hi((v) => `${v.t} ने बोली आगे बढ़ाई... ${v.a}!`, (v) => `${v.t} ne boli aage badhaayi... ${v.a}!`),
        hi((v) => `बहुत बढ़िया, ${v.t}! ${v.a}!`, (v) => `Bahut badhiya, ${v.t}! ${v.a}!`),
      ],
      [
        hi((v) => `क्या बात है! मुक़ाबला कड़ा हो गया है! ${v.t}... ${v.a}!`, (v) => `Kya baat hai! Muqaabla kada ho gaya hai! ${v.t}... ${v.a}!`),
        hi((v) => `देखिए, देखिए! ${v.t} ने बोली पहुँचा दी... ${v.a} पर!`, (v) => `Dekhiye, dekhiye! ${v.t} ne boli pahuncha di... ${v.a} par!`),
        hi((v) => `माहौल गरम है! ${v.t}... ${v.a}!`, (v) => `Maahaul garam hai! ${v.t}... ${v.a}!`),
        hi((v) => `${v.t}, आप तो कमाल कर रहे हैं! ${v.a}!`, (v) => `${v.t}, aap to kamaal kar rahe hain! ${v.a}!`),
        hi((v) => `यह बोली रुकने का नाम नहीं ले रही! ${v.t}... ${v.a}!`, (v) => `Yeh boli rukne ka naam nahin le rahi! ${v.t}... ${v.a}!`),
        hi((v) => `वाह, वाह! ${v.t} ने लगाई... ${v.a}!`, (v) => `Waah, waah! ${v.t} ne lagaayi... ${v.a}!`),
      ],
      [
        hi((v) => `अविश्वसनीय! अद्भुत! ${v.t}... ${v.a}! यह बोली अब रुकने वाली नहीं!`, (v) => `Avishvasneeya! Adbhut! ${v.t}... ${v.a}! Yeh boli ab rukne waali nahin!`),
        hi((v) => `दिल थाम के बैठिए, देवियों और सज्जनों! ${v.t}... ${v.a}!`, (v) => `Dil thaam ke baithiye, deviyon aur sajjano! ${v.t}... ${v.a}!`),
        hi((v) => `जंग छिड़ गई है! ${v.t}... ${v.a}!`, (v) => `Jung chhid gayi hai! ${v.t}... ${v.a}!`),
        hi((v) => `ऐसा मुक़ाबला मैंने बहुत कम देखा है! ${v.t}... ${v.a}!`, (v) => `Aisa muqaabla maine bahut kam dekha hai! ${v.t}... ${v.a}!`),
        hi((v) => `सारे रिकॉर्ड टूट रहे हैं! ${v.t}... ${v.a}!`, (v) => `Saare record toot rahe hain! ${v.t}... ${v.a}!`),
        hi((v) => `यह है असली मुक़ाबला! ${v.t}... ${v.a}!`, (v) => `Yeh hai asli muqaabla! ${v.t}... ${v.a}!`),
      ],
    ],
    rivalBid: [
      [],
      [hi((v) => `${v.t} ने ${v.r} को पीछे छोड़ा... ${v.a}!`, (v) => `${v.t} ne ${v.r} ko peeche chhoda... ${v.a}!`), hi((v) => `${v.r} की बोली का जवाब... ${v.t}! ${v.a}!`, (v) => `${v.r} ki boli ka jawaab... ${v.t}! ${v.a}!`)],
      [hi((v) => `${v.r} अब क्या करेंगे? ${v.t} ने बोली लगाई... ${v.a}!`, (v) => `${v.r} ab kya karenge? ${v.t} ne boli lagaayi... ${v.a}!`), hi((v) => `${v.r}, आपकी बारी! ${v.t} ने कहा... ${v.a}!`, (v) => `${v.r}, aapki baari! ${v.t} ne kaha... ${v.a}!`)],
      [hi((v) => `${v.r} और ${v.t} आमने-सामने! ${v.t}... ${v.a}!`, (v) => `${v.r} aur ${v.t} aamne-saamne! ${v.t}... ${v.a}!`), hi((v) => `${v.t} बनाम ${v.r}... कौन झुकेगा? ${v.a}!`, (v) => `${v.t} banaam ${v.r}... kaun jhukega? ${v.a}!`)],
    ],
    call: [
      [hi((v) => `${v.ap}एक बार!`, (v) => `${v.ap}ek baar!`), hi((v) => `${v.ap}एक बार... कोई और?`, (v) => `${v.ap}ek baar... koi aur?`), hi((v) => `एक बार... ${v.a}!`, (v) => `Ek baar... ${v.a}!`)],
      [hi((v) => `${v.ap}दो बार! कोई है... जो आगे बढ़े?`, (v) => `${v.ap}do baar! Koi hai... jo aage badhe?`), hi((v) => `दो बार! सोच लीजिए... समय कम है!`, (v) => `Do baar! Soch lijiye... samay kam hai!`), hi((v) => `${v.ap}दो बार!`, (v) => `${v.ap}do baar!`)],
      [hi((v) => `${v.ap}तीसरी बार... यह आख़िरी मौक़ा है!`, (v) => `${v.ap}teesri baar... yeh aakhiri mauka hai!`), hi((v) => `तीसरी बार... और...`, (v) => `Teesri baar... aur...`), hi((v) => `${v.ap}तीसरी बार! फ़ैसले की घड़ी!`, (v) => `${v.ap}teesri baar! Faisle ki ghadi!`)],
    ],
    sold: [
      hi((v) => `सौदा पक्का! ${v.p} अब ${v.t} की टीम में हैं... ${v.a} में! बधाई हो!`, (v) => `Sauda pakka! ${v.p} ab ${v.t} ki team mein hain... ${v.a} mein! Badhaai ho!`),
      hi((v) => `${v.t}, ${v.p} अब आपके हुए... ${v.a} में!`, (v) => `${v.t}, ${v.p} ab aapke hue... ${v.a} mein!`),
      hi((v) => `और बोली ख़त्म! ${v.p}... ${v.t} के नाम... ${v.a} में!`, (v) => `Aur boli khatam! ${v.p}... ${v.t} ke naam... ${v.a} mein!`),
      hi((v) => `बहुत-बहुत बधाई, ${v.t}! ${v.p}... ${v.a} में!`, (v) => `Bahut bahut badhaai, ${v.t}! ${v.p}... ${v.a} mein!`),
    ],
    soldHot: [
      hi((v) => `और... सौदा पक्का! क्या ज़बरदस्त मुक़ाबला था! ${v.p}... ${v.a} में... ${v.t} के नाम! बहुत-बहुत बधाई!`, (v) => `Aur... sauda pakka! Kya zabardast muqaabla tha! ${v.p}... ${v.a} mein... ${v.t} ke naam! Bahut bahut badhaai!`),
      hi((v) => `क्या लड़ाई थी! आख़िरकार ${v.t} ने बाज़ी मार ली! ${v.p}... ${v.a} में!`, (v) => `Kya ladaai thi! Aakhirkaar ${v.t} ne baazi maar li! ${v.p}... ${v.a} mein!`),
      hi((v) => `दिल जीत लिया आपने, ${v.t}! ${v.p}... ${v.a} में!`, (v) => `Dil jeet liya aapne, ${v.t}! ${v.p}... ${v.a} mein!`),
      hi((v) => `इतिहास बन गया! ${v.p}... ${v.t} की टीम में... ${v.a} में!`, (v) => `Itihaas ban gaya! ${v.p}... ${v.t} ki team mein... ${v.a} mein!`),
    ],
    unsold: [hi((v) => `अफ़सोस... ${v.p} के लिए आज कोई बोली नहीं लगी.`, (v) => `Afsos... ${v.p} ke liye aaj koi boli nahin lagi.`), hi((v) => `${v.p}... इस बार नहीं. शायद अगले राउंड में!`, (v) => `${v.p}... is baar nahin. Shaayad agle round mein!`)],
    undo: [hi(() => `रुकिए, रुकिए... यह बोली वापस ले ली गई है.`, () => `Rukiye, rukiye... yeh boli wapas le li gayi hai.`), hi(() => `एक मिनट... यह बोली रद्द!`, () => `Ek minute... yeh boli radd!`)],
    brk: [hi((v) => `देवियों और सज्जनों... अब एक छोटा सा ब्रेक... ${v.dur} का. कप्तान अपनी रणनीति बनाइए... मिलते हैं ब्रेक के बाद!`, (v) => `Deviyon aur sajjano... ab ek chhota sa break... ${v.dur} ka. Captain apni ranneeti banaiye... milte hain break ke baad!`), hi((v) => `थोड़ा आराम... ${v.dur} का ब्रेक. कहीं मत जाइए!`, (v) => `Thoda aaraam... ${v.dur} ka break. Kahin mat jaiye!`)],
    brkext: [hi((v) => `ब्रेक थोड़ा और... ${v.dur} और!`, (v) => `Break thoda aur... ${v.dur} aur!`)],
    brkend: [hi(() => `स्वागत है आपका वापस! तो चलिए... खेल फिर शुरू करते हैं!`, () => `Swaagat hai aapka wapas! To chaliye... khel phir shuru karte hain!`), hi(() => `और हम वापस आ गए हैं! तैयार हैं आप?`, () => `Aur hum wapas aa gaye hain! Taiyaar hain aap?`)],
    round: [hi((v) => `देवियों और सज्जनों... शुरू होता है... राउंड ${v.round}! नई उम्मीदें... नए मौक़े!`, (v) => `Deviyon aur sajjano... shuru hota hai... round ${v.round}! Nayi ummeedein... naye mauke!`)],
    record: [hi(() => `और यह है आज की सबसे बड़ी बोली!`, () => `Aur yeh hai aaj ki sabse badi boli!`), hi(() => `नया रिकॉर्ड! आज की सबसे महँगी ख़रीद!`, () => `Naya record! Aaj ki sabse mehngi khareed!`)],
    steal: [hi(() => `क्या सस्ता सौदा है!`, () => `Kya sasta sauda hai!`), hi(() => `बहुत ही समझदारी की ख़रीद!`, () => `Bahut hi samajhdaari ki khareed!`)],
    left: [hi((v) => `${v.t} के पास अब बचे हैं... ${v.left}.`, (v) => `${v.t} ke paas ab bache hain... ${v.left}.`), hi((v) => `${v.t}, आपके पर्स में अब ${v.left} हैं.`, (v) => `${v.t}, aapke purse mein ab ${v.left} hain.`)],
    allIn: [hi((v) => `${v.t} ने सब कुछ दाँव पर लगा दिया है!`, (v) => `${v.t} ne sab kuchh daanv par laga diya hai!`), hi((v) => `${v.t}, बहुत बड़ा जोखिम!`, (v) => `${v.t}, bahut bada jokhim!`)],
  },
  // ------------------------------------------------------------------ arena narrator: cold at first, roaring by the end
  mk: {
    lang: 'en', voice: { pitch: 0.25, rate: 1, gender: 'male' },
    spin: [en(() => `Choose your destiny...`), en(() => `The wheel turns... fate decides.`), en(() => `Who will be summoned to the arena?`)],
    reveal: [
      en((v) => `${v.p}... enters the arena. Opening bid... ${v.a}.`),
      en((v) => `A new challenger approaches... ${v.p}! The bidding begins at ${v.a}.`),
      en((v) => `From the shadows... ${v.p}. Opening bid, ${v.a}.`),
      en((v) => `The tournament summons ${v.p}! Bidding starts at ${v.a}.`),
    ],
    bid: [
      [en((v) => `${v.t}... ${v.a}.`), en((v) => `${v.t} makes the first move... ${v.a}.`), en((v) => `${v.t} steps forward. ${v.a}.`), en((v) => `The first strike... ${v.t}. ${v.a}.`)],
      [en((v) => `${v.t} strikes... ${v.a}!`), en((v) => `${v.t}! ${v.a}!`), en((v) => `${v.t} attacks! ${v.a}!`), en((v) => `Excellent! ${v.t}, ${v.a}!`), en((v) => `${v.t} fights on! ${v.a}!`)],
      [en((v) => `Brutal! ${v.t}... ${v.a}!`), en((v) => `${v.t}! ${v.a}! No mercy!`), en((v) => `Savage! ${v.t}, ${v.a}!`), en((v) => `${v.t} shows no fear! ${v.a}!`), en((v) => `Combo! ${v.t}, ${v.a}!`)],
      [
        en((v) => `${v.t} unleashes ${v.a}! The arena trembles!`),
        en((v) => `Outstanding! ${v.t}... ${v.a}! Who dares to fight back?!`),
        en((v) => `Fight! ${v.t}! ${v.a}! This battle is legendary!`),
        en((v) => `Superb! ${v.t}, ${v.a}! The gods are watching!`),
        en((v) => `${v.t}! ${v.a}! Unstoppable!`),
      ],
    ],
    rivalBid: [
      [],
      [en((v) => `${v.t} counters ${v.r}! ${v.a}!`), en((v) => `${v.r} is challenged! ${v.t}, ${v.a}!`)],
      [en((v) => `${v.r} is wounded! ${v.t}... ${v.a}!`), en((v) => `${v.t} strikes back at ${v.r}! ${v.a}!`)],
      [en((v) => `${v.t} versus ${v.r}! ${v.a}! Only one will survive!`), en((v) => `${v.r} stands alone against ${v.t}! ${v.a}!`)],
    ],
    call: [
      [en((v) => `${v.ap}Going once! Prepare yourselves!`), en((v) => `${v.ap}Going once...`), en((v) => `Going once... the arena waits.`)],
      [en((v) => `${v.ap}Going twice! Last warning!`), en((v) => `Going twice... who dares?`), en((v) => `${v.ap}Going twice!`)],
      [en(() => `Going three times... FINISH HIM!`), en((v) => `${v.ap}Going three times... FINISH HIM!`), en(() => `No one dares? Going three times... FINISH HIM!`)],
    ],
    sold: [
      en((v) => `${v.t} wins! ${v.p} is theirs... for ${v.a}! Flawless victory!`),
      en((v) => `Victory! ${v.p} joins ${v.t}, for ${v.a}!`),
      en((v) => `${v.t} claims ${v.p}... ${v.a}. Well done.`),
      en((v) => `The battle is won. ${v.p}, to ${v.t}, for ${v.a}!`),
    ],
    soldHot: [
      en((v) => `Fatality! ${v.t} claims ${v.p}... for ${v.a}! Flawless victory!`),
      en((v) => `Brutality! ${v.p} goes to ${v.t}, for ${v.a}!`),
      en((v) => `${v.t} wins the war! ${v.p}, for ${v.a}! Outstanding!`),
      en((v) => `Legendary! ${v.t} takes ${v.p}... ${v.a}! Flawless victory!`),
    ],
    unsold: [en((v) => `Nobody dares. ${v.p} remains unclaimed.`), en((v) => `${v.p} returns to the shadows.`)],
    undo: [en(() => `The bid... is undone.`), en(() => `That strike... did not count.`)],
    brk: [en((v) => `Warriors... rest. ${v.dur}. Prepare your strategy.`)],
    brkext: [en((v) => `The rest is extended... ${v.dur}.`)],
    brkend: [en(() => `The tournament resumes. Fight!`), en(() => `Return to the arena!`)],
    round: [en((v) => `Round ${v.round}... FIGHT!`)],
    record: [en(() => `A new champion of the night!`), en(() => `The highest price in this tournament!`)],
    steal: [en(() => `Taken... without a fight.`), en(() => `An easy victory.`)],
    left: [en((v) => `${v.t}... ${v.left} remains.`), en((v) => `${v.t} has ${v.left} left for battle.`)],
    allIn: [en((v) => `${v.t} risks everything!`), en((v) => `${v.t} holds nothing back!`)],
  },
  // ------------------------------------------------------------------ game-show host
  show: {
    lang: 'en', voice: { pitch: 1.1, rate: 1, gender: 'female' },
    spin: [en(() => `Spin it to win it! Round and round it goes... where it stops, nobody knows!`), en(() => `Ooh, here comes the wheel! Fingers crossed, everybody!`), en(() => `Big money, big money... let's spin!`)],
    reveal: [
      en((v) => `Welcome back, everybody! Our next contestant is... ${v.p}! The bidding opens at ${v.a}! Let's play!`),
      en((v) => `Ooh, here's a good one! Give it up for... ${v.p}! Starting at ${v.a}!`),
      en((v) => `Behind door number one... it's ${v.p}! Bidding starts at ${v.a}!`),
      en((v) => `Say hello to ${v.p}! We're starting at ${v.a}!`),
    ],
    bid: [
      [en((v) => `And ${v.t} buzzes in first! ${v.a}!`), en((v) => `${v.t} is on the board with ${v.a}!`), en((v) => `First answer from ${v.t}: ${v.a}!`), en((v) => `${v.t} gets us going! ${v.a}!`)],
      [en((v) => `${v.t}! ${v.a}! Ooh, I like it!`), en((v) => `Ding ding ding! ${v.t}, ${v.a}!`), en((v) => `${v.t} says ${v.a}! Good answer!`), en((v) => `Ooh! ${v.t}, ${v.a}!`), en((v) => `${v.t} is playing! ${v.a}!`)],
      [en((v) => `Oh, this is getting good! ${v.t}... ${v.a}! The board is lighting up!`), en((v) => `Ooh! ${v.t} goes big! ${v.a}! Who's next?!`), en((v) => `${v.t} is on fire! ${v.a}!`), en((v) => `Bonus round energy! ${v.t}, ${v.a}!`)],
      [en((v) => `Oh my goodness! ${v.t}! ${v.a}! This is the round of the night!`), en((v) => `Are you kidding me?! ${v.t} with ${v.a}! Somebody get these teams some water!`), en((v) => `${v.t}! ${v.a}! I have never seen anything like it!`), en((v) => `Jackpot energy! ${v.t}, ${v.a}!`)],
    ],
    rivalBid: [[], [en((v) => `${v.t} steals it from ${v.r}! ${v.a}!`)], [en((v) => `${v.r}, are you going to take that?! ${v.t}, ${v.a}!`)], [en((v) => `${v.t} and ${v.r} just won't stop! ${v.a}!`)]],
    call: [
      [en((v) => `${v.ap}Going once... the clock is ticking!`), en((v) => `${v.ap}Going once!`)],
      [en((v) => `${v.ap}Going twice! Is that your final answer, everybody?`), en((v) => `Going twice! Tick tock!`)],
      [en((v) => `${v.ap}Going three times... last chance, last chance!`), en(() => `Going three times... any last buzzers?`)],
    ],
    sold: [en((v) => `Sold! ${v.p} is going home with ${v.t}, for ${v.a}! Congratulations!`), en((v) => `${v.t} wins ${v.p}! ${v.a}! Collect your prize!`), en((v) => `And the prize goes to... ${v.t}! ${v.p}, for ${v.a}!`)],
    soldHot: [en((v) => `And THAT is the winning bid! ${v.p} goes to ${v.t} for ${v.a}! What a game! Give it up, everybody!`), en((v) => `We have a winner! ${v.t} takes ${v.p} for ${v.a}! What a round!`)],
    unsold: [en((v) => `Aww! No takers for ${v.p}... maybe next round!`), en((v) => `Oh no! ${v.p} goes back in the box!`)],
    undo: [en(() => `Oops! The judges have taken that bid back!`), en(() => `Hold on, hold on! That bid is off the board!`)],
    brk: [en((v) => `We'll be right back after this short break! ${v.dur}, everybody. Teams, huddle up!`)],
    brkext: [en((v) => `Ooh, we're adding ${v.dur} to the clock!`)],
    brkend: [en(() => `And we're back! Let's play!`)],
    round: [en((v) => `Welcome to round ${v.round}! New players, new money, new chances to win!`)],
    record: [en(() => `That's the highest score of the night!`), en(() => `A brand new high score!`)],
    steal: [en(() => `What a bargain!`), en(() => `Right on the money!`)],
    left: [en((v) => `${v.t} has ${v.left} left to play with!`), en((v) => `${v.left} still in the bank for ${v.t}!`)],
    allIn: [en((v) => `${v.t} is betting it all!`), en((v) => `${v.t} is going for broke!`)],
    squad: [en((v) => `That's player number ${v.n} for ${v.t}!`)],
  },
  // ------------------------------------------------------------------ smooth late-night voice
  velvet: {
    lang: 'en', voice: { pitch: 0.95, rate: 1, gender: 'female' },
    spin: [en(() => `Mmm... let's see who the wheel picks for us tonight.`), en(() => `Round and round... who's next?`), en(() => `Let it spin... I love a surprise.`)],
    reveal: [en((v) => `Mmm... up next... ${v.p}. Starting at ${v.a}. Take your time... or don't.`), en((v) => `Well, hello... ${v.p}. The bidding opens at... ${v.a}.`), en((v) => `Say hi to ${v.p}. Starting at ${v.a}... who's interested?`)],
    bid: [
      [en((v) => `${v.t}... ${v.a}. Bold move.`), en((v) => `Oh... ${v.t}. ${v.a}. I noticed.`), en((v) => `${v.t} goes first... ${v.a}. I like that.`)],
      [en((v) => `${v.t}... ${v.a}. Now we're talking.`), en((v) => `Mmm... ${v.t}... ${v.a}.`), en((v) => `${v.t}, ${v.a}. Getting interesting.`), en((v) => `Oh, ${v.t}. ${v.a}. Smooth.`)],
      [en((v) => `Oh, ${v.t}... ${v.a}. Somebody's feeling confident tonight.`), en((v) => `${v.t}... ${v.a}. It's getting warm in here.`), en((v) => `${v.t}, ${v.a}. Don't stop now.`)],
      [en((v) => `Ooh... ${v.t}. ${v.a}. Now that... is irresistible.`), en((v) => `${v.t}... ${v.a}. You really know how to make an entrance.`), en((v) => `${v.a}... from ${v.t}. I could listen to this all night.`)],
    ],
    rivalBid: [[], [en((v) => `${v.t} takes it from ${v.r}... ${v.a}. Smooth.`)], [en((v) => `${v.r}... are you going to let ${v.t} have this? ${v.a}.`)], [en((v) => `${v.t} and ${v.r}... this is getting interesting. ${v.a}.`)]],
    call: [[en((v) => `${v.ap}Once.`), en(() => `Going once...`)], [en(() => `Twice... don't keep me waiting.`), en(() => `Going twice...`)], [en(() => `Three times... last chance, darling.`), en(() => `Going three times...`)]],
    sold: [en((v) => `Sold... ${v.p}, to ${v.t}, for ${v.a}. Enjoy.`), en((v) => `${v.p} goes home with ${v.t}... ${v.a}. Lovely.`)],
    soldHot: [en((v) => `And... it's yours, ${v.t}. ${v.p}... for ${v.a}. Worth every bit.`), en((v) => `${v.t} wins ${v.p}... ${v.a}. That was fun.`)],
    unsold: [en((v) => `Hmm... no one for ${v.p}? Their loss.`)],
    undo: [en(() => `Changed your mind? That bid is... taken back.`)],
    brk: [en((v) => `Let's take a little break... ${v.dur}. Relax. Plan something... clever.`)],
    brkext: [en((v) => `A little longer... ${v.dur} more.`)],
    brkend: [en(() => `Welcome back... where were we?`)],
    round: [en((v) => `Round ${v.round}... the night is still young.`)],
    record: [en(() => `The most expensive one tonight... I'm impressed.`)],
    steal: [en(() => `A steal... lucky you.`)],
    left: [en((v) => `${v.t}... you have ${v.left} left. Spend it wisely.`)],
    allIn: [en((v) => `${v.t}... putting everything on the table. I like that.`)],
  },
  // ------------------------------------------------------------------ movie-trailer narrator
  trailer: {
    lang: 'en', voice: { pitch: 0.4, rate: 1, gender: 'male' },
    spin: [en(() => `In a world... where fate spins the wheel...`), en(() => `One wheel... one spin... one destiny.`), en(() => `This season... the wheel decides.`)],
    reveal: [en((v) => `In a world... where every team needs a hero... one player... ${v.p}. Opening bid... ${v.a}.`), en((v) => `This season... one name... ${v.p}. The bidding begins... at ${v.a}.`), en((v) => `Coming up... ${v.p}. Starting at ${v.a}.`)],
    bid: [
      [en((v) => `${v.t}... makes their move. ${v.a}.`), en((v) => `One team... dared to bid first. ${v.t}... ${v.a}.`), en((v) => `It begins. ${v.t}, ${v.a}.`)],
      [en((v) => `${v.t}... ${v.a}.`), en((v) => `${v.t} raises the stakes... ${v.a}.`), en((v) => `The plot thickens. ${v.t}, ${v.a}.`)],
      [en((v) => `The battle... intensifies. ${v.t}... ${v.a}!`), en((v) => `No one... saw this coming. ${v.t}... ${v.a}!`), en((v) => `Everything... is on the line. ${v.t}, ${v.a}!`)],
      [en((v) => `This summer... the bidding war... of the century! ${v.t}... ${v.a}!`), en((v) => `Only one team... will survive. ${v.t}... ${v.a}!`), en((v) => `Legends... are made tonight. ${v.t}... ${v.a}!`)],
    ],
    rivalBid: [[], [en((v) => `${v.r} thought it was over... but ${v.t}... ${v.a}.`)], [en((v) => `${v.r}... versus ${v.t}... ${v.a}!`)], [en((v) => `Two teams. One player. ${v.t}... ${v.a}!`)]],
    call: [[en((v) => `${v.ap}Going once.`)], [en(() => `Going twice... time is running out.`)], [en(() => `Going three times... this is... the final chapter.`)]],
    sold: [en((v) => `${v.p}... joins ${v.t}... for ${v.a}. The story... begins.`), en((v) => `${v.t}... and ${v.p}. ${v.a}. A new chapter.`)],
    soldHot: [en((v) => `${v.t}... ${v.p}... ${v.a}. The legend... begins. Coming soon... to a squad near you.`), en((v) => `After the battle of the century... ${v.t} wins ${v.p}. ${v.a}.`)],
    unsold: [en((v) => `${v.p}... will return. In the next round.`)],
    undo: [en(() => `But wait... the bid... was never meant to be.`)],
    brk: [en((v) => `Intermission. ${v.dur}. The teams... prepare.`)],
    brkext: [en((v) => `The intermission... continues. ${v.dur} more.`)],
    brkend: [en(() => `And now... the story continues.`)],
    round: [en((v) => `Part ${v.round}. The battle... returns.`)],
    record: [en(() => `The biggest deal... of the night.`)],
    steal: [en(() => `A steal... nobody saw coming.`)],
    left: [en((v) => `${v.t}... ${v.left} remains.`)],
    allIn: [en((v) => `${v.t}... risks... everything.`)],
  },
  // ------------------------------------------------------------------ cricket commentary (Hindi): loud and joyful
  cricket: {
    lang: 'hi', voice: { pitch: 1, rate: 1, gender: 'male' },
    spin: [
      hi(() => `टॉस हो चुका है! देखते हैं अगला बल्लेबाज़ कौन!`, () => `Toss ho chuka hai! Dekhte hain agla ballebaaz kaun!`),
      hi(() => `पहिया घूम रहा है! अगला खिलाड़ी कौन होगा?`, () => `Pahiya ghoom raha hai! Agla khiladi kaun hoga?`),
      hi(() => `स्टेडियम में सन्नाटा! किसका नाम आएगा?`, () => `Stadium mein sannaata! Kiska naam aayega?`),
    ],
    reveal: [
      hi((v) => `और मैदान पर उतर रहे हैं... ${v.p}! बेस प्राइस ${v.a}! ज़ोरदार तालियाँ!`, (v) => `Aur maidaan par utar rahe hain... ${v.p}! Base price ${v.a}! Zordaar taaliyaan!`),
      hi((v) => `नया बल्लेबाज़, नया जोश! ${v.p}! बोली शुरू ${v.a} से!`, (v) => `Naya ballebaaz, naya josh! ${v.p}! Boli shuru ${v.a} se!`),
      hi((v) => `क्रीज़ पर आ गए हैं ${v.p}! बेस प्राइस ${v.a}!`, (v) => `Crease par aa gaye hain ${v.p}! Base price ${v.a}!`),
      hi((v) => `सबकी नज़रें ${v.p} पर! बोली ${v.a} से शुरू!`, (v) => `Sabki nazrein ${v.p} par! Boli ${v.a} se shuru!`),
      hi((v) => `पवेलियन से निकल रहे हैं ${v.p}! शुरुआत ${v.a} से!`, (v) => `Pavilion se nikal rahe hain ${v.p}! Shuruaat ${v.a} se!`),
    ],
    bid: [
      [
        hi((v) => `${v.t} ने खाता खोला! ${v.a}! शानदार शुरुआत!`, (v) => `${v.t} ne khaata khola! ${v.a}! Shaandaar shuruaat!`),
        hi((v) => `पहली ही गेंद पर रन! ${v.t}, ${v.a}!`, (v) => `Pehli hi gend par run! ${v.t}, ${v.a}!`),
        hi((v) => `${v.t} ने पहला शॉट खेला! ${v.a}!`, (v) => `${v.t} ne pehla shot khela! ${v.a}!`),
        hi((v) => `खेल शुरू! ${v.t}, ${v.a}!`, (v) => `Khel shuru! ${v.t}, ${v.a}!`),
        hi((v) => `सिंगल लिया ${v.t} ने! ${v.a}!`, (v) => `Single liya ${v.t} ne! ${v.a}!`),
      ],
      [
        hi((v) => `चौका! ${v.t}, ${v.a}!`, (v) => `Chauka! ${v.t}, ${v.a}!`),
        hi((v) => `क्या टाइमिंग है! ${v.t}, ${v.a}!`, (v) => `Kya timing hai! ${v.t}, ${v.a}!`),
        hi((v) => `${v.t} ने गैप ढूँढ लिया! ${v.a}!`, (v) => `${v.t} ne gap dhoondh liya! ${v.a}!`),
        hi((v) => `बढ़िया शॉट! ${v.t}, ${v.a}!`, (v) => `Badhiya shot! ${v.t}, ${v.a}!`),
        hi((v) => `कवर ड्राइव! ${v.t}, ${v.a}!`, (v) => `Cover drive! ${v.t}, ${v.a}!`),
        hi((v) => `दो रन और! ${v.t}, ${v.a}!`, (v) => `Do run aur! ${v.t}, ${v.a}!`),
      ],
      [
        hi((v) => `छक्का! छक्का! ${v.t}, ${v.a}!`, (v) => `Chhakka! Chhakka! ${v.t}, ${v.a}!`),
        hi((v) => `ओहो हो! क्या शॉट है! ${v.t}, ${v.a}!`, (v) => `Oho ho! Kya shot hai! ${v.t}, ${v.a}!`),
        hi((v) => `ज़बरदस्त! ${v.t} रुकने का नाम नहीं ले रहे! ${v.a}!`, (v) => `Zabardast! ${v.t} rukne ka naam nahin le rahe! ${v.a}!`),
        hi((v) => `हेलीकॉप्टर शॉट! ${v.t}, ${v.a}!`, (v) => `Helicopter shot! ${v.t}, ${v.a}!`),
        hi((v) => `गेंद हवा में... और बाउंड्री के पार! ${v.t}, ${v.a}!`, (v) => `Gend hawa mein... aur boundary ke paar! ${v.t}, ${v.a}!`),
        hi((v) => `स्टेडियम में शोर! ${v.t}, ${v.a}!`, (v) => `Stadium mein shor! ${v.t}, ${v.a}!`),
      ],
      [
        hi((v) => `अविश्वसनीय! एक और छक्का! ${v.t}, ${v.a}! पूरा स्टेडियम खड़ा हो गया!`, (v) => `Avishvasneeya! Ek aur chhakka! ${v.t}, ${v.a}! Poora stadium khada ho gaya!`),
        hi((v) => `गेंद स्टेडियम के बाहर! ${v.t}, ${v.a}! क्या मुक़ाबला है भाई!`, (v) => `Gend stadium ke bahar! ${v.t}, ${v.a}! Kya muqaabla hai bhai!`),
        hi((v) => `धमाकेदार! ${v.t}, ${v.a}! सुपर ओवर जैसा रोमांच!`, (v) => `Dhamaakedaar! ${v.t}, ${v.a}! Super over jaisa romaanch!`),
        hi((v) => `यह मैच नहीं, जंग है! ${v.t}, ${v.a}!`, (v) => `Yeh match nahin, jung hai! ${v.t}, ${v.a}!`),
        hi((v) => `ऐसा मुक़ाबला सालों में एक बार! ${v.t}, ${v.a}!`, (v) => `Aisa muqaabla saalon mein ek baar! ${v.t}, ${v.a}!`),
        hi((v) => `आसमान छू गई बोली! ${v.t}, ${v.a}!`, (v) => `Aasmaan chhoo gayi boli! ${v.t}, ${v.a}!`),
      ],
    ],
    rivalBid: [
      [],
      [hi((v) => `${v.t} ने ${v.r} की गेंद सीधी बाउंड्री के पार भेजी! ${v.a}!`, (v) => `${v.t} ne ${v.r} ki gend seedhi boundary ke paar bheji! ${v.a}!`), hi((v) => `${v.r} को जवाब दिया ${v.t} ने! ${v.a}!`, (v) => `${v.r} ko jawaab diya ${v.t} ne! ${v.a}!`)],
      [hi((v) => `${v.r} दबाव में! ${v.t}, ${v.a}!`, (v) => `${v.r} dabaav mein! ${v.t}, ${v.a}!`), hi((v) => `${v.r} की फ़ील्डिंग बिखर गई! ${v.t}, ${v.a}!`, (v) => `${v.r} ki fielding bikhar gayi! ${v.t}, ${v.a}!`)],
      [hi((v) => `${v.t} बनाम ${v.r}! आर-पार की लड़ाई! ${v.a}!`, (v) => `${v.t} banaam ${v.r}! Aar-paar ki ladaai! ${v.a}!`), hi((v) => `${v.r} और ${v.t}, आख़िरी ओवर जैसा रोमांच! ${v.a}!`, (v) => `${v.r} aur ${v.t}, aakhiri over jaisa romaanch! ${v.a}!`)],
    ],
    call: [
      [hi((v) => `${v.ap}एक बार!`, (v) => `${v.ap}ek baar!`), hi((v) => `एक बार! ${v.a}!`, (v) => `Ek baar! ${v.a}!`)],
      [hi((v) => `${v.ap}दो बार! आख़िरी ओवर!`, (v) => `${v.ap}do baar! Aakhiri over!`), hi(() => `दो बार! कोई और शॉट?`, () => `Do baar! Koi aur shot?`)],
      [hi((v) => `${v.ap}तीसरी बार! आख़िरी गेंद!`, (v) => `${v.ap}teesri baar! Aakhiri gend!`), hi(() => `तीसरी बार! अंपायर की उँगली उठने वाली है!`, () => `Teesri baar! Umpire ki ungli uthne waali hai!`)],
    ],
    sold: [
      hi((v) => `सौदा पक्का! ${v.p}, ${v.t} की टीम में, ${v.a} में! क्या बात है!`, (v) => `Sauda pakka! ${v.p}, ${v.t} ki team mein, ${v.a} mein! Kya baat hai!`),
      hi((v) => `${v.t} ने ${v.p} को अपनी टीम में लिया! ${v.a}!`, (v) => `${v.t} ne ${v.p} ko apni team mein liya! ${v.a}!`),
      hi((v) => `कैच पकड़ लिया! ${v.p}, ${v.t} के! ${v.a}!`, (v) => `Catch pakad liya! ${v.p}, ${v.t} ke! ${v.a}!`),
      hi((v) => `डील डन! ${v.p}, ${v.a} में, ${v.t} के नाम!`, (v) => `Deal done! ${v.p}, ${v.a} mein, ${v.t} ke naam!`),
    ],
    soldHot: [
      hi((v) => `और ये... मैच ख़त्म! ${v.t} ने बाज़ी मार ली! ${v.p}, ${v.a} में! क्या मैच था, क्या मैच था!`, (v) => `Aur ye... match khatam! ${v.t} ne baazi maar li! ${v.p}, ${v.a} mein! Kya match tha, kya match tha!`),
      hi((v) => `आख़िरी गेंद पर जीत! ${v.t}! ${v.p}, ${v.a} में!`, (v) => `Aakhiri gend par jeet! ${v.t}! ${v.p}, ${v.a} mein!`),
      hi((v) => `ट्रॉफ़ी जैसी जीत! ${v.p}, ${v.t} के! ${v.a}!`, (v) => `Trophy jaisi jeet! ${v.p}, ${v.t} ke! ${v.a}!`),
      hi((v) => `क्या फ़िनिश है! ${v.t} ने ${v.p} को जीता, ${v.a} में!`, (v) => `Kya finish hai! ${v.t} ne ${v.p} ko jeeta, ${v.a} mein!`),
    ],
    unsold: [hi((v) => `अरे! ${v.p} के लिए कोई बोली नहीं! वापस पवेलियन!`, (v) => `Arre! ${v.p} ke liye koi boli nahin! Wapas pavilion!`), hi((v) => `${v.p}... डक पर आउट! अगले राउंड में मिलेंगे!`, (v) => `${v.p}... duck par out! Agle round mein milenge!`)],
    undo: [hi(() => `रिव्यू! और फ़ैसला बदल गया! बोली वापस!`, () => `Review! Aur faisla badal gaya! Boli wapas!`), hi(() => `नो बॉल! यह बोली गिनी नहीं जाएगी!`, () => `No ball! Yeh boli gini nahin jaayegi!`)],
    brk: [hi((v) => `ड्रिंक्स ब्रेक! ${v.dur}! कप्तान, अपनी रणनीति बनाइए!`, (v) => `Drinks break! ${v.dur}! Captain, apni ranneeti banaiye!`), hi((v) => `स्ट्रैटेजिक टाइम आउट! ${v.dur}!`, (v) => `Strategic time out! ${v.dur}!`)],
    brkext: [hi((v) => `ब्रेक बढ़ा! ${v.dur} और!`, (v) => `Break badha! ${v.dur} aur!`)],
    brkend: [hi(() => `खेल फिर शुरू! चलिए, धमाका करते हैं!`, () => `Khel phir shuru! Chaliye, dhamaaka karte hain!`), hi(() => `खिलाड़ी मैदान पर लौट आए हैं!`, () => `Khiladi maidaan par laut aaye hain!`)],
    round: [hi((v) => `राउंड ${v.round}! नई पारी, नया जोश!`, (v) => `Round ${v.round}! Nayi paari, naya josh!`)],
    record: [hi(() => `आज की सबसे महँगी ख़रीद! रिकॉर्ड टूट गया!`, () => `Aaj ki sabse mehngi khareed! Record toot gaya!`), hi(() => `नया रिकॉर्ड! इतनी बड़ी बोली आज तक नहीं लगी!`, () => `Naya record! Itni badi boli aaj tak nahin lagi!`)],
    steal: [hi(() => `बिल्कुल सस्ते में! क्या चोरी है!`, () => `Bilkul saste mein! Kya chori hai!`), hi(() => `बेस प्राइस पर! क्या समझदारी है!`, () => `Base price par! Kya samajhdaari hai!`)],
    left: [hi((v) => `${v.t} के पर्स में बचे ${v.left}!`, (v) => `${v.t} ke purse mein bache ${v.left}!`), hi((v) => `${v.t} के पास अब ${v.left} बाक़ी!`, (v) => `${v.t} ke paas ab ${v.left} baaki!`)],
    allIn: [hi((v) => `${v.t} ने पूरा पर्स झोंक दिया!`, (v) => `${v.t} ne poora purse jhonk diya!`), hi((v) => `${v.t} ने सब कुछ दाँव पर लगा दिया!`, (v) => `${v.t} ne sab kuchh daanv par laga diya!`)],
  },
  // ------------------------------------------------------------------ friendly smart assistant
  assistant: {
    lang: 'en', voice: { pitch: 1, rate: 1, gender: 'female' },
    spin: [en(() => `Spinning the wheel now.`), en(() => `Let's see who's next.`)],
    reveal: [en((v) => `Next up: ${v.p}. Base price, ${v.a}.`), en((v) => `Now bidding on ${v.p}. Starting at ${v.a}.`), en((v) => `${v.p} is on the block. Base price ${v.a}.`)],
    bid: [
      [en((v) => `First bid: ${v.t}, ${v.a}.`), en((v) => `${v.t} opens the bidding at ${v.a}.`), en((v) => `We have a bid. ${v.t}, ${v.a}.`)],
      [en((v) => `New bid from ${v.t}: ${v.a}.`), en((v) => `${v.t} bids ${v.a}.`), en((v) => `${v.t} is now on top, at ${v.a}.`), en((v) => `Now at ${v.a}, from ${v.t}.`)],
      [en((v) => `${v.t} raises to ${v.a}. The bidding is picking up.`), en((v) => `${v.t}, ${v.a}. That's a big jump.`), en((v) => `${v.t} leads with ${v.a}. Lots of interest in this one.`)],
      [en((v) => `${v.t}, ${v.a}! This is a real bidding war.`), en((v) => `Wow. ${v.t} bids ${v.a}. That's well above the base price.`), en((v) => `${v.t} now at ${v.a}. Everyone wants this player.`)],
    ],
    rivalBid: [[], [en((v) => `${v.t} outbids ${v.r}: ${v.a}.`)], [en((v) => `${v.t} outbids ${v.r} again: ${v.a}.`)], [en((v) => `${v.t} and ${v.r} keep going. ${v.t}, ${v.a}!`)]],
    call: [[en((v) => `${v.ap}Going once.`)], [en((v) => `${v.ap}Going twice.`)], [en((v) => `Final call: ${v.ap}going three times.`)]],
    sold: [en((v) => `Sold. ${v.p} joins ${v.t} for ${v.a}.`), en((v) => `${v.p} goes to ${v.t}, for ${v.a}.`)],
    soldHot: [en((v) => `Sold! ${v.p} joins ${v.t} for ${v.a}. What a contest!`), en((v) => `After a long bidding war, ${v.p} goes to ${v.t} for ${v.a}.`)],
    unsold: [en((v) => `${v.p} is unsold. They may come back in the next round.`)],
    undo: [en(() => `The last bid has been taken back.`)],
    brk: [en((v) => `Starting a ${v.dur} strategy break. Captains, check your plans.`)],
    brkext: [en((v) => `The break has been extended by ${v.dur}.`)],
    brkend: [en(() => `The break is over. Let's continue.`)],
    round: [en((v) => `Round ${v.round} is starting. Purses have been updated.`)],
    record: [en(() => `That's the highest price so far.`)],
    steal: [en(() => `That's a great deal at the base price.`)],
    left: [en((v) => `${v.t} now has ${v.left} left.`)],
    allIn: [en((v) => `Heads up: that's almost all of ${v.t}'s purse.`)],
    squad: [en((v) => `That's player number ${v.n} for ${v.t}.`)],
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
  const one = (list: Pair[]) => pick(list, c.variant);
  if (kind === 'bid' && c.allIn) out.push(one(h.allIn));
  if (kind === 'sold') {
    if (c.record) out.push(one(h.record));
    else if ((c.bids ?? 0) <= 1 && c.base && c.amount && c.amount <= c.base) out.push(one(h.steal));
    if (h.squad && c.squad && c.squad > 1) out.push(one(h.squad));
    if (c.left !== undefined && c.team) out.push(one(h.left));
  }
  return out;
}

/** The studio voice's speaking pace: every host speaks at the voice's own normal pace (never faster, never slower). */
export function studioPace(_style?: AnnouncerStyle, _kind?: SpeechKind, _c?: AnnounceCtx): number {
  return 1;
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
    case 'call': {
      const n = Math.min(2, Math.max(0, (c.call ?? 1) - 1));
      const own = n === 2 ? c.lastCall?.trim() : '';
      // the organiser's own last call ("Finish him!", "Ab ya kabhi nahin!") replaces the host's
      line = own ? [(v) => `${v.ap}${own}`, (v) => `${v.ap}${own}`] : pick(h.call[n], c.variant);
      break;
    }
    case 'sold': if (c.player && c.team && c.amount) line = pick(heat >= 2 ? h.soldHot : h.sold, c.variant); break;
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
  // In the bidding, long "..." pauses become ordinary commas so a bid flows like normal speech (the speed itself never changes).
  const brisk = kind === 'bid' || kind === 'call' || kind === 'undo';
  const tidy = (x: string) => (brisk ? x.replace(/\.\.\.\s*(?=[!?.,]|$)/g, '').replace(/\.\.\.\s*/g, ', ') : x);
  const text = tidy(parts.map((p) => p[0](vd)).join(' '));
  const alt = h.lang === 'hi' ? tidy(parts.map((p) => p[1](vl)).join(' ')) : undefined;
  return { text, ...(alt ? { alt } : {}), lang: h.lang, ...h.voice };
}

export function announce(style: AnnouncerStyle, kind: SpeechKind, ctx: AnnounceCtx): SpeechLine | null {
  const line = style === 'classic' ? classic(kind, ctx) : hosted(style, kind, ctx);
  return line && line.text ? line : null;
}

/** Whether the style has a host line for every part of the auction (classic only speaks the bidding itself). */
export const hostsEverything = (style: AnnouncerStyle) => style !== 'classic';
