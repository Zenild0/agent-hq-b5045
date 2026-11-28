// The pitch trail: the last four seconds of the child's voice drawn as a line. The green band is the note to hit
// (as wide as the level allows); the line turns green while the note is being held. Nothing is stored: it is a picture of "now".
export const TRAIL_MS = 4000;
export const SPAN = 2.5; // semitones shown above and below the note

// trail: [{ t, d }] with d = distance from the note in semitones (null while there is no clear pitch).
export function paintTrail(ctx, w, h, trail, now, tolSemis, holding) {
  const mid = h / 2, yOf = (d) => mid - Math.max(-SPAN, Math.min(SPAN, d)) / SPAN * (mid - 8);
  ctx.clearRect(0, 0, w, h);
  const bandH = Math.max(10, tolSemis / SPAN * (mid - 8));
  ctx.fillStyle = 'rgba(46,200,140,.2)'; ctx.fillRect(0, mid - bandH, w, bandH * 2);
  ctx.strokeStyle = 'rgba(46,200,140,.75)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
  ctx.strokeRect(1, mid - bandH, w - 2, bandH * 2); ctx.setLineDash([]);
  const colour = holding ? '#1fae78' : '#ff9f1c';
  ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = colour;
  let open = false, lx = 0, ly = 0, drawn = 0;
  ctx.beginPath();
  for (const p of trail) {
    if (now - p.t > TRAIL_MS) continue;
    if (p.d == null) { open = false; continue; }
    const x = w * (1 - (now - p.t) / TRAIL_MS), y = yOf(p.d);
    if (!open) { ctx.moveTo(x, y); open = true; } else ctx.lineTo(x, y);
    lx = x; ly = y; drawn += 1;
  }
  ctx.stroke();
  const last = trail.at(-1);
  if (last && last.d != null && now - last.t < 250) { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(lx, ly, 11, 0, 7); ctx.fill(); }
  return drawn;
}
