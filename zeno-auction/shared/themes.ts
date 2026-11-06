// Themes: a handful of choices per theme (surface tint, two accent colours, a pattern, a typeface)
// become the full palette for BOTH a dark and a light version, with text contrast checked in code.
//
// The app's colours are CSS variables ("r g b" triples) that this file fills in; see tailwind.config.cjs
// and web/src/index.css for where they are used. Pure functions, so the server tests can verify them.

export type Mode = 'dark' | 'light';
export type Pattern = 'grid' | 'dots' | 'stripes' | 'diagonal' | 'lines' | 'none';
export type FontId = 'sora' | 'playfair' | 'mono' | 'orbitron' | 'cinzel';

export interface ThemeDef {
  id: string;
  name: string;
  group: 'Classic' | 'Sports' | 'Antique' | 'Stock market' | 'Festive' | 'More' | 'Your brand';
  /** Tint of the dark/light surfaces */
  hue: number;
  sat: number;
  /** "Money" colour: prices, primary buttons, the winner */
  accent: string;
  /** Second colour: links, focus, labels */
  accent2: string;
  pattern: Pattern;
  font: FontId;
  /** Keep the original hand-tuned dark surfaces (the default theme only) */
  classic?: boolean;
}

export const FONT_STACKS: Record<FontId, string> = {
  sora: "'Sora', 'Inter', system-ui, sans-serif",
  playfair: "'Playfair Display', Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
  orbitron: "'Orbitron', 'Sora', system-ui, sans-serif",
  cinzel: "'Cinzel', 'Playfair Display', Georgia, serif",
};

export const THEMES: ThemeDef[] = [
  { id: 'midnight-gold', name: 'Midnight Gold', group: 'Classic', hue: 224, sat: 70, accent: '#f2b84b', accent2: '#2f6bff', pattern: 'grid', font: 'sora', classic: true },
  { id: 'ocean-deep', name: 'Ocean Deep', group: 'Classic', hue: 200, sat: 65, accent: '#2dd4bf', accent2: '#60a5fa', pattern: 'grid', font: 'sora' },
  { id: 'monochrome', name: 'Monochrome', group: 'Classic', hue: 220, sat: 6, accent: '#e5e7eb', accent2: '#94a3b8', pattern: 'none', font: 'sora' },

  { id: 'stadium-night', name: 'Stadium Night', group: 'Sports', hue: 150, sat: 42, accent: '#ffd23f', accent2: '#35d07f', pattern: 'stripes', font: 'sora' },
  { id: 'cricket', name: 'Cricket', group: 'Sports', hue: 140, sat: 38, accent: '#f4d35e', accent2: '#e63946', pattern: 'stripes', font: 'sora' },
  { id: 'football', name: 'Football', group: 'Sports', hue: 125, sat: 45, accent: '#b8f400', accent2: '#ffffff', pattern: 'stripes', font: 'orbitron' },
  { id: 'basketball', name: 'Basketball', group: 'Sports', hue: 22, sat: 45, accent: '#ff8a1f', accent2: '#ffd166', pattern: 'lines', font: 'sora' },
  { id: 'racing', name: 'Racing', group: 'Sports', hue: 355, sat: 40, accent: '#ff2d2d', accent2: '#ffd400', pattern: 'diagonal', font: 'orbitron' },
  { id: 'arctic-ice', name: 'Arctic Ice', group: 'Sports', hue: 205, sat: 50, accent: '#7dd3fc', accent2: '#38bdf8', pattern: 'dots', font: 'sora' },

  { id: 'parchment', name: 'Parchment', group: 'Antique', hue: 32, sat: 38, accent: '#c9a24d', accent2: '#b4513f', pattern: 'lines', font: 'playfair' },
  { id: 'royal-court', name: 'Royal Court', group: 'Antique', hue: 275, sat: 45, accent: '#d4af37', accent2: '#b794f6', pattern: 'dots', font: 'cinzel' },
  { id: 'old-library', name: 'Old Library', group: 'Antique', hue: 165, sat: 35, accent: '#c5a059', accent2: '#7fb69e', pattern: 'lines', font: 'playfair' },

  { id: 'terminal-green', name: 'Terminal Green', group: 'Stock market', hue: 150, sat: 22, accent: '#00e676', accent2: '#29b6f6', pattern: 'grid', font: 'mono' },
  { id: 'trading-amber', name: 'Trading Amber', group: 'Stock market', hue: 32, sat: 18, accent: '#ffb000', accent2: '#00b3ff', pattern: 'grid', font: 'mono' },
  { id: 'broadsheet', name: 'Broadsheet', group: 'Stock market', hue: 24, sat: 28, accent: '#0fa3b1', accent2: '#e2672b', pattern: 'lines', font: 'playfair' },

  { id: 'halloween', name: 'Halloween', group: 'Festive', hue: 268, sat: 38, accent: '#ff7a00', accent2: '#a855f7', pattern: 'diagonal', font: 'cinzel' },
  { id: 'black-friday', name: 'Black Friday', group: 'Festive', hue: 0, sat: 4, accent: '#ffd60a', accent2: '#ff3b30', pattern: 'diagonal', font: 'sora' },
  { id: 'christmas', name: 'Christmas', group: 'Festive', hue: 148, sat: 45, accent: '#f5c542', accent2: '#e63946', pattern: 'dots', font: 'playfair' },

  { id: 'neon-arcade', name: 'Neon Arcade', group: 'More', hue: 268, sat: 60, accent: '#ff2ec4', accent2: '#22d3ee', pattern: 'grid', font: 'orbitron' },
  { id: 'synthwave', name: 'Synthwave', group: 'More', hue: 285, sat: 55, accent: '#ff7a59', accent2: '#c77dff', pattern: 'stripes', font: 'orbitron' },
  { id: 'sunset-blaze', name: 'Sunset Blaze', group: 'More', hue: 14, sat: 48, accent: '#ff7b00', accent2: '#ff3d71', pattern: 'diagonal', font: 'sora' },
  { id: 'forest-trail', name: 'Forest Trail', group: 'More', hue: 112, sat: 30, accent: '#a3e635', accent2: '#86efac', pattern: 'dots', font: 'sora' },
  { id: 'rose-quartz', name: 'Rose Quartz', group: 'More', hue: 338, sat: 35, accent: '#fb7185', accent2: '#f0abfc', pattern: 'dots', font: 'sora' },
  { id: 'ruby', name: 'Ruby', group: 'More', hue: 350, sat: 55, accent: '#ffd166', accent2: '#ff4d6d', pattern: 'grid', font: 'sora' },
  { id: 'emerald-city', name: 'Emerald City', group: 'More', hue: 162, sat: 50, accent: '#34d399', accent2: '#fde047', pattern: 'grid', font: 'sora' },
  { id: 'copper-forge', name: 'Copper Forge', group: 'More', hue: 18, sat: 30, accent: '#e08a4b', accent2: '#5eead4', pattern: 'diagonal', font: 'sora' },
  { id: 'cherry-blossom', name: 'Cherry Blossom', group: 'More', hue: 330, sat: 32, accent: '#f472b6', accent2: '#a78bfa', pattern: 'dots', font: 'sora' },
  { id: 'desert-dunes', name: 'Desert Dunes', group: 'More', hue: 35, sat: 32, accent: '#f59e0b', accent2: '#14b8a6', pattern: 'diagonal', font: 'sora' },
  { id: 'aurora', name: 'Aurora', group: 'More', hue: 238, sat: 55, accent: '#5eead4', accent2: '#a78bfa', pattern: 'grid', font: 'sora' },
];

