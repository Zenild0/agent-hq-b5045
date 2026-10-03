export const $ = (sel, el = document) => el.querySelector(sel);

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtPts = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const fmtDate = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const typeLabel = (t) => (t === 'sunday' ? 'Sunday mass' : 'Saturday practice');

export async function api(path, { method = 'GET', body, pin } = {}) {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(pin ? { 'x-pin': pin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
  return data;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function boardHtml(rows, emptyText = 'No children yet.') {
  if (!rows.length) return `<div class="empty">${emptyText}</div>`;
  const body = rows.map((r) => `
    <tr class="${r.eligible ? '' : 'out'}">
      <td>${r.eligible ? (r.rank <= 3 && r.points > 0 ? `<span class="medal">${MEDALS[r.rank - 1]}</span>` : r.rank) : '–'}</td>
      <td>${esc(r.name)}${r.eligible ? '' : ' <span class="badge bad">out this year</span>'}</td>
      <td class="num">${r.leaves}</td>
      <td class="num"><b>${fmtPts(r.points)}</b></td>
    </tr>`).join('');
  return `<table><thead><tr><th>#</th><th>Name</th><th class="num">Leaves</th><th class="num">Points</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function leaveBadge(leaves, max, exceeded) {
  const cls = exceeded ? 'bad' : leaves >= max ? 'warn' : leaves >= max - 1 ? 'warn' : 'ok';
  return `<span class="badge ${cls}">${leaves}/${max} leaves</span>`;
}

const STATUS_LABEL = { present: 'Present', absent: 'Absent', excused: 'Excused (sick)' };

export function childHtml(d) {
  const { stats: st, settings: s } = d;
  const alert = st.exceeded
    ? `<div class="alert bad"><b>Not continuing this year.</b> ${esc(d.name)} went over ${s.maxLeaves} leaves (from ${fmtDate(st.leftOn)}). They are welcome to rejoin next April.</div>`
    : st.leavesLeft <= 1
      ? `<div class="alert warn"><b>Careful:</b> ${st.leavesLeft ? `only ${st.leavesLeft} leave left` : 'no leaves left'} this year — one more unexcused absence and ${esc(d.name)} can't continue.</div>`
      : '';
  const rows = d.history.map((h) => `
    <tr>
      <td>${fmtDate(h.date)}<div class="muted">${typeLabel(h.type)}</div></td>
      <td><span class="badge ${h.status === 'present' ? 'ok' : h.status === 'absent' ? 'bad' : 'info'}">${STATUS_LABEL[h.status]}</span>
        ${h.remarks.map((r) => `<span class="badge ${r === 'Well behaved' || r === 'Helped others' ? 'ok' : 'warn'}">${esc(r)}</span>`).join(' ')}</td>
      <td class="num">${h.points ? `+${fmtPts(h.points)}` : '0'}</td>
    </tr>`).join('');
  return `
    <h2>${esc(d.name)} <span class="muted">· ${esc(d.seasonLabel)}</span></h2>
    ${alert}
    <div class="stats">
      <div class="stat"><b>${fmtPts(st.points)}</b>points</div>
      <div class="stat"><b>${d.rank ?? '–'}${d.rank ? `<small class="muted"> / ${d.ranked}</small>` : ''}</b>rank to ${esc(d.prize.label)}</div>
      <div class="stat"><b>${st.leaves}/${s.maxLeaves}</b>leaves used</div>
      <div class="stat"><b>${st.present}</b>present (${st.late} late)</div>
    </div>
    <h2>Attendance</h2>
    ${rows ? `<table><tbody>${rows}</tbody></table>` : '<div class="empty">No attendance recorded yet.</div>'}`;
}
