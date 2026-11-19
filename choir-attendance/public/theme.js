// Look and feel, kept only on this phone or computer.
//  - theme: Light (the original cream look), Bright (lavender to pink) or Dark. Default: Dark.
//  - lens (parent app only): Kid view (bold, playful) or Parent view (calmer, larger text, nothing moving).
// The teacher area has its own saved choice, so changing one never changes the other.
const THEMES = ['light', 'bright', 'dark'];
let KEY_T = 'choir-theme';
let useLens = true;
const KEY_L = 'choir-lens';
const get = (k, ok, dflt) => { try { const v = localStorage.getItem(k); return ok.includes(v) ? v : dflt; } catch { return dflt; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export const getTheme = () => get(KEY_T, THEMES, 'dark'); // an older saved "auto" simply becomes Dark
export const getLens = () => get(KEY_L, ['kid', 'parent'], 'kid');

export function configure({ key, lens }) { KEY_T = key; useLens = lens; }

export function applyLook() {
  const t = getTheme();
  const root = document.documentElement;
  root.dataset.theme = t;
  if (useLens) root.dataset.lens = getLens(); else delete root.dataset.lens;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#0E0B1F' : t === 'bright' ? '#6C4DFF' : '#3a1fa8');
}

export const setTheme = (t) => { put(KEY_T, t); applyLook(); };
export const setLens = (l) => { put(KEY_L, l); applyLook(); };

export function lookCardHtml() {
  const seg = (name, cur, items) => `<div class="seg" role="group" aria-label="${name}">${items.map(([v, label]) =>
    `<button type="button" data-${name}="${v}" aria-pressed="${cur === v}" class="${cur === v ? 'on' : ''}">${label}</button>`).join('')}</div>`;
  return `
    <div class="card look" id="lookCard">
      <h3>Look of the app</h3>
      <div class="muted">Colours</div>
      ${seg('theme', getTheme(), [['light', 'Light'], ['bright', 'Bright'], ['dark', 'Dark']])}
      ${useLens ? `
      <div class="muted" style="margin-top:10px">Who is using it</div>
      ${seg('lens', getLens(), [['kid', 'Student view'], ['parent', 'Parent view']])}
      <div class="muted" style="margin-top:8px">Parent view is calmer, with larger plain text. Only the look changes, never your child's data.</div>` : ''}
    </div>`;
}

export function wireLook(root) {
  const mark = () => {
    root.querySelectorAll('[data-theme]').forEach((b) => { const on = b.dataset.theme === getTheme(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    root.querySelectorAll('[data-lens]').forEach((b) => { const on = b.dataset.lens === getLens(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  };
  root.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.theme); mark(); }));
  root.querySelectorAll('[data-lens]').forEach((b) => b.addEventListener('click', () => { setLens(b.dataset.lens); mark(); }));
}
