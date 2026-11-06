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
/** 'lull' is not an event: it is the host's comment when nobody has bid for a few seconds (see LULL_MS). */
export type SpeechKind = 'spin' | 'reveal' | 'bid' | 'call' | 'sold' | 'unsold' | 'undo' | 'break' | 'breakext' | 'breakend' | 'round' | 'lull';
export const SPEECH_KINDS: readonly SpeechKind[] = ['spin', 'reveal', 'bid', 'call', 'sold', 'unsold', 'undo', 'break', 'breakext', 'breakend', 'round'];
export const isSpeechKind = (v: unknown): v is SpeechKind => SPEECH_KINDS.includes(v as SpeechKind);
/** How long the room must be quiet (no new bid) before the host comments. */
export const LULL_MS = 5000;

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

// ---- after a quiet moment: the host's comment ----------------------------------------------------------
// A bid itself is just "<team>, <amount>". If nobody bids for a few seconds, the host says ONE comment to push the
// room: before the first bid ("open"), or about the standing bid, more excited the hotter the bidding (heat 0–3);
// sometimes aimed at the team that was just outbid ("rival").

interface Lull { open: Pair[]; heat: Pair[][]; rival: Pair[] }

const LULL: Record<Exclude<AnnouncerStyle, 'classic'>, Lull> = {
  wwe: {
    open: [en(() => `Who's going to start this one?! Somebody make a move!`), en((v) => `${v.p} is waiting! Who wants to throw the first bid?!`), en(() => `Come on! Don't be shy! Who's opening?!`), en(() => `The ring is empty! Somebody get in there!`)],
    heat: [
      [en((v) => `${v.t} is the only one in the ring at ${v.a}! Anybody else?!`), en((v) => `${v.a} from ${v.t}... is that it?! Who's next?!`), en((v) => `Come on! ${v.t} can't have it that easy!`), en((v) => `Is nobody going to challenge ${v.t}?!`)],
      [en((v) => `${v.t} holds it at ${v.a}! Who's got the guts?!`), en(() => `The bid stands! Do I hear more?!`), en((v) => `${v.a}! Is anybody stepping up?!`), en((v) => `${v.t} is waiting for a challenger!`)],
      [en((v) => `What a fight! ${v.t} leads at ${v.a}! Who's next?!`), en(() => `This crowd wants MORE! Anybody?!`), en((v) => `${v.t} is on top... but for how long?!`), en((v) => `Somebody answer ${v.t}!`)],
      [en((v) => `This is a WAR! ${v.t} sits at ${v.a}! Who dares to go higher?!`), en(() => `Unbelievable bidding! Is there anybody left standing?!`), en((v) => `${v.t} at ${v.a}! The crowd is going insane!`), en((v) => `Will anybody top ${v.a}?! Come on!`)],
    ],
    rival: [en((v) => `${v.r}, are you just going to let ${v.t} have this?!`), en((v) => `${v.r}! Your move!`), en((v) => `${v.r}, it's now or never!`)],
  },
  kbc: {
    open: [
      hi(() => `तो देवियों और सज्जनों... कौन लगाएगा पहली बोली?`, () => `To deviyon aur sajjano... kaun lagaayega pehli boli?`),
      hi((v) => `${v.p} आपका इंतज़ार कर रहे हैं... कोई तो बोली लगाइए!`, (v) => `${v.p} aapka intezaar kar rahe hain... koi to boli lagaiye!`),
      hi(() => `सोचिए मत... बोली लगाइए!`, () => `Sochiye mat... boli lagaiye!`),
      hi(() => `मंच तैयार है... बस आपकी बोली का इंतज़ार है!`, () => `Manch taiyaar hai... bas aapki boli ka intezaar hai!`),
    ],
    heat: [
      [hi((v) => `${v.t} की बोली... ${v.a}. क्या कोई और है?`, (v) => `${v.t} ki boli... ${v.a}. Kya koi aur hai?`), hi((v) => `बस ${v.t}? और कोई नहीं?`, (v) => `Bas ${v.t}? Aur koi nahin?`), hi((v) => `${v.a} पर अटकी है बोली... कोई आगे आएगा?`, (v) => `${v.a} par atki hai boli... koi aage aayega?`)],
      [hi((v) => `${v.t} आगे हैं... ${v.a}. कोई चुनौती देगा?`, (v) => `${v.t} aage hain... ${v.a}. Koi chunauti dega?`), hi((v) => `बोली ${v.t} के पास है... और आप?`, (v) => `Boli ${v.t} ke paas hai... aur aap?`), hi(() => `समय निकल रहा है... कोई और बोली?`, () => `Samay nikal raha hai... koi aur boli?`)],
      [hi((v) => `क्या मुक़ाबला है! ${v.t} आगे हैं ${v.a} पर... अब कौन?`, (v) => `Kya muqaabla hai! ${v.t} aage hain ${v.a} par... ab kaun?`), hi(() => `माहौल गरम है... कोई और हिम्मत करेगा?`, () => `Maahaul garam hai... koi aur himmat karega?`), hi((v) => `${v.t} ने बाज़ी पकड़ी हुई है... कोई छीनेगा?`, (v) => `${v.t} ne baazi pakdi hui hai... koi chheenega?`)],
      [hi((v) => `देवियों और सज्जनों, यह बोली इतिहास बना रही है! ${v.t}, ${v.a}... क्या कोई और?`, (v) => `Deviyon aur sajjano, yeh boli itihaas bana rahi hai! ${v.t}, ${v.a}... kya koi aur?`), hi((v) => `दिल थाम के बैठिए... कौन देगा ${v.t} को टक्कर?`, (v) => `Dil thaam ke baithiye... kaun dega ${v.t} ko takkar?`), hi(() => `अविश्वसनीय मुक़ाबला! क्या यह आख़िरी बोली है?`, () => `Avishvasneeya muqaabla! Kya yeh aakhiri boli hai?`)],
    ],
    rival: [hi((v) => `${v.r}, क्या आप हार मान लेंगे?`, (v) => `${v.r}, kya aap haar maan lenge?`), hi((v) => `${v.r}, आपकी बारी है!`, (v) => `${v.r}, aapki baari hai!`)],
  },
  mk: {
    open: [en(() => `Who will step into the arena first?`), en(() => `The arena waits... who dares?`), en((v) => `${v.p} stands alone... challenge them.`)],
    heat: [
      [en((v) => `${v.t} stands alone at ${v.a}... who will fight?`), en((v) => `No challenger for ${v.t}?`), en((v) => `${v.a}... the arena is silent.`)],
      [en((v) => `${v.t} holds the arena at ${v.a}. Who dares?`), en((v) => `Is there no one to face ${v.t}?`), en((v) => `The challenge stands... ${v.a}.`)],
      [en((v) => `${v.t} leads at ${v.a}... the battle rages on. Who's next?`), en(() => `Fight back! Or fall!`), en((v) => `${v.t} awaits the next challenger...`)],
      [en((v) => `Legendary battle! ${v.t} at ${v.a}... who will strike next?`), en(() => `The arena trembles! Any warrior left?`), en((v) => `${v.a}... only the brave go higher!`)],
    ],
    rival: [en((v) => `${v.r}... will you surrender?`), en((v) => `${v.r}... fight back!`)],
  },
  show: {
    open: [en(() => `Who's going to buzz in first? Come on, don't be shy!`), en((v) => `${v.p} is up for grabs! Who wants to play?`), en(() => `The board is empty! Let's get a bid!`)],
    heat: [
      [en((v) => `${v.t} is the only one on the board at ${v.a}! Anybody else want to play?`), en((v) => `Just ${v.t} so far! Come on, everybody!`), en((v) => `${v.a} from ${v.t}... do I hear another buzzer?`)],
      [en((v) => `${v.t} is in the lead at ${v.a}! Who's next?`), en(() => `Ooh, the clock is ticking! Any more bids?`), en((v) => `${v.t} has it for now! Anybody?`)],
      [en((v) => `What a round! ${v.t} leads at ${v.a}! Who's going to buzz in?`), en(() => `The board is hot! Any more?`), en((v) => `${v.t} is on top... can anybody beat it?`)],
      [en((v) => `This is the round of the night! ${v.t} at ${v.a}! Who's still playing?`), en(() => `Oh my goodness! Anybody going higher?!`), en((v) => `${v.t} at ${v.a}! Is that your final answer, everybody?`)],
    ],
    rival: [en((v) => `${v.r}, are you going to let that go?!`), en((v) => `${v.r}, buzz in!`)],
  },
  velvet: {
    open: [en(() => `Mmm... nobody yet? Somebody start us off.`), en((v) => `${v.p} is waiting... don't be shy.`), en(() => `Who's first? I'm listening.`)],
    heat: [
      [en((v) => `Just ${v.t}, at ${v.a}... anyone else?`), en((v) => `Only ${v.t}... how lonely.`), en((v) => `${v.a}... is that all?`)],
      [en((v) => `${v.t} has it, at ${v.a}... for now.`), en(() => `Anyone else feeling brave?`), en((v) => `Mmm... ${v.t} is ahead. Who's next?`)],
      [en((v) => `${v.t} at ${v.a}... it's getting warm in here. Anyone?`), en(() => `Don't stop now...`), en((v) => `${v.t} leads... are you going to let them?`)],
      [en((v) => `${v.t} at ${v.a}... irresistible. Anyone dare go higher?`), en(() => `Oh, this is fun. Who's next?`), en(() => `I could watch this all night... anyone?`)],
    ],
    rival: [en((v) => `${v.r}... you're not giving up, are you?`), en((v) => `${v.r}... your move, darling.`)],
  },
  trailer: {
    open: [en(() => `In a world... where no one has bid yet...`), en(() => `One player... waiting for a team.`), en(() => `Who... will make the first move?`)],
    heat: [
      [en((v) => `${v.t}... stands alone. At ${v.a}.`), en((v) => `One bid... ${v.a}. Will anyone answer?`), en(() => `Silence... falls over the auction.`)],
      [en((v) => `${v.t} leads... at ${v.a}. But the story... isn't over.`), en((v) => `Who... will challenge ${v.t}?`), en(() => `The stakes... are rising.`)],
      [en((v) => `The battle... rages on. ${v.t}, at ${v.a}.`), en(() => `Every team... must choose. Now.`), en((v) => `${v.t} holds on... for now.`)],
      [en((v) => `The bidding war... of the century. ${v.t}, at ${v.a}. Who's next?`), en(() => `Only the bold... go higher.`), en(() => `This is... the final act.`)],
    ],
    rival: [en((v) => `${v.r}... must decide. Fight... or fall.`), en((v) => `${v.r}... your story... isn't over.`)],
  },
  cricket: {
    open: [
      hi(() => `पहली गेंद का इंतज़ार! कौन खोलेगा खाता?`, () => `Pehli gend ka intezaar! Kaun kholega khaata?`),
      hi((v) => `${v.p} क्रीज़ पर खड़े हैं! कोई तो बोली लगाओ!`, (v) => `${v.p} crease par khade hain! Koi to boli lagao!`),
      hi(() => `फ़ील्डिंग सेट है... अब बोली का इंतज़ार!`, () => `Fielding set hai... ab boli ka intezaar!`),
    ],
    heat: [
      [hi((v) => `${v.t} ने खाता खोला, ${v.a}! कोई और बल्लेबाज़?`, (v) => `${v.t} ne khaata khola, ${v.a}! Koi aur ballebaaz?`), hi((v) => `अभी सिर्फ़ ${v.t}! बाक़ी टीमें कहाँ हैं?`, (v) => `Abhi sirf ${v.t}! Baaki teamein kahaan hain?`), hi((v) => `${v.a} पर डॉट बॉल! कोई रन लेगा?`, (v) => `${v.a} par dot ball! Koi run lega?`)],
      [hi((v) => `${v.t} आगे, ${v.a}! अगला शॉट कौन लगाएगा?`, (v) => `${v.t} aage, ${v.a}! Agla shot kaun lagaayega?`), hi(() => `रन रेट बढ़ रहा है! और बोली?`, () => `Run rate badh raha hai! Aur boli?`), hi((v) => `${v.t} क्रीज़ पर जमे हुए! कोई आउट करेगा?`, (v) => `${v.t} crease par jame hue! Koi out karega?`)],
      [hi((v) => `क्या मैच है! ${v.t} आगे, ${v.a}! कौन मारेगा अगला छक्का?`, (v) => `Kya match hai! ${v.t} aage, ${v.a}! Kaun maarega agla chhakka?`), hi(() => `स्टेडियम शोर से गूँज रहा है! और बोली?`, () => `Stadium shor se goonj raha hai! Aur boli?`), hi(() => `दबाव बढ़ रहा है! कौन झुकेगा?`, () => `Dabaav badh raha hai! Kaun jhukega?`)],
      [hi((v) => `आख़िरी ओवर जैसा रोमांच! ${v.t}, ${v.a}! कोई और?`, (v) => `Aakhiri over jaisa romaanch! ${v.t}, ${v.a}! Koi aur?`), hi(() => `सुपर ओवर! कौन मारेगा विनिंग शॉट?`, () => `Super over! Kaun maarega winning shot?`), hi(() => `यह बोली आसमान में! क्या कोई और ऊपर जाएगा?`, () => `Yeh boli aasmaan mein! Kya koi aur upar jaayega?`)],
    ],
    rival: [hi((v) => `${v.r}, जवाबी हमला कब?`, (v) => `${v.r}, jawaabi hamla kab?`), hi((v) => `${v.r} को चाहिए एक बड़ा शॉट!`, (v) => `${v.r} ko chahiye ek bada shot!`)],
  },
  assistant: {
    open: [en((v) => `No bids yet for ${v.p}. The base price is ${v.a}.`), en(() => `Waiting for the first bid.`), en((v) => `${v.p} is still open. Would anyone like to start the bidding?`)],
    heat: [
      [en((v) => `${v.t} has the only bid so far, at ${v.a}.`), en((v) => `The current bid is ${v.a}, from ${v.t}. Any other bids?`), en((v) => `Only one bid so far: ${v.t}.`)],
      [en((v) => `${v.t} leads at ${v.a}. Any more bids?`), en((v) => `Current bid: ${v.a}, ${v.t}.`), en(() => `There's still time to bid.`)],
      [en((v) => `${v.t} is ahead at ${v.a}. The bidding is active.`), en((v) => `Still with ${v.t} at ${v.a}. Anyone else?`)],
      [en((v) => `${v.t} leads at ${v.a}, well above the base price. Any more bids?`), en((v) => `This one is popular. ${v.t}, ${v.a}. Anyone higher?`)],
    ],
    rival: [en((v) => `${v.r}, would you like to bid again?`)],
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
  if (kind === 'lull' && c.allIn) out.push(one(h.allIn));
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

/** Hosts whose plain bid line ends calmly ("Red, 40 lakh.") rather than with a shout. */
const CALM = new Set<AnnouncerStyle>(['velvet', 'trailer', 'assistant']);

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
      // just the team and the bid, nothing else
      if (c.team && c.amount) line = CALM.has(style) ? [(v) => `${v.t}, ${v.a}.`, (v) => `${v.t}, ${v.a}.`] : [(v) => `${v.t}, ${v.a}!`, (v) => `${v.t}, ${v.a}!`];
      break;
    case 'lull': {
      // the room has gone quiet: one comment to push it
      const L = LULL[style];
      if (!c.team || !(c.bids ?? 0)) line = c.player ? pick(L.open, c.variant) : undefined;
      else line = pick([...L.heat[Math.min(heat, L.heat.length - 1)], ...(c.rival && heat >= 1 ? L.rival : [])], c.variant);
      break;
    }
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
  const brisk = kind === 'bid' || kind === 'call' || kind === 'undo' || kind === 'lull';
  const tidy = (x: string) => (brisk ? x.replace(/\.\.\.\s*(?=[!?.,]|$)/g, '').replace(/\.\.\.\s*/g, ', ') : x);
  const text = tidy(parts.map((p) => p[0](vd)).join(' '));
  const alt = h.lang === 'hi' ? tidy(parts.map((p) => p[1](vl)).join(' ')) : undefined;
  return { text, ...(alt ? { alt } : {}), lang: h.lang, ...h.voice };
}

export function announce(style: AnnouncerStyle, kind: SpeechKind, ctx: AnnounceCtx): SpeechLine | null {
  const line = style === 'classic' ? classic(kind, ctx) : hosted(style, kind, ctx);
  return line && line.text ? line : null;
}

// ---- voice direction: how each line should be PERFORMED ---------------------------------------------------
// The expressive voices (server/tts.ts) are actors: with each line they get the host's personality brief and a
// director's note for this exact moment. The note follows the emotional arc of a live auction: anticipation when a
// player comes up, energy that climbs with every bid, suspense through the calls, release and celebration on SOLD,
// sympathy for no sale, and cheeky, personal provocation when the room goes quiet. Pace stays natural (never slowed
// down or sped up): emotion comes from tone, emphasis, energy and pauses, the way a great host does it.

const PERSONA: Record<Exclude<AnnouncerStyle, 'classic'>, string> = {
  wwe: 'You are a legendary arena ring announcer with an enormous, deep, booming bass voice and total command of the crowd. Larger than life: you punch every team name, stretch the big words for effect, and make every bid sound like a main event.',
  kbc: 'You are a much-loved Hindi TV quiz-show host with a deep, rich, warm baritone and impeccable Hindi diction (a natural Indian Hindi accent, never an English one). You speak to the audience like family: gracious, dramatic, a master of suspense who leans into pauses, then lights up with genuine warmth and delight.',
  mk: 'You are the narrator of a brutal, legendary fighting tournament: a very deep, gravelly, menacing voice, full of dark power and theatrical intensity. You growl the quiet words and ROAR the big ones. Every bid is a strike in battle.',
  show: 'You are a glamorous, bubbly prime-time game-show host with a huge smile in your voice: sparkling, playful, warm and genuinely thrilled for every contestant. You squeal a little at big moments and cheer people on.',
  velvet: 'You are a smooth, sultry late-night radio host: a low, warm, intimate voice, unhurried and confident, with a playful, teasing charm and a knowing smile. Classy and alluring, never explicit.',
  trailer: 'You are an epic Hollywood movie-trailer narrator: a very deep, gravelly voice with enormous cinematic gravitas, ominous weight and dramatic pauses, as if every bid were the plot twist of the year.',
  cricket: 'You are a wildly passionate Hindi cricket commentator in a packed, roaring stadium (a natural Indian Hindi accent, Hindi and Hinglish, never an English accent). Explosive, joyful and emotional: your voice soars and cracks with excitement, you celebrate like every bid is a six in the last over, and you live every moment with the crowd.',
  assistant: 'You are a friendly, warm and clear voice assistant: upbeat, helpful and calm, with a smile in your voice and a touch of excitement for big moments.',
};

const ENERGY = ['calm but upbeat', 'lively and rising', 'high, thrilled', 'explosive, breathless, at the very top of your energy'];

/** The director's note for one line: who the host is, what this moment feels like, and how to deliver it. */
export function voiceDirection(style: AnnouncerStyle, kind: SpeechKind, c: AnnounceCtx): string {
  if (style === 'classic') return '';
  const heat = heatOf(c);
  const hindi = STYLES.find((x) => x.id === style)?.lang === 'hi';
  let moment = '';
  switch (kind) {
    case 'spin': moment = 'The wheel is spinning to pick the next player. Build curious, excited anticipation, as if leaning towards the audience.'; break;
    case 'reveal': moment = 'A new player has just come up. Introduce them grandly, with pride and anticipation, then invite the bidding with a smile.'; break;
    case 'bid': moment = `A team has just placed a bid. Announce the team and the amount crisply and with punch, like a live sports call. Energy: ${ENERGY[heat]}${heat >= 2 ? '; the room is in a bidding war, let the thrill come through' : ''}.`; break;
    case 'call': {
      const n = c.call ?? 1;
      moment = n === 1 ? 'First call: firm, expectant, building suspense.' : n === 2 ? 'Second call: more tension, urgent, almost a warning, holding the room in suspense.' : 'Final call: maximum suspense and drama, the decisive moment.';
      if (style === 'mk' && n === 3) moment += ' ROAR the last words with full menace.';
      break;
    }
    case 'sold': moment = heat >= 2 ? 'SOLD after a fierce bidding war! Release all the built-up tension in an explosive, triumphant celebration, full of joy and admiration.' : 'SOLD! Celebrate with proud, happy triumph and congratulate the team warmly.'; break;
    case 'unsold': moment = 'Nobody bid for this player. Sound genuinely disappointed but kind and sympathetic, with a soft sigh, and a hint of hope for next time.'; break;
    case 'undo': moment = 'A bid has just been taken back. Sound surprised, then make the correction quickly and with a little drama.'; break;
    case 'lull': moment = !c.team || !(c.bids ?? 0)
      ? 'Nobody has bid yet. Playfully and personally challenge the room to make the first move: warm, teasing, encouraging.'
      : `The room has gone quiet after this bid. Talk directly to the teams: tease, provoke and dare them to go higher, cheeky and conversational, with a smile. Energy: ${ENERGY[heat]}.`; break;
    case 'break': moment = 'Announce a short strategy break: relaxed, friendly, a little conspiratorial.'; break;
    case 'breakext': moment = 'The break is being extended: easy-going and friendly.'; break;
    case 'breakend': moment = 'The break is over: an energetic, delighted welcome back.'; break;
    case 'round': moment = 'A brand-new round is starting: a big, celebratory announcement full of fresh energy.'; break;
  }
  return `${PERSONA[style]} ${moment} Speak at a natural, normal talking pace (not slowed down, not rushed): put the emotion into tone, emphasis and energy.${hindi ? ' Speak in Hindi with a natural Indian accent; English words such as team names are said the Indian way.' : ''} Say only the given words.`;
}

/** What "Hear it" plays: a bid, then the host's comment when the room goes quiet (classic: just the bid). */
export function sampleLine(style: AnnouncerStyle): SpeechLine | null {
  const bid = announce(style, 'bid', SAMPLE_CTX);
  const comment = style === 'classic' ? null : announce(style, 'lull', SAMPLE_CTX);
  if (!bid || !comment) return bid;
  return { ...bid, text: `${bid.text} ${comment.text}`, ...(bid.alt ? { alt: `${bid.alt} ${comment.alt ?? ''}`.trim() } : {}) };
}

/** Whether the style has a host line for every part of the auction (classic only speaks the bidding itself). */
export const hostsEverything = (style: AnnouncerStyle) => style !== 'classic';
