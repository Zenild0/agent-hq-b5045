// server/index.ts
import express from "express";
import { randomBytes as randomBytes3 } from "node:crypto";
import { existsSync as existsSync3, mkdirSync as mkdirSync2, readdirSync as readdirSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "node:fs";
import path3 from "node:path";
import { WebSocketServer } from "ws";

// shared/limits.ts
var LIMITS = {
  teams: 32,
  // bidders (captains) per auction
  players: 500,
  // players per auction
  photos: 1e3,
  // uploaded photos per auction
  photoBytes: 1024 * 1024,
  // 1 MB per photo (the app shrinks photos before uploading)
  logoBytes: 1024 * 1024
  // 1 MB per brand logo
};

// server/engine.ts
import { randomBytes, randomInt } from "node:crypto";

// shared/money.ts
var INDIAN = [
  { v: 1e7, s: " Cr", dec: 2 },
  { v: 1e5, s: " L", dec: 2 }
];
var WESTERN = [
  { v: 1e6, s: "M", dec: 3 },
  { v: 1e3, s: "K", dec: 2 }
];
function group(n, style) {
  return Math.round(n).toLocaleString(style === "indian" ? "en-IN" : "en-US");
}
function withSymbol(body, symbol) {
  if (!symbol) return body;
  return /^[A-Za-z]+$/.test(symbol) ? `${body} ${symbol}` : `${symbol}${body}`;
}
function formatMoney(amount, fmt) {
  const n = Math.round(amount);
  const units = fmt.moneyStyle === "indian" ? INDIAN : WESTERN;
  if (n < 0) return "-" + formatMoney(-n, fmt);
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

// shared/themes.ts
var THEMES = [
  { id: "midnight-gold", name: "Midnight Gold", group: "Classic", hue: 224, sat: 70, accent: "#f2b84b", accent2: "#2f6bff", pattern: "grid", font: "sora", classic: true },
  { id: "ocean-deep", name: "Ocean Deep", group: "Classic", hue: 200, sat: 65, accent: "#2dd4bf", accent2: "#60a5fa", pattern: "grid", font: "sora" },
  { id: "monochrome", name: "Monochrome", group: "Classic", hue: 220, sat: 6, accent: "#e5e7eb", accent2: "#94a3b8", pattern: "none", font: "sora" },
  { id: "stadium-night", name: "Stadium Night", group: "Sports", hue: 150, sat: 42, accent: "#ffd23f", accent2: "#35d07f", pattern: "stripes", font: "sora" },
  { id: "cricket", name: "Cricket", group: "Sports", hue: 140, sat: 38, accent: "#f4d35e", accent2: "#e63946", pattern: "stripes", font: "sora" },
  { id: "football", name: "Football", group: "Sports", hue: 125, sat: 45, accent: "#b8f400", accent2: "#ffffff", pattern: "stripes", font: "orbitron" },
  { id: "basketball", name: "Basketball", group: "Sports", hue: 22, sat: 45, accent: "#ff8a1f", accent2: "#ffd166", pattern: "lines", font: "sora" },
  { id: "racing", name: "Racing", group: "Sports", hue: 355, sat: 40, accent: "#ff2d2d", accent2: "#ffd400", pattern: "diagonal", font: "orbitron" },
  { id: "arctic-ice", name: "Arctic Ice", group: "Sports", hue: 205, sat: 50, accent: "#7dd3fc", accent2: "#38bdf8", pattern: "dots", font: "sora" },
  { id: "parchment", name: "Parchment", group: "Antique", hue: 32, sat: 38, accent: "#c9a24d", accent2: "#b4513f", pattern: "lines", font: "playfair" },
  { id: "royal-court", name: "Royal Court", group: "Antique", hue: 275, sat: 45, accent: "#d4af37", accent2: "#b794f6", pattern: "dots", font: "cinzel" },
  { id: "old-library", name: "Old Library", group: "Antique", hue: 165, sat: 35, accent: "#c5a059", accent2: "#7fb69e", pattern: "lines", font: "playfair" },
  { id: "terminal-green", name: "Terminal Green", group: "Stock market", hue: 150, sat: 22, accent: "#00e676", accent2: "#29b6f6", pattern: "grid", font: "mono" },
  { id: "trading-amber", name: "Trading Amber", group: "Stock market", hue: 32, sat: 18, accent: "#ffb000", accent2: "#00b3ff", pattern: "grid", font: "mono" },
  { id: "broadsheet", name: "Broadsheet", group: "Stock market", hue: 24, sat: 28, accent: "#0fa3b1", accent2: "#e2672b", pattern: "lines", font: "playfair" },
  { id: "halloween", name: "Halloween", group: "Festive", hue: 268, sat: 38, accent: "#ff7a00", accent2: "#a855f7", pattern: "diagonal", font: "cinzel" },
  { id: "black-friday", name: "Black Friday", group: "Festive", hue: 0, sat: 4, accent: "#ffd60a", accent2: "#ff3b30", pattern: "diagonal", font: "sora" },
  { id: "christmas", name: "Christmas", group: "Festive", hue: 148, sat: 45, accent: "#f5c542", accent2: "#e63946", pattern: "dots", font: "playfair" },
  { id: "neon-arcade", name: "Neon Arcade", group: "More", hue: 268, sat: 60, accent: "#ff2ec4", accent2: "#22d3ee", pattern: "grid", font: "orbitron" },
  { id: "synthwave", name: "Synthwave", group: "More", hue: 285, sat: 55, accent: "#ff7a59", accent2: "#c77dff", pattern: "stripes", font: "orbitron" },
  { id: "sunset-blaze", name: "Sunset Blaze", group: "More", hue: 14, sat: 48, accent: "#ff7b00", accent2: "#ff3d71", pattern: "diagonal", font: "sora" },
  { id: "forest-trail", name: "Forest Trail", group: "More", hue: 112, sat: 30, accent: "#a3e635", accent2: "#86efac", pattern: "dots", font: "sora" },
  { id: "rose-quartz", name: "Rose Quartz", group: "More", hue: 338, sat: 35, accent: "#fb7185", accent2: "#f0abfc", pattern: "dots", font: "sora" },
  { id: "ruby", name: "Ruby", group: "More", hue: 350, sat: 55, accent: "#ffd166", accent2: "#ff4d6d", pattern: "grid", font: "sora" },
  { id: "emerald-city", name: "Emerald City", group: "More", hue: 162, sat: 50, accent: "#34d399", accent2: "#fde047", pattern: "grid", font: "sora" },
  { id: "copper-forge", name: "Copper Forge", group: "More", hue: 18, sat: 30, accent: "#e08a4b", accent2: "#5eead4", pattern: "diagonal", font: "sora" },
  { id: "cherry-blossom", name: "Cherry Blossom", group: "More", hue: 330, sat: 32, accent: "#f472b6", accent2: "#a78bfa", pattern: "dots", font: "sora" },
  { id: "desert-dunes", name: "Desert Dunes", group: "More", hue: 35, sat: 32, accent: "#f59e0b", accent2: "#14b8a6", pattern: "diagonal", font: "sora" },
  { id: "aurora", name: "Aurora", group: "More", hue: 238, sat: 55, accent: "#5eead4", accent2: "#a78bfa", pattern: "grid", font: "sora" }
];
var BRAND_THEME_ID = "brand";
var themeIds = [...THEMES.map((t) => t.id), BRAND_THEME_ID];

// shared/rules.ts
function stepFor(increments, current) {
  let step = increments[0]?.step ?? 1;
  for (const t of increments) {
    if (current >= t.from) step = t.step;
  }
  return step;
}
function effectiveBase(settings, player) {
  return player.basePrice > 0 ? player.basePrice : settings.defaultBasePrice;
}
function nextBidAmount(settings, player, bids) {
  const top = bids[bids.length - 1];
  if (!top) return effectiveBase(settings, player);
  return top.amount + stepFor(settings.increments, top.amount);
}
function teamStats(data, captain) {
  const players = data.players.filter((p) => p.status === "sold" && p.teamId === captain.id);
  const spent = players.reduce((sum, p) => sum + p.price, 0);
  return { spent, remaining: captain.budget - spent, count: players.length, players };
}
function maxBid(data, captain, excludePlayerId) {
  const { settings } = data;
  const { remaining, count } = teamStats(data, captain);
  if (!settings.reserveRule || settings.minSquad <= 0) return remaining;
  const slotsAfterThis = Math.max(0, settings.minSquad - count - 1);
  if (slotsAfterThis === 0) return remaining;
  const cheapest = data.players.filter((p) => p.status !== "sold" && p.id !== excludePlayerId).map((p) => effectiveBase(settings, p)).sort((a, b) => a - b).slice(0, slotsAfterThis);
  return remaining - cheapest.reduce((a, b) => a + b, 0);
}
function checkBid(data, captain, amount) {
  const { live, settings } = data;
  const player = data.players.find((p) => p.id === live.playerId);
  if (live.phase !== "bidding" || !player) return { ok: false, reason: "Bidding is not open" };
  const { count } = teamStats(data, captain);
  if (settings.maxSquad > 0 && count >= settings.maxSquad) return { ok: false, reason: "Your squad is full" };
  const top = live.bids[live.bids.length - 1];
  if (top?.captainId === captain.id) return { ok: false, reason: "You hold the top bid" };
  const limit = maxBid(data, captain, player.id);
  if (amount > limit) return { ok: false, reason: "Over your budget" };
  return { ok: true };
}
function sortedTiers(tiers) {
  return [...tiers].sort((a, b) => a.from - b.from);
}

// server/engine.ts
var AuctionError = class extends Error {
  status;
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
};
var freeAccess = () => ({ status: "free", price: 0, by: "", ref: "", payer: "", requestedAt: 0, decidedAt: 0 });
var isOpen = (a) => a.status === "free" || a.status === "unlocked";
function normalizeStore(store) {
  store.strategies ??= {};
  store.stash ??= null;
  store.access ??= freeAccess();
  store.data.practice ??= false;
  store.data.live.break ??= null;
  store.data.live.squadSort ??= "price";
  const st = store.data.settings;
  st.theme ??= DEFAULT_SETTINGS.theme;
  st.mode ??= "dark";
  st.brand ??= { ...DEFAULT_SETTINGS.brand };
  return store;
}
var SPIN_MS = 7e3;
var MAX_PLAYERS = LIMITS.players;
var MAX_CAPTAINS = LIMITS.teams;
var WHEEL_SLICES = 24;
var COLORS = ["#ff3d81", "#29e0ff", "#ffc933", "#7cf29a", "#b388ff", "#ff8a3d", "#4d8bff", "#f25cf0"];
var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(length) {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}
var uid = () => randomBytes(4).toString("hex");
var secretKey = () => randomBytes(12).toString("base64url");
var DEFAULT_SETTINGS = {
  theme: "midnight-gold",
  mode: "dark",
  brand: { logo: "", eventLogo: "", eventLogoStyle: "side", color: "#2f6bff" },
  name: "Office Premier League",
  sport: "Cricket",
  tagline: "The Zeno team auction",
  accent: "#ffc933",
  symbol: "\u20B9",
  moneyStyle: "indian",
  defaultBudget: 12e7,
  // 12 Cr
  defaultBasePrice: 2e6,
  // 20 L
  increments: [
    { from: 0, step: 5e5 },
    // +5 L
    { from: 1e7, step: 1e6 }
    // +10 L once the bid reaches 1 Cr
  ],
  display: { showPhoto: true, showDescription: true, showRole: true, showBasePrice: true },
  drawMode: "random",
  minSquad: 0,
  maxSquad: 0,
  reserveRule: false,
  totalRounds: 2
};
var str = (v, fallback, max = 120) => typeof v === "string" ? v.trim().slice(0, max) : fallback;
var num = (v, fallback, min = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= min ? Math.round(n) : fallback;
};
var bool = (v, fallback) => typeof v === "boolean" ? v : fallback;
function mergeSettings(base, patch) {
  const p = patch && typeof patch === "object" ? patch : {};
  const next = { ...base, display: { ...base.display }, brand: { ...base.brand } };
  next.name = str(p.name, base.name, 80) || base.name;
  next.sport = str(p.sport, base.sport, 40) || base.sport;
  next.tagline = str(p.tagline, base.tagline, 140);
  if (typeof p.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(p.accent)) next.accent = p.accent;
  next.symbol = str(p.symbol, base.symbol, 5);
  if (p.moneyStyle === "indian" || p.moneyStyle === "western") next.moneyStyle = p.moneyStyle;
  next.defaultBudget = num(p.defaultBudget, base.defaultBudget, 1);
  next.defaultBasePrice = num(p.defaultBasePrice, base.defaultBasePrice, 1);
  if (p.drawMode === "random" || p.drawMode === "sequential" || p.drawMode === "manual") next.drawMode = p.drawMode;
  next.minSquad = num(p.minSquad, base.minSquad, 0);
  next.maxSquad = num(p.maxSquad, base.maxSquad, 0);
  next.reserveRule = bool(p.reserveRule, base.reserveRule);
  next.totalRounds = Math.max(1, num(p.totalRounds, base.totalRounds, 1));
  if (typeof p.theme === "string" && themeIds.includes(p.theme)) next.theme = p.theme;
  if (p.mode === "dark" || p.mode === "light") next.mode = p.mode;
  if (p.brand && typeof p.brand === "object") {
    const b = p.brand;
    const pic = (v, old) => typeof v === "string" ? v === "" || /^\/uploads\/[A-Z0-9]{6}\/[A-Za-z0-9]+\.(jpg|png|webp)$/.test(v) || /^https:\/\/[^\s"'<>]{1,280}$/.test(v) ? v : old : old;
    next.brand = {
      logo: pic(b.logo, base.brand.logo),
      eventLogo: pic(b.eventLogo, base.brand.eventLogo),
      eventLogoStyle: b.eventLogoStyle === "banner" ? "banner" : b.eventLogoStyle === "side" ? "side" : base.brand.eventLogoStyle,
      color: typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : base.brand.color
    };
  }
  if (p.display && typeof p.display === "object") {
    const d = p.display;
    next.display = {
      showPhoto: bool(d.showPhoto, base.display.showPhoto),
      showDescription: bool(d.showDescription, base.display.showDescription),
      showRole: bool(d.showRole, base.display.showRole),
      showBasePrice: bool(d.showBasePrice, base.display.showBasePrice)
    };
  }
  if (Array.isArray(p.increments)) {
    const tiers = p.increments.map((t) => ({ from: num(t?.from, -1, 0), step: num(t?.step, -1, 1) })).filter((t) => t.from >= 0 && t.step > 0);
    if (tiers.length === 0) throw new AuctionError("Add at least one bid increment");
    const sorted = sortedTiers(tiers);
    if (sorted[0].from !== 0) sorted[0] = { ...sorted[0], from: 0 };
    next.increments = sorted;
  }
  return next;
}
function createStore(code, settingsPatch, now = Date.now(), gate = { required: false, price: 0 }) {
  const settings = mergeSettings(DEFAULT_SETTINGS, settingsPatch);
  return {
    access: gate.required ? { ...freeAccess(), status: "locked", price: gate.price } : freeAccess(),
    data: {
      code,
      createdAt: now,
      settings,
      players: [],
      captains: [],
      round: 1,
      live: emptyLive(),
      log: [{ at: now, text: `Auction \u201C${settings.name}\u201D created` }],
      practice: false
    },
    secrets: { adminKey: secretKey(), hostKey: secretKey(), captainTokens: {} },
    strategies: {},
    stash: null
  };
}
function emptyLive() {
  return { phase: "idle", playerId: null, bids: [], call: 0, spin: null, result: null, screen: "stage", squadSort: "price", break: null, seq: 0, lastEvent: null };
}
function emit(d, type, now, extra = {}) {
  d.live.seq += 1;
  d.live.lastEvent = { seq: d.live.seq, type, at: now, ...extra };
}
function note(d, text3, now) {
  d.log.push({ at: now, text: text3 });
  if (d.log.length > 300) d.log.splice(0, d.log.length - 300);
}
var fmtOf = (d) => d.settings;
var money = (d, n) => formatMoney(n, fmtOf(d));
function getPlayer(d, id) {
  const p = d.players.find((x) => x.id === id);
  if (!p) throw new AuctionError("Player not found", 404);
  return p;
}
function getCaptain(d, id) {
  const c = d.captains.find((x) => x.id === id);
  if (!c) throw new AuctionError("Team not found", 404);
  return c;
}
function currentPlayer(d) {
  return d.live.playerId ? d.players.find((p) => p.id === d.live.playerId) ?? null : null;
}
function tick(store, now) {
  const { live } = store.data;
  let changed = false;
  if (live.phase === "spinning" && live.spin && now >= live.spin.endsAt) {
    live.phase = "bidding";
    emit(store.data, "reveal", live.spin.endsAt, { playerId: live.playerId ?? void 0 });
    changed = true;
  }
  if (live.break && now >= live.break.endsAt) {
    const at = live.break.endsAt;
    live.break = null;
    emit(store.data, "breakend", at);
    changed = true;
  }
  return changed;
}
function nextDue(store) {
  const { live } = store.data;
  const times = [];
  if (live.phase === "spinning" && live.spin) times.push(live.spin.endsAt);
  if (live.break) times.push(live.break.endsAt);
  return times.length ? Math.min(...times) : null;
}
var rank = { viewer: 0, captain: 1, host: 2, admin: 3 };
function allowed(actor, access) {
  if (access === "captainOnly") return actor.role === "captain" && !!actor.captainId;
  if (access === "captain") return actor.role === "captain" || actor.role === "host" || actor.role === "admin";
  return rank[actor.role] >= rank[access];
}
var ROSTER_LOCKED = /* @__PURE__ */ new Set(["captain.add", "captain.budget", "captains.topup", "captain.remove", "player.add", "players.import", "player.update", "player.remove", "demo.load"]);
var GO_LIVE = /* @__PURE__ */ new Set(["draw", "pick"]);
var actions = {};
var on = (name, access, run) => {
  actions[name] = { access, run };
};
function runAction(store, actor, name, params, now = Date.now()) {
  const action = typeof name === "string" && Object.hasOwn(actions, name) ? actions[name] : void 0;
  if (!action) throw new AuctionError(`Unknown action \u201C${String(name).slice(0, 40)}\u201D`, 404);
  if (!allowed(actor, action.access)) throw new AuctionError("You are not allowed to do that", 403);
  if (GO_LIVE.has(name) && !store.data.practice && !isOpen(store.access))
    throw new AuctionError("This auction is not unlocked yet. The admin can unlock it under Settings \u2192 Unlock to go live. Practice runs are free.", 402);
  if (store.data.practice && ROSTER_LOCKED.has(name))
    throw new AuctionError("Teams and players are locked during a practice run \u2014 click \u201CGo live\u201D first to edit them");
  tick(store, now);
  const p = params && typeof params === "object" ? params : {};
  return action.run(store, p, actor, now);
}
on("settings.update", "admin", ({ data }, p) => {
  data.settings = mergeSettings(data.settings, p.patch);
});
on("captain.add", "admin", ({ data, secrets }, p, _a, now) => {
  if (data.captains.length >= MAX_CAPTAINS) throw new AuctionError(`Up to ${MAX_CAPTAINS} teams per auction`);
  const team = str(p.team, "", 60);
  if (!team) throw new AuctionError("Team name is required");
  const c = {
    id: uid(),
    team,
    name: str(p.name, "", 60),
    color: typeof p.color === "string" && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : COLORS[data.captains.length % COLORS.length],
    logo: str(p.logo, "", 300),
    budget: num(p.budget, data.settings.defaultBudget, 0)
  };
  data.captains.push(c);
  secrets.captainTokens[c.id] = randomCode(6);
  note(data, `Team ${c.team} joined with ${money(data, c.budget)}`, now);
  return { id: c.id };
});
on("captain.update", "admin", ({ data }, p) => {
  const c = getCaptain(data, p.id);
  if (p.team !== void 0) c.team = str(p.team, c.team, 60) || c.team;
  if (p.name !== void 0) c.name = str(p.name, c.name, 60);
  if (p.logo !== void 0) c.logo = str(p.logo, c.logo, 300);
  if (typeof p.color === "string" && /^#[0-9a-fA-F]{6}$/.test(p.color)) c.color = p.color;
});
on("captain.budget", "admin", ({ data }, p, _a, now) => {
  const c = getCaptain(data, p.id);
  const amount = num(p.amount, NaN, 0);
  if (!Number.isFinite(amount)) throw new AuctionError("Enter an amount");
  const before = c.budget;
  if (p.mode === "add") c.budget += amount;
  else if (p.mode === "subtract") c.budget = Math.max(0, c.budget - amount);
  else if (p.mode === "set") c.budget = amount;
  else throw new AuctionError("Unknown budget mode");
  note(data, `${c.team} purse ${money(data, before)} \u2192 ${money(data, c.budget)}`, now);
});
on("captains.topup", "admin", ({ data }, p, _a, now) => {
  const amount = typeof p.amount === "number" ? Math.round(p.amount) : NaN;
  if (!Number.isFinite(amount) || amount === 0) throw new AuctionError("Enter an amount");
  for (const c of data.captains) c.budget = Math.max(0, c.budget + amount);
  note(data, `All purses ${amount > 0 ? "increased" : "reduced"} by ${money(data, Math.abs(amount))}`, now);
});
on("captain.rotateToken", "admin", ({ data, secrets }, p) => {
  const c = getCaptain(data, p.id);
  secrets.captainTokens[c.id] = randomCode(6);
});
on("captain.remove", "admin", (store, p, _a, now) => {
  const { data, secrets } = store;
  const c = getCaptain(data, p.id);
  const top = data.live.bids[data.live.bids.length - 1];
  if (data.live.phase === "bidding" && data.live.bids.some((b) => b.captainId === c.id) && top)
    throw new AuctionError("This team has bids on the current player \u2014 undo them first");
  if (data.live.phase === "sold" && data.live.playerId && (data.live.result?.captainId === c.id || data.live.bids.some((b) => b.captainId === c.id)))
    dropFromBlock(data, data.live.playerId, now);
  for (const pl of data.players) {
    if (pl.teamId === c.id) resetPlayer(pl);
  }
  data.captains = data.captains.filter((x) => x.id !== c.id);
  delete secrets.captainTokens[c.id];
  delete store.strategies[c.id];
  note(data, `Team ${c.team} removed`, now);
});
function newPlayer(d, src) {
  const name = str(src.name, "", 80);
  if (!name) throw new AuctionError("Player name is required");
  return {
    id: uid(),
    name,
    role: str(src.role, "", 40),
    description: str(src.description, "", 400),
    photo: str(src.photo, "", 400),
    basePrice: num(src.basePrice, 0, 0),
    status: "available",
    teamId: null,
    price: 0,
    soldRound: 0,
    soldAt: 0,
    order: d.players.reduce((m, p) => Math.max(m, p.order), 0) + 1
  };
}
on("player.add", "admin", ({ data }, p) => {
  if (data.players.length >= MAX_PLAYERS) throw new AuctionError(`Up to ${MAX_PLAYERS} players per auction`);
  const pl = newPlayer(data, p);
  data.players.push(pl);
  return { id: pl.id };
});
on("players.import", "admin", ({ data }, p, _a, now) => {
  const rows = Array.isArray(p.rows) ? p.rows : [];
  if (rows.length === 0) throw new AuctionError("Nothing to import");
  const skipped = [];
  let added = 0;
  let updated = 0;
  let assigned = 0;
  for (const row of rows) {
    const name = str(row?.name, "", 80);
    if (!name) {
      skipped.push("(a row without a name)");
      continue;
    }
    const existing = data.players.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (existing && data.live.playerId === existing.id && data.live.phase !== "idle") {
      skipped.push(`${name} (on the block right now)`);
      continue;
    }
    if (!existing && data.players.length >= MAX_PLAYERS) {
      skipped.push(`${name} (limit of ${MAX_PLAYERS} players reached)`);
      continue;
    }
    let pl;
    if (existing) {
      pl = existing;
      if (str(row.role, "", 40)) pl.role = str(row.role, "", 40);
      if (str(row.description, "", 400)) pl.description = str(row.description, "", 400);
      if (str(row.photo, "", 400)) pl.photo = str(row.photo, "", 400);
      if (num(row.basePrice, 0, 0) > 0) pl.basePrice = num(row.basePrice, 0, 0);
      updated++;
    } else {
      pl = newPlayer(data, row);
      data.players.push(pl);
      added++;
    }
    const teamName = str(row.team, "", 60).toLowerCase();
    if (teamName) {
      const c = data.captains.find((x) => x.team.toLowerCase() === teamName || x.name.toLowerCase() === teamName);
      if (c) {
        pl.status = "sold";
        pl.teamId = c.id;
        pl.price = num(row.price, effectiveBase(data.settings, pl), 0);
        pl.soldRound = data.round;
        pl.soldAt = now;
        assigned++;
      } else {
        skipped.push(`${pl.name} (team \u201C${row.team}\u201D not found \u2014 left unassigned)`);
      }
    }
  }
  note(data, `Imported players: ${added} added, ${updated} updated${assigned ? `, ${assigned} placed on teams` : ""}`, now);
  return { added, updated, assigned, skipped };
});
on("player.update", "admin", ({ data }, p) => {
  const pl = getPlayer(data, p.id);
  const patch = p.patch ?? {};
  if (patch.name !== void 0) pl.name = str(patch.name, pl.name, 80) || pl.name;
  if (patch.role !== void 0) pl.role = str(patch.role, pl.role, 40);
  if (patch.description !== void 0) pl.description = str(patch.description, pl.description, 400);
  if (patch.photo !== void 0) pl.photo = str(patch.photo, pl.photo, 400);
  if (patch.basePrice !== void 0) pl.basePrice = num(patch.basePrice, pl.basePrice, 0);
});
var resetPlayer = (pl) => Object.assign(pl, { status: "available", teamId: null, price: 0, soldRound: 0, soldAt: 0 });
function dropFromBlock(d, id, now) {
  if (d.live.playerId !== id || d.live.phase === "idle") return false;
  clearBlock(d);
  emit(d, "idle", now);
  return true;
}
on("player.remove", "admin", ({ data, strategies }, p, _a, now) => {
  const pl = getPlayer(data, p.id);
  dropFromBlock(data, pl.id, now);
  data.players = data.players.filter((x) => x.id !== pl.id);
  for (const id of Object.keys(strategies)) strategies[id] = strategies[id].filter((i) => i.playerId !== pl.id);
});
on("player.assign", "admin", ({ data }, p, _a, now) => {
  const pl = getPlayer(data, p.id);
  const c = getCaptain(data, p.captainId);
  dropFromBlock(data, pl.id, now);
  pl.status = "sold";
  pl.teamId = c.id;
  pl.price = num(p.price, effectiveBase(data.settings, pl), 0);
  pl.soldRound = data.round;
  pl.soldAt = now;
  note(data, `${pl.name} assigned to ${c.team} for ${money(data, pl.price)}`, now);
});
on("player.release", "admin", ({ data }, p, _a, now) => {
  const pl = getPlayer(data, p.id);
  dropFromBlock(data, pl.id, now);
  resetPlayer(pl);
  note(data, `${pl.name} released back to the pool`, now);
});
on("player.setStatus", "admin", ({ data }, p, _a, now) => {
  const pl = getPlayer(data, p.id);
  switch (p.status) {
    case "available":
      dropFromBlock(data, pl.id, now);
      resetPlayer(pl);
      note(data, `${pl.name} set to: in the pool`, now);
      break;
    case "unsold":
      dropFromBlock(data, pl.id, now);
      resetPlayer(pl);
      pl.status = "unsold";
      note(data, `${pl.name} set to: unsold`, now);
      break;
    case "block":
      assertNoBreak(data);
      if (data.captains.length < 2) throw new AuctionError("Add at least two teams before starting");
      if (pl.status === "sold") resetPlayer(pl);
      putOnBlock(data, pl, null, now);
      note(data, `${pl.name} put on the block`, now);
      break;
    default:
      throw new AuctionError("Choose in the pool, on the block or unsold \u2014 use Assign to mark someone sold");
  }
});
var poolOf = (d, role) => d.players.filter((p) => p.status === "available" && (!role || p.role.toLowerCase() === role.toLowerCase())).sort((a, b) => a.order - b.order);
function assertNoBreak(d) {
  if (d.live.break) throw new AuctionError("A strategy break is running \u2014 end it first");
}
function assertCanDraw(d) {
  assertNoBreak(d);
  if (d.live.phase === "spinning" || d.live.phase === "bidding") throw new AuctionError("Finish the current player first");
  if (d.captains.length < 2) throw new AuctionError("Add at least two teams before starting");
}
function clearBlock(d) {
  d.live.playerId = null;
  d.live.bids = [];
  d.live.call = 0;
  d.live.spin = null;
  d.live.result = null;
  d.live.phase = "idle";
}
function putOnBlock(d, player, spin, now) {
  clearBlock(d);
  d.live.playerId = player.id;
  if (spin) {
    d.live.phase = "spinning";
    d.live.spin = spin;
    emit(d, "spin", now, { playerId: player.id });
  } else {
    d.live.phase = "bidding";
    emit(d, "reveal", now, { playerId: player.id });
  }
}
function drawFromPool(d, now, mode, role) {
  assertCanDraw(d);
  const pool = poolOf(d, role);
  if (pool.length === 0) throw new AuctionError(role ? `No \u201C${role}\u201D players left in this round` : `No players left in round ${d.round}`);
  const how = mode ?? d.settings.drawMode;
  if (how === "manual") throw new AuctionError("Pick a player from the list");
  if (how === "sequential") {
    putOnBlock(d, pool[0], null, now);
    return;
  }
  const target = pool[randomInt(pool.length)];
  const others = pool.filter((p) => p.id !== target.id);
  for (let i = others.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [others[i], others[j]] = [others[j], others[i]];
  }
  const candidates = [target.id, ...others.slice(0, WHEEL_SLICES - 1).map((p) => p.id)];
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  putOnBlock(d, target, { targetId: target.id, candidates, startedAt: now, endsAt: now + SPIN_MS }, now);
}
on("draw", "host", ({ data }, p, _a, now) => {
  drawFromPool(data, now, typeof p.mode === "string" ? p.mode : void 0, typeof p.role === "string" && p.role ? p.role : void 0);
});
on("pick", "host", ({ data }, p, _a, now) => {
  assertCanDraw(data);
  const pl = getPlayer(data, p.playerId);
  if (pl.status === "sold") throw new AuctionError(`${pl.name} is already on a team`);
  putOnBlock(data, pl, null, now);
});
on("next", "host", ({ data }, _p, _a, now) => {
  const phase = data.live.phase;
  if (phase !== "sold" && phase !== "unsold") throw new AuctionError("Nothing to move on from");
  clearBlock(data);
  emit(data, "idle", now);
  if (data.settings.drawMode !== "manual" && poolOf(data).length > 0) drawFromPool(data, now, void 0);
});
on("bid", "captain", (store, p, actor, now) => {
  const { data } = store;
  const live = data.live;
  const player = currentPlayer(data);
  if (live.phase !== "bidding" || !player) throw new AuctionError("Bidding is not open right now");
  const byHost = actor.role !== "captain";
  const captainId = byHost ? p.captainId : actor.captainId;
  const captain = getCaptain(data, captainId);
  const min = nextBidAmount(data.settings, player, live.bids);
  const amount = p.amount === void 0 ? min : num(p.amount, NaN, 0);
  if (!Number.isFinite(amount)) throw new AuctionError("Invalid bid amount");
  if (amount < min) throw new AuctionError(`Too late \u2014 the bid is already at ${money(data, live.bids[live.bids.length - 1]?.amount ?? 0)}. Next bid: ${money(data, min)}`);
  const block = checkBid(data, captain, amount);
  if (!block.ok) throw new AuctionError(block.reason);
  live.bids.push({ captainId: captain.id, amount, at: now, byHost });
  live.call = 0;
  emit(data, "bid", now, { captainId: captain.id, amount, playerId: player.id });
  return { amount };
});
on("undoBid", "host", ({ data }, _p, _a, now) => {
  if (data.live.phase !== "bidding") throw new AuctionError("Bidding is not open");
  if (data.live.bids.length === 0) throw new AuctionError("No bids to undo");
  data.live.bids.pop();
  data.live.call = 0;
  emit(data, "undo", now);
});
on("call", "host", ({ data }, _p, _a, now) => {
  const live = data.live;
  if (live.phase !== "bidding") throw new AuctionError("Bidding is not open");
  if (live.bids.length === 0) throw new AuctionError("No bids yet \u2014 wait for an opening bid, or mark the player unsold");
  if (live.call >= 3) throw new AuctionError("Final call already made \u2014 sell it!");
  live.call = live.call + 1;
  emit(data, "call", now, { call: live.call });
});
on("sold", "host", ({ data }, _p, _a, now) => {
  const live = data.live;
  const player = currentPlayer(data);
  if (live.phase !== "bidding" || !player) throw new AuctionError("Bidding is not open");
  const top = live.bids[live.bids.length - 1];
  if (!top) throw new AuctionError("No bids \u2014 mark the player unsold instead");
  const captain = getCaptain(data, top.captainId);
  if (teamStats(data, captain).remaining < top.amount)
    throw new AuctionError(`${captain.team} can no longer afford ${money(data, top.amount)} \u2014 undo the bid or top up their purse`);
  player.status = "sold";
  player.teamId = captain.id;
  player.price = top.amount;
  player.soldRound = data.round;
  player.soldAt = now;
  live.phase = "sold";
  live.result = { kind: "sold", playerId: player.id, captainId: captain.id, price: top.amount };
  emit(data, "sold", now, { playerId: player.id, captainId: captain.id, amount: top.amount });
  note(data, `SOLD: ${player.name} \u2192 ${captain.team} for ${money(data, top.amount)}`, now);
});
on("unsold", "host", ({ data }, _p, _a, now) => {
  const live = data.live;
  const player = currentPlayer(data);
  if (live.phase !== "bidding" || !player) throw new AuctionError("Bidding is not open");
  if (live.bids.length > 0) throw new AuctionError("There are bids on this player \u2014 undo them first");
  player.status = "unsold";
  live.phase = "unsold";
  live.result = { kind: "unsold", playerId: player.id };
  emit(data, "unsold", now, { playerId: player.id });
  note(data, `UNSOLD: ${player.name}`, now);
});
on("reopen", "host", ({ data }, _p, _a, now) => {
  const live = data.live;
  const player = currentPlayer(data);
  if (live.phase !== "sold" && live.phase !== "unsold" || !player) throw new AuctionError("Nothing to reopen");
  Object.assign(player, { status: "available", teamId: null, price: 0, soldRound: 0, soldAt: 0 });
  live.result = null;
  live.phase = "bidding";
  live.call = 0;
  emit(data, "undo", now);
  note(data, `${player.name} re-opened for bidding`, now);
});
on("unblock", "host", ({ data }, _p, _a, now) => {
  const pl = currentPlayer(data);
  if (data.live.phase === "idle" || !pl) throw new AuctionError("Nobody is on the block");
  const hadBids = data.live.bids.length;
  if (pl.status !== "available") resetPlayer(pl);
  clearBlock(data);
  emit(data, "idle", now);
  note(data, `${pl.name} sent back to the pool${hadBids ? ` (${hadBids} bid${hadBids === 1 ? "" : "s"} discarded)` : ""}`, now);
});
on("round.next", "host", ({ data }, _p, _a, now) => {
  assertNoBreak(data);
  if (data.live.phase === "spinning" || data.live.phase === "bidding") throw new AuctionError("Finish the current player first");
  const unsold = data.players.filter((p) => p.status === "unsold");
  if (unsold.length === 0) throw new AuctionError("There are no unsold players to carry over");
  for (const p of unsold) p.status = "available";
  data.round += 1;
  clearBlock(data);
  emit(data, "round", now);
  note(data, `Round ${data.round} started with ${unsold.length} unsold players`, now);
});
on("screen.set", "host", ({ data }, p) => {
  data.live.screen = p.screen === "board" ? "board" : "stage";
});
on("squad.sort", "host", ({ data }, p) => {
  data.live.squadSort = p.sort === "added" ? "added" : "price";
});
on("reset", "admin", ({ data }, _p, _a, now) => {
  for (const p of data.players) Object.assign(p, { status: "available", teamId: null, price: 0, soldRound: 0 });
  data.round = 1;
  const { screen, seq, squadSort } = data.live;
  data.live = { ...emptyLive(), screen, seq, squadSort };
  emit(data, "idle", now);
  note(data, data.practice ? "Practice restarted" : "Auction reset", now);
});
on("break.start", "host", ({ data }, p, _a, now) => {
  const live = data.live;
  if (live.break) throw new AuctionError("A break is already running");
  if (live.phase === "spinning" || live.phase === "bidding")
    throw new AuctionError("Finish the current player (or send them back to the pool) before a break");
  const seconds = Number(p.seconds);
  if (!Number.isFinite(seconds) || seconds < 10 || seconds > 7200) throw new AuctionError("Choose a break between 10 seconds and 2 hours");
  clearBlock(data);
  live.break = { startedAt: now, endsAt: now + Math.round(seconds) * 1e3, label: str(p.label, "Strategy break", 60) || "Strategy break" };
  emit(data, "break", now, { amount: Math.round(seconds) });
  note(data, `Strategy break started (${Math.round(seconds)} s)`, now);
});
on("break.extend", "host", ({ data }, p, _a, now) => {
  const b = data.live.break;
  if (!b) throw new AuctionError("There is no break running");
  const seconds = Math.round(Number(p.seconds ?? 60));
  if (!Number.isFinite(seconds) || seconds < 5 || seconds > 3600) throw new AuctionError("Add between 5 seconds and 1 hour");
  b.endsAt = Math.min(b.endsAt + seconds * 1e3, now + 72e5);
  emit(data, "breakext", now, { amount: seconds });
});
on("break.end", "host", ({ data }, _p, _a, now) => {
  if (!data.live.break) throw new AuctionError("There is no break running");
  data.live.break = null;
  emit(data, "breakend", now);
  note(data, "Strategy break ended early", now);
});
on("practice.start", "admin", (store, _p, _a, now) => {
  const { data } = store;
  if (data.practice) throw new AuctionError("A practice run is already going");
  if (data.captains.length < 2 || data.players.length === 0) throw new AuctionError("Add at least two teams and some players first");
  store.stash = structuredClone({
    players: data.players,
    budgets: Object.fromEntries(data.captains.map((c) => [c.id, c.budget])),
    round: data.round,
    live: data.live,
    log: data.log
  });
  for (const pl of data.players) resetPlayer(pl);
  data.round = 1;
  const { screen, seq, squadSort } = data.live;
  data.live = { ...emptyLive(), screen, seq, squadSort };
  data.log = [];
  data.practice = true;
  emit(data, "practice", now);
  note(data, "Practice run started \u2014 nothing here affects the real auction", now);
});
on("practice.end", "admin", (store, _p, _a, now) => {
  const { data, stash } = store;
  if (!data.practice) throw new AuctionError("No practice run is going");
  if (stash) {
    data.players = stash.players;
    for (const c of data.captains) if (stash.budgets[c.id] !== void 0) c.budget = stash.budgets[c.id];
    data.round = stash.round;
    data.log = stash.log;
    const seq = data.live.seq;
    data.live = { ...stash.live, seq };
  } else {
    for (const pl of data.players) resetPlayer(pl);
    data.round = 1;
    data.live = { ...emptyLive(), screen: data.live.screen, seq: data.live.seq, squadSort: data.live.squadSort };
  }
  store.stash = null;
  data.practice = false;
  emit(data, "practice", now);
});
var planOf = (store, actor) => {
  const c = getCaptain(store.data, actor.captainId);
  return store.strategies[c.id] ??= [];
};
on("strategy.add", "captainOnly", (store, p, actor) => {
  const pl = getPlayer(store.data, p.playerId);
  const plan = planOf(store, actor);
  if (pl.status === "sold") throw new AuctionError(`${pl.name} has already been sold`);
  if (plan.some((i) => i.playerId === pl.id)) throw new AuctionError(`${pl.name} is already in your plan`);
  if (plan.length >= 100) throw new AuctionError("Your plan is full (100 players)");
  plan.push({ playerId: pl.id, budget: num(p.budget, effectiveBase(store.data.settings, pl), 0), note: str(p.note, "", 140) });
});
on("strategy.update", "captainOnly", (store, p, actor) => {
  const item = planOf(store, actor).find((i) => i.playerId === p.playerId);
  if (!item) throw new AuctionError("That player is not in your plan", 404);
  if (p.budget !== void 0) item.budget = num(p.budget, item.budget, 0);
  if (p.note !== void 0) item.note = str(p.note, item.note, 140);
});
on("strategy.remove", "captainOnly", (store, p, actor) => {
  store.strategies[actor.captainId] = planOf(store, actor).filter((i) => i.playerId !== p.playerId);
});
var DEMO_PLAYERS = [
  ["Aarav Mehta", "Batter", "Opens the innings and never leaves the crease."],
  ["Rohan Iyer", "Bowler", "Yorker specialist. Terrifying in the last five."],
  ["Priya Nair", "All-rounder", "Handy with both bat and ball \u2014 the office MVP."],
  ["Kabir Singh", "Batter", "Big hitter. Has broken two windows this season."],
  ["Ananya Rao", "Wicketkeeper", "Quick hands, sharper tongue."],
  ["Vikram Shah", "Bowler", "Left-arm spin that nobody can read."],
  ["Meera Kapoor", "All-rounder", "Captain material. Calm under pressure."],
  ["Arjun Das", "Batter", "Anchors the innings with grit."],
  ["Sneha Pillai", "Bowler", "Swing queen. Moves it both ways."],
  ["Dev Malhotra", "Batter", "Highest strike rate in the building."],
  ["Isha Verma", "All-rounder", "Fields like a cat, hits like a truck."],
  ["Karan Joshi", "Bowler", "Pace and bounce. Needs ice after every spell."],
  ["Tanya Bose", "Batter", "Elegant cover drives all day."],
  ["Nikhil Reddy", "Wicketkeeper", "Stumps a batter before they blink."],
  ["Zara Khan", "All-rounder", "Plays for the highlight reel."],
  ["Harsh Vora", "Bowler", "Death-over specialist."],
  ["Pooja Menon", "Batter", "Consistent. Boringly, wonderfully consistent."],
  ["Rahul Gupta", "Bowler", "Off-spin with a doosra nobody asked for."],
  ["Simran Kaur", "All-rounder", "Wins matches from nowhere."],
  ["Aditya Pandey", "Batter", "Left-hander with a lovely flick."],
  ["Neha Saxena", "Bowler", "Slower balls. Many, many slower balls."],
  ["Yash Thakur", "Batter", "Finisher. Cool as ice."],
  ["Divya Chawla", "All-rounder", "Does a bit of everything, brilliantly."],
  ["Manav Kulkarni", "Wicketkeeper", "Loud behind the stumps."]
];
on("demo.load", "admin", ({ data, secrets }, _p, _a, now) => {
  if (data.captains.length === 0) {
    for (const team of ["Royal Rockets", "Thunder Hawks", "Neon Ninjas", "Blaze Bulls"]) {
      const c = { id: uid(), team, name: "", color: COLORS[data.captains.length % COLORS.length], logo: "", budget: data.settings.defaultBudget };
      data.captains.push(c);
      secrets.captainTokens[c.id] = randomCode(6);
    }
  }
  if (data.players.length === 0) {
    for (const [name, role, description] of DEMO_PLAYERS) data.players.push(newPlayer(data, { name, role, description }));
  }
  note(data, "Sample teams and players loaded", now);
});

// server/archive.ts
import { randomBytes as randomBytes2 } from "node:crypto";

// server/platform.ts
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { existsSync as existsSync2, readFileSync as readFileSync2, renameSync as renameSync2, writeFileSync as writeFileSync2 } from "node:fs";
import path2 from "node:path";

// server/persist.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
var DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(PROJECT_ROOT, "data"));
var EVENTS_DIR = path.join(DATA_DIR, "events");
var UPLOADS_DIR = path.join(DATA_DIR, "uploads");
mkdirSync(EVENTS_DIR, { recursive: true });
mkdirSync(UPLOADS_DIR, { recursive: true });
function loadAll() {
  const out = /* @__PURE__ */ new Map();
  for (const file of readdirSync(EVENTS_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const store = JSON.parse(readFileSync(path.join(EVENTS_DIR, file), "utf8"));
      out.set(store.data.code, normalizeStore(store));
    } catch (err) {
      console.error(`Could not load ${file}:`, err);
    }
  }
  return out;
}
var timers = /* @__PURE__ */ new Map();
function saveSoon(store) {
  const code = store.data.code;
  if (timers.has(code)) return;
  timers.set(
    code,
    setTimeout(() => {
      timers.delete(code);
      saveNow(store);
    }, 0)
  );
}
function saveNow(store) {
  const file = path.join(EVENTS_DIR, `${store.data.code}.json`);
  const tmp = `${file}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(store));
    renameSync(tmp, file);
  } catch (err) {
    console.error(`Could not save auction ${store.data.code}:`, err);
  }
}
function flushAll(stores) {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  for (const s of stores) saveNow(s);
}
function deleteEventFiles(code) {
  clearTimeout(timers.get(code));
  timers.delete(code);
  const file = path.join(EVENTS_DIR, `${code}.json`);
  rmSync(file, { force: true });
  rmSync(`${file}.tmp`, { force: true });
  rmSync(path.join(UPLOADS_DIR, code), { recursive: true, force: true });
}
function readUpload(code, fileName) {
  try {
    return readFileSync(path.join(UPLOADS_DIR, code, fileName));
  } catch {
    return null;
  }
}
function writeUploads(code, files) {
  if (files.size === 0) return;
  const dir = path.join(UPLOADS_DIR, code);
  mkdirSync(dir, { recursive: true });
  for (const [name, buf] of files) writeFileSync(path.join(dir, name), buf);
}

// server/platform.ts
var FILE = path2.join(DATA_DIR, "platform.json");
var DEV_KEY = process.env.DEV_KEY ?? "";
var devEnabled = () => DEV_KEY.length >= 12;
var EMPTY = { upiId: "", payeeName: "", price: 0, note: "", operatorName: "", contact: "" };
var cache = null;
function getPlatform() {
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...existsSync2(FILE) ? JSON.parse(readFileSync2(FILE, "utf8")) : {} };
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}
var text = (v, max) => typeof v === "string" ? v.trim().replace(/[\r\n]+/g, " ").slice(0, max) : "";
var UPI_ID = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,31}$/;
function savePlatform(input) {
  const p = input && typeof input === "object" ? input : {};
  const price = Number(p.price);
  if (!Number.isInteger(price) || price < 0 || price > 1e6) throw new AuctionError("The price must be a whole number of rupees, 0 or more.");
  const upiId = text(p.upiId, 80);
  if (price > 0 && !UPI_ID.test(upiId)) throw new AuctionError("Enter a valid UPI id like yourname@bank, or set the price to 0 to make everything free.");
  const next = {
    upiId,
    payeeName: text(p.payeeName, 60),
    price,
    note: text(p.note, 160),
    operatorName: text(p.operatorName, 80),
    contact: text(p.contact, 120)
  };
  const tmp = `${FILE}.tmp`;
  writeFileSync2(tmp, JSON.stringify(next, null, 2));
  renameSync2(tmp, FILE);
  cache = next;
  return next;
}
function currentGate() {
  const c = getPlatform();
  return { required: devEnabled() && c.price > 0 && UPI_ID.test(c.upiId), price: c.price };
}
function isDevKey(key) {
  if (!devEnabled() || typeof key !== "string" || !key) return false;
  const a = createHash("sha256").update(key).digest();
  const b = createHash("sha256").update(DEV_KEY).digest();
  return timingSafeEqual(a, b);
}
function refreshAccess(store) {
  const a = store.access;
  if ((a.status === "locked" || a.status === "pending") && !currentGate().required) {
    a.status = "free";
    a.decidedAt = Date.now();
  }
}
var unlockProof = (code, by) => devEnabled() ? createHmac("sha256", DEV_KEY).update(`zenobid-unlock:${code}:${by}`).digest("hex") : "";
function verifyUnlockProof(code, by, proof) {
  if (!devEnabled() || typeof proof !== "string" || proof.length !== 64) return false;
  const want = Buffer.from(unlockProof(code, by), "hex");
  const got = Buffer.from(proof, "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}

// server/archive.ts
var ARCHIVE_FORMAT = "zenobid-auction";
var ARCHIVE_VERSION = 1;
var MAX_PHOTO_BYTES = LIMITS.photoBytes;
var MAX_PHOTOS = LIMITS.photos;
var MIME_BY_EXT = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
var EXT_BY_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
var uploadName = (url, code) => {
  const m = new RegExp(`^/uploads/${code}/([A-Za-z0-9]+\\.(?:jpg|png|webp))$`).exec(url);
  return m ? m[1] : null;
};
function buildArchive(store, readPhoto, now = Date.now()) {
  const d = store.data;
  const real = store.stash;
  const players = JSON.parse(JSON.stringify(real ? real.players : d.players));
  const captains = JSON.parse(JSON.stringify(d.captains));
  if (real) {
    for (const c of captains) if (typeof real.budgets[c.id] === "number") c.budget = real.budgets[c.id];
  }
  const log = JSON.parse(JSON.stringify(real ? real.log : d.log));
  const photos = {};
  const grab = (url) => {
    const name = uploadName(url, d.code);
    if (!name || photos[name] || Object.keys(photos).length >= MAX_PHOTOS) return;
    const buf = readPhoto(name);
    if (buf && buf.length <= MAX_PHOTO_BYTES) photos[name] = `data:${MIME_BY_EXT[name.split(".")[1]]};base64,${buf.toString("base64")}`;
  };
  const settings = JSON.parse(JSON.stringify(d.settings));
  for (const p of players) grab(p.photo);
  for (const c of captains) grab(c.logo);
  if (settings.brand) for (const u of [settings.brand.logo, settings.brand.eventLogo]) grab(u);
  const neutral = (url) => {
    const name = uploadName(url, d.code);
    return name && photos[name] ? `photo:${name}` : /^https?:\/\//.test(url) ? url : "";
  };
  for (const p of players) p.photo = neutral(p.photo);
  for (const c of captains) c.logo = neutral(c.logo);
  if (settings.brand) {
    settings.brand.logo = neutral(settings.brand.logo);
    settings.brand.eventLogo = neutral(settings.brand.eventLogo);
  }
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exportedAt: now,
    note: 'ZenoBid auction file. Keep it safe: it contains team PINs. Restore it from the "Restore from file" button when creating an auction.',
    auction: {
      settings,
      round: real ? real.round : d.round,
      captains,
      players,
      log,
      captainPins: { ...store.secrets.captainTokens },
      strategies: JSON.parse(JSON.stringify(store.strategies)),
      sourceCode: d.code,
      unlock: store.access.status === "unlocked" && store.access.by ? { by: store.access.by, proof: unlockProof(d.code, store.access.by) } : null
    },
    photos
  };
}
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var text2 = (v, max, fallback = "") => typeof v === "string" ? v.trim().slice(0, max) : fallback;
var whole = (v, fallback = 0, min = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= min && n <= Number.MAX_SAFE_INTEGER ? Math.round(n) : fallback;
};
var COLOR = /^#[0-9a-fA-F]{6}$/;
var ID = /^[A-Za-z0-9_-]{1,40}$/;
var PIN = /^[A-Z0-9]{6}$/;
function restoreArchive(file, code, now = Date.now(), gate = { required: false, price: 0 }) {
  if (!isObj(file) || file.format !== ARCHIVE_FORMAT || !isObj(file.auction)) {
    throw new AuctionError("That does not look like a ZenoBid auction file.");
  }
  if (typeof file.version !== "number" || file.version > ARCHIVE_VERSION) {
    throw new AuctionError("That file was made by a newer version of ZenoBid \u2014 update the app first.");
  }
  const a = file.auction;
  const store = createStore(code, a.settings ?? {}, now, gate);
  const d = store.data;
  const photos = /* @__PURE__ */ new Map();
  const renamed = /* @__PURE__ */ new Map();
  if (isObj(file.photos)) {
    for (const [oldName, url] of Object.entries(file.photos)) {
      if (photos.size >= MAX_PHOTOS || typeof url !== "string") break;
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);
      if (!m) continue;
      const buf = Buffer.from(m[2], "base64");
      if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) continue;
      const fresh = `${randomBytes2(6).toString("hex")}.${EXT_BY_MIME[m[1]]}`;
      photos.set(fresh, buf);
      renamed.set(`photo:${oldName}`, `/uploads/${code}/${fresh}`);
    }
  }
  const pic = (v) => {
    const s = text2(v, 300);
    return renamed.get(s) ?? (/^https?:\/\//.test(s) ? s : "");
  };
  const rawSettings = isObj(a.settings) ? { ...a.settings } : {};
  if (isObj(rawSettings.brand)) rawSettings.brand = { ...rawSettings.brand, logo: pic(rawSettings.brand.logo), eventLogo: pic(rawSettings.brand.eventLogo) };
  d.settings = mergeSettings(DEFAULT_SETTINGS, rawSettings);
  const rawCaptains = Array.isArray(a.captains) ? a.captains : [];
  const seen = /* @__PURE__ */ new Set();
  const pins = isObj(a.captainPins) ? a.captainPins : {};
  const usedPins = /* @__PURE__ */ new Set();
  for (const rc of rawCaptains.slice(0, MAX_CAPTAINS)) {
    if (!isObj(rc) || !ID.test(String(rc.id)) || seen.has(rc.id)) continue;
    const team = text2(rc.team, 60);
    if (!team) continue;
    seen.add(rc.id);
    const c = {
      id: rc.id,
      team,
      name: text2(rc.name, 60),
      color: typeof rc.color === "string" && COLOR.test(rc.color) ? rc.color : "#4d8bff",
      logo: pic(rc.logo),
      budget: whole(rc.budget, d.settings.defaultBudget)
    };
    d.captains.push(c);
    let pin = typeof pins[c.id] === "string" ? pins[c.id].toUpperCase() : "";
    if (!PIN.test(pin) || usedPins.has(pin)) {
      pin = randomCode(6);
      while (usedPins.has(pin)) pin = randomCode(6);
    }
    usedPins.add(pin);
    store.secrets.captainTokens[c.id] = pin;
  }
  const rawPlayers = Array.isArray(a.players) ? a.players : [];
  const playerIds = /* @__PURE__ */ new Set();
  d.round = Math.max(1, whole(a.round, 1, 1));
  for (const rp of rawPlayers.slice(0, MAX_PLAYERS)) {
    if (!isObj(rp) || !ID.test(String(rp.id)) || playerIds.has(rp.id)) continue;
    const name = text2(rp.name, 80);
    if (!name) continue;
    playerIds.add(rp.id);
    let status = rp.status === "sold" || rp.status === "unsold" ? rp.status : "available";
    const teamId = status === "sold" && typeof rp.teamId === "string" && seen.has(rp.teamId) ? rp.teamId : null;
    if (status === "sold" && !teamId) status = "available";
    const p = {
      id: rp.id,
      name,
      role: text2(rp.role, 60),
      description: text2(rp.description, 400),
      photo: pic(rp.photo),
      basePrice: whole(rp.basePrice, 0),
      status,
      teamId,
      price: status === "sold" ? whole(rp.price, 0) : 0,
      soldRound: status === "sold" ? Math.max(1, whole(rp.soldRound, 1, 1)) : 0,
      order: d.players.length
    };
    if (status === "sold" && Number.isFinite(rp.soldAt)) p.soldAt = whole(rp.soldAt, now);
    d.players.push(p);
  }
  d.players.forEach((p, i) => p.order = i);
  const rawLog = Array.isArray(a.log) ? a.log : [];
  const log = [];
  for (const l of rawLog.slice(-300)) if (isObj(l) && typeof l.text === "string") log.push({ at: whole(l.at, now), text: l.text.slice(0, 300) });
  d.log = [...log, { at: now, text: `Auction restored from a saved file (${d.players.length} players, ${d.captains.length} teams)` }];
  if (gate.required && isObj(a.unlock) && typeof a.sourceCode === "string" && (a.unlock.by === "payment" || a.unlock.by === "grant") && verifyUnlockProof(a.sourceCode, a.unlock.by, a.unlock.proof)) {
    store.access = { ...store.access, status: "unlocked", by: a.unlock.by, decidedAt: now };
  }
  if (isObj(a.strategies)) {
    for (const [cid, items] of Object.entries(a.strategies)) {
      if (!seen.has(cid) || !Array.isArray(items)) continue;
      const clean = [];
      for (const it of items.slice(0, MAX_PLAYERS)) {
        if (isObj(it) && playerIds.has(it.playerId)) clean.push({ playerId: it.playerId, budget: whole(it.budget, 0), note: text2(it.note, 300) });
      }
      store.strategies[cid] = clean;
    }
  }
  return { store, photos };
}

// server/net.ts
function clientIp(remote, forwardedFor, trustProxy) {
  if (trustProxy && forwardedFor) {
    const parts = (Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor).split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return remote ?? "";
}

// server/index.ts
var PORT = Number(process.env.PORT ?? 8787);
var APP_ENV = process.env.APP_ENV === "test" ? "test" : "production";
var VERSION = process.env.APP_VERSION ?? (existsSync3("VERSION") ? readFileSync3("VERSION", "utf8").trim().slice(0, 80) : "dev");
var MAX_EVENTS = Number(process.env.MAX_EVENTS ?? 2e3);
var MAX_UPLOAD_BYTES = LIMITS.photoBytes;
var MAX_UPLOADS_PER_AUCTION = LIMITS.photos;
var MAX_SCREENS = Number(process.env.MAX_SCREENS ?? 250);
var events = loadAll();
console.log(`ZenoBid \xB7 data in ${DATA_DIR} \xB7 ${events.size} auction(s) loaded`);
if (process.env.NODE_ENV !== "production" && events.size > 0) {
  console.log("Your auctions \u2014 open on whichever address shows the app:");
  for (const s of events.values()) console.log(`  ${s.data.code}  ${s.data.settings.name}  \u2192  /e/${s.data.code}/admin?k=${s.secrets.adminKey}`);
}
var clients = /* @__PURE__ */ new Map();
var spinTimers = /* @__PURE__ */ new Map();
function resolveActor(store, key) {
  if (typeof key === "string" && key) {
    if (key === store.secrets.adminKey) return { role: "admin", isAdmin: true };
    if (key === store.secrets.hostKey) return { role: "host", isAdmin: false };
    for (const [captainId, token] of Object.entries(store.secrets.captainTokens)) {
      if (token === key.toUpperCase()) return { role: "captain", captainId, isAdmin: false };
    }
  }
  return { role: "viewer", isAdmin: false };
}
var BAD_KEY_LIMIT = Number(process.env.BAD_KEY_LIMIT ?? 120);
var badKeys = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of badKeys) if (now > e.reset) badKeys.delete(ip);
}, 5 * 6e4).unref();
function authorize(ip, store, key) {
  const actor = resolveActor(store, key);
  if (typeof key === "string" && key && actor.role === "viewer") {
    const now = Date.now();
    let e = badKeys.get(ip);
    if (!e || now > e.reset) badKeys.set(ip, e = { count: 0, reset: now + 6e4 });
    if (++e.count > BAD_KEY_LIMIT) throw new AuctionError("Too many wrong keys from this connection \u2014 wait a minute and try again.", 429);
  }
  return actor;
}
function presenceOf(code) {
  const set = clients.get(code) ?? /* @__PURE__ */ new Set();
  const captains = /* @__PURE__ */ new Set();
  for (const c of set) if (c.me.captainId) captains.add(c.me.captainId);
  return { captains: [...captains], viewers: set.size };
}
function unlockInfo(store, isAdmin) {
  const a = store.access;
  const u = { status: a.status, price: a.status === "locked" ? currentGate().price : a.price, by: a.by };
  if (isAdmin && (a.status === "locked" || a.status === "pending")) {
    const c = getPlatform();
    u.payee = { upiId: c.upiId, payeeName: c.payeeName, note: c.note };
    if (a.status === "pending") u.ref = a.ref;
  }
  return u;
}
function snapshot(store, me, isAdmin, now = Date.now()) {
  const { log: _log, ...data } = store.data;
  const snap = { ...data, now, me, presence: presenceOf(store.data.code), unlock: unlockInfo(store, isAdmin) };
  if (isAdmin) snap.secrets = store.secrets;
  if (me.captainId) snap.strategy = store.strategies[me.captainId] ?? [];
  return snap;
}
function sendFull(store, c) {
  const snap = snapshot(store, c.me, c.isAdmin);
  c.last = new Map(Object.entries(snap).filter(([k]) => k !== "now").map(([k, v]) => [k, JSON.stringify(v)]));
  c.send(JSON.stringify(snap));
}
function broadcast(store) {
  const set = clients.get(store.data.code);
  if (!set || set.size === 0) return;
  const now = Date.now();
  const groups = /* @__PURE__ */ new Map();
  for (const c of set) {
    const groupKey = c.isAdmin ? "admin" : `${c.me.role}:${c.me.captainId ?? ""}`;
    let parts = groups.get(groupKey);
    if (!parts) {
      parts = /* @__PURE__ */ new Map();
      for (const [k, v] of Object.entries(snapshot(store, c.me, c.isAdmin, now))) if (k !== "now") parts.set(k, JSON.stringify(v));
      groups.set(groupKey, parts);
    }
    let body;
    if (!c.last || !c.deltas) {
      body = `{${[...parts].map(([k, v]) => `${JSON.stringify(k)}:${v}`).join(",")},"now":${now}}`;
    } else {
      const changed = [...parts].filter(([k, v]) => c.last.get(k) !== v);
      if (changed.length === 0) continue;
      body = `{"delta":true,${changed.map(([k, v]) => `${JSON.stringify(k)}:${v}`).join(",")}${changed.length ? "," : ""}"now":${now}}`;
    }
    c.last = parts;
    try {
      c.send(body);
    } catch {
    }
  }
}
var presenceTimers = /* @__PURE__ */ new Map();
function broadcastPresenceSoon(store) {
  const code = store.data.code;
  if (presenceTimers.has(code)) return;
  presenceTimers.set(
    code,
    setTimeout(() => {
      presenceTimers.delete(code);
      broadcast(store);
    }, 400)
  );
}
function register(store, client) {
  let set = clients.get(store.data.code);
  if (!set) clients.set(store.data.code, set = /* @__PURE__ */ new Set());
  set.add(client);
  broadcastPresenceSoon(store);
  return () => {
    set.delete(client);
    if (events.get(store.data.code) === store) broadcastPresenceSoon(store);
  };
}
function scheduleTimers(store) {
  const code = store.data.code;
  clearTimeout(spinTimers.get(code));
  spinTimers.delete(code);
  const due = nextDue(store);
  if (due === null) return;
  spinTimers.set(
    code,
    setTimeout(() => {
      if (tick(store, Date.now())) {
        saveSoon(store);
        broadcast(store);
      }
      scheduleTimers(store);
    }, Math.max(0, due - Date.now()) + 25)
  );
}
for (const s of events.values()) {
  tick(s, Date.now());
  scheduleTimers(s);
}
var app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : process.env.TRUST_PROXY);
var smallJson = express.json({ limit: "1mb" });
app.use((req, res, next) => req.path === "/api/events/restore" ? next() : smallJson(req, res, next));
var wrap = (fn) => (req, res, next) => {
  try {
    fn(req, res);
  } catch (err) {
    next(err);
  }
};
function findEvent(req) {
  const code = String(req.params.code ?? "").toUpperCase();
  const store = events.get(code);
  if (!store) throw new AuctionError("Auction not found \u2014 check the code", 404);
  tick(store, Date.now());
  refreshAccess(store);
  return store;
}
app.post(
  "/api/events",
  wrap((req, res) => {
    if (events.size >= MAX_EVENTS) throw new AuctionError("This server is full", 503);
    let code = randomCode(6);
    while (events.has(code)) code = randomCode(6);
    const store = createStore(code, req.body?.settings, Date.now(), currentGate());
    events.set(code, store);
    saveSoon(store);
    res.status(201).json({ code, adminKey: store.secrets.adminKey, hostKey: store.secrets.hostKey });
  })
);
app.get(
  "/api/events/:code/exists",
  wrap((req, res) => {
    const store = findEvent(req);
    res.json({ code: store.data.code, name: store.data.settings.name, sport: store.data.settings.sport });
  })
);
app.get(
  "/api/events/:code/state",
  wrap((req, res) => {
    const store = findEvent(req);
    const actor = authorize(req.ip ?? "", store, req.query.key);
    res.json(snapshot(store, { role: actor.role, captainId: actor.captainId }, actor.isAdmin));
  })
);
app.get("/api/events/:code/stream", (req, res, next) => {
  let store;
  try {
    store = findEvent(req);
  } catch (err) {
    return next(err);
  }
  let actor;
  try {
    actor = authorize(req.ip ?? "", store, req.query.key);
  } catch (err) {
    return next(err);
  }
  const client = {
    send: (json) => res.write(`data: ${json}

`),
    close: () => res.end(),
    me: { role: actor.role, captainId: actor.captainId },
    isAdmin: actor.isAdmin
  };
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write("retry: 2000\n\n");
  const unregister = register(store, client);
  sendFull(store, client);
  const heartbeat2 = setInterval(() => res.write(": ping\n\n"), 2e4);
  req.on("close", () => {
    clearInterval(heartbeat2);
    unregister();
  });
});
app.post(
  "/api/events/:code/cmd",
  wrap((req, res) => {
    const store = findEvent(req);
    const key = req.header("x-key") ?? req.body?.key;
    const actor = authorize(req.ip ?? "", store, key);
    const action = String(req.body?.action ?? "");
    const result = runAction(store, actor, action, req.body?.params);
    saveSoon(store);
    scheduleTimers(store);
    broadcast(store);
    res.json({ ok: true, result: result ?? null });
  })
);
function destroyEvent(store) {
  const code = store.data.code;
  const set = clients.get(code);
  if (set) {
    for (const c of [...set]) {
      try {
        c.send(JSON.stringify({ deleted: true }));
        c.close();
      } catch {
      }
    }
    clients.delete(code);
  }
  clearTimeout(spinTimers.get(code));
  spinTimers.delete(code);
  clearTimeout(presenceTimers.get(code));
  presenceTimers.delete(code);
  events.delete(code);
  deleteEventFiles(code);
}
function requireAdmin(req, store) {
  const actor = authorize(req.ip ?? "", store, req.header("x-key"));
  if (actor.role !== "admin") throw new AuctionError("Only the admin can do that", 403);
}
app.delete(
  "/api/events/:code",
  wrap((req, res) => {
    const store = findEvent(req);
    requireAdmin(req, store);
    destroyEvent(store);
    res.json({ ok: true });
  })
);
app.get(
  "/api/events/:code/export",
  wrap((req, res) => {
    const store = findEvent(req);
    requireAdmin(req, store);
    const archive = buildArchive(store, (name) => readUpload(store.data.code, name));
    res.set("Cache-Control", "no-store");
    res.json(archive);
  })
);
var RESTORE_LIMIT_BYTES = 25 * 1024 * 1024;
app.post(
  "/api/events/restore",
  express.json({ limit: RESTORE_LIMIT_BYTES }),
  wrap((req, res) => {
    if (events.size >= MAX_EVENTS) throw new AuctionError("This server is full", 503);
    let code = randomCode(6);
    while (events.has(code)) code = randomCode(6);
    const { store, photos } = restoreArchive(req.body, code, Date.now(), currentGate());
    writeUploads(code, photos);
    events.set(code, store);
    saveSoon(store);
    res.status(201).json({
      code,
      name: store.data.settings.name,
      adminKey: store.secrets.adminKey,
      hostKey: store.secrets.hostKey,
      players: store.data.players.length,
      teams: store.data.captains.length
    });
  })
);
app.get("/api/platform", (_req, res) => {
  const c = getPlatform();
  const g = currentGate();
  res.json({
    env: APP_ENV,
    payments: g.required,
    price: g.required ? g.price : 0,
    operatorName: c.operatorName,
    contact: c.contact,
    limits: { ...LIMITS, screensPerAuction: MAX_SCREENS, auctionsOnServer: MAX_EVENTS, autoDeleteDays: AUTO_DELETE_DAYS }
  });
});
app.post(
  "/api/events/:code/unlock/request",
  wrap((req, res) => {
    const store = findEvent(req);
    requireAdmin(req, store);
    const a = store.access;
    if (a.status === "unlocked" || a.status === "free") throw new AuctionError("This auction does not need unlocking.");
    const ref = String(req.body?.ref ?? "").trim();
    if (!/^[A-Za-z0-9-]{6,40}$/.test(ref)) throw new AuctionError("Enter the UPI reference / transaction ID from your payment app (6\u201340 letters and numbers).");
    a.status = "pending";
    a.ref = ref;
    a.payer = String(req.body?.payer ?? "").trim().slice(0, 60);
    a.price = currentGate().price;
    a.requestedAt = Date.now();
    saveSoon(store);
    broadcast(store);
    res.json({ ok: true });
  })
);
var devBadKeys = /* @__PURE__ */ new Map();
function requireDev(req) {
  if (!devEnabled()) throw new AuctionError("Not found", 404);
  const ip = req.ip ?? "";
  const key = req.header("x-dev-key");
  if (!isDevKey(key)) {
    const now = Date.now();
    let e = devBadKeys.get(ip);
    if (!e || now > e.reset) devBadKeys.set(ip, e = { count: 0, reset: now + 6e4 });
    if (++e.count > 20) throw new AuctionError("Too many wrong keys \u2014 wait a minute.", 429);
    throw new AuctionError("Wrong developer key", 403);
  }
}
app.get(
  "/api/dev/overview",
  wrap((req, res) => {
    requireDev(req);
    const auctions = [...events.values()].map((s) => ({
      code: s.data.code,
      name: s.data.settings.name,
      createdAt: s.data.createdAt,
      lastActivity: lastActivity(s),
      teams: s.data.captains.length,
      players: s.data.players.length,
      sold: s.data.players.filter((p) => p.status === "sold").length,
      screens: clients.get(s.data.code)?.size ?? 0,
      status: s.access.status,
      by: s.access.by,
      ref: s.access.ref,
      payer: s.access.payer,
      price: s.access.price,
      requestedAt: s.access.requestedAt
    })).sort((a, b) => b.createdAt - a.createdAt);
    res.json({ config: getPlatform(), gate: currentGate(), auctions, limits: { events: MAX_EVENTS, screens: MAX_SCREENS } });
  })
);
app.put(
  "/api/dev/config",
  wrap((req, res) => {
    requireDev(req);
    res.json({ config: savePlatform(req.body) });
  })
);
app.post(
  "/api/dev/auctions/:code/:action",
  wrap((req, res) => {
    requireDev(req);
    const store = findEvent(req);
    const a = store.access;
    const now = Date.now();
    switch (req.params.action) {
      case "approve":
        if (a.status !== "pending") throw new AuctionError("There is no payment waiting for this auction.");
        Object.assign(a, { status: "unlocked", by: "payment", decidedAt: now });
        break;
      case "reject":
        Object.assign(a, { status: "locked", ref: "", payer: "", decidedAt: now });
        break;
      case "grant":
        Object.assign(a, { status: "unlocked", by: "grant", decidedAt: now });
        break;
      case "lock":
        Object.assign(a, { status: currentGate().required ? "locked" : "free", by: "", ref: "", payer: "", decidedAt: now });
        break;
      case "delete":
        destroyEvent(store);
        return void res.json({ ok: true });
      default:
        throw new AuctionError("Unknown action", 404);
    }
    saveSoon(store);
    broadcast(store);
    res.json({ ok: true });
  })
);
app.post(
  "/api/dev/create",
  wrap((req, res) => {
    requireDev(req);
    let code = randomCode(6);
    while (events.has(code)) code = randomCode(6);
    const store = createStore(code, req.body?.settings);
    Object.assign(store.access, { status: "unlocked", by: "grant", decidedAt: Date.now() });
    events.set(code, store);
    saveSoon(store);
    res.status(201).json({ code, adminKey: store.secrets.adminKey, hostKey: store.secrets.hostKey });
  })
);
var AUTO_DELETE_DAYS = Number(process.env.AUTO_DELETE_DAYS ?? 0);
function lastActivity(store) {
  const d = store.data;
  return Math.max(d.createdAt, d.log[d.log.length - 1]?.at ?? 0, d.live.lastEvent?.at ?? 0);
}
function sweepOldAuctions(now = Date.now()) {
  if (!(AUTO_DELETE_DAYS > 0)) return 0;
  let n = 0;
  for (const s of [...events.values()]) {
    if (now - lastActivity(s) > AUTO_DELETE_DAYS * 864e5 && (clients.get(s.data.code)?.size ?? 0) === 0) {
      console.log(`Auto-deleting auction ${s.data.code} (no activity for ${AUTO_DELETE_DAYS} days)`);
      destroyEvent(s);
      n++;
    }
  }
  return n;
}
if (AUTO_DELETE_DAYS > 0) {
  console.log(`Auctions with no activity for ${AUTO_DELETE_DAYS} day(s) are deleted automatically.`);
  setTimeout(sweepOldAuctions, 3e4).unref();
  setInterval(sweepOldAuctions, 6 * 36e5).unref();
}
var EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
app.post(
  "/api/events/:code/upload",
  express.raw({ type: Object.keys(EXT), limit: MAX_UPLOAD_BYTES }),
  wrap((req, res) => {
    const store = findEvent(req);
    const actor = authorize(req.ip ?? "", store, req.header("x-key"));
    if (actor.role !== "admin") throw new AuctionError("You are not allowed to do that", 403);
    const ext = EXT[String(req.header("content-type") ?? "").split(";")[0]];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) throw new AuctionError("Upload a JPEG, PNG or WebP image");
    const dir = path3.join(UPLOADS_DIR, store.data.code);
    mkdirSync2(dir, { recursive: true });
    if (readdirSync2(dir).length >= MAX_UPLOADS_PER_AUCTION) throw new AuctionError(`This auction has reached its ${MAX_UPLOADS_PER_AUCTION}-photo limit`);
    const name = `${randomBytes3(6).toString("hex")}.${ext}`;
    writeFileSync3(path3.join(dir, name), req.body);
    res.status(201).json({ url: `/uploads/${store.data.code}/${name}` });
  })
);
app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "7d", immutable: true, index: false }));
app.get("/api/health", (_req, res) => res.json({ ok: true, auctions: events.size }));
app.get("/healthz", (_req, res) => {
  let live = 0;
  for (const s of events.values()) if (s.data.live.phase === "spinning" || s.data.live.phase === "bidding" || s.data.live.break) live++;
  res.json({ ok: true, auctions: events.size, live, version: VERSION, env: APP_ENV });
});
var WEB_DIST = path3.resolve("dist/web");
if (existsSync3(WEB_DIST)) {
  app.use("/assets", express.static(path3.join(WEB_DIST, "assets"), { index: false, maxAge: "365d", immutable: true, fallthrough: false }));
  app.use(express.static(WEB_DIST, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api\/|\/uploads\/|\/assets\/).*/, (_req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(path3.join(WEB_DIST, "index.html"));
  });
}
app.use((err, _req, res, _next) => {
  if (err instanceof AuctionError) return res.status(err.status).json({ ok: false, error: err.message });
  const e = err;
  if (e?.type === "entity.too.large") return res.status(413).json({ ok: false, error: "That upload is too large" });
  if (e?.status && e.status < 500) return res.status(e.status).json({ ok: false, error: e.message ?? "Bad request" });
  console.error(err);
  res.status(500).json({ ok: false, error: "Something went wrong" });
});
var HOST = process.env.HOST || void 0;
var onListening = () => console.log(`ZenoBid listening on http://${HOST ?? "localhost"}:${PORT}`);
var server = HOST ? app.listen(PORT, HOST, onListening) : app.listen(PORT, onListening);
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`
\u2717 Port ${PORT} is already in use \u2014 another copy of ZenoBid is probably still running.
  Close the other terminal window (Ctrl+C) and start again. Auctions are saved on disk, nothing is lost.
`);
  } else console.error(err);
  process.exit(1);
});
var wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
var alive = /* @__PURE__ */ new WeakMap();
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const match = /^\/api\/events\/([A-Za-z0-9]+)\/ws$/.exec(url.pathname);
  const store = match ? events.get(match[1].toUpperCase()) : void 0;
  if (!match || !store) {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  if ((clients.get(store.data.code)?.size ?? 0) >= MAX_SCREENS) {
    socket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  let actor;
  try {
    actor = authorize(clientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"], !!process.env.TRUST_PROXY), store, url.searchParams.get("key"));
  } catch {
    socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    tick(store, Date.now());
    const client = {
      send: (json) => ws.readyState === ws.OPEN && ws.send(json),
      close: () => ws.close(),
      deltas: true,
      me: { role: actor.role, captainId: actor.captainId },
      isAdmin: actor.isAdmin
    };
    alive.set(ws, true);
    ws.on("pong", () => alive.set(ws, true));
    ws.on("error", () => ws.terminate());
    const unregister = register(store, client);
    ws.on("close", unregister);
    sendFull(store, client);
  });
});
var heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (alive.get(ws) === false) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 25e3);
heartbeat.unref();
function shutdown() {
  flushAll(events.values());
  for (const ws of wss.clients) ws.terminate();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on("uncaughtException", (err) => console.error("Uncaught exception (auction keeps running):", err));
process.on("unhandledRejection", (err) => console.error("Unhandled rejection (auction keeps running):", err));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
