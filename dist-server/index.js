// server/localEnv.ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
function loadLocalEnv(file = path.join(process.cwd(), ".env"), env = process.env) {
  if (!existsSync(file)) return [];
  const loaded = [];
  for (const raw of readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(raw);
    if (!m || raw.trim().startsWith("#")) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (env[m[1]] === void 0 || env[m[1]] === "") {
      env[m[1]] = value;
      loaded.push(m[1]);
    }
  }
  return loaded;
}
var names = loadLocalEnv();
if (names.length) console.log(`Settings read from .env: ${names.join(", ")}`);

// server/index.ts
import express from "express";
import { randomBytes as randomBytes3 } from "node:crypto";
import { existsSync as existsSync5, mkdirSync as mkdirSync3, readdirSync as readdirSync3, readFileSync as readFileSync5, writeFileSync as writeFileSync4 } from "node:fs";
import path5 from "node:path";
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
function currencyWord(symbol) {
  switch (symbol) {
    case "\u20B9":
      return "rupees";
    case "$":
      return "dollars";
    case "\u20AC":
      return "euros";
    case "\xA3":
      return "pounds";
    default:
      return /^[A-Za-z]+$/.test(symbol) ? "points" : "";
  }
}
function spokenMoney(amount, fmt) {
  let n = Math.round(amount);
  const parts = [];
  const take = (size, word2) => {
    const q = Math.floor(n / size);
    if (q > 0) {
      parts.push(`${q} ${word2}`);
      n -= q * size;
    }
  };
  if (fmt.moneyStyle === "indian") {
    take(1e7, "crore");
    take(1e5, "lakh");
    take(1e3, "thousand");
  } else {
    take(1e6, "million");
    take(1e3, "thousand");
  }
  if (n > 0 || parts.length === 0) parts.push(String(n));
  const word = currencyWord(fmt.symbol);
  return (parts.join(" ") + (word ? " " + word : "")).trim();
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
  const cheapest = data.players.filter((p) => p.status !== "sold" && p.status !== "upcoming" && p.id !== excludePlayerId).map((p) => effectiveBase(settings, p)).sort((a, b) => a - b).slice(0, slotsAfterThis);
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
  store.data.nextTopup ??= 0;
  const st = store.data.settings;
  st.theme ??= DEFAULT_SETTINGS.theme;
  st.mode ??= "dark";
  st.brand ??= { ...DEFAULT_SETTINGS.brand };
  st.lastCall ??= "";
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
  totalRounds: 2,
  lastCall: ""
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
  if (typeof p.lastCall === "string") next.lastCall = p.lastCall.replace(/[\u0000-\u001f\u007f<>{}]/g, "").trim().slice(0, 80);
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
      nextTopup: 0,
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
var ROSTER_LOCKED = /* @__PURE__ */ new Set(["captain.add", "captain.budget", "captains.topup", "captain.remove", "player.add", "players.import", "player.update", "player.remove", "round.topup", "demo.load"]);
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
function newPlayer(d, src, later = false) {
  const name = str(src.name, "", 80);
  if (!name) throw new AuctionError("Player name is required");
  return {
    id: uid(),
    name,
    role: str(src.role, "", 40),
    description: str(src.description, "", 400),
    photo: str(src.photo, "", 400),
    basePrice: num(src.basePrice, 0, 0),
    status: later ? "upcoming" : "available",
    teamId: null,
    price: 0,
    soldRound: 0,
    soldAt: 0,
    order: d.players.reduce((m, p) => Math.max(m, p.order), 0) + 1
  };
}
on("player.add", "admin", ({ data }, p) => {
  if (data.players.length >= MAX_PLAYERS) throw new AuctionError(`Up to ${MAX_PLAYERS} players per auction`);
  const pl = newPlayer(data, p, p.later === true);
  data.players.push(pl);
  return { id: pl.id };
});
on("players.import", "admin", ({ data, strategies }, p, _a, now) => {
  const rows = Array.isArray(p.rows) ? p.rows : [];
  if (rows.length === 0) throw new AuctionError("Nothing to import");
  const replace = p.replace === true;
  if (replace) {
    assertNoBreak(data);
    if (data.live.phase === "spinning" || data.live.phase === "bidding") throw new AuctionError("Finish the current player first, then replace the list");
    if (data.live.phase !== "idle") {
      clearBlock(data);
      emit(data, "idle", now);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  let position = 0;
  let removed = 0;
  const skipped = [];
  let added = 0;
  let updated = 0;
  let assigned = 0;
  let queued = 0;
  const nextRound = data.round + 1;
  for (const row of rows) {
    const name = str(row?.name, "", 80);
    if (!name) {
      skipped.push("(a row without a name)");
      continue;
    }
    const askedRound = num(row?.round, 0, 0);
    if (askedRound > nextRound) {
      skipped.push(`${name} (round ${askedRound} is too far ahead: only the next round, ${nextRound}, can be prepared)`);
      continue;
    }
    const toNextRound = askedRound ? askedRound === nextRound : p.later === true;
    seen.add(name.toLowerCase());
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
    if (existing && replace) resetPlayer(existing);
    if (existing) {
      pl = existing;
      if (str(row.role, "", 40)) pl.role = str(row.role, "", 40);
      if (str(row.description, "", 400)) pl.description = str(row.description, "", 400);
      if (str(row.photo, "", 400)) pl.photo = str(row.photo, "", 400);
      if (num(row.basePrice, 0, 0) > 0) pl.basePrice = num(row.basePrice, 0, 0);
      updated++;
      if (askedRound && !str(row.team, "", 60) && pl.status !== "sold") {
        if (toNextRound && pl.status !== "upcoming") {
          pl.status = "upcoming";
          queued++;
        } else if (!toNextRound && pl.status === "upcoming") pl.status = "available";
      }
    } else {
      pl = newPlayer(data, row, toNextRound && !str(row.team, "", 60));
      data.players.push(pl);
      added++;
      if (pl.status === "upcoming") queued++;
    }
    if (replace) pl.order = ++position;
    const teamName = str(row.team, "", 60).toLowerCase();
    if (teamName) {
      const c = data.captains.find((x) => x.team.toLowerCase() === teamName || x.name.toLowerCase() === teamName);
      if (c) {
        pl.status = "sold";
        pl.teamId = c.id;
        pl.price = num(row.price, effectiveBase(data.settings, pl), 0);
        pl.soldRound = replace && askedRound && askedRound <= data.round ? askedRound : data.round;
        pl.soldAt = now;
        assigned++;
      } else {
        skipped.push(`${pl.name} (team \u201C${row.team}\u201D not found \u2014 left unassigned)`);
      }
    }
  }
  if (replace) {
    const keep = data.players.filter((x) => seen.has(x.name.toLowerCase()));
    removed = data.players.length - keep.length;
    const gone = new Set(data.players.filter((x) => !seen.has(x.name.toLowerCase())).map((x) => x.id));
    data.players = keep.sort((a, b) => a.order - b.order);
    for (const id of Object.keys(strategies)) strategies[id] = strategies[id].filter((i) => !gone.has(i.playerId));
    dropStale(data, now);
  }
  note(data, `${replace ? "REPLACED the player list from a file" : "Imported players"}: ${added} added, ${updated} updated${removed ? `, ${removed} removed` : ""}${assigned ? `, ${assigned} placed on teams` : ""}${queued ? `, ${queued} saved for round ${nextRound}` : ""}`, now);
  return { added, updated, assigned, queued, removed, skipped };
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
function dropStale(d, now) {
  if (d.live.playerId && !d.players.some((p) => p.id === d.live.playerId)) {
    clearBlock(d);
    emit(d, "idle", now);
  }
}
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
    case "upcoming":
      dropFromBlock(data, pl.id, now);
      resetPlayer(pl);
      pl.status = "upcoming";
      note(data, `${pl.name} set to: waiting for the next round`, now);
      break;
    case "block":
      assertNoBreak(data);
      if (data.captains.length < 2) throw new AuctionError("Add at least two teams before starting");
      if (pl.status === "sold") resetPlayer(pl);
      putOnBlock(data, pl, null, now);
      note(data, `${pl.name} put on the block`, now);
      break;
    default:
      throw new AuctionError("Choose in the pool, on the block, unsold or waiting for the next round \u2014 use Assign to mark someone sold");
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
  const waiting = data.players.filter((p) => p.status === "upcoming");
  if (unsold.length + waiting.length === 0) throw new AuctionError("There are no unsold or waiting players to bring into the next round");
  for (const p of [...unsold, ...waiting]) p.status = "available";
  const topup = data.nextTopup;
  if (topup > 0) for (const c of data.captains) c.budget += topup;
  data.nextTopup = 0;
  data.round += 1;
  clearBlock(data);
  emit(data, "round", now);
  note(
    data,
    `Round ${data.round} started: ${unsold.length} unsold + ${waiting.length} new players${topup > 0 ? `, every team received ${money(data, topup)} more` : ""}`,
    now
  );
  return { unsold: unsold.length, added: waiting.length, topup };
});
on("round.topup", "admin", ({ data }, p) => {
  data.nextTopup = num(p.amount, 0, 0);
});
on("screen.set", "host", ({ data }, p) => {
  data.live.screen = p.screen === "board" ? "board" : "stage";
});
on("squad.sort", "host", ({ data }, p) => {
  data.live.squadSort = p.sort === "added" ? "added" : "price";
});
on("reset", "admin", ({ data }, _p, _a, now) => {
  for (const p of data.players) Object.assign(p, { status: p.status === "upcoming" ? "upcoming" : "available", teamId: null, price: 0, soldRound: 0 });
  data.round = 1;
  data.nextTopup = 0;
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
  for (const pl of data.players) if (pl.status !== "upcoming") resetPlayer(pl);
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
import { existsSync as existsSync3, readFileSync as readFileSync3, renameSync as renameSync2, writeFileSync as writeFileSync2 } from "node:fs";
import path3 from "node:path";

// server/persist.ts
import { existsSync as existsSync2, mkdirSync, readdirSync, readFileSync as readFileSync2, renameSync, rmSync, writeFileSync } from "node:fs";
import path2 from "node:path";
import { fileURLToPath } from "node:url";
var PROJECT_ROOT = path2.resolve(path2.dirname(fileURLToPath(import.meta.url)), "..");
var DATA_DIR = path2.resolve(process.env.DATA_DIR ?? path2.join(PROJECT_ROOT, "data"));
var EVENTS_DIR = path2.join(DATA_DIR, "events");
var UPLOADS_DIR = path2.join(DATA_DIR, "uploads");
mkdirSync(EVENTS_DIR, { recursive: true });
mkdirSync(UPLOADS_DIR, { recursive: true });
function loadAll() {
  const out = /* @__PURE__ */ new Map();
  for (const file of readdirSync(EVENTS_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const store = JSON.parse(readFileSync2(path2.join(EVENTS_DIR, file), "utf8"));
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
  const file = path2.join(EVENTS_DIR, `${store.data.code}.json`);
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
var SAFETY_DIR = path2.join(DATA_DIR, "safety");
var safetySeq = 0;
function saveSafetyCopy(store, keep = 5) {
  mkdirSync(SAFETY_DIR, { recursive: true });
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:.]/g, "");
  const file = path2.join(SAFETY_DIR, `${store.data.code}-${stamp}-${String(safetySeq++ % 1e4).padStart(4, "0")}.json`);
  writeFileSync(file, JSON.stringify(store));
  const mine = readdirSync(SAFETY_DIR).filter((f) => f.startsWith(`${store.data.code}-`)).sort();
  for (const old of mine.slice(0, Math.max(0, mine.length - keep))) rmSync(path2.join(SAFETY_DIR, old), { force: true });
  return file;
}
function deleteEventFiles(code) {
  clearTimeout(timers.get(code));
  timers.delete(code);
  const file = path2.join(EVENTS_DIR, `${code}.json`);
  rmSync(file, { force: true });
  rmSync(`${file}.tmp`, { force: true });
  rmSync(path2.join(UPLOADS_DIR, code), { recursive: true, force: true });
  if (existsSync2(SAFETY_DIR)) {
    for (const f of readdirSync(SAFETY_DIR)) if (f.startsWith(`${code}-`)) rmSync(path2.join(SAFETY_DIR, f), { force: true });
  }
}
function readUpload(code, fileName) {
  try {
    return readFileSync2(path2.join(UPLOADS_DIR, code, fileName));
  } catch {
    return null;
  }
}
function writeUploads(code, files) {
  if (files.size === 0) return;
  const dir = path2.join(UPLOADS_DIR, code);
  mkdirSync(dir, { recursive: true });
  for (const [name, buf] of files) writeFileSync(path2.join(dir, name), buf);
}

// server/platform.ts
var FILE = path3.join(DATA_DIR, "platform.json");
var DEV_KEY = process.env.DEV_KEY ?? "";
var devEnabled = () => DEV_KEY.length >= 12;
var EMPTY = { upiId: "", payeeName: "", price: 0, note: "", operatorName: "", contact: "" };
var cache = null;
function getPlatform() {
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...existsSync3(FILE) ? JSON.parse(readFileSync3(FILE, "utf8")) : {} };
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
      nextTopup: d.nextTopup,
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
  d.nextTopup = whole(a.nextTopup, 0);
  for (const rp of rawPlayers.slice(0, MAX_PLAYERS)) {
    if (!isObj(rp) || !ID.test(String(rp.id)) || playerIds.has(rp.id)) continue;
    const name = text2(rp.name, 80);
    if (!name) continue;
    playerIds.add(rp.id);
    let status = rp.status === "sold" || rp.status === "unsold" || rp.status === "upcoming" ? rp.status : "available";
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

// server/tts.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync4, mkdirSync as mkdirSync2, readdirSync as readdirSync2, readFileSync as readFileSync4, renameSync as renameSync3, rmSync as rmSync2, statSync, writeFileSync as writeFileSync3 } from "node:fs";
import path4 from "node:path";
var DEFAULT_VOICES = {
  kbc: ["hi-IN-Chirp3-HD-Charon", "hi-IN-Chirp3-HD-Fenrir", "hi-IN-Neural2-B", "hi-IN-Wavenet-C", "hi-IN-Standard-B"],
  // the most excitable free voice for the commentator
  cricket: ["hi-IN-Chirp3-HD-Fenrir", "hi-IN-Chirp3-HD-Puck", "hi-IN-Neural2-C", "hi-IN-Wavenet-B", "hi-IN-Standard-C"],
  // the deepest, most booming male voices for the ring announcer, the arena narrator and the trailer
  wwe: ["en-US-Chirp3-HD-Alnilam", "en-US-Chirp3-HD-Orus", "en-US-Chirp3-HD-Algenib", "en-US-Neural2-D", "en-US-Wavenet-D", "en-US-Standard-D"],
  mk: ["en-US-Chirp3-HD-Algenib", "en-US-Chirp3-HD-Charon", "en-US-Neural2-D", "en-US-Wavenet-B", "en-US-Standard-B"],
  trailer: ["en-US-Chirp3-HD-Alnilam", "en-US-Chirp3-HD-Iapetus", "en-US-Neural2-D", "en-US-Wavenet-D", "en-US-Standard-B"],
  show: ["en-US-Chirp3-HD-Zephyr", "en-US-Chirp3-HD-Aoede", "en-US-Neural2-F", "en-US-Wavenet-F", "en-US-Standard-C"],
  velvet: ["en-US-Chirp3-HD-Sulafat", "en-US-Chirp3-HD-Kore", "en-US-Neural2-H", "en-US-Wavenet-H", "en-US-Standard-E"],
  assistant: ["en-IN-Chirp3-HD-Kore", "en-IN-Chirp3-HD-Aoede", "en-IN-Neural2-A", "en-IN-Wavenet-A", "en-IN-Standard-A"]
};
var DEFAULT_EXPRESSIVE_VOICES = {
  kbc: { lang: "hi-IN", name: "Charon" },
  cricket: { lang: "hi-IN", name: "Fenrir" },
  wwe: { lang: "en-US", name: "Alnilam" },
  mk: { lang: "en-US", name: "Algenib" },
  trailer: { lang: "en-US", name: "Alnilam" },
  show: { lang: "en-US", name: "Zephyr" },
  velvet: { lang: "en-US", name: "Sulafat" },
  assistant: { lang: "en-IN", name: "Kore" }
};
var lang = (voice) => voice.split("-").slice(0, 2).join("-");
var STYLES = Object.keys(DEFAULT_VOICES);
function ttsConfigFromEnv(env, dataDir) {
  const provider = env.TTS_PROVIDER === "mock" ? "mock" : "google";
  const key = env.GOOGLE_TTS_KEY ?? "";
  if (provider === "google" && key.length < 20) return null;
  const list = (v, d) => v ? [...v.split(",").map((x) => x.trim()).filter(Boolean), ...d] : d;
  const count = (v, d) => Math.max(0, Number(v ?? d) || 0);
  return {
    key,
    provider,
    dir: path4.join(dataDir, "tts-cache"),
    monthlyChars: count(env.TTS_MONTHLY_CHARS, 3e5),
    // TTS_VOICE_KBC, TTS_VOICE_SHOW, …: a studio voice of the owner's choice goes first for that host
    voices: Object.fromEntries(STYLES.map((s) => [s, list(env[`TTS_VOICE_${s.toUpperCase()}`], DEFAULT_VOICES[s])])),
    expressive: {
      // paid per use, so OFF unless the owner explicitly switches it on (TTS_EXPRESSIVE=on)
      on: /^(on|1|true|yes)$/i.test(env.TTS_EXPRESSIVE ?? ""),
      model: env.TTS_EXPRESSIVE_MODEL || "gemini-2.5-flash-tts",
      monthlyChars: count(env.TTS_EXPRESSIVE_MONTHLY_CHARS, 4e4),
      // TTS_EXPRESSIVE_VOICE_CRICKET=Fenrir (or hi-IN:Fenrir) swaps a host's expressive voice
      voices: Object.fromEntries(
        STYLES.map((s) => {
          const v = env[`TTS_EXPRESSIVE_VOICE_${s.toUpperCase()}`];
          const d = DEFAULT_EXPRESSIVE_VOICES[s];
          if (!v) return [s, d];
          const [a, b] = v.includes(":") ? v.split(":") : [d.lang, v];
          return [s, { lang: a.trim(), name: b.trim() }];
        })
      )
    }
  };
}
function mockWav(seconds = 0.25) {
  const rate = 8e3, n = Math.floor(rate * seconds);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / rate * 2 * Math.PI * 330) * 4e3), 44 + i * 2);
  return b;
}
var API = "https://texttospeech.googleapis.com/v1/text:synthesize";
var Tts = class {
  constructor(cfg, fetcher = fetch, now = () => /* @__PURE__ */ new Date()) {
    this.cfg = cfg;
    this.fetcher = fetcher;
    this.now = now;
    mkdirSync2(cfg.dir, { recursive: true });
  }
  inflight = /* @__PURE__ */ new Map();
  /** studio voices Google refused, so they are not tried again */
  badVoices = /* @__PURE__ */ new Set();
  /** the expressive voice rests after a problem (ms timestamp), then is tried again */
  expressiveRestUntil = 0;
  /** the last reason the expressive voice was not used (shown in the server's log once, never the key) */
  lastExpressiveError = "";
  get enabled() {
    return this.remaining() > 0 || this.expressiveRemaining() > 0;
  }
  // ---- monthly budgets ------------------------------------------------------------------------
  usageFile() {
    return path4.join(this.cfg.dir, "usage.json");
  }
  month() {
    return this.now().toISOString().slice(0, 7);
  }
  usage() {
    try {
      const u = JSON.parse(readFileSync4(this.usageFile(), "utf8"));
      return u.month === this.month() ? { chars: Number(u.chars) || 0, ex: Number(u.ex) || 0 } : { chars: 0, ex: 0 };
    } catch {
      return { chars: 0, ex: 0 };
    }
  }
  /** Studio-voice characters used this month. */
  used() {
    return this.usage().chars;
  }
  /** Expressive-voice characters used this month. */
  expressiveUsed() {
    return this.usage().ex;
  }
  remaining() {
    return Math.max(0, this.cfg.monthlyChars - this.used());
  }
  expressiveRemaining() {
    return this.cfg.expressive.on ? Math.max(0, this.cfg.expressive.monthlyChars - this.expressiveUsed()) : 0;
  }
  addUsage(kind, chars) {
    const u = this.usage();
    if (kind === "expressive") u.ex += chars;
    else u.chars += chars;
    const tmp = `${this.usageFile()}.tmp`;
    writeFileSync3(tmp, JSON.stringify({ month: this.month(), ...u }));
    renameSync3(tmp, this.usageFile());
  }
  // ---- the cache ----------------------------------------------------------------------------------
  ext() {
    return this.cfg.provider === "mock" ? "wav" : "mp3";
  }
  studioFile(style, text3, rate = 1) {
    const id = createHash2("sha256").update(`${style}
${rate === 1 ? "" : `${rate}
`}${text3}`).digest("hex").slice(0, 32);
    return path4.join(this.cfg.dir, `${id}.${this.ext()}`);
  }
  expressiveFile(style, text3, direction) {
    const v = this.cfg.expressive.voices[style];
    const id = createHash2("sha256").update(`x
${this.cfg.expressive.model}
${v.lang}:${v.name}
${direction}
${text3}`).digest("hex").slice(0, 32);
    return path4.join(this.cfg.dir, `x-${id}.${this.ext()}`);
  }
  /** Already made (costs nothing to serve again)? */
  has(style, text3, opts = {}) {
    return !!opts.direction && existsSync4(this.expressiveFile(style, text3, opts.direction)) || existsSync4(this.studioFile(style, text3, opts.rate ?? 1));
  }
  expressiveReady(text3) {
    return this.cfg.expressive.on && Date.now() >= this.expressiveRestUntil && text3.length <= this.expressiveRemaining();
  }
  /**
   * The sentence as audio: the expressive recording if there is one (or it can be made now), otherwise the studio
   * recording. Throws only when neither can be had (the screen then stays quiet rather than sounding robotic).
   */
  async speak(style, text3, opts = {}) {
    const type = this.cfg.provider === "mock" ? "audio/wav" : "audio/mpeg";
    const xFile = opts.direction ? this.expressiveFile(style, text3, opts.direction) : "";
    if (xFile && existsSync4(xFile)) return { audio: readFileSync4(xFile), type, kind: "expressive" };
    const sFile = this.studioFile(style, text3, opts.rate ?? 1);
    const tryExpressive = !!opts.direction && this.expressiveReady(text3);
    if (!tryExpressive && existsSync4(sFile)) return { audio: readFileSync4(sFile), type, kind: "studio" };
    const jobKey = tryExpressive ? xFile : sFile;
    const running = this.inflight.get(jobKey);
    if (running) return running;
    const job = (async () => {
      if (tryExpressive) {
        try {
          const audio2 = this.cfg.provider === "mock" ? mockWav(0.3) : await this.gemini(style, text3, opts.direction, opts.urgent ? 4500 : 9e3);
          this.addUsage("expressive", text3.length);
          writeFileSync3(xFile, audio2);
          return { audio: audio2, type, kind: "expressive" };
        } catch (err) {
          this.restExpressive(err);
        }
      }
      if (existsSync4(sFile)) return { audio: readFileSync4(sFile), type, kind: "studio" };
      if (text3.length > this.remaining()) throw new Error("monthly voice budget used up");
      const audio = this.cfg.provider === "mock" ? mockWav() : await this.studio(style, text3, opts.rate ?? 1);
      this.addUsage("studio", text3.length);
      writeFileSync3(sFile, audio);
      return { audio, type, kind: "studio" };
    })().finally(() => this.inflight.delete(jobKey));
    this.inflight.set(jobKey, job);
    return job;
  }
  /** After a problem the expressive voice rests: an hour for a refusal (not enabled, wrong model), 2 minutes otherwise. */
  restExpressive(err) {
    const refused = err.status === 400 || err.status === 403 || err.status === 404;
    this.expressiveRestUntil = Date.now() + (refused ? 36e5 : 12e4);
    const why = err.message.slice(0, 240);
    if (why !== this.lastExpressiveError) console.warn(`Expressive voice not used (${refused ? "resting 1 h" : "resting 2 min"}): ${why}. The studio voice speaks instead.`);
    this.lastExpressiveError = why;
  }
  post(body, timeoutMs) {
    return this.fetcher(`${API}?key=${encodeURIComponent(this.cfg.key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  }
  /** The expressive (Gemini) voice: the text, plus a director's note on how to say it. */
  async gemini(style, text3, direction, timeoutMs) {
    const v = this.cfg.expressive.voices[style];
    let res;
    try {
      res = await this.post({ input: { prompt: direction, text: text3 }, voice: { languageCode: v.lang, name: v.name, modelName: this.cfg.expressive.model }, audioConfig: { audioEncoding: "MP3" } }, timeoutMs);
    } catch (e) {
      throw Object.assign(new Error(`no answer in time (${e.name})`), { status: 0 });
    }
    if (!res.ok) {
      const msg = (await res.text().catch(() => "")).replace(/\s+/g, " ");
      throw Object.assign(new Error(`${res.status} ${msg.slice(0, 200)}`), { status: res.status });
    }
    const body = await res.json();
    if (!body.audioContent) throw Object.assign(new Error("empty answer"), { status: 0 });
    return Buffer.from(body.audioContent, "base64");
  }
  /** The studio voices, best first. */
  async studio(style, text3, rate) {
    let lastError = "no voice available";
    for (const name of this.cfg.voices[style]) {
      if (this.badVoices.has(name)) continue;
      const res = await this.post({ input: { text: text3 }, voice: { languageCode: lang(name), name }, audioConfig: { audioEncoding: "MP3", ...rate !== 1 ? { speakingRate: rate } : {} } }, 8e3);
      if (res.ok) {
        const body = await res.json();
        if (body.audioContent) return Buffer.from(body.audioContent, "base64");
        lastError = "empty answer";
        continue;
      }
      const err = await res.text().catch(() => "");
      lastError = `${res.status} ${err.slice(0, 200)}`;
      if (res.status === 400 || res.status === 404) this.badVoices.add(name);
      else break;
    }
    throw new Error(`Google voice failed: ${lastError}`);
  }
  /** Keeps the cache small: removes the oldest files beyond `maxMb`. */
  prune(maxMb = 80) {
    const files = readdirSync2(this.cfg.dir).filter((f) => f.endsWith(".mp3") || f.endsWith(".wav")).map((f) => ({ f, s: statSync(path4.join(this.cfg.dir, f)) })).sort((a, b) => b.s.mtimeMs - a.s.mtimeMs);
    let total = 0;
    for (const { f, s } of files) {
      total += s.size;
      if (total > maxMb * 1024 * 1024) rmSync2(path4.join(this.cfg.dir, f), { force: true });
    }
  }
};

// shared/announcer.ts
var SPEECH_KINDS = ["spin", "reveal", "bid", "call", "sold", "unsold", "undo", "break", "breakext", "breakend", "round"];
var isSpeechKind = (v) => SPEECH_KINDS.includes(v);
var LULL_MS = 5e3;
var STYLES2 = [
  { id: "classic", label: "Classic", hint: "A clear, friendly announcer", lang: "en" },
  { id: "wwe", label: "WWE hype", hint: "Big, loud ring-announcer energy (English)", lang: "en" },
  { id: "kbc", label: "KBC host", hint: "Warm, dramatic quiz-show host who builds the suspense (Hindi)", lang: "hi" },
  { id: "mk", label: "Mortal Kombat", hint: "Deep arena narrator with gongs and drums (English)", lang: "en" },
  { id: "show", label: "Game show host", hint: "Glamorous, bubbly game-show host (English)", lang: "en" },
  { id: "velvet", label: "Velvet", hint: "Smooth, sultry late-night voice (English)", lang: "en" },
  { id: "trailer", label: "Movie trailer", hint: 'Epic "In a world\u2026" movie-trailer narrator (English)', lang: "en" },
  { id: "cricket", label: "Cricket commentary", hint: "Stadium commentary in Hindi: chauka, chhakka! (Hindi)", lang: "hi" },
  { id: "assistant", label: "Smart assistant", hint: "Friendly and clear, keeps everyone informed: purses, records, squads (English)", lang: "en" }
];
var isStyle = (v) => STYLES2.some((s) => s.id === v);
function heatOf(c) {
  const n = c.bids ?? 1;
  let h = n <= 1 ? 0 : n <= 3 ? 1 : n <= 6 ? 2 : 3;
  if (c.base && c.amount && c.amount >= c.base * 4 && h < 3) h++;
  return h;
}
function momentCtx(src, ev) {
  const player = src.players.find((p) => p.id === ev.playerId);
  const teamName = (id) => src.captains.find((c) => c.id === id)?.team;
  const spentBy = (id) => src.players.reduce((n, p) => p.status === "sold" && p.teamId === id ? n + (p.price ?? 0) : n, 0);
  const bids = src.live.bids;
  const top = bids[bids.length - 1];
  const prev = bids[bids.length - 2];
  const base = player ? player.basePrice || src.settings.defaultBasePrice : void 0;
  const ctx = { team: teamName(ev.captainId), player: player?.name, amount: ev.amount, call: ev.call, fmt: src.settings, variant: ev.seq, bids: bids.length, base };
  if (ev.type === "reveal") ctx.amount = base ?? 0;
  if (ev.type === "bid") {
    if (prev && prev.captainId !== ev.captainId) ctx.rival = teamName(prev.captainId);
    const cap = src.captains.find((c) => c.id === ev.captainId);
    if (cap?.budget && ev.amount) {
      const free = cap.budget - spentBy(cap.id);
      ctx.allIn = free > 0 && ev.amount >= free * 0.8 && (bids.length > 1 || ev.amount > (base ?? 0));
    }
  }
  if (ev.type === "call" && ev.call === 3 && src.settings.lastCall) ctx.lastCall = src.settings.lastCall;
  if (ev.type === "call" && top) {
    ctx.amount = top.amount;
    ctx.team = teamName(top.captainId);
  }
  if (ev.type === "sold" && ev.captainId) {
    const cap = src.captains.find((c) => c.id === ev.captainId);
    if (cap?.budget !== void 0) ctx.left = Math.max(0, cap.budget - spentBy(cap.id));
    ctx.squad = src.players.filter((p) => p.status === "sold" && p.teamId === ev.captainId).length;
    const others = src.players.filter((p) => p.status === "sold" && p.id !== ev.playerId);
    ctx.record = others.length >= 2 && (ev.amount ?? 0) > Math.max(...others.map((p) => p.price ?? 0));
  }
  if (ev.type === "break" || ev.type === "breakext") ctx.seconds = ev.amount;
  if (ev.type === "round") ctx.round = src.round;
  return ctx;
}
var SAMPLE_CTX = { team: "Thunder Hawks", rival: "Royal Lions", player: "Aarav Mehta", amount: 12e6, base: 2e6, bids: 5, fmt: { symbol: "\u20B9", moneyStyle: "indian" }, variant: 0 };
var HI = "0 \u0936\u0942\u0928\u094D\u092F|\u090F\u0915|\u0926\u094B|\u0924\u0940\u0928|\u091A\u093E\u0930|\u092A\u093E\u0901\u091A|\u091B\u0939|\u0938\u093E\u0924|\u0906\u0920|\u0928\u094C|\u0926\u0938|\u0917\u094D\u092F\u093E\u0930\u0939|\u092C\u093E\u0930\u0939|\u0924\u0947\u0930\u0939|\u091A\u094C\u0926\u0939|\u092A\u0902\u0926\u094D\u0930\u0939|\u0938\u094B\u0932\u0939|\u0938\u0924\u094D\u0930\u0939|\u0905\u0920\u093E\u0930\u0939|\u0909\u0928\u094D\u0928\u0940\u0938|\u092C\u0940\u0938|\u0907\u0915\u094D\u0915\u0940\u0938|\u092C\u093E\u0908\u0938|\u0924\u0947\u0908\u0938|\u091A\u094C\u092C\u0940\u0938|\u092A\u091A\u094D\u091A\u0940\u0938|\u091B\u092C\u094D\u092C\u0940\u0938|\u0938\u0924\u094D\u0924\u093E\u0908\u0938|\u0905\u091F\u094D\u0920\u093E\u0908\u0938|\u0909\u0928\u0924\u0940\u0938|\u0924\u0940\u0938|\u0907\u0915\u0924\u0940\u0938|\u092C\u0924\u094D\u0924\u0940\u0938|\u0924\u0948\u0902\u0924\u0940\u0938|\u091A\u094C\u0902\u0924\u0940\u0938|\u092A\u0948\u0902\u0924\u0940\u0938|\u091B\u0924\u094D\u0924\u0940\u0938|\u0938\u0948\u0902\u0924\u0940\u0938|\u0905\u0921\u093C\u0924\u0940\u0938|\u0909\u0928\u0924\u093E\u0932\u0940\u0938|\u091A\u093E\u0932\u0940\u0938|\u0907\u0915\u0924\u093E\u0932\u0940\u0938|\u092C\u092F\u093E\u0932\u0940\u0938|\u0924\u0948\u0902\u0924\u093E\u0932\u0940\u0938|\u091A\u094C\u0935\u093E\u0932\u0940\u0938|\u092A\u0948\u0902\u0924\u093E\u0932\u0940\u0938|\u091B\u093F\u092F\u093E\u0932\u0940\u0938|\u0938\u0948\u0902\u0924\u093E\u0932\u0940\u0938|\u0905\u0921\u093C\u0924\u093E\u0932\u0940\u0938|\u0909\u0928\u091A\u093E\u0938|\u092A\u091A\u093E\u0938|\u0907\u0915\u094D\u092F\u093E\u0935\u0928|\u092C\u093E\u0935\u0928|\u0924\u093F\u0930\u092A\u0928|\u091A\u094C\u0935\u0928|\u092A\u091A\u092A\u0928|\u091B\u092A\u094D\u092A\u0928|\u0938\u0924\u094D\u0924\u093E\u0935\u0928|\u0905\u091F\u094D\u0920\u093E\u0935\u0928|\u0909\u0928\u0938\u0920|\u0938\u093E\u0920|\u0907\u0915\u0938\u0920|\u092C\u093E\u0938\u0920|\u0924\u093F\u0930\u0938\u0920|\u091A\u094C\u0902\u0938\u0920|\u092A\u0948\u0902\u0938\u0920|\u091B\u093F\u092F\u093E\u0938\u0920|\u0938\u0921\u093C\u0938\u0920|\u0905\u0921\u093C\u0938\u0920|\u0909\u0928\u0939\u0924\u094D\u0924\u0930|\u0938\u0924\u094D\u0924\u0930|\u0907\u0915\u0939\u0924\u094D\u0924\u0930|\u092C\u0939\u0924\u094D\u0924\u0930|\u0924\u093F\u0939\u0924\u094D\u0924\u0930|\u091A\u094C\u0939\u0924\u094D\u0924\u0930|\u092A\u091A\u0939\u0924\u094D\u0924\u0930|\u091B\u093F\u0939\u0924\u094D\u0924\u0930|\u0938\u0924\u0939\u0924\u094D\u0924\u0930|\u0905\u0920\u0939\u0924\u094D\u0924\u0930|\u0909\u0928\u094D\u092F\u093E\u0938\u0940|\u0905\u0938\u094D\u0938\u0940|\u0907\u0915\u094D\u092F\u093E\u0938\u0940|\u092C\u092F\u093E\u0938\u0940|\u0924\u093F\u0930\u093E\u0938\u0940|\u091A\u094C\u0930\u093E\u0938\u0940|\u092A\u091A\u093E\u0938\u0940|\u091B\u093F\u092F\u093E\u0938\u0940|\u0938\u0924\u094D\u0924\u093E\u0938\u0940|\u0905\u091F\u094D\u0920\u093E\u0938\u0940|\u0928\u0935\u093E\u0938\u0940|\u0928\u092C\u094D\u092C\u0947|\u0907\u0915\u094D\u092F\u093E\u0928\u0935\u0947|\u092C\u093E\u0928\u0935\u0947|\u0924\u093F\u0930\u093E\u0928\u0935\u0947|\u091A\u094C\u0930\u093E\u0928\u0935\u0947|\u092A\u0902\u091A\u093E\u0928\u0935\u0947|\u091B\u093F\u092F\u093E\u0928\u0935\u0947|\u0938\u0924\u094D\u0924\u093E\u0928\u0935\u0947|\u0905\u091F\u094D\u0920\u093E\u0928\u0935\u0947|\u0928\u093F\u0928\u094D\u092F\u093E\u0928\u0935\u0947".replace(/^0 /, "").split("|");
var HI_LATIN = "shoonya|ek|do|teen|chaar|paanch|chhah|saat|aath|nau|das|gyaarah|baarah|terah|chaudah|pandrah|solah|satrah|athaarah|unnees|bees|ikkees|baaees|teyees|chaubees|pachchees|chhabbees|sattaaees|atthaaees|unatees|tees|ikatees|battees|taintees|chauntees|paintees|chhattees|saintees|adtees|untaalees|chaalees|iktaalees|bayaalees|taintaalees|chauwaalees|paintaalees|chhiyaalees|saintaalees|adtaalees|unchaas|pachaas|ikyaavan|baavan|tirpan|chauwan|pachpan|chhappan|sattaavan|atthaavan|unsath|saath|iksath|baasath|tirsath|chaunsath|painsath|chhiyaasath|sadsath|adsath|unhattar|sattar|ikahattar|bahattar|tihattar|chauhattar|pachhattar|chhihattar|satahattar|athahattar|unyaasi|assi|ikyaasi|bayaasi|tiraasi|chauraasi|pachaasi|chhiyaasi|sattaasi|atthaasi|navaasi|nabbe|ikyaanave|baanave|tiraanave|chauraanave|panchaanave|chhiyaanave|sattaanave|atthaanave|ninyaanave".split("|");
var words = (n, s) => (s === "deva" ? HI : HI_LATIN)[n] ?? String(n);
function below1000(n, s) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const hundred = s === "deva" ? "\u0938\u094C" : "sau";
  return [h ? `${words(h, s)} ${hundred}` : "", rest || !h ? words(rest, s) : ""].filter(Boolean).join(" ");
}
var CURRENCY = { "\u20B9": ["\u0930\u0941\u092A\u092F\u0947", "rupaye"], $: ["\u0921\u0949\u0932\u0930", "dollar"], "\u20AC": ["\u092F\u0942\u0930\u094B", "euro"], "\xA3": ["\u092A\u093E\u0909\u0902\u0921", "pound"], pts: ["\u092A\u0949\u0907\u0902\u091F\u094D\u0938", "points"] };
function hindiMoney(amount, fmt, s = "deva") {
  if (fmt.moneyStyle !== "indian" || amount >= 1e9) return spokenMoney(amount, fmt);
  let n = Math.round(amount);
  const units = [[1e7, "\u0915\u0930\u094B\u0921\u093C", "crore"], [1e5, "\u0932\u093E\u0916", "lakh"], [1e3, "\u0939\u091C\u093C\u093E\u0930", "hazaar"]];
  const parts = [];
  for (const [size, deva, latin] of units) {
    const q = Math.floor(n / size);
    if (q > 0) {
      parts.push(`${q > 99 ? String(q) : words(q, s)} ${s === "deva" ? deva : latin}`);
      n -= q * size;
    }
  }
  if (n > 0 || parts.length === 0) parts.push(below1000(n, s));
  const cur = CURRENCY[fmt.symbol]?.[s === "deva" ? 0 : 1];
  return (parts.join(" ") + (cur ? " " + cur : "")).trim();
}
var pick = (list, variant) => list[Math.abs(variant) % list.length];
function classic(kind, c) {
  const m = (n) => spokenMoney(n, c.fmt);
  switch (kind) {
    default:
      return null;
    // classic speaks the bidding; breaks keep their own plain announcements
    case "reveal":
      return c.player ? { text: `Up next, ${c.player}. Base price ${m(c.amount ?? 0)}.`, lang: "en" } : null;
    case "bid":
      return c.team && c.amount ? { text: `${c.team}, ${m(c.amount)}`, lang: "en" } : null;
    case "call":
      return { text: c.call === 3 && c.lastCall ? `Going thrice! ${c.lastCall}` : ["", "Going once!", "Going twice!", "Going thrice! Last call!"][c.call ?? 1] ?? "", lang: "en" };
    case "sold":
      return c.player && c.team && c.amount ? { text: `Sold! ${c.player} goes to ${c.team} for ${m(c.amount)}`, lang: "en" } : null;
    case "unsold":
      return c.player ? { text: `${c.player} goes unsold`, lang: "en" } : null;
  }
}
var en = (f) => [f, f];
var hi = (d, l) => [d, l];
var HOSTS = {
  // ------------------------------------------------------------------ ring announcer: deep, booming, larger than life
  wwe: {
    lang: "en",
    voice: { pitch: 0.7, rate: 1, gender: "male" },
    spin: [
      en(() => `Here we go! Spin that wheel! Who's next into the ring?!`),
      en(() => `Ladies and gentlemen... it is time... to SPIN!`),
      en(() => `The wheel is turning! Somebody's name is about to be called!`),
      en(() => `Round and round! Who will step into the ring next?!`)
    ],
    reveal: [
      en((v) => `Ladies and gentlemen! Making their way to the ring... ${v.p}! Opening bid, ${v.a}!`),
      en((v) => `Get on your feet! Next up... ${v.p}! We start at ${v.a}!`),
      en((v) => `In this corner... weighing in at ${v.a}... ${v.p}!`),
      en((v) => `Put your hands together for... ${v.p}! The bidding opens at ${v.a}!`),
      en((v) => `Here comes ${v.p}! And this crowd is ready! Opening bid... ${v.a}!`)
    ],
    call: [
      [en((v) => `${v.ap}Going once! Do I hear more?!`), en((v) => `${v.ap}Going once! Anybody?!`), en((v) => `Going once at ${v.a}! Who wants it?!`)],
      [en((v) => `${v.ap}Going twice! This is it!`), en((v) => `Going twice! Last chance to get in this ring!`), en((v) => `${v.ap}Going twice! Speak now!`)],
      [en((v) => `Last chance! ${v.ap}Going three times!`), en((v) => `Going three times! The referee is counting!`), en((v) => `${v.ap}Going three times! One... two...`)]
    ],
    sold: [
      en((v) => `${v.p}... is SOLD to ${v.t}, for ${v.a}! And the crowd goes WILD!`),
      en((v) => `Ding ding ding! ${v.p} belongs to ${v.t}! ${v.a}!`),
      en((v) => `It's official! ${v.t} gets ${v.p} for ${v.a}!`),
      en((v) => `Your winner... ${v.t}! ${v.p} for ${v.a}!`)
    ],
    soldHot: [
      en((v) => `IT'S OVER! ${v.p}... is SOLD to ${v.t}, for ${v.a}! What a battle! And the crowd goes WILD!`),
      en((v) => `After an absolute war... ${v.t} takes ${v.p}! ${v.a}! Unbelievable!`),
      en((v) => `What a main event! ${v.p} goes to ${v.t}, for ${v.a}! Give it up!`),
      en((v) => `And the NEW member of ${v.t}... ${v.p}! ${v.a}! What a fight!`)
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
    allIn: [en((v) => `${v.t} is going ALL IN!`), en((v) => `${v.t} is putting everything on the line!`), en((v) => `${v.t} just emptied the wallet!`)]
  },
  // ------------------------------------------------------------------ quiz-show host (Hindi): warm, personal, dramatic
  kbc: {
    lang: "hi",
    voice: { pitch: 0.6, rate: 1, gender: "male" },
    spin: [
      hi(() => `\u0924\u094B \u0926\u0947\u0935\u093F\u092F\u094B\u0902 \u0914\u0930 \u0938\u091C\u094D\u091C\u0928\u094B\u0902... \u0918\u0942\u092E \u0930\u0939\u093E \u0939\u0948 \u092A\u0939\u093F\u092F\u093E... \u0926\u0947\u0916\u0924\u0947 \u0939\u0948\u0902, \u0915\u093F\u0938\u0915\u0940 \u0915\u093C\u093F\u0938\u094D\u092E\u0924 \u091A\u092E\u0915\u0924\u0940 \u0939\u0948!`, () => `To deviyon aur sajjano... ghoom raha hai pahiya... dekhte hain, kiski kismat chamakti hai!`),
      hi(() => `\u092A\u0939\u093F\u092F\u093E \u0918\u0942\u092E \u0930\u0939\u093E \u0939\u0948... \u0914\u0930 \u0906\u092A\u0915\u0940 \u0927\u0921\u093C\u0915\u0928\u0947\u0902 \u092D\u0940!`, () => `Pahiya ghoom raha hai... aur aapki dhadkanein bhi!`),
      hi(() => `\u091A\u0932\u093F\u090F \u0926\u0947\u0916\u0924\u0947 \u0939\u0948\u0902... \u0906\u091C \u0915\u093C\u093F\u0938\u094D\u092E\u0924 \u0915\u093F\u0938 \u092A\u0930 \u092E\u0947\u0939\u0930\u092C\u093E\u0928 \u0939\u0948!`, () => `Chaliye dekhte hain... aaj kismat kis par meharbaan hai!`)
    ],
    reveal: [
      hi((v) => `\u0926\u0947\u0935\u093F\u092F\u094B\u0902 \u0914\u0930 \u0938\u091C\u094D\u091C\u0928\u094B\u0902... \u0905\u092C \u092E\u0902\u091A \u092A\u0930 \u0906 \u0930\u0939\u0947 \u0939\u0948\u0902... ${v.p}! \u0936\u0941\u0930\u0941\u0906\u0924\u0940 \u092C\u094B\u0932\u0940... ${v.a}. \u0924\u094B \u091A\u0932\u093F\u090F... \u0936\u0941\u0930\u0942 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902!`, (v) => `Deviyon aur sajjano... ab manch par aa rahe hain... ${v.p}! Shuruaati boli... ${v.a}. To chaliye... shuru karte hain!`),
      hi((v) => `\u0914\u0930 \u0905\u092C... \u091C\u093F\u0928\u0915\u093E \u0938\u092C\u0915\u094B \u0907\u0902\u0924\u091C\u093C\u093E\u0930 \u0925\u093E... ${v.p}! \u092C\u094B\u0932\u0940 \u0936\u0941\u0930\u0942 \u0939\u094B\u0924\u0940 \u0939\u0948... ${v.a} \u0938\u0947!`, (v) => `Aur ab... jinka sabko intezaar tha... ${v.p}! Boli shuru hoti hai... ${v.a} se!`),
      hi((v) => `\u0906\u092A\u0915\u0947 \u0938\u093E\u092E\u0928\u0947 \u0939\u0948\u0902... ${v.p}! \u0936\u0941\u0930\u0941\u0906\u0924\u0940 \u092C\u094B\u0932\u0940 ${v.a}. \u092C\u0924\u093E\u0907\u090F... \u0915\u094C\u0928 \u0939\u0948 \u0924\u0948\u092F\u093E\u0930?`, (v) => `Aapke saamne hain... ${v.p}! Shuruaati boli ${v.a}. Bataiye... kaun hai taiyaar?`),
      hi((v) => `\u0924\u093E\u0932\u093F\u092F\u094B\u0902 \u0938\u0947 \u0938\u094D\u0935\u093E\u0917\u0924 \u0915\u0940\u091C\u093F\u090F... ${v.p} \u0915\u093E! \u092C\u094B\u0932\u0940... ${v.a} \u0938\u0947.`, (v) => `Taaliyon se swaagat kijiye... ${v.p} ka! Boli... ${v.a} se.`),
      hi((v) => `\u0905\u0917\u0932\u093E \u0928\u093E\u092E \u0939\u0948... ${v.p}! \u0914\u0930 \u092C\u094B\u0932\u0940 \u0915\u0940 \u0936\u0941\u0930\u0941\u0906\u0924... ${v.a}.`, (v) => `Agla naam hai... ${v.p}! Aur boli ki shuruaat... ${v.a}.`)
    ],
    call: [
      [hi((v) => `${v.ap}\u090F\u0915 \u092C\u093E\u0930!`, (v) => `${v.ap}ek baar!`), hi((v) => `${v.ap}\u090F\u0915 \u092C\u093E\u0930... \u0915\u094B\u0908 \u0914\u0930?`, (v) => `${v.ap}ek baar... koi aur?`), hi((v) => `\u090F\u0915 \u092C\u093E\u0930... ${v.a}!`, (v) => `Ek baar... ${v.a}!`)],
      [hi((v) => `${v.ap}\u0926\u094B \u092C\u093E\u0930! \u0915\u094B\u0908 \u0939\u0948... \u091C\u094B \u0906\u0917\u0947 \u092C\u0922\u093C\u0947?`, (v) => `${v.ap}do baar! Koi hai... jo aage badhe?`), hi((v) => `\u0926\u094B \u092C\u093E\u0930! \u0938\u094B\u091A \u0932\u0940\u091C\u093F\u090F... \u0938\u092E\u092F \u0915\u092E \u0939\u0948!`, (v) => `Do baar! Soch lijiye... samay kam hai!`), hi((v) => `${v.ap}\u0926\u094B \u092C\u093E\u0930!`, (v) => `${v.ap}do baar!`)],
      [hi((v) => `${v.ap}\u0924\u0940\u0938\u0930\u0940 \u092C\u093E\u0930... \u092F\u0939 \u0906\u0916\u093C\u093F\u0930\u0940 \u092E\u094C\u0915\u093C\u093E \u0939\u0948!`, (v) => `${v.ap}teesri baar... yeh aakhiri mauka hai!`), hi((v) => `\u0924\u0940\u0938\u0930\u0940 \u092C\u093E\u0930... \u0914\u0930...`, (v) => `Teesri baar... aur...`), hi((v) => `${v.ap}\u0924\u0940\u0938\u0930\u0940 \u092C\u093E\u0930! \u092B\u093C\u0948\u0938\u0932\u0947 \u0915\u0940 \u0918\u0921\u093C\u0940!`, (v) => `${v.ap}teesri baar! Faisle ki ghadi!`)]
    ],
    sold: [
      hi((v) => `\u0938\u094C\u0926\u093E \u092A\u0915\u094D\u0915\u093E! ${v.p} \u0905\u092C ${v.t} \u0915\u0940 \u091F\u0940\u092E \u092E\u0947\u0902 \u0939\u0948\u0902... ${v.a} \u092E\u0947\u0902! \u092C\u0927\u093E\u0908 \u0939\u094B!`, (v) => `Sauda pakka! ${v.p} ab ${v.t} ki team mein hain... ${v.a} mein! Badhaai ho!`),
      hi((v) => `${v.t}, ${v.p} \u0905\u092C \u0906\u092A\u0915\u0947 \u0939\u0941\u090F... ${v.a} \u092E\u0947\u0902!`, (v) => `${v.t}, ${v.p} ab aapke hue... ${v.a} mein!`),
      hi((v) => `\u0914\u0930 \u092C\u094B\u0932\u0940 \u0916\u093C\u0924\u094D\u092E! ${v.p}... ${v.t} \u0915\u0947 \u0928\u093E\u092E... ${v.a} \u092E\u0947\u0902!`, (v) => `Aur boli khatam! ${v.p}... ${v.t} ke naam... ${v.a} mein!`),
      hi((v) => `\u092C\u0939\u0941\u0924-\u092C\u0939\u0941\u0924 \u092C\u0927\u093E\u0908, ${v.t}! ${v.p}... ${v.a} \u092E\u0947\u0902!`, (v) => `Bahut bahut badhaai, ${v.t}! ${v.p}... ${v.a} mein!`)
    ],
    soldHot: [
      hi((v) => `\u0914\u0930... \u0938\u094C\u0926\u093E \u092A\u0915\u094D\u0915\u093E! \u0915\u094D\u092F\u093E \u091C\u093C\u092C\u0930\u0926\u0938\u094D\u0924 \u092E\u0941\u0915\u093C\u093E\u092C\u0932\u093E \u0925\u093E! ${v.p}... ${v.a} \u092E\u0947\u0902... ${v.t} \u0915\u0947 \u0928\u093E\u092E! \u092C\u0939\u0941\u0924-\u092C\u0939\u0941\u0924 \u092C\u0927\u093E\u0908!`, (v) => `Aur... sauda pakka! Kya zabardast muqaabla tha! ${v.p}... ${v.a} mein... ${v.t} ke naam! Bahut bahut badhaai!`),
      hi((v) => `\u0915\u094D\u092F\u093E \u0932\u0921\u093C\u093E\u0908 \u0925\u0940! \u0906\u0916\u093C\u093F\u0930\u0915\u093E\u0930 ${v.t} \u0928\u0947 \u092C\u093E\u091C\u093C\u0940 \u092E\u093E\u0930 \u0932\u0940! ${v.p}... ${v.a} \u092E\u0947\u0902!`, (v) => `Kya ladaai thi! Aakhirkaar ${v.t} ne baazi maar li! ${v.p}... ${v.a} mein!`),
      hi((v) => `\u0926\u093F\u0932 \u091C\u0940\u0924 \u0932\u093F\u092F\u093E \u0906\u092A\u0928\u0947, ${v.t}! ${v.p}... ${v.a} \u092E\u0947\u0902!`, (v) => `Dil jeet liya aapne, ${v.t}! ${v.p}... ${v.a} mein!`),
      hi((v) => `\u0907\u0924\u093F\u0939\u093E\u0938 \u092C\u0928 \u0917\u092F\u093E! ${v.p}... ${v.t} \u0915\u0940 \u091F\u0940\u092E \u092E\u0947\u0902... ${v.a} \u092E\u0947\u0902!`, (v) => `Itihaas ban gaya! ${v.p}... ${v.t} ki team mein... ${v.a} mein!`)
    ],
    unsold: [hi((v) => `\u0905\u092B\u093C\u0938\u094B\u0938... ${v.p} \u0915\u0947 \u0932\u093F\u090F \u0906\u091C \u0915\u094B\u0908 \u092C\u094B\u0932\u0940 \u0928\u0939\u0940\u0902 \u0932\u0917\u0940.`, (v) => `Afsos... ${v.p} ke liye aaj koi boli nahin lagi.`), hi((v) => `${v.p}... \u0907\u0938 \u092C\u093E\u0930 \u0928\u0939\u0940\u0902. \u0936\u093E\u092F\u0926 \u0905\u0917\u0932\u0947 \u0930\u093E\u0909\u0902\u0921 \u092E\u0947\u0902!`, (v) => `${v.p}... is baar nahin. Shaayad agle round mein!`)],
    undo: [hi(() => `\u0930\u0941\u0915\u093F\u090F, \u0930\u0941\u0915\u093F\u090F... \u092F\u0939 \u092C\u094B\u0932\u0940 \u0935\u093E\u092A\u0938 \u0932\u0947 \u0932\u0940 \u0917\u0908 \u0939\u0948.`, () => `Rukiye, rukiye... yeh boli wapas le li gayi hai.`), hi(() => `\u090F\u0915 \u092E\u093F\u0928\u091F... \u092F\u0939 \u092C\u094B\u0932\u0940 \u0930\u0926\u094D\u0926!`, () => `Ek minute... yeh boli radd!`)],
    brk: [hi((v) => `\u0926\u0947\u0935\u093F\u092F\u094B\u0902 \u0914\u0930 \u0938\u091C\u094D\u091C\u0928\u094B\u0902... \u0905\u092C \u090F\u0915 \u091B\u094B\u091F\u093E \u0938\u093E \u092C\u094D\u0930\u0947\u0915... ${v.dur} \u0915\u093E. \u0915\u092A\u094D\u0924\u093E\u0928 \u0905\u092A\u0928\u0940 \u0930\u0923\u0928\u0940\u0924\u093F \u092C\u0928\u093E\u0907\u090F... \u092E\u093F\u0932\u0924\u0947 \u0939\u0948\u0902 \u092C\u094D\u0930\u0947\u0915 \u0915\u0947 \u092C\u093E\u0926!`, (v) => `Deviyon aur sajjano... ab ek chhota sa break... ${v.dur} ka. Captain apni ranneeti banaiye... milte hain break ke baad!`), hi((v) => `\u0925\u094B\u0921\u093C\u093E \u0906\u0930\u093E\u092E... ${v.dur} \u0915\u093E \u092C\u094D\u0930\u0947\u0915. \u0915\u0939\u0940\u0902 \u092E\u0924 \u091C\u093E\u0907\u090F!`, (v) => `Thoda aaraam... ${v.dur} ka break. Kahin mat jaiye!`)],
    brkext: [hi((v) => `\u092C\u094D\u0930\u0947\u0915 \u0925\u094B\u0921\u093C\u093E \u0914\u0930... ${v.dur} \u0914\u0930!`, (v) => `Break thoda aur... ${v.dur} aur!`)],
    brkend: [hi(() => `\u0938\u094D\u0935\u093E\u0917\u0924 \u0939\u0948 \u0906\u092A\u0915\u093E \u0935\u093E\u092A\u0938! \u0924\u094B \u091A\u0932\u093F\u090F... \u0916\u0947\u0932 \u092B\u093F\u0930 \u0936\u0941\u0930\u0942 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902!`, () => `Swaagat hai aapka wapas! To chaliye... khel phir shuru karte hain!`), hi(() => `\u0914\u0930 \u0939\u092E \u0935\u093E\u092A\u0938 \u0906 \u0917\u090F \u0939\u0948\u0902! \u0924\u0948\u092F\u093E\u0930 \u0939\u0948\u0902 \u0906\u092A?`, () => `Aur hum wapas aa gaye hain! Taiyaar hain aap?`)],
    round: [hi((v) => `\u0926\u0947\u0935\u093F\u092F\u094B\u0902 \u0914\u0930 \u0938\u091C\u094D\u091C\u0928\u094B\u0902... \u0936\u0941\u0930\u0942 \u0939\u094B\u0924\u093E \u0939\u0948... \u0930\u093E\u0909\u0902\u0921 ${v.round}! \u0928\u0908 \u0909\u092E\u094D\u092E\u0940\u0926\u0947\u0902... \u0928\u090F \u092E\u094C\u0915\u093C\u0947!`, (v) => `Deviyon aur sajjano... shuru hota hai... round ${v.round}! Nayi ummeedein... naye mauke!`)],
    record: [hi(() => `\u0914\u0930 \u092F\u0939 \u0939\u0948 \u0906\u091C \u0915\u0940 \u0938\u092C\u0938\u0947 \u092C\u0921\u093C\u0940 \u092C\u094B\u0932\u0940!`, () => `Aur yeh hai aaj ki sabse badi boli!`), hi(() => `\u0928\u092F\u093E \u0930\u093F\u0915\u0949\u0930\u094D\u0921! \u0906\u091C \u0915\u0940 \u0938\u092C\u0938\u0947 \u092E\u0939\u0901\u0917\u0940 \u0916\u093C\u0930\u0940\u0926!`, () => `Naya record! Aaj ki sabse mehngi khareed!`)],
    steal: [hi(() => `\u0915\u094D\u092F\u093E \u0938\u0938\u094D\u0924\u093E \u0938\u094C\u0926\u093E \u0939\u0948!`, () => `Kya sasta sauda hai!`), hi(() => `\u092C\u0939\u0941\u0924 \u0939\u0940 \u0938\u092E\u091D\u0926\u093E\u0930\u0940 \u0915\u0940 \u0916\u093C\u0930\u0940\u0926!`, () => `Bahut hi samajhdaari ki khareed!`)],
    left: [hi((v) => `${v.t} \u0915\u0947 \u092A\u093E\u0938 \u0905\u092C \u092C\u091A\u0947 \u0939\u0948\u0902... ${v.left}.`, (v) => `${v.t} ke paas ab bache hain... ${v.left}.`), hi((v) => `${v.t}, \u0906\u092A\u0915\u0947 \u092A\u0930\u094D\u0938 \u092E\u0947\u0902 \u0905\u092C ${v.left} \u0939\u0948\u0902.`, (v) => `${v.t}, aapke purse mein ab ${v.left} hain.`)],
    allIn: [hi((v) => `${v.t} \u0928\u0947 \u0938\u092C \u0915\u0941\u091B \u0926\u093E\u0901\u0935 \u092A\u0930 \u0932\u0917\u093E \u0926\u093F\u092F\u093E \u0939\u0948!`, (v) => `${v.t} ne sab kuchh daanv par laga diya hai!`), hi((v) => `${v.t}, \u092C\u0939\u0941\u0924 \u092C\u0921\u093C\u093E \u091C\u094B\u0916\u093F\u092E!`, (v) => `${v.t}, bahut bada jokhim!`)]
  },
  // ------------------------------------------------------------------ arena narrator: cold at first, roaring by the end
  mk: {
    lang: "en",
    voice: { pitch: 0.25, rate: 1, gender: "male" },
    spin: [en(() => `Choose your destiny...`), en(() => `The wheel turns... fate decides.`), en(() => `Who will be summoned to the arena?`)],
    reveal: [
      en((v) => `${v.p}... enters the arena. Opening bid... ${v.a}.`),
      en((v) => `A new challenger approaches... ${v.p}! The bidding begins at ${v.a}.`),
      en((v) => `From the shadows... ${v.p}. Opening bid, ${v.a}.`),
      en((v) => `The tournament summons ${v.p}! Bidding starts at ${v.a}.`)
    ],
    call: [
      [en((v) => `${v.ap}Going once! Prepare yourselves!`), en((v) => `${v.ap}Going once...`), en((v) => `Going once... the arena waits.`)],
      [en((v) => `${v.ap}Going twice! Last warning!`), en((v) => `Going twice... who dares?`), en((v) => `${v.ap}Going twice!`)],
      [en(() => `Going three times... FINISH HIM!`), en((v) => `${v.ap}Going three times... FINISH HIM!`), en(() => `No one dares? Going three times... FINISH HIM!`)]
    ],
    sold: [
      en((v) => `${v.t} wins! ${v.p} is theirs... for ${v.a}! Flawless victory!`),
      en((v) => `Victory! ${v.p} joins ${v.t}, for ${v.a}!`),
      en((v) => `${v.t} claims ${v.p}... ${v.a}. Well done.`),
      en((v) => `The battle is won. ${v.p}, to ${v.t}, for ${v.a}!`)
    ],
    soldHot: [
      en((v) => `Fatality! ${v.t} claims ${v.p}... for ${v.a}! Flawless victory!`),
      en((v) => `Brutality! ${v.p} goes to ${v.t}, for ${v.a}!`),
      en((v) => `${v.t} wins the war! ${v.p}, for ${v.a}! Outstanding!`),
      en((v) => `Legendary! ${v.t} takes ${v.p}... ${v.a}! Flawless victory!`)
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
    allIn: [en((v) => `${v.t} risks everything!`), en((v) => `${v.t} holds nothing back!`)]
  },
  // ------------------------------------------------------------------ game-show host
  show: {
    lang: "en",
    voice: { pitch: 1.1, rate: 1, gender: "female" },
    spin: [en(() => `Spin it to win it! Round and round it goes... where it stops, nobody knows!`), en(() => `Ooh, here comes the wheel! Fingers crossed, everybody!`), en(() => `Big money, big money... let's spin!`)],
    reveal: [
      en((v) => `Welcome back, everybody! Our next contestant is... ${v.p}! The bidding opens at ${v.a}! Let's play!`),
      en((v) => `Ooh, here's a good one! Give it up for... ${v.p}! Starting at ${v.a}!`),
      en((v) => `Behind door number one... it's ${v.p}! Bidding starts at ${v.a}!`),
      en((v) => `Say hello to ${v.p}! We're starting at ${v.a}!`)
    ],
    call: [
      [en((v) => `${v.ap}Going once... the clock is ticking!`), en((v) => `${v.ap}Going once!`)],
      [en((v) => `${v.ap}Going twice! Is that your final answer, everybody?`), en((v) => `Going twice! Tick tock!`)],
      [en((v) => `${v.ap}Going three times... last chance, last chance!`), en(() => `Going three times... any last buzzers?`)]
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
    squad: [en((v) => `That's player number ${v.n} for ${v.t}!`)]
  },
  // ------------------------------------------------------------------ smooth late-night voice
  velvet: {
    lang: "en",
    voice: { pitch: 0.95, rate: 1, gender: "female" },
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
    allIn: [en((v) => `${v.t}... putting everything on the table. I like that.`)]
  },
  // ------------------------------------------------------------------ movie-trailer narrator
  trailer: {
    lang: "en",
    voice: { pitch: 0.4, rate: 1, gender: "male" },
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
    allIn: [en((v) => `${v.t}... risks... everything.`)]
  },
  // ------------------------------------------------------------------ cricket commentary (Hindi): loud and joyful
  cricket: {
    lang: "hi",
    voice: { pitch: 1, rate: 1, gender: "male" },
    spin: [
      hi(() => `\u091F\u0949\u0938 \u0939\u094B \u091A\u0941\u0915\u093E \u0939\u0948! \u0926\u0947\u0916\u0924\u0947 \u0939\u0948\u0902 \u0905\u0917\u0932\u093E \u092C\u0932\u094D\u0932\u0947\u092C\u093E\u091C\u093C \u0915\u094C\u0928!`, () => `Toss ho chuka hai! Dekhte hain agla ballebaaz kaun!`),
      hi(() => `\u092A\u0939\u093F\u092F\u093E \u0918\u0942\u092E \u0930\u0939\u093E \u0939\u0948! \u0905\u0917\u0932\u093E \u0916\u093F\u0932\u093E\u0921\u093C\u0940 \u0915\u094C\u0928 \u0939\u094B\u0917\u093E?`, () => `Pahiya ghoom raha hai! Agla khiladi kaun hoga?`),
      hi(() => `\u0938\u094D\u091F\u0947\u0921\u093F\u092F\u092E \u092E\u0947\u0902 \u0938\u0928\u094D\u0928\u093E\u091F\u093E! \u0915\u093F\u0938\u0915\u093E \u0928\u093E\u092E \u0906\u090F\u0917\u093E?`, () => `Stadium mein sannaata! Kiska naam aayega?`)
    ],
    reveal: [
      hi((v) => `\u0914\u0930 \u092E\u0948\u0926\u093E\u0928 \u092A\u0930 \u0909\u0924\u0930 \u0930\u0939\u0947 \u0939\u0948\u0902... ${v.p}! \u092C\u0947\u0938 \u092A\u094D\u0930\u093E\u0907\u0938 ${v.a}! \u091C\u093C\u094B\u0930\u0926\u093E\u0930 \u0924\u093E\u0932\u093F\u092F\u093E\u0901!`, (v) => `Aur maidaan par utar rahe hain... ${v.p}! Base price ${v.a}! Zordaar taaliyaan!`),
      hi((v) => `\u0928\u092F\u093E \u092C\u0932\u094D\u0932\u0947\u092C\u093E\u091C\u093C, \u0928\u092F\u093E \u091C\u094B\u0936! ${v.p}! \u092C\u094B\u0932\u0940 \u0936\u0941\u0930\u0942 ${v.a} \u0938\u0947!`, (v) => `Naya ballebaaz, naya josh! ${v.p}! Boli shuru ${v.a} se!`),
      hi((v) => `\u0915\u094D\u0930\u0940\u091C\u093C \u092A\u0930 \u0906 \u0917\u090F \u0939\u0948\u0902 ${v.p}! \u092C\u0947\u0938 \u092A\u094D\u0930\u093E\u0907\u0938 ${v.a}!`, (v) => `Crease par aa gaye hain ${v.p}! Base price ${v.a}!`),
      hi((v) => `\u0938\u092C\u0915\u0940 \u0928\u091C\u093C\u0930\u0947\u0902 ${v.p} \u092A\u0930! \u092C\u094B\u0932\u0940 ${v.a} \u0938\u0947 \u0936\u0941\u0930\u0942!`, (v) => `Sabki nazrein ${v.p} par! Boli ${v.a} se shuru!`),
      hi((v) => `\u092A\u0935\u0947\u0932\u093F\u092F\u0928 \u0938\u0947 \u0928\u093F\u0915\u0932 \u0930\u0939\u0947 \u0939\u0948\u0902 ${v.p}! \u0936\u0941\u0930\u0941\u0906\u0924 ${v.a} \u0938\u0947!`, (v) => `Pavilion se nikal rahe hain ${v.p}! Shuruaat ${v.a} se!`)
    ],
    call: [
      [hi((v) => `${v.ap}\u090F\u0915 \u092C\u093E\u0930!`, (v) => `${v.ap}ek baar!`), hi((v) => `\u090F\u0915 \u092C\u093E\u0930! ${v.a}!`, (v) => `Ek baar! ${v.a}!`)],
      [hi((v) => `${v.ap}\u0926\u094B \u092C\u093E\u0930! \u0906\u0916\u093C\u093F\u0930\u0940 \u0913\u0935\u0930!`, (v) => `${v.ap}do baar! Aakhiri over!`), hi(() => `\u0926\u094B \u092C\u093E\u0930! \u0915\u094B\u0908 \u0914\u0930 \u0936\u0949\u091F?`, () => `Do baar! Koi aur shot?`)],
      [hi((v) => `${v.ap}\u0924\u0940\u0938\u0930\u0940 \u092C\u093E\u0930! \u0906\u0916\u093C\u093F\u0930\u0940 \u0917\u0947\u0902\u0926!`, (v) => `${v.ap}teesri baar! Aakhiri gend!`), hi(() => `\u0924\u0940\u0938\u0930\u0940 \u092C\u093E\u0930! \u0905\u0902\u092A\u093E\u092F\u0930 \u0915\u0940 \u0909\u0901\u0917\u0932\u0940 \u0909\u0920\u0928\u0947 \u0935\u093E\u0932\u0940 \u0939\u0948!`, () => `Teesri baar! Umpire ki ungli uthne waali hai!`)]
    ],
    sold: [
      hi((v) => `\u0938\u094C\u0926\u093E \u092A\u0915\u094D\u0915\u093E! ${v.p}, ${v.t} \u0915\u0940 \u091F\u0940\u092E \u092E\u0947\u0902, ${v.a} \u092E\u0947\u0902! \u0915\u094D\u092F\u093E \u092C\u093E\u0924 \u0939\u0948!`, (v) => `Sauda pakka! ${v.p}, ${v.t} ki team mein, ${v.a} mein! Kya baat hai!`),
      hi((v) => `${v.t} \u0928\u0947 ${v.p} \u0915\u094B \u0905\u092A\u0928\u0940 \u091F\u0940\u092E \u092E\u0947\u0902 \u0932\u093F\u092F\u093E! ${v.a}!`, (v) => `${v.t} ne ${v.p} ko apni team mein liya! ${v.a}!`),
      hi((v) => `\u0915\u0948\u091A \u092A\u0915\u0921\u093C \u0932\u093F\u092F\u093E! ${v.p}, ${v.t} \u0915\u0947! ${v.a}!`, (v) => `Catch pakad liya! ${v.p}, ${v.t} ke! ${v.a}!`),
      hi((v) => `\u0921\u0940\u0932 \u0921\u0928! ${v.p}, ${v.a} \u092E\u0947\u0902, ${v.t} \u0915\u0947 \u0928\u093E\u092E!`, (v) => `Deal done! ${v.p}, ${v.a} mein, ${v.t} ke naam!`)
    ],
    soldHot: [
      hi((v) => `\u0914\u0930 \u092F\u0947... \u092E\u0948\u091A \u0916\u093C\u0924\u094D\u092E! ${v.t} \u0928\u0947 \u092C\u093E\u091C\u093C\u0940 \u092E\u093E\u0930 \u0932\u0940! ${v.p}, ${v.a} \u092E\u0947\u0902! \u0915\u094D\u092F\u093E \u092E\u0948\u091A \u0925\u093E, \u0915\u094D\u092F\u093E \u092E\u0948\u091A \u0925\u093E!`, (v) => `Aur ye... match khatam! ${v.t} ne baazi maar li! ${v.p}, ${v.a} mein! Kya match tha, kya match tha!`),
      hi((v) => `\u0906\u0916\u093C\u093F\u0930\u0940 \u0917\u0947\u0902\u0926 \u092A\u0930 \u091C\u0940\u0924! ${v.t}! ${v.p}, ${v.a} \u092E\u0947\u0902!`, (v) => `Aakhiri gend par jeet! ${v.t}! ${v.p}, ${v.a} mein!`),
      hi((v) => `\u091F\u094D\u0930\u0949\u092B\u093C\u0940 \u091C\u0948\u0938\u0940 \u091C\u0940\u0924! ${v.p}, ${v.t} \u0915\u0947! ${v.a}!`, (v) => `Trophy jaisi jeet! ${v.p}, ${v.t} ke! ${v.a}!`),
      hi((v) => `\u0915\u094D\u092F\u093E \u092B\u093C\u093F\u0928\u093F\u0936 \u0939\u0948! ${v.t} \u0928\u0947 ${v.p} \u0915\u094B \u091C\u0940\u0924\u093E, ${v.a} \u092E\u0947\u0902!`, (v) => `Kya finish hai! ${v.t} ne ${v.p} ko jeeta, ${v.a} mein!`)
    ],
    unsold: [hi((v) => `\u0905\u0930\u0947! ${v.p} \u0915\u0947 \u0932\u093F\u090F \u0915\u094B\u0908 \u092C\u094B\u0932\u0940 \u0928\u0939\u0940\u0902! \u0935\u093E\u092A\u0938 \u092A\u0935\u0947\u0932\u093F\u092F\u0928!`, (v) => `Arre! ${v.p} ke liye koi boli nahin! Wapas pavilion!`), hi((v) => `${v.p}... \u0921\u0915 \u092A\u0930 \u0906\u0909\u091F! \u0905\u0917\u0932\u0947 \u0930\u093E\u0909\u0902\u0921 \u092E\u0947\u0902 \u092E\u093F\u0932\u0947\u0902\u0917\u0947!`, (v) => `${v.p}... duck par out! Agle round mein milenge!`)],
    undo: [hi(() => `\u0930\u093F\u0935\u094D\u092F\u0942! \u0914\u0930 \u092B\u093C\u0948\u0938\u0932\u093E \u092C\u0926\u0932 \u0917\u092F\u093E! \u092C\u094B\u0932\u0940 \u0935\u093E\u092A\u0938!`, () => `Review! Aur faisla badal gaya! Boli wapas!`), hi(() => `\u0928\u094B \u092C\u0949\u0932! \u092F\u0939 \u092C\u094B\u0932\u0940 \u0917\u093F\u0928\u0940 \u0928\u0939\u0940\u0902 \u091C\u093E\u090F\u0917\u0940!`, () => `No ball! Yeh boli gini nahin jaayegi!`)],
    brk: [hi((v) => `\u0921\u094D\u0930\u093F\u0902\u0915\u094D\u0938 \u092C\u094D\u0930\u0947\u0915! ${v.dur}! \u0915\u092A\u094D\u0924\u093E\u0928, \u0905\u092A\u0928\u0940 \u0930\u0923\u0928\u0940\u0924\u093F \u092C\u0928\u093E\u0907\u090F!`, (v) => `Drinks break! ${v.dur}! Captain, apni ranneeti banaiye!`), hi((v) => `\u0938\u094D\u091F\u094D\u0930\u0948\u091F\u0947\u091C\u093F\u0915 \u091F\u093E\u0907\u092E \u0906\u0909\u091F! ${v.dur}!`, (v) => `Strategic time out! ${v.dur}!`)],
    brkext: [hi((v) => `\u092C\u094D\u0930\u0947\u0915 \u092C\u0922\u093C\u093E! ${v.dur} \u0914\u0930!`, (v) => `Break badha! ${v.dur} aur!`)],
    brkend: [hi(() => `\u0916\u0947\u0932 \u092B\u093F\u0930 \u0936\u0941\u0930\u0942! \u091A\u0932\u093F\u090F, \u0927\u092E\u093E\u0915\u093E \u0915\u0930\u0924\u0947 \u0939\u0948\u0902!`, () => `Khel phir shuru! Chaliye, dhamaaka karte hain!`), hi(() => `\u0916\u093F\u0932\u093E\u0921\u093C\u0940 \u092E\u0948\u0926\u093E\u0928 \u092A\u0930 \u0932\u094C\u091F \u0906\u090F \u0939\u0948\u0902!`, () => `Khiladi maidaan par laut aaye hain!`)],
    round: [hi((v) => `\u0930\u093E\u0909\u0902\u0921 ${v.round}! \u0928\u0908 \u092A\u093E\u0930\u0940, \u0928\u092F\u093E \u091C\u094B\u0936!`, (v) => `Round ${v.round}! Nayi paari, naya josh!`)],
    record: [hi(() => `\u0906\u091C \u0915\u0940 \u0938\u092C\u0938\u0947 \u092E\u0939\u0901\u0917\u0940 \u0916\u093C\u0930\u0940\u0926! \u0930\u093F\u0915\u0949\u0930\u094D\u0921 \u091F\u0942\u091F \u0917\u092F\u093E!`, () => `Aaj ki sabse mehngi khareed! Record toot gaya!`), hi(() => `\u0928\u092F\u093E \u0930\u093F\u0915\u0949\u0930\u094D\u0921! \u0907\u0924\u0928\u0940 \u092C\u0921\u093C\u0940 \u092C\u094B\u0932\u0940 \u0906\u091C \u0924\u0915 \u0928\u0939\u0940\u0902 \u0932\u0917\u0940!`, () => `Naya record! Itni badi boli aaj tak nahin lagi!`)],
    steal: [hi(() => `\u092C\u093F\u0932\u094D\u0915\u0941\u0932 \u0938\u0938\u094D\u0924\u0947 \u092E\u0947\u0902! \u0915\u094D\u092F\u093E \u091A\u094B\u0930\u0940 \u0939\u0948!`, () => `Bilkul saste mein! Kya chori hai!`), hi(() => `\u092C\u0947\u0938 \u092A\u094D\u0930\u093E\u0907\u0938 \u092A\u0930! \u0915\u094D\u092F\u093E \u0938\u092E\u091D\u0926\u093E\u0930\u0940 \u0939\u0948!`, () => `Base price par! Kya samajhdaari hai!`)],
    left: [hi((v) => `${v.t} \u0915\u0947 \u092A\u0930\u094D\u0938 \u092E\u0947\u0902 \u092C\u091A\u0947 ${v.left}!`, (v) => `${v.t} ke purse mein bache ${v.left}!`), hi((v) => `${v.t} \u0915\u0947 \u092A\u093E\u0938 \u0905\u092C ${v.left} \u092C\u093E\u0915\u093C\u0940!`, (v) => `${v.t} ke paas ab ${v.left} baaki!`)],
    allIn: [hi((v) => `${v.t} \u0928\u0947 \u092A\u0942\u0930\u093E \u092A\u0930\u094D\u0938 \u091D\u094B\u0902\u0915 \u0926\u093F\u092F\u093E!`, (v) => `${v.t} ne poora purse jhonk diya!`), hi((v) => `${v.t} \u0928\u0947 \u0938\u092C \u0915\u0941\u091B \u0926\u093E\u0901\u0935 \u092A\u0930 \u0932\u0917\u093E \u0926\u093F\u092F\u093E!`, (v) => `${v.t} ne sab kuchh daanv par laga diya!`)]
  },
  // ------------------------------------------------------------------ friendly smart assistant
  assistant: {
    lang: "en",
    voice: { pitch: 1, rate: 1, gender: "female" },
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
    squad: [en((v) => `That's player number ${v.n} for ${v.t}.`)]
  }
};
var LULL = {
  wwe: {
    open: [en(() => `Who's going to start this one?! Somebody make a move!`), en((v) => `${v.p} is waiting! Who wants to throw the first bid?!`), en(() => `Come on! Don't be shy! Who's opening?!`), en(() => `The ring is empty! Somebody get in there!`)],
    heat: [
      [en((v) => `${v.t} is the only one in the ring at ${v.a}! Anybody else?!`), en((v) => `${v.a} from ${v.t}... is that it?! Who's next?!`), en((v) => `Come on! ${v.t} can't have it that easy!`), en((v) => `Is nobody going to challenge ${v.t}?!`)],
      [en((v) => `${v.t} holds it at ${v.a}! Who's got the guts?!`), en(() => `The bid stands! Do I hear more?!`), en((v) => `${v.a}! Is anybody stepping up?!`), en((v) => `${v.t} is waiting for a challenger!`)],
      [en((v) => `What a fight! ${v.t} leads at ${v.a}! Who's next?!`), en(() => `This crowd wants MORE! Anybody?!`), en((v) => `${v.t} is on top... but for how long?!`), en((v) => `Somebody answer ${v.t}!`)],
      [en((v) => `This is a WAR! ${v.t} sits at ${v.a}! Who dares to go higher?!`), en(() => `Unbelievable bidding! Is there anybody left standing?!`), en((v) => `${v.t} at ${v.a}! The crowd is going insane!`), en((v) => `Will anybody top ${v.a}?! Come on!`)]
    ],
    rival: [en((v) => `${v.r}, are you just going to let ${v.t} have this?!`), en((v) => `${v.r}! Your move!`), en((v) => `${v.r}, it's now or never!`)]
  },
  kbc: {
    open: [
      hi(() => `\u0924\u094B \u0926\u0947\u0935\u093F\u092F\u094B\u0902 \u0914\u0930 \u0938\u091C\u094D\u091C\u0928\u094B\u0902... \u0915\u094C\u0928 \u0932\u0917\u093E\u090F\u0917\u093E \u092A\u0939\u0932\u0940 \u092C\u094B\u0932\u0940?`, () => `To deviyon aur sajjano... kaun lagaayega pehli boli?`),
      hi((v) => `${v.p} \u0906\u092A\u0915\u093E \u0907\u0902\u0924\u091C\u093C\u093E\u0930 \u0915\u0930 \u0930\u0939\u0947 \u0939\u0948\u0902... \u0915\u094B\u0908 \u0924\u094B \u092C\u094B\u0932\u0940 \u0932\u0917\u093E\u0907\u090F!`, (v) => `${v.p} aapka intezaar kar rahe hain... koi to boli lagaiye!`),
      hi(() => `\u0938\u094B\u091A\u093F\u090F \u092E\u0924... \u092C\u094B\u0932\u0940 \u0932\u0917\u093E\u0907\u090F!`, () => `Sochiye mat... boli lagaiye!`),
      hi(() => `\u092E\u0902\u091A \u0924\u0948\u092F\u093E\u0930 \u0939\u0948... \u092C\u0938 \u0906\u092A\u0915\u0940 \u092C\u094B\u0932\u0940 \u0915\u093E \u0907\u0902\u0924\u091C\u093C\u093E\u0930 \u0939\u0948!`, () => `Manch taiyaar hai... bas aapki boli ka intezaar hai!`)
    ],
    heat: [
      [hi((v) => `${v.t} \u0915\u0940 \u092C\u094B\u0932\u0940... ${v.a}. \u0915\u094D\u092F\u093E \u0915\u094B\u0908 \u0914\u0930 \u0939\u0948?`, (v) => `${v.t} ki boli... ${v.a}. Kya koi aur hai?`), hi((v) => `\u092C\u0938 ${v.t}? \u0914\u0930 \u0915\u094B\u0908 \u0928\u0939\u0940\u0902?`, (v) => `Bas ${v.t}? Aur koi nahin?`), hi((v) => `${v.a} \u092A\u0930 \u0905\u091F\u0915\u0940 \u0939\u0948 \u092C\u094B\u0932\u0940... \u0915\u094B\u0908 \u0906\u0917\u0947 \u0906\u090F\u0917\u093E?`, (v) => `${v.a} par atki hai boli... koi aage aayega?`)],
      [hi((v) => `${v.t} \u0906\u0917\u0947 \u0939\u0948\u0902... ${v.a}. \u0915\u094B\u0908 \u091A\u0941\u0928\u094C\u0924\u0940 \u0926\u0947\u0917\u093E?`, (v) => `${v.t} aage hain... ${v.a}. Koi chunauti dega?`), hi((v) => `\u092C\u094B\u0932\u0940 ${v.t} \u0915\u0947 \u092A\u093E\u0938 \u0939\u0948... \u0914\u0930 \u0906\u092A?`, (v) => `Boli ${v.t} ke paas hai... aur aap?`), hi(() => `\u0938\u092E\u092F \u0928\u093F\u0915\u0932 \u0930\u0939\u093E \u0939\u0948... \u0915\u094B\u0908 \u0914\u0930 \u092C\u094B\u0932\u0940?`, () => `Samay nikal raha hai... koi aur boli?`)],
      [hi((v) => `\u0915\u094D\u092F\u093E \u092E\u0941\u0915\u093C\u093E\u092C\u0932\u093E \u0939\u0948! ${v.t} \u0906\u0917\u0947 \u0939\u0948\u0902 ${v.a} \u092A\u0930... \u0905\u092C \u0915\u094C\u0928?`, (v) => `Kya muqaabla hai! ${v.t} aage hain ${v.a} par... ab kaun?`), hi(() => `\u092E\u093E\u0939\u094C\u0932 \u0917\u0930\u092E \u0939\u0948... \u0915\u094B\u0908 \u0914\u0930 \u0939\u093F\u092E\u094D\u092E\u0924 \u0915\u0930\u0947\u0917\u093E?`, () => `Maahaul garam hai... koi aur himmat karega?`), hi((v) => `${v.t} \u0928\u0947 \u092C\u093E\u091C\u093C\u0940 \u092A\u0915\u0921\u093C\u0940 \u0939\u0941\u0908 \u0939\u0948... \u0915\u094B\u0908 \u091B\u0940\u0928\u0947\u0917\u093E?`, (v) => `${v.t} ne baazi pakdi hui hai... koi chheenega?`)],
      [hi((v) => `\u0926\u0947\u0935\u093F\u092F\u094B\u0902 \u0914\u0930 \u0938\u091C\u094D\u091C\u0928\u094B\u0902, \u092F\u0939 \u092C\u094B\u0932\u0940 \u0907\u0924\u093F\u0939\u093E\u0938 \u092C\u0928\u093E \u0930\u0939\u0940 \u0939\u0948! ${v.t}, ${v.a}... \u0915\u094D\u092F\u093E \u0915\u094B\u0908 \u0914\u0930?`, (v) => `Deviyon aur sajjano, yeh boli itihaas bana rahi hai! ${v.t}, ${v.a}... kya koi aur?`), hi((v) => `\u0926\u093F\u0932 \u0925\u093E\u092E \u0915\u0947 \u092C\u0948\u0920\u093F\u090F... \u0915\u094C\u0928 \u0926\u0947\u0917\u093E ${v.t} \u0915\u094B \u091F\u0915\u094D\u0915\u0930?`, (v) => `Dil thaam ke baithiye... kaun dega ${v.t} ko takkar?`), hi(() => `\u0905\u0935\u093F\u0936\u094D\u0935\u0938\u0928\u0940\u092F \u092E\u0941\u0915\u093C\u093E\u092C\u0932\u093E! \u0915\u094D\u092F\u093E \u092F\u0939 \u0906\u0916\u093C\u093F\u0930\u0940 \u092C\u094B\u0932\u0940 \u0939\u0948?`, () => `Avishvasneeya muqaabla! Kya yeh aakhiri boli hai?`)]
    ],
    rival: [hi((v) => `${v.r}, \u0915\u094D\u092F\u093E \u0906\u092A \u0939\u093E\u0930 \u092E\u093E\u0928 \u0932\u0947\u0902\u0917\u0947?`, (v) => `${v.r}, kya aap haar maan lenge?`), hi((v) => `${v.r}, \u0906\u092A\u0915\u0940 \u092C\u093E\u0930\u0940 \u0939\u0948!`, (v) => `${v.r}, aapki baari hai!`)]
  },
  mk: {
    open: [en(() => `Who will step into the arena first?`), en(() => `The arena waits... who dares?`), en((v) => `${v.p} stands alone... challenge them.`)],
    heat: [
      [en((v) => `${v.t} stands alone at ${v.a}... who will fight?`), en((v) => `No challenger for ${v.t}?`), en((v) => `${v.a}... the arena is silent.`)],
      [en((v) => `${v.t} holds the arena at ${v.a}. Who dares?`), en((v) => `Is there no one to face ${v.t}?`), en((v) => `The challenge stands... ${v.a}.`)],
      [en((v) => `${v.t} leads at ${v.a}... the battle rages on. Who's next?`), en(() => `Fight back! Or fall!`), en((v) => `${v.t} awaits the next challenger...`)],
      [en((v) => `Legendary battle! ${v.t} at ${v.a}... who will strike next?`), en(() => `The arena trembles! Any warrior left?`), en((v) => `${v.a}... only the brave go higher!`)]
    ],
    rival: [en((v) => `${v.r}... will you surrender?`), en((v) => `${v.r}... fight back!`)]
  },
  show: {
    open: [en(() => `Who's going to buzz in first? Come on, don't be shy!`), en((v) => `${v.p} is up for grabs! Who wants to play?`), en(() => `The board is empty! Let's get a bid!`)],
    heat: [
      [en((v) => `${v.t} is the only one on the board at ${v.a}! Anybody else want to play?`), en((v) => `Just ${v.t} so far! Come on, everybody!`), en((v) => `${v.a} from ${v.t}... do I hear another buzzer?`)],
      [en((v) => `${v.t} is in the lead at ${v.a}! Who's next?`), en(() => `Ooh, the clock is ticking! Any more bids?`), en((v) => `${v.t} has it for now! Anybody?`)],
      [en((v) => `What a round! ${v.t} leads at ${v.a}! Who's going to buzz in?`), en(() => `The board is hot! Any more?`), en((v) => `${v.t} is on top... can anybody beat it?`)],
      [en((v) => `This is the round of the night! ${v.t} at ${v.a}! Who's still playing?`), en(() => `Oh my goodness! Anybody going higher?!`), en((v) => `${v.t} at ${v.a}! Is that your final answer, everybody?`)]
    ],
    rival: [en((v) => `${v.r}, are you going to let that go?!`), en((v) => `${v.r}, buzz in!`)]
  },
  velvet: {
    open: [en(() => `Mmm... nobody yet? Somebody start us off.`), en((v) => `${v.p} is waiting... don't be shy.`), en(() => `Who's first? I'm listening.`)],
    heat: [
      [en((v) => `Just ${v.t}, at ${v.a}... anyone else?`), en((v) => `Only ${v.t}... how lonely.`), en((v) => `${v.a}... is that all?`)],
      [en((v) => `${v.t} has it, at ${v.a}... for now.`), en(() => `Anyone else feeling brave?`), en((v) => `Mmm... ${v.t} is ahead. Who's next?`)],
      [en((v) => `${v.t} at ${v.a}... it's getting warm in here. Anyone?`), en(() => `Don't stop now...`), en((v) => `${v.t} leads... are you going to let them?`)],
      [en((v) => `${v.t} at ${v.a}... irresistible. Anyone dare go higher?`), en(() => `Oh, this is fun. Who's next?`), en(() => `I could watch this all night... anyone?`)]
    ],
    rival: [en((v) => `${v.r}... you're not giving up, are you?`), en((v) => `${v.r}... your move, darling.`)]
  },
  trailer: {
    open: [en(() => `In a world... where no one has bid yet...`), en(() => `One player... waiting for a team.`), en(() => `Who... will make the first move?`)],
    heat: [
      [en((v) => `${v.t}... stands alone. At ${v.a}.`), en((v) => `One bid... ${v.a}. Will anyone answer?`), en(() => `Silence... falls over the auction.`)],
      [en((v) => `${v.t} leads... at ${v.a}. But the story... isn't over.`), en((v) => `Who... will challenge ${v.t}?`), en(() => `The stakes... are rising.`)],
      [en((v) => `The battle... rages on. ${v.t}, at ${v.a}.`), en(() => `Every team... must choose. Now.`), en((v) => `${v.t} holds on... for now.`)],
      [en((v) => `The bidding war... of the century. ${v.t}, at ${v.a}. Who's next?`), en(() => `Only the bold... go higher.`), en(() => `This is... the final act.`)]
    ],
    rival: [en((v) => `${v.r}... must decide. Fight... or fall.`), en((v) => `${v.r}... your story... isn't over.`)]
  },
  cricket: {
    open: [
      hi(() => `\u092A\u0939\u0932\u0940 \u0917\u0947\u0902\u0926 \u0915\u093E \u0907\u0902\u0924\u091C\u093C\u093E\u0930! \u0915\u094C\u0928 \u0916\u094B\u0932\u0947\u0917\u093E \u0916\u093E\u0924\u093E?`, () => `Pehli gend ka intezaar! Kaun kholega khaata?`),
      hi((v) => `${v.p} \u0915\u094D\u0930\u0940\u091C\u093C \u092A\u0930 \u0916\u0921\u093C\u0947 \u0939\u0948\u0902! \u0915\u094B\u0908 \u0924\u094B \u092C\u094B\u0932\u0940 \u0932\u0917\u093E\u0913!`, (v) => `${v.p} crease par khade hain! Koi to boli lagao!`),
      hi(() => `\u092B\u093C\u0940\u0932\u094D\u0921\u093F\u0902\u0917 \u0938\u0947\u091F \u0939\u0948... \u0905\u092C \u092C\u094B\u0932\u0940 \u0915\u093E \u0907\u0902\u0924\u091C\u093C\u093E\u0930!`, () => `Fielding set hai... ab boli ka intezaar!`)
    ],
    heat: [
      [hi((v) => `${v.t} \u0928\u0947 \u0916\u093E\u0924\u093E \u0916\u094B\u0932\u093E, ${v.a}! \u0915\u094B\u0908 \u0914\u0930 \u092C\u0932\u094D\u0932\u0947\u092C\u093E\u091C\u093C?`, (v) => `${v.t} ne khaata khola, ${v.a}! Koi aur ballebaaz?`), hi((v) => `\u0905\u092D\u0940 \u0938\u093F\u0930\u094D\u092B\u093C ${v.t}! \u092C\u093E\u0915\u093C\u0940 \u091F\u0940\u092E\u0947\u0902 \u0915\u0939\u093E\u0901 \u0939\u0948\u0902?`, (v) => `Abhi sirf ${v.t}! Baaki teamein kahaan hain?`), hi((v) => `${v.a} \u092A\u0930 \u0921\u0949\u091F \u092C\u0949\u0932! \u0915\u094B\u0908 \u0930\u0928 \u0932\u0947\u0917\u093E?`, (v) => `${v.a} par dot ball! Koi run lega?`)],
      [hi((v) => `${v.t} \u0906\u0917\u0947, ${v.a}! \u0905\u0917\u0932\u093E \u0936\u0949\u091F \u0915\u094C\u0928 \u0932\u0917\u093E\u090F\u0917\u093E?`, (v) => `${v.t} aage, ${v.a}! Agla shot kaun lagaayega?`), hi(() => `\u0930\u0928 \u0930\u0947\u091F \u092C\u0922\u093C \u0930\u0939\u093E \u0939\u0948! \u0914\u0930 \u092C\u094B\u0932\u0940?`, () => `Run rate badh raha hai! Aur boli?`), hi((v) => `${v.t} \u0915\u094D\u0930\u0940\u091C\u093C \u092A\u0930 \u091C\u092E\u0947 \u0939\u0941\u090F! \u0915\u094B\u0908 \u0906\u0909\u091F \u0915\u0930\u0947\u0917\u093E?`, (v) => `${v.t} crease par jame hue! Koi out karega?`)],
      [hi((v) => `\u0915\u094D\u092F\u093E \u092E\u0948\u091A \u0939\u0948! ${v.t} \u0906\u0917\u0947, ${v.a}! \u0915\u094C\u0928 \u092E\u093E\u0930\u0947\u0917\u093E \u0905\u0917\u0932\u093E \u091B\u0915\u094D\u0915\u093E?`, (v) => `Kya match hai! ${v.t} aage, ${v.a}! Kaun maarega agla chhakka?`), hi(() => `\u0938\u094D\u091F\u0947\u0921\u093F\u092F\u092E \u0936\u094B\u0930 \u0938\u0947 \u0917\u0942\u0901\u091C \u0930\u0939\u093E \u0939\u0948! \u0914\u0930 \u092C\u094B\u0932\u0940?`, () => `Stadium shor se goonj raha hai! Aur boli?`), hi(() => `\u0926\u092C\u093E\u0935 \u092C\u0922\u093C \u0930\u0939\u093E \u0939\u0948! \u0915\u094C\u0928 \u091D\u0941\u0915\u0947\u0917\u093E?`, () => `Dabaav badh raha hai! Kaun jhukega?`)],
      [hi((v) => `\u0906\u0916\u093C\u093F\u0930\u0940 \u0913\u0935\u0930 \u091C\u0948\u0938\u093E \u0930\u094B\u092E\u093E\u0902\u091A! ${v.t}, ${v.a}! \u0915\u094B\u0908 \u0914\u0930?`, (v) => `Aakhiri over jaisa romaanch! ${v.t}, ${v.a}! Koi aur?`), hi(() => `\u0938\u0941\u092A\u0930 \u0913\u0935\u0930! \u0915\u094C\u0928 \u092E\u093E\u0930\u0947\u0917\u093E \u0935\u093F\u0928\u093F\u0902\u0917 \u0936\u0949\u091F?`, () => `Super over! Kaun maarega winning shot?`), hi(() => `\u092F\u0939 \u092C\u094B\u0932\u0940 \u0906\u0938\u092E\u093E\u0928 \u092E\u0947\u0902! \u0915\u094D\u092F\u093E \u0915\u094B\u0908 \u0914\u0930 \u090A\u092A\u0930 \u091C\u093E\u090F\u0917\u093E?`, () => `Yeh boli aasmaan mein! Kya koi aur upar jaayega?`)]
    ],
    rival: [hi((v) => `${v.r}, \u091C\u0935\u093E\u092C\u0940 \u0939\u092E\u0932\u093E \u0915\u092C?`, (v) => `${v.r}, jawaabi hamla kab?`), hi((v) => `${v.r} \u0915\u094B \u091A\u093E\u0939\u093F\u090F \u090F\u0915 \u092C\u0921\u093C\u093E \u0936\u0949\u091F!`, (v) => `${v.r} ko chahiye ek bada shot!`)]
  },
  assistant: {
    open: [en((v) => `No bids yet for ${v.p}. The base price is ${v.a}.`), en(() => `Waiting for the first bid.`), en((v) => `${v.p} is still open. Would anyone like to start the bidding?`)],
    heat: [
      [en((v) => `${v.t} has the only bid so far, at ${v.a}.`), en((v) => `The current bid is ${v.a}, from ${v.t}. Any other bids?`), en((v) => `Only one bid so far: ${v.t}.`)],
      [en((v) => `${v.t} leads at ${v.a}. Any more bids?`), en((v) => `Current bid: ${v.a}, ${v.t}.`), en(() => `There's still time to bid.`)],
      [en((v) => `${v.t} is ahead at ${v.a}. The bidding is active.`), en((v) => `Still with ${v.t} at ${v.a}. Anyone else?`)],
      [en((v) => `${v.t} leads at ${v.a}, well above the base price. Any more bids?`), en((v) => `This one is popular. ${v.t}, ${v.a}. Anyone higher?`)]
    ],
    rival: [en((v) => `${v.r}, would you like to bid again?`)]
  }
};
function durationWords(sec, script) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60), r = s % 60;
  if (script === "en") {
    const mm2 = m ? `${m} minute${m === 1 ? "" : "s"}` : "";
    const ss2 = r ? `${r} second${r === 1 ? "" : "s"}` : "";
    return [mm2, ss2].filter(Boolean).join(" ") || "0 seconds";
  }
  const w = (n) => n < 100 ? words(n, script) : String(n);
  const mm = m ? `${w(m)} ${script === "deva" ? "\u092E\u093F\u0928\u091F" : "minute"}` : "";
  const ss = r ? `${w(r)} ${script === "deva" ? "\u0938\u0947\u0915\u0902\u0921" : "second"}` : "";
  return [mm, ss].filter(Boolean).join(" ") || w(0);
}
function reactions(h, kind, c) {
  const out = [];
  const one = (list) => pick(list, c.variant);
  if (kind === "lull" && c.allIn) out.push(one(h.allIn));
  if (kind === "sold") {
    if (c.record) out.push(one(h.record));
    else if ((c.bids ?? 0) <= 1 && c.base && c.amount && c.amount <= c.base) out.push(one(h.steal));
    if (h.squad && c.squad && c.squad > 1) out.push(one(h.squad));
    if (c.left !== void 0 && c.team) out.push(one(h.left));
  }
  return out;
}
var CALM = /* @__PURE__ */ new Set(["velvet", "trailer", "assistant"]);
function hosted(style, kind, c) {
  const h = HOSTS[style];
  const heat = heatOf(c);
  const money2 = (n, s) => h.lang === "hi" ? hindiMoney(n ?? 0, c.fmt, s) : spokenMoney(n ?? 0, c.fmt);
  const vars = (s) => {
    const script = h.lang === "hi" ? s : "en";
    const a = money2(c.amount, s);
    return {
      t: c.team ?? "",
      r: c.rival ?? "",
      p: c.player ?? "",
      a,
      ap: c.amount ? `${a}... ` : "",
      left: money2(c.left, s),
      dur: durationWords(c.seconds ?? 60, script),
      round: String(c.round ?? 2),
      n: String(c.squad ?? "")
    };
  };
  let line;
  switch (kind) {
    case "spin":
      line = pick(h.spin, c.variant);
      break;
    case "reveal":
      if (c.player) line = pick(h.reveal, c.variant);
      break;
    case "bid":
      if (c.team && c.amount) line = CALM.has(style) ? [(v) => `${v.t}, ${v.a}.`, (v) => `${v.t}, ${v.a}.`] : [(v) => `${v.t}, ${v.a}!`, (v) => `${v.t}, ${v.a}!`];
      break;
    case "lull": {
      const L = LULL[style];
      if (!c.team || !(c.bids ?? 0)) line = c.player ? pick(L.open, c.variant) : void 0;
      else line = pick([...L.heat[Math.min(heat, L.heat.length - 1)], ...c.rival && heat >= 1 ? L.rival : []], c.variant);
      break;
    }
    case "call": {
      const n = Math.min(2, Math.max(0, (c.call ?? 1) - 1));
      const own = n === 2 ? c.lastCall?.trim() : "";
      line = own ? [(v) => `${v.ap}${own}`, (v) => `${v.ap}${own}`] : pick(h.call[n], c.variant);
      break;
    }
    case "sold":
      if (c.player && c.team && c.amount) line = pick(heat >= 2 ? h.soldHot : h.sold, c.variant);
      break;
    case "unsold":
      if (c.player) line = pick(h.unsold, c.variant);
      break;
    case "undo":
      line = pick(h.undo, c.variant);
      break;
    case "break":
      line = pick(h.brk, c.variant);
      break;
    case "breakext":
      line = pick(h.brkext, c.variant);
      break;
    case "breakend":
      line = pick(h.brkend, c.variant);
      break;
    case "round":
      line = pick(h.round, c.variant);
      break;
  }
  if (!line) return null;
  const parts = [line, ...reactions(h, kind, c)];
  const vd = vars("deva"), vl = vars("latin");
  const brisk = kind === "bid" || kind === "call" || kind === "undo" || kind === "lull";
  const tidy = (x) => brisk ? x.replace(/\.\.\.\s*(?=[!?.,]|$)/g, "").replace(/\.\.\.\s*/g, ", ") : x;
  const text3 = tidy(parts.map((p) => p[0](vd)).join(" "));
  const alt = h.lang === "hi" ? tidy(parts.map((p) => p[1](vl)).join(" ")) : void 0;
  return { text: text3, ...alt ? { alt } : {}, lang: h.lang, ...h.voice };
}
function announce(style, kind, ctx) {
  const line = style === "classic" ? classic(kind, ctx) : hosted(style, kind, ctx);
  return line && line.text ? line : null;
}
var PERSONA = {
  wwe: "You are a legendary arena ring announcer with an enormous, deep, booming bass voice and total command of the crowd. Larger than life: you punch every team name, stretch the big words for effect, and make every bid sound like a main event.",
  kbc: "You are a much-loved Hindi TV quiz-show host with a deep, rich, warm baritone and impeccable Hindi diction (a natural Indian Hindi accent, never an English one). You speak to the audience like family: gracious, dramatic, a master of suspense who leans into pauses, then lights up with genuine warmth and delight.",
  mk: "You are the narrator of a brutal, legendary fighting tournament: a very deep, gravelly, menacing voice, full of dark power and theatrical intensity. You growl the quiet words and ROAR the big ones. Every bid is a strike in battle.",
  show: "You are a glamorous, bubbly prime-time game-show host with a huge smile in your voice: sparkling, playful, warm and genuinely thrilled for every contestant. You squeal a little at big moments and cheer people on.",
  velvet: "You are a smooth, sultry late-night radio host: a low, warm, intimate voice, unhurried and confident, with a playful, teasing charm and a knowing smile. Classy and alluring, never explicit.",
  trailer: "You are an epic Hollywood movie-trailer narrator: a very deep, gravelly voice with enormous cinematic gravitas, ominous weight and dramatic pauses, as if every bid were the plot twist of the year.",
  cricket: "You are a wildly passionate Hindi cricket commentator in a packed, roaring stadium (a natural Indian Hindi accent, Hindi and Hinglish, never an English accent). Explosive, joyful and emotional: your voice soars and cracks with excitement, you celebrate like every bid is a six in the last over, and you live every moment with the crowd.",
  assistant: "You are a friendly, warm and clear voice assistant: upbeat, helpful and calm, with a smile in your voice and a touch of excitement for big moments."
};
var ENERGY = ["calm but upbeat", "lively and rising", "high, thrilled", "explosive, breathless, at the very top of your energy"];
function voiceDirection(style, kind, c) {
  if (style === "classic") return "";
  const heat = heatOf(c);
  const hindi = STYLES2.find((x) => x.id === style)?.lang === "hi";
  let moment = "";
  switch (kind) {
    case "spin":
      moment = "The wheel is spinning to pick the next player. Build curious, excited anticipation, as if leaning towards the audience.";
      break;
    case "reveal":
      moment = "A new player has just come up. Introduce them grandly, with pride and anticipation, then invite the bidding with a smile.";
      break;
    case "bid":
      moment = `A team has just placed a bid. Announce the team and the amount crisply and with punch, like a live sports call. Energy: ${ENERGY[heat]}${heat >= 2 ? "; the room is in a bidding war, let the thrill come through" : ""}.`;
      break;
    case "call": {
      const n = c.call ?? 1;
      moment = n === 1 ? "First call: firm, expectant, building suspense." : n === 2 ? "Second call: more tension, urgent, almost a warning, holding the room in suspense." : "Final call: maximum suspense and drama, the decisive moment.";
      if (style === "mk" && n === 3) moment += " ROAR the last words with full menace.";
      break;
    }
    case "sold":
      moment = heat >= 2 ? "SOLD after a fierce bidding war! Release all the built-up tension in an explosive, triumphant celebration, full of joy and admiration." : "SOLD! Celebrate with proud, happy triumph and congratulate the team warmly.";
      break;
    case "unsold":
      moment = "Nobody bid for this player. Sound genuinely disappointed but kind and sympathetic, with a soft sigh, and a hint of hope for next time.";
      break;
    case "undo":
      moment = "A bid has just been taken back. Sound surprised, then make the correction quickly and with a little drama.";
      break;
    case "lull":
      moment = !c.team || !(c.bids ?? 0) ? "Nobody has bid yet. Playfully and personally challenge the room to make the first move: warm, teasing, encouraging." : `The room has gone quiet after this bid. Talk directly to the teams: tease, provoke and dare them to go higher, cheeky and conversational, with a smile. Energy: ${ENERGY[heat]}.`;
      break;
    case "break":
      moment = "Announce a short strategy break: relaxed, friendly, a little conspiratorial.";
      break;
    case "breakext":
      moment = "The break is being extended: easy-going and friendly.";
      break;
    case "breakend":
      moment = "The break is over: an energetic, delighted welcome back.";
      break;
    case "round":
      moment = "A brand-new round is starting: a big, celebratory announcement full of fresh energy.";
      break;
  }
  return `${PERSONA[style]} ${moment} Speak at a natural, normal talking pace (not slowed down, not rushed): put the emotion into tone, emphasis and energy.${hindi ? " Speak in Hindi with a natural Indian accent; English words such as team names are said the Indian way." : ""} Say only the given words.`;
}
function sampleLine(style) {
  const bid = announce(style, "bid", SAMPLE_CTX);
  const comment = style === "classic" ? null : announce(style, "lull", SAMPLE_CTX);
  if (!bid || !comment) return bid;
  return { ...bid, text: `${bid.text} ${comment.text}`, ...bid.alt ? { alt: `${bid.alt} ${comment.alt ?? ""}`.trim() } : {} };
}

// server/index.ts
var PORT = Number(process.env.PORT ?? 8787);
var APP_ENV = process.env.APP_ENV === "test" ? "test" : "production";
var VERSION = process.env.APP_VERSION ?? (existsSync5("VERSION") ? readFileSync5("VERSION", "utf8").trim().slice(0, 80) : "dev");
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
  if (me.role !== "admin" && me.role !== "host") data.players = data.players.filter((p) => p.status !== "upcoming");
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
    if (action === "players.import" && req.body?.params?.replace === true && actor.role === "admin") {
      try {
        saveSafetyCopy(store);
      } catch (err) {
        console.error("Could not save the safety copy:", err);
        throw new AuctionError("Could not save a safety copy first, so nothing was changed. Try again.", 500);
      }
    }
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
    voice: !!tts && tts.enabled,
    payments: g.required,
    price: g.required ? g.price : 0,
    operatorName: c.operatorName,
    contact: c.contact,
    limits: { ...LIMITS, screensPerAuction: MAX_SCREENS, auctionsOnServer: MAX_EVENTS, autoDeleteDays: AUTO_DELETE_DAYS }
  });
});
var ttsCfg = ttsConfigFromEnv(process.env, DATA_DIR);
var tts = ttsCfg ? new Tts(ttsCfg) : null;
if (tts) {
  tts.prune();
  setInterval(() => tts.prune(), 6 * 36e5).unref();
  console.log(`Studio announcer voices: on (${ttsCfg.provider}; ${tts.remaining().toLocaleString("en")} characters left this month)`);
  console.log(ttsCfg.expressive.on ? `Expressive (acted) voices: on (${ttsCfg.expressive.model}; ${tts.expressiveRemaining().toLocaleString("en")} characters left this month)` : "Expressive (acted) voices: off");
}
var VOICE_PER_HOUR = Number(process.env.TTS_PER_AUCTION_HOUR ?? 400);
var voiceMade = /* @__PURE__ */ new Map();
async function sendVoice(res, style, text3, opts, budgetKey) {
  if (!tts) throw new AuctionError("Studio voices are not switched on", 404);
  if (!tts.has(style, text3, opts)) {
    const now = Date.now();
    let e = voiceMade.get(budgetKey);
    if (!e || now > e.reset) voiceMade.set(budgetKey, e = { n: 0, reset: now + 36e5 });
    if (++e.n > VOICE_PER_HOUR) throw new AuctionError("Too many new voice lines this hour", 429);
  }
  try {
    const { audio, type, kind } = await tts.speak(style, text3, opts);
    res.set("Content-Type", type);
    res.set("X-Voice-Kind", kind);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(audio);
  } catch (err) {
    console.error("Announcer voice:", err.message);
    throw new AuctionError("The studio voice is not available right now", 503);
  }
}
var styleOf = (v) => {
  if (!isStyle(v) || v === "classic") throw new AuctionError("Choose one of the studio hosts (not Classic)", 400);
  return v;
};
app.get("/api/events/:code/voice/:seq", (req, res, next) => {
  (async () => {
    const style = styleOf(req.query.style);
    const store = findEvent(req);
    const d = store.data;
    const ev = d.live.lastEvent;
    if (!ev || ev.seq !== Number(req.params.seq) || !isSpeechKind(ev.type)) throw new AuctionError("That moment has passed", 404);
    const ctx = momentCtx(d, ev);
    const lull = req.query.kind === "lull";
    if (lull && (!(ev.type === "bid" || ev.type === "reveal") || d.live.phase !== "bidding" || Date.now() - ev.at < LULL_MS - 1500)) throw new AuctionError("Not a quiet moment", 404);
    const line = announce(style, lull ? "lull" : ev.type, ctx);
    if (!line) throw new AuctionError("Nothing to say", 404);
    const kindNow = lull ? "lull" : ev.type;
    await sendVoice(res, style, line.text, { direction: voiceDirection(style, kindNow, ctx), urgent: kindNow === "bid" || kindNow === "call" }, d.code);
  })().catch(next);
});
app.get("/api/voice-sample/:style", (req, res, next) => {
  (async () => {
    const style = styleOf(req.params.style);
    const line = sampleLine(style);
    await sendVoice(res, style, line.text, { direction: voiceDirection(style, "lull", SAMPLE_CTX) }, "sample");
  })().catch(next);
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
    const dir = path5.join(UPLOADS_DIR, store.data.code);
    mkdirSync3(dir, { recursive: true });
    if (readdirSync3(dir).length >= MAX_UPLOADS_PER_AUCTION) throw new AuctionError(`This auction has reached its ${MAX_UPLOADS_PER_AUCTION}-photo limit`);
    const name = `${randomBytes3(6).toString("hex")}.${ext}`;
    writeFileSync4(path5.join(dir, name), req.body);
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
var WEB_DIST = path5.resolve("dist/web");
if (existsSync5(WEB_DIST)) {
  app.use("/assets", express.static(path5.join(WEB_DIST, "assets"), { index: false, maxAge: "365d", immutable: true, fallthrough: false }));
  app.use(express.static(WEB_DIST, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api\/|\/uploads\/|\/assets\/).*/, (_req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(path5.join(WEB_DIST, "index.html"));
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
