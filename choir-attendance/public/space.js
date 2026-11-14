// Choir Space: a safe, friendly place for the children. Automatic posts, one-tap reactions, a weekly challenge the
// whole choir fills together, and a little avatar. No free chat, no photos, no voices.
import { api, esc, feeNoteHtml } from './common.js';

const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};
export const avatarEl = (a, size = 44) => `<span class="sp-av" style="--c:${esc(a.color)};--s:${size}px;${a.frame && a.frame !== 'none' ? `--ring:${frameColour(a.frame)}` : ''}" aria-hidden="true">${esc(a.initial ?? '')}${badgeEmoji(a.badge) ? `<i>${badgeEmoji(a.badge)}</i>` : ''}</span>`;
const frameColour = (id) => ({ gold: '#FFE14D', mint: '#2EE6A6', sky: '#3DDCFF' })[id] ?? 'transparent';
const badgeEmoji = (id) => ({ note: '🎵', mic: '🎤', star: '⭐', fire: '🔥', crown: '👑' })[id] ?? '';

const text = (p) => {
  if (p.kind === 'streak') return `is on a <b>${p.n}-day streak</b> 🔥`;
  if (p.kind === 'bigday') return `sang for <b>${p.n} minutes</b> today 🎤`;
  if (p.kind === 'songs') return `<b>${p.n} new song${p.n === 1 ? '' : 's'}</b> are in the Chord Book! 🎶`;
  return esc(p.text);
};
const postHtml = (p) => {
  const teacher = !p.who;
  const who = teacher ? `<span class="sp-av teacher" style="--s:44px">🎼</span>` : avatarEl(p.who.avatar);
  return `<article class="sp-post" data-post="${esc(p.id)}">
    <div class="sp-head">${who}<div class="grow"><b>${teacher ? 'Your teacher' : esc(p.who.name)}</b><small>${ago(p.at)}</small></div></div>
    <div class="sp-text">${teacher && p.kind === 'songs' ? text(p) : teacher ? `📣 ${text(p)}` : text(p)}</div>
    <div class="sp-reacts">${p.reacts.map((r) => `<button type="button" class="sp-react${r.mine ? ' on' : ''}" data-react="${esc(r.e)}" aria-pressed="${r.mine}" aria-label="React ${esc(r.e)}">${r.e}${r.n ? ` <b>${r.n}</b>` : ''}</button>`).join('')}</div>
  </article>`;
};
const challengeHtml = (c) => `
  <section class="sp-chal">
    <div class="sp-chal-top"><span class="sp-kick">🎯 CHOIR CHALLENGE · THIS WEEK</span></div>
    <div class="sp-chal-main"><div class="sp-ring" style="--p:${c.pct / 100}"><b>${c.minutes}</b><small>of ${c.goal} min</small></div>
      <div class="grow"><div class="sp-chal-t">We sing ${c.goal} minutes together</div>
        <div class="sp-medals">${c.medals.map((m) => `<span class="${m.got ? 'got' : ''}" title="${m.minutes} min">${m.emoji}<small>${m.minutes}</small></span>`).join('')}</div>
        <div class="sp-chal-me">${c.mine ? `You have added <b>${c.mine} min</b>. Thank you!` : 'Your minutes count for everyone. Sing 5 minutes today!'}</div></div></div>
    ${c.top.length ? `<div class="sp-lanes">${c.top.map((r) => `<div class="sp-lane${r.me ? ' me' : ''}"><b>${r.rank}</b><span class="nm">${r.me ? 'You' : esc(r.name)}</span><span class="bar"><i style="width:${Math.max(6, r.share)}%"></i></span><em>${r.minutes} min</em></div>`).join('')}</div>` : ''}
    <button type="button" class="sp-cta" data-go="games">🎤 Sing now</button>
  </section>`;

