// Look and feel for the parent app. Two separate choices, both kept only on this phone:
//  - theme: dark, light or auto (follows the phone). Default: dark.
//  - lens: kid (bold and playful) or parent (calmer, bigger text, no moving parts). Default: kid.
const KEY_T = 'choir-theme';
const KEY_L = 'choir-lens';
const get = (k, ok, dflt) => { try { const v = localStorage.getItem(k); return ok.includes(v) ? v : dflt; } catch { return dflt; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export const getTheme = () => get(KEY_T, ['dark', 'light', 'auto'], 'dark');
export const getLens = () => get(KEY_L, ['kid', 'parent'], 'kid');

const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function applyLook() {
  const t = getTheme();
  const dark = t === 'dark' || (t === 'auto' && (media ? media.matches : true));
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.lens = getLens();
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0E0B1F' : '#3a1fa8');
}
media?.addEventListener?.('change', applyLook);

export const setTheme = (t) => { put(KEY_T, t); applyLook(); };
export const setLens = (l) => { put(KEY_L, l); applyLook(); };

export function lookCardHtml() {
  const t = getTheme(); const l = getLens();
  const seg = (name, cur, items) => `<div class="seg" role="group" aria-label="${name}">${items.map(([v, label]) =>
    `<button type="button" data-${name}="${v}" aria-pressed="${cur === v}" class="${cur === v ? 'on' : ''}">${label}</button>`).join('')}</div>`;
  return `
    <div class="card look" id="lookCard">
      <h3>Look of the app</h3>
      <div class="muted">Colours</div>
      ${seg('theme', t, [['dark', 'Dark'], ['light', 'Light'], ['auto', 'Auto']])}
      <div class="muted" style="margin-top:10px">Who is using it</div>
      ${seg('lens', l, [['kid', 'Kid view'], ['parent', 'Parent view']])}
      <div class="muted" style="margin-top:8px">Parent view is calmer, with larger plain text. Only the look changes, never your child's data.</div>
    </div>`;
}

export function wireLook(root) {
  root.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.theme); mark(root); }));
  root.querySelectorAll('[data-lens]').forEach((b) => b.addEventListener('click', () => { setLens(b.dataset.lens); mark(root); }));
}
function mark(root) {
  root.querySelectorAll('[data-theme]').forEach((b) => { const on = b.dataset.theme === getTheme(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  root.querySelectorAll('[data-lens]').forEach((b) => { const on = b.dataset.lens === getLens(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
