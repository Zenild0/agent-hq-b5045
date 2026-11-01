// Shared between the server (authoritative) and the web app (display only).

export type DrawMode = 'random' | 'sequential' | 'manual';
export type MoneyStyle = 'indian' | 'western';

/** From `from` upwards (inclusive), every bid goes up by `step`. */
export interface IncrementTier {
  from: number;
  step: number;
}

export interface DisplayOptions {
  showPhoto: boolean;
  showDescription: boolean;
  showRole: boolean;
  showBasePrice: boolean;
}

/** A company's own branding: shown instead of the ZenoBid logo, always with "Powered by ZenoBid". */
export interface BrandSettings {
  logo: string; // the company logo (an uploaded image)
  eventLogo: string; // an optional second logo for this event
  eventLogoStyle: 'side' | 'banner'; // beside the company logo, or as a wide banner across the top
  color: string; // the brand colour (taken from the logo; can be changed)
}

export interface EventSettings {
  theme: string; // see shared/themes.ts
  mode: 'dark' | 'light'; // the look people see by default (each person can switch on their own device)
  brand: BrandSettings;
  name: string;
  sport: string;
  tagline: string;
  accent: string;
  symbol: string;
  moneyStyle: MoneyStyle;
  defaultBudget: number;
  defaultBasePrice: number;
  increments: IncrementTier[];
  display: DisplayOptions;
  drawMode: DrawMode;
  minSquad: number; // 0 = no minimum
  maxSquad: number; // 0 = unlimited
  reserveRule: boolean; // keep enough purse to still reach minSquad
  totalRounds: number;
}

/** 'price' = highest price first; 'added' = in the order they were bought (first bought at the top). */
export type SquadSort = 'price' | 'added';

export type PlayerStatus = 'available' | 'sold' | 'unsold';

export interface Player {
  id: string;
  name: string;
  role: string;
  description: string;
  photo: string;
  basePrice: number; // 0 = use the event default
  status: PlayerStatus;
  teamId: string | null;
  price: number;
  soldRound: number;
  /** When the player was sold (for the "latest buys" feed). Missing on very old saves. */
  soldAt?: number;
  order: number;
}

export interface Captain {
  id: string;
  name: string;
  team: string;
  color: string;
  logo: string;
  budget: number; // total purse; spent is derived from sold players
}

export interface Bid {
  captainId: string;
  amount: number;
  at: number;
  byHost: boolean;
}

export type Phase = 'idle' | 'spinning' | 'bidding' | 'sold' | 'unsold';

export interface SpinInfo {
  targetId: string;
  candidates: string[]; // player ids shown on the wheel
  startedAt: number;
  endsAt: number;
}

export interface LiveResult {
  kind: 'sold' | 'unsold';
  playerId: string;
  captainId?: string;
  price?: number;
}

export type LiveEventType =
  | 'spin' | 'reveal' | 'bid' | 'call' | 'sold' | 'unsold' | 'undo' | 'idle' | 'round'
  | 'break' | 'breakext' | 'breakend' | 'practice';

export interface LiveEvent {
  seq: number;
  type: LiveEventType;
  at: number;
  playerId?: string;
  captainId?: string;
  amount?: number;
  call?: number;
}

/** A timed pause between players so captains can plan. */
export interface BreakState {
  startedAt: number;
  endsAt: number;
  label: string;
}

export interface LiveState {
  phase: Phase;
  playerId: string | null;
  bids: Bid[];
  call: 0 | 1 | 2 | 3;
  spin: SpinInfo | null;
  result: LiveResult | null;
  screen: 'stage' | 'board';
  /** How every team's list of players is ordered on the big screen and the team board. */
  squadSort: SquadSort;
  break: BreakState | null;
  seq: number;
  lastEvent: LiveEvent | null;
}

export interface LogItem {
  at: number;
  text: string;
}

export interface EventData {
  code: string;
  createdAt: number;
  settings: EventSettings;
  players: Player[];
  captains: Captain[];
  round: number;
  live: LiveState;
  log: LogItem[];
  /** A practice run is in progress: nothing in it touches the real auction. */
  practice: boolean;
}

/** A captain's private plan for one player. */
export interface StrategyItem {
  playerId: string;
  budget: number; // the most they plan to pay
  note: string;
}

export interface Secrets {
  adminKey: string;
  hostKey: string;
  captainTokens: Record<string, string>;
}

export type Role = 'admin' | 'host' | 'captain' | 'viewer';

export interface Me {
  role: Role;
  captainId?: string;
}

/** What every connected client receives. */
/** (The activity log stays on the server — no screen shows it, and it was a sizeable part of every update.) */
export interface Snapshot extends Omit<EventData, 'log'> {
  now: number;
  me: Me;
  presence: { captains: string[]; viewers: number };
  /** Only sent to the admin. */
  secrets?: Secrets;
  /** Only sent to a captain: their own plan. */
  strategy?: StrategyItem[];
}