export function mountSpace(host, { code }) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  let data = null, dead = false;

  const studio = () => {
    const m = data.me, a = m.avatar, own = (xp) => m.xp >= xp;
    const pick = (k, v) => ({ ...a, [k]: v });
    return `<details class="sp-studio card"><summary><b>🎨 My avatar</b><span class="muted"> · ${m.xp} XP. New looks unlock as you earn XP</span></summary>
      <div class="sp-prev">${avatarEl({ ...a, initial: m.name[0] }, 72)}</div>
      <div class="sp-row"><span>Colour</span>${m.colours.map((c) => `<button type="button" class="sw${a.color === c ? ' on' : ''}" style="--c:${c}" data-av='${esc(JSON.stringify(pick('color', c)))}' aria-label="Colour ${esc(c)}"></button>`).join('')}</div>
      <div class="sp-row"><span>Badge</span>${m.badges.map((b) => `<button type="button" class="chip${a.badge === b.id ? ' on' : ''}" ${own(b.xp) ? `data-av='${esc(JSON.stringify(pick('badge', b.id)))}'` : 'disabled'}>${b.e || '—'}${own(b.xp) ? '' : ` 🔒${b.xp}`}</button>`).join('')}</div>
      <div class="sp-row"><span>Frame</span>${m.frames.map((f) => `<button type="button" class="chip${a.frame === f.id ? ' on' : ''}" ${own(f.xp) ? `data-av='${esc(JSON.stringify(pick('frame', f.id)))}'` : 'disabled'}>${f.id === 'none' ? '—' : `<i class="fr" style="--c:${esc(f.c)}"></i>`}${own(f.xp) ? '' : ` 🔒${f.xp}`}</button>`).join('')}</div>
    </details>`;
  };

  function paint() {
    if (dead) return;
    if (!data.enabled) { root.innerHTML = '<div class="card muted">Choir Space is not open right now.</div>'; return; }
    if (data.locked) { root.innerHTML = `<div class="card"><h3 style="margin:0">Choir Space</h3><p class="muted">Cheer your friends on and fill the weekly challenge together. It is part of the full version (₹${esc(data.price ?? 500)} a year). Every child gets a free trial first.</p>${feeNoteHtml(data.note)}</div>`; return; }
    if (data.needConsent) { root.innerHTML = '<div class="card"><h3 style="margin:0">Choir Space</h3><p class="muted">A parent needs to tick the box in <b>Me</b> first. Then you can join your friends here.</p></div>'; return; }
    const m = data.me;
    root.innerHTML = `
      <div class="sp-top"><div><small>Treble Makers</small><h2>Choir Space</h2></div><span class="sp-chip fire">🔥 ${m.streak}</span><span class="sp-chip">⚡ ${m.xp}</span></div>
      ${data.stories.length ? `<div class="sp-stories" aria-label="Friends practising">${data.stories.map((s) => `<div class="sp-story">${avatarEl(s.avatar, 52)}<small>${s.id === m.id ? 'You' : esc(s.name.split(' ')[0])}${s.streak > 1 ? ` 🔥${s.streak}` : ''}</small></div>`).join('')}</div>` : ''}
      ${challengeHtml(data.challenge)}
      <div class="sp-feed">${data.feed.length ? data.feed.map(postHtml).join('') : '<div class="card muted">Nothing here yet. Practise in Games and your streaks and long practice days will show up for your friends to cheer.</div>'}</div>
      ${studio()}
      <div class="sp-safe">🛡 Safe by design: no chat, no photos and no voice recordings. Only short posts, cheers and stickers.</div>`;
  }

  async function load() {
    root.innerHTML = '<div class="empty">Loading…</div>';
    try { data = await api('me/space', { code }); paint(); }
    catch (e) { root.innerHTML = `<div class="card"><div class="alert bad">${esc(e.message)}</div></div>`; }
  }

  root.addEventListener('click', async (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { document.querySelector(`nav.tabbar [data-tab="${go.dataset.go}"]`)?.click(); return; }
    const r = e.target.closest('[data-react]');
    if (r) {
      const post = r.closest('[data-post]');
      const id = post.dataset.post, emoji = r.dataset.react;
      const p = data.feed.find((x) => x.id === id), cell = p.reacts.find((x) => x.e === emoji);
      cell.mine = !cell.mine; cell.n += cell.mine ? 1 : -1; // instant: the server answer below confirms it
      post.outerHTML = postHtml(p);
      try { const out = await api('me/space/react', { method: 'POST', code, body: { post: id, emoji } }); p.reacts = out.reacts; root.querySelector(`[data-post="${id}"]`).outerHTML = postHtml(p); }
      catch { cell.mine = !cell.mine; cell.n += cell.mine ? 1 : -1; root.querySelector(`[data-post="${id}"]`).outerHTML = postHtml(p); }
      return;
    }
    const av = e.target.closest('[data-av]');
    if (av) {
      try { const out = await api('me/avatar', { method: 'POST', code, body: JSON.parse(av.dataset.av) }); data.me.avatar = out.avatar; data.feed.forEach((p) => { if (p.who?.id === data.me.id) p.who.avatar = out.avatar; }); data.stories.forEach((s) => { if (s.id === data.me.id) s.avatar = out.avatar; }); const open = root.querySelector('.sp-studio')?.open; paint(); if (open) root.querySelector('.sp-studio').open = true; }
      catch (err) { alert(err.message); }
    }
  });

  load();
  return { destroy() { dead = true; root.remove(); } };
}