export const BRAND_THEME_ID = 'brand';
export const DEFAULT_THEME_ID = 'midnight-gold';
export const themeIds = [...THEMES.map((t) => t.id), BRAND_THEME_ID];

// ---------------------------------------------------------------------------------------------
// colour maths
// ---------------------------------------------------------------------------------------------

type RGB = [number, number, number];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
export const rgbToHex = ([r, g, b]: RGB) => '#' + [r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}
export function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const hsl = (h: number, s: number, l: number) => rgbToHex(hslToRgb(h, s, l));

function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** WCAG contrast ratio between two hex colours (1 … 21). */
export function contrast(a: string, b: string): number {
  const la = luminance(hexToRgb(a)), lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Moves `fg` lighter or darker (keeping its hue) until it reads on `bg` with at least `min` contrast. */
export function ensureContrast(fg: string, bg: string, min: number, towards: 'lighter' | 'darker'): string {
  if (contrast(fg, bg) >= min) return fg;
  const [h, s, l] = rgbToHsl(hexToRgb(fg));
  for (let step = 1; step <= 100; step++) {
    const nl = clamp(towards === 'lighter' ? l + step : l - step, 0, 100);
    const c = hsl(h, s, nl);
    if (contrast(c, bg) >= min) return c;
    if (nl === 0 || nl === 100) break;
  }
  return towards === 'lighter' ? '#ffffff' : '#000000';
}

const triple = (hex: string) => hexToRgb(hex).map((n) => Math.round(n)).join(' ');
const lighten = (hex: string, by: number) => { const [h, s, l] = rgbToHsl(hexToRgb(hex)); return hsl(h, s, Math.min(92, l + by)); };
const darken = (hex: string, by: number) => { const [h, s, l] = rgbToHsl(hexToRgb(hex)); return hsl(h, s, Math.max(8, l - by)); };

// ---------------------------------------------------------------------------------------------
// the palette
// ---------------------------------------------------------------------------------------------

export interface Palette {
  /** CSS custom properties to set on <html> */
  vars: Record<string, string>;
  pattern: Pattern;
  font: string;
  mode: Mode;
  /** Colours for the spin wheel's slices (hex) */
  wheel: string[];
  /** The resolved hex colours, for tests and for the theme picker swatches */
  hex: { bg: string; card: string; text: string; muted: string; accent: string; accentText: string; accent2: string; hot: string };
}

const CLASSIC_INK_DARK = ['#040918', '#070f26', '#0b1636', '#12214a', '#1b2f63', '#2a4488'];
const DARK_TEXT = '#0b1020';

// neutral text / status colours, per mode (dark = the usual Tailwind shades)
const SLATE = {
  dark: { 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569' },
  light: { 100: '#0f172a', 200: '#1e293b', 300: '#334155', 400: '#475569', 500: '#5b6b82', 600: '#94a3b8' },
};
const STATUS = {
  dark: {
    emerald: { 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 950: '#022c22' },
    red: { 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444' },
    amber: { 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b' },
    orange: { 400: '#fb923c' },
  },
  light: {
    emerald: { 100: '#064e3b', 200: '#065f46', 300: '#065f46', 400: '#047857', 950: '#022c22' },
    red: { 100: '#7f1d1d', 200: '#991b1b', 300: '#b91c1c', 400: '#c81e1e', 500: '#dc2626' },
    amber: { 100: '#78350f', 200: '#92400e', 300: '#a15c07', 400: '#d97706', 500: '#d97706' },
    orange: { 400: '#c2410c' },
  },
};

/** Builds the colours for one theme in one mode. */
export function buildPalette(theme: ThemeDef, mode: Mode): Palette {
  const dark = mode === 'dark';
  const { hue, sat } = theme;

  // --- surfaces (ink-950 = the page, 500 = the lightest raised surface) ---
  const ink = theme.classic && dark
    ? CLASSIC_INK_DARK
    : dark
      ? [5.5, 8.5, 12.5, 18, 25, 35].map((l) => hsl(hue, sat * (l < 14 ? 0.95 : 0.85), l))
      : [97.5, 95, 92, 88.5, 83, 74].map((l) => hsl(hue, Math.min(sat, 50) * 0.7, l));
  const bg = ink[0];
  const card = ink[1];
  // text must read on the page, on cards, and on raised panels; the raised one is the hardest case in both modes
  const worst = ink[2];

  // --- text ---
  const pearl = dark ? (theme.classic ? '#f4f7ff' : hsl(hue, 60, 96)) : hsl(hue, 45, 11);
  const white = dark ? '#ffffff' : hsl(hue, 45, 11);
  const slate = SLATE[dark ? 'dark' : 'light'];
  const muted = ensureContrast(slate[400], worst, 4.5, dark ? 'lighter' : 'darker');
  const faint = ensureContrast(slate[500], worst, 3.6, dark ? 'lighter' : 'darker');

  // --- accent ("gold" role): bright for buttons, readable shade for text ---
  let accent = theme.accent;
  if (dark) accent = ensureContrast(accent, worst, 4.5, 'lighter');
  const soft = lighten(accent, dark ? 20 : 16);
  const deep = darken(accent, 18);
  const gradStops = [soft, accent, deep];

  // text sitting on the bright accent (buttons): dark or white, whichever reads best on all three stops
  const minOn = (t: string) => Math.min(...gradStops.map((s) => contrast(t, s)));
  let onAccent = minOn(DARK_TEXT) >= minOn('#ffffff') ? DARK_TEXT : '#ffffff';
  let stops = gradStops;
  for (let i = 0; i < 40 && Math.min(...stops.map((s) => contrast(onAccent, s))) < 4.5; i++) {
    stops = stops.map((s) => (onAccent === DARK_TEXT ? lighten(s, 3) : darken(s, 3)));
  }
  const brightGrad = `linear-gradient(135deg, ${stops[0]} 0%, ${stops[1]} 46%, ${stops[2]} 100%)`;

  // accent as TEXT on the page: darker on light pages
  const goldText = dark ? accent : ensureContrast(theme.accent, worst, 4.5, 'darker');
  const goldTextDeep = dark ? deep : ensureContrast(darken(theme.accent, 10), worst, 4.5, 'darker');
  const goldTextSoft = dark ? soft : ensureContrast(lighten(theme.accent, 4), worst, 3.5, 'darker');
  const goldTextGrad = dark ? brightGrad : `linear-gradient(135deg, ${goldTextSoft} 0%, ${goldText} 46%, ${goldTextDeep} 100%)`;

  // --- second colour ("royal" role) ---
  const royal = theme.accent2;
  const royal300 = ensureContrast(dark ? lighten(royal, 22) : darken(royal, 10), worst, 4.5, dark ? 'lighter' : 'darker');
  const royal400 = dark ? lighten(royal, 8) : royal;
  const royal600 = darken(royal, 14);
  const royalGrad = `linear-gradient(135deg, ${royal400} 0%, ${royal} 55%, ${royal600} 100%)`;
  const royalTextGrad = dark ? royalGrad : `linear-gradient(135deg, ${royal300} 0%, ${royal300} 100%)`;

  // --- alerts ---
  const hot = ensureContrast(dark ? '#ff5c7a' : '#d6264a', worst, 4.5, dark ? 'lighter' : 'darker');
  const cyan = ensureContrast(dark ? '#5cc8ff' : '#0a7bb5', worst, 4.5, dark ? 'lighter' : 'darker');

  // --- lines, glows, shadows ---
  const line = dark ? hsl(hue, Math.max(40, sat), 76) : hsl(hue, 30, 28);

  const vars: Record<string, string> = {
    '--ink-950': triple(ink[0]), '--ink-900': triple(ink[1]), '--ink-800': triple(ink[2]), '--ink-700': triple(ink[3]), '--ink-600': triple(ink[4]), '--ink-500': triple(ink[5]),
    '--pearl': triple(pearl), '--white': triple(white), '--on-accent': triple(onAccent),
    '--royal': triple(royal), '--royal-300': triple(royal300), '--royal-400': triple(royal400), '--royal-600': triple(royal600),
    '--gold': triple(goldText), '--gold-soft': triple(goldTextSoft), '--gold-deep': triple(goldTextDeep),
    '--accent': triple(accent), '--accent-soft': triple(stops[0]), '--accent-deep': triple(stops[2]),
    '--hot': triple(hot), '--cyan': triple(cyan),
    '--line': triple(line),
    '--team-keep': dark ? '100%' : '62%', // team colours as TEXT are darkened on light pages (see teamInk)
    '--shadow': dark ? '0 0 0' : '36 48 84',
    '--shadow-a': dark ? '0.75' : '0.2',
    '--aurora-a': dark ? '0.26' : '0.14', '--aurora-b': dark ? '0.12' : '0.1', '--aurora-c': dark ? '0.2' : '0.1',
    '--grid-a': dark ? '0.045' : '0.06',
    '--gold-grad': brightGrad, '--royal-grad': royalGrad, '--gold-text-grad': goldTextGrad, '--royal-text-grad': royalTextGrad,
    '--hairline': `rgb(${triple(line)} / ${dark ? 0.14 : 0.16})`,
    '--font-display': FONT_STACKS[theme.font],
    color: pearl,
  };
  delete vars.color;
  for (const k of [100, 200, 300, 400, 500, 600] as const) vars[`--slate-${k}`] = triple(k === 400 ? muted : k === 500 ? faint : slate[k]);
  const st = STATUS[dark ? 'dark' : 'light'];
  for (const [family, shades] of Object.entries(st)) for (const [shade, hex] of Object.entries(shades)) vars[`--${family}-${shade}`] = triple(hex);

  return {
    vars,
    pattern: theme.pattern,
    font: FONT_STACKS[theme.font],
    mode,
    wheel: [royal600, stops[1], royal, stops[0], darken(royal, 34), stops[2]],
    hex: { bg, card, text: pearl, muted, accent: stops[1], accentText: goldText, accent2: royal300, hot },
  };
}

// ---------------------------------------------------------------------------------------------
// the brand theme: colours from the company's logo colour
// ---------------------------------------------------------------------------------------------

/** A theme whose accent is the brand colour; surfaces are tinted with the same hue, the second colour is its opposite. */
export function brandTheme(brandHex: string): ThemeDef {
  const [h, s, l] = rgbToHsl(hexToRgb(/^#[0-9a-fA-F]{6}$/.test(brandHex) ? brandHex : '#2f6bff'));
  const neutral = s < 12; // a grey / black / white logo: keep it calm
  const accent = neutral ? hsl(h, 0, clamp(l, 55, 80)) : hsl(h, clamp(s, 45, 100), clamp(l, 45, 68));
  return {
    id: BRAND_THEME_ID,
    name: 'Your brand',
    group: 'Your brand',
    hue: h,
    sat: neutral ? 8 : clamp(s * 0.55, 28, 55),
    accent,
    accent2: neutral ? '#94a3b8' : hsl(h + 180, 65, 62),
    pattern: 'grid',
    font: 'sora',
  };
}

export function findTheme(id: string | undefined, brandHex?: string): ThemeDef {
  if (id === BRAND_THEME_ID) return brandTheme(brandHex ?? '#2f6bff');
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function paletteFor(id: string | undefined, mode: Mode, brandHex?: string): Palette {
  return buildPalette(findTheme(id, brandHex), mode);
}
