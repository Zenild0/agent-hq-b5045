import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, brandTheme, buildPalette, contrast, findTheme, themeIds, type Mode, type ThemeDef } from './themes';

const modes: Mode[] = ['dark', 'light'];
const brands = ['#e11d48', '#2563eb', '#16a34a', '#facc15', '#ffffff', '#000000', '#808080', '#7c3aed', '#f97316', '#0ea5e9'];
const all: ThemeDef[] = [...THEMES, ...brands.map(brandTheme)];
const rgbHex = (triple: string) => '#' + triple.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('');

test('there are plenty of themes with unique ids, and unknown ids fall back to the default', () => {
  assert.ok(THEMES.length >= 25, `${THEMES.length} themes`);
  assert.equal(new Set(THEMES.map((t) => t.id)).size, THEMES.length);
  for (const id of ['halloween', 'christmas', 'black-friday', 'parchment', 'terminal-green', 'stadium-night']) assert.ok(THEMES.some((t) => t.id === id), id);
  assert.ok(themeIds.includes('brand'));
  assert.equal(findTheme('nope').id, 'midnight-gold');
  assert.equal(findTheme(undefined).id, 'midnight-gold');
});

test('every theme, in dark and light, keeps text readable (WCAG contrast)', () => {
  for (const t of all) {
    for (const mode of modes) {
      const p = buildPalette(t, mode);
      const v = (name: string) => rgbHex(p.vars[name]);
      const label = `${t.id}/${t.accent}/${mode}`;
      const page = v('--ink-950'), card = v('--ink-900'), raised = v('--ink-800');
      for (const surface of [page, card, raised]) {
        assert.ok(contrast(v('--pearl'), surface) >= 7, `${label}: main text on ${surface} = ${contrast(v('--pearl'), surface).toFixed(1)}`);
        assert.ok(contrast(v('--slate-300'), surface) >= 4.5, `${label}: slate-300 on ${surface}`);
        assert.ok(contrast(v('--slate-400'), surface) >= 4.5, `${label}: slate-400 (muted text) on ${surface} = ${contrast(v('--slate-400'), surface).toFixed(1)}`);
        assert.ok(contrast(v('--slate-500'), surface) >= 3.4, `${label}: slate-500 on ${surface} = ${contrast(v('--slate-500'), surface).toFixed(1)}`);
        assert.ok(contrast(v('--gold'), surface) >= 4.4, `${label}: accent text on ${surface} = ${contrast(v('--gold'), surface).toFixed(1)}`);
        assert.ok(contrast(v('--royal-300'), surface) >= 4.4, `${label}: label colour on ${surface}`);
        assert.ok(contrast(v('--hot'), surface) >= 4.4, `${label}: alert colour on ${surface}`);
        assert.ok(contrast(v('--cyan'), surface) >= 4.4, `${label}: cyan on ${surface}`);
        for (const c of ['red-300', 'red-400', 'emerald-300', 'emerald-400', 'amber-300']) assert.ok(contrast(v(`--${c}`), surface) >= 3.9, `${label}: ${c} on ${surface} = ${contrast(v(`--${c}`), surface).toFixed(1)}`);
      }
      // text on the bright button colour, across the whole gradient
      for (const stop of ['--accent', '--accent-soft', '--accent-deep']) assert.ok(contrast(v('--on-accent'), v(stop)) >= 4.5, `${label}: button text on ${stop} = ${contrast(v('--on-accent'), v(stop)).toFixed(1)}`);
      // the page must actually be dark in dark mode and light in light mode
      const lum = contrast(page, '#000000');
      assert.ok(mode === 'dark' ? lum < 2 : lum > 12, `${label}: page colour ${page} looks wrong for ${mode} mode (${lum.toFixed(1)})`);
    }
  }
});

test('the default theme in dark mode is exactly the original look', () => {
  const p = buildPalette(THEMES[0], 'dark');
  assert.equal(rgbHex(p.vars['--ink-950']), '#040918');
  assert.equal(rgbHex(p.vars['--pearl']), '#f4f7ff');
  assert.equal(rgbHex(p.vars['--gold']), '#f2b84b');
  assert.equal(rgbHex(p.vars['--royal']), '#2f6bff');
});

test('a brand colour drives the brand theme, and a grey logo stays calm', () => {
  const red = buildPalette(brandTheme('#e11d48'), 'dark');
  assert.ok(Number(red.vars['--accent'].split(' ')[0]) > 180, 'a red brand gives a red accent');
  const grey = brandTheme('#808080');
  assert.ok(grey.sat <= 8);
  assert.equal(brandTheme('not a colour').id, 'brand'); // bad input does not crash
});
