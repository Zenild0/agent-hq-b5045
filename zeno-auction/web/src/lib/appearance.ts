import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { EventSettings } from '../../../shared/types';
import { DEFAULT_THEME_ID, paletteFor, type Mode, type Palette } from '../../../shared/themes';

/** Colours for use in inline styles / SVG: they follow the active theme. */
export const GOLD = 'rgb(var(--gold))';
export const HOT = 'rgb(var(--hot))';

/** A team's colour for use as TEXT: unchanged on dark pages, darkened on light ones so it stays readable. */
export const teamInk = (color: string | undefined) => (color ? `color-mix(in srgb, ${color} var(--team-keep, 100%), black)` : undefined);

interface EventLook {
  theme: string;
  mode: Mode;
  brand: string;
}

const MODE_KEY = 'zeno:mode';
let event: EventLook | null = null; // the look the auction's organiser chose (while on an auction page)
let override: Mode | null = (() => {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
})();
let palette: Palette = paletteFor(DEFAULT_THEME_ID, 'dark');
let version = 0;
const listeners = new Set<() => void>();

export const effectiveMode = (): Mode => override ?? event?.mode ?? 'dark';

/** Writes the active theme's colours onto <html>. Cheap: ~60 properties. */
function apply() {
  palette = paletteFor(event?.theme ?? DEFAULT_THEME_ID, effectiveMode(), event?.brand);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(palette.vars)) root.style.setProperty(k, v);
  root.dataset.pattern = palette.pattern;
  root.dataset.mode = palette.mode;
  root.style.colorScheme = palette.mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${palette.vars['--ink-950'].split(' ').join(',')})`);
  version++;
  listeners.forEach((l) => l());
}

export const currentPalette = () => palette;

/** Called once at start-up so the first paint already has the right colours. */
export const initAppearance = apply;

// Several parts of a page can ask for a look (the Admin page and its settings form, which previews unsaved
// changes). The most recent asker that is still on screen wins; when it leaves, the one before it applies again.
const claims: { key: symbol; look: EventLook }[] = [];
function claim(key: symbol, look: EventLook) {
  const i = claims.findIndex((c) => c.key === key);
  if (i >= 0) claims[i].look = look;
  else claims.push({ key, look });
  event = claims[claims.length - 1].look;
  apply();
}
function release(key: symbol) {
  const i = claims.findIndex((c) => c.key === key);
  if (i >= 0) claims.splice(i, 1);
  event = claims.length ? claims[claims.length - 1].look : null;
  apply();
}

/** The person's own light/dark choice on this device (null = follow the auction's setting). */
export function setModeOverride(m: Mode | null) {
  override = m;
  try {
    if (m) localStorage.setItem(MODE_KEY, m);
    else localStorage.removeItem(MODE_KEY);
  } catch {
    /* private mode: the choice just lasts until reload */
  }
  apply();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Re-renders when the theme changes; returns the active mode and palette. */
export function useAppearance() {
  useSyncExternalStore(subscribe, () => version);
  return { mode: palette.mode, palette, setMode: setModeOverride };
}

/**
 * Pages of an auction call this with its settings so every screen (big screen, captains, auctioneer) shows
 * the organiser's theme. Leaving the page restores the default look.
 */
export function useEventAppearance(settings: Pick<EventSettings, 'theme' | 'mode' | 'brand'> | undefined) {
  const theme = settings?.theme;
  const mode = settings?.mode;
  const brand = settings?.brand?.color;
  const key = useRef(Symbol('look')).current;
  useEffect(() => {
    if (!theme) return;
    claim(key, { theme, mode: mode === 'light' ? 'light' : 'dark', brand: brand ?? '#2f6bff' });
  }, [key, theme, mode, brand]);
  useEffect(() => () => release(key), [key]);
}
