// Choose a child's pictures: first the square PROFILE photo, then (optionally) just the FACE for the leaderboard bobble-heads.
// The full photo is never kept: only the two framed crops are saved (a profile square and a small head crop).
const VIEW = 280; // size of the frame on screen

function frame(bmp, { title, hint, shape, out, startZoom, focusY, ok, skip }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'face-dlg';
    dlg.innerHTML = `
      <div class="face-box">
        <h3 style="margin:0">${title}</h3>
        <div class="muted">${hint}</div>
        <canvas width="${VIEW}" height="${VIEW}" class="face-canvas" aria-label="Photo: drag to move"></canvas>
        <label class="field" style="margin:0">Zoom<input type="range" min="1" max="4" step="0.01" value="${startZoom}" class="face-zoom"></label>
        <div class="row"><button class="btn primary" data-f="ok">${ok}</button>${skip ? `<button class="btn" data-f="skip">${skip}</button>` : ''}<button class="btn" data-f="no">Cancel</button></div>
      </div>`;
    document.body.appendChild(dlg);
    const canvas = dlg.querySelector('canvas'), ctx = canvas.getContext('2d'), zoom = dlg.querySelector('.face-zoom');
    const base = VIEW / Math.min(bmp.width, bmp.height); // smallest scale that still covers the frame
    let scale = base * startZoom;
    let x = VIEW / 2 - bmp.width * 0.5 * scale;       // centred sideways
    let y = VIEW / 2 - bmp.height * focusY * scale;   // towards the upper part, where faces usually are
    const fit = () => { x = Math.min(0, Math.max(VIEW - bmp.width * scale, x)); y = Math.min(0, Math.max(VIEW - bmp.height * scale, y)); };
    const draw = () => {
      ctx.clearRect(0, 0, VIEW, VIEW);
      ctx.drawImage(bmp, x, y, bmp.width * scale, bmp.height * scale);
      ctx.save(); // dim everything outside the guide
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath(); ctx.rect(0, 0, VIEW, VIEW);
      if (shape === 'circle') ctx.arc(VIEW / 2, VIEW / 2, VIEW / 2 - 6, 0, Math.PI * 2, true); else ctx.rect(8, 8, VIEW - 16, VIEW - 16);
      ctx.fill('evenodd');
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath();
      if (shape === 'circle') ctx.arc(VIEW / 2, VIEW / 2, VIEW / 2 - 6, 0, Math.PI * 2); else ctx.rect(8, 8, VIEW - 16, VIEW - 16);
      ctx.stroke(); ctx.restore();
    };
    fit(); draw();
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = { px: e.clientX, py: e.clientY, x, y }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (!drag) return; x = drag.x + (e.clientX - drag.px); y = drag.y + (e.clientY - drag.py); fit(); draw(); });
    const end = () => { drag = null; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    zoom.addEventListener('input', () => { // zoom around the centre of the frame
      const cx = (VIEW / 2 - x) / scale, cy = (VIEW / 2 - y) / scale;
      scale = base * Number(zoom.value); x = VIEW / 2 - cx * scale; y = VIEW / 2 - cy * scale; fit(); draw();
    });
    const close = (value) => { dlg.close(); dlg.remove(); resolve(value); };
    dlg.querySelector('[data-f="no"]').addEventListener('click', () => close(undefined));
    dlg.addEventListener('cancel', () => close(undefined));
    dlg.querySelector('[data-f="skip"]')?.addEventListener('click', () => close(null));
    dlg.querySelector('[data-f="ok"]').addEventListener('click', () => {
      const c = document.createElement('canvas');
      c.width = c.height = out;
      const inset = shape === 'square' ? 8 : 0; // keep exactly what is inside the white guide
      c.getContext('2d').drawImage(bmp, (inset - x) / scale, (inset - y) / scale, (VIEW - 2 * inset) / scale, (VIEW - 2 * inset) / scale, 0, 0, out, out);
      close(c.toDataURL('image/jpeg', 0.85));
    });
    dlg.showModal();
  });
}

// Returns { image, head } (head may be null if the face step was skipped), or null if cancelled.
export async function pickPhotos(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { return null; }
  try {
    const image = await frame(bmp, {
      title: 'Step 1 of 2: profile photo', hint: 'Drag and zoom to choose the square picture for the profile.',
      shape: 'square', out: 600, startZoom: 1, focusY: 0.45, ok: 'Next', skip: null,
    });
    if (!image) return null;
    const head = await frame(bmp, {
      title: 'Step 2 of 2: face for the leaderboard', hint: 'Now just the face. Fill the circle with the face (this is the bobble-head).',
      shape: 'circle', out: 300, startZoom: 1.5, focusY: 0.33, ok: 'Use these photos', skip: 'Skip',
    });
    if (head === undefined) return null; // cancelled
    return { image, head };
  } finally { bmp.close?.(); }
}
