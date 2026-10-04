// Pick a photo, then choose the face: the picture opens in a round frame that can be dragged and zoomed.
// Only the framed square (the face) is kept: it is shrunk to 400 pixels and saved. The full photo is never stored.
const SIZE = 400;       // saved picture
const VIEW = 280;       // size of the frame on screen

export function pickFace(file) {
  return new Promise((resolve) => {
    createImageBitmap(file, { imageOrientation: 'from-image' }).then((bmp) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'face-dlg';
      dlg.innerHTML = `
        <div class="face-box">
          <h3 style="margin:0">Choose the face</h3>
          <div class="muted">Drag the photo and zoom so the face fills the circle.</div>
          <canvas width="${VIEW}" height="${VIEW}" class="face-canvas" aria-label="Photo: drag to move"></canvas>
          <label class="field" style="margin:0">Zoom<input type="range" min="1" max="4" step="0.01" value="1" class="face-zoom"></label>
          <div class="row"><button class="btn primary" data-f="ok">Use this photo</button><button class="btn" data-f="no">Cancel</button></div>
        </div>`;
      document.body.appendChild(dlg);
      const canvas = dlg.querySelector('canvas'), ctx = canvas.getContext('2d'), zoom = dlg.querySelector('.face-zoom');
      const base = VIEW / Math.min(bmp.width, bmp.height); // smallest scale that still covers the frame
      let scale = base, x = 0, y = 0; // x, y: where the picture's top-left sits inside the frame
      const fit = () => { // keep the frame covered by the picture
        x = Math.min(0, Math.max(VIEW - bmp.width * scale, x));
        y = Math.min(0, Math.max(VIEW - bmp.height * scale, y));
      };
      // start zoomed in a little, centred sideways and towards the upper-middle: that is where faces usually are
      const START_ZOOM = 1.4;
      scale = base * START_ZOOM;
      x = VIEW / 2 - bmp.width * 0.5 * scale;
      y = VIEW / 2 - bmp.height * 0.35 * scale;
      zoom.value = START_ZOOM;
      const draw = () => {
        ctx.clearRect(0, 0, VIEW, VIEW);
        ctx.drawImage(bmp, x, y, bmp.width * scale, bmp.height * scale);
        ctx.save(); // dim everything outside the circle
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.beginPath(); ctx.rect(0, 0, VIEW, VIEW); ctx.arc(VIEW / 2, VIEW / 2, VIEW / 2 - 6, 0, Math.PI * 2, true); ctx.fill('evenodd');
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(VIEW / 2, VIEW / 2, VIEW / 2 - 6, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      };
      fit(); draw();
      let drag = null;
      canvas.addEventListener('pointerdown', (e) => { drag = { px: e.clientX, py: e.clientY, x, y }; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', (e) => { if (!drag) return; x = drag.x + (e.clientX - drag.px); y = drag.y + (e.clientY - drag.py); fit(); draw(); });
      const end = () => { drag = null; };
      canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      zoom.addEventListener('input', () => { // zoom around the centre of the frame
        const next = base * Number(zoom.value);
        const cx = (VIEW / 2 - x) / scale, cy = (VIEW / 2 - y) / scale;
        scale = next; x = VIEW / 2 - cx * scale; y = VIEW / 2 - cy * scale; fit(); draw();
      });
      const close = (value) => { dlg.close(); dlg.remove(); bmp.close?.(); resolve(value); };
      dlg.querySelector('[data-f="no"]').addEventListener('click', () => close(null));
      dlg.addEventListener('cancel', () => close(null));
      dlg.querySelector('[data-f="ok"]').addEventListener('click', () => {
        const out = document.createElement('canvas');
        out.width = out.height = SIZE;
        out.getContext('2d').drawImage(bmp, -x / scale, -y / scale, VIEW / scale, VIEW / scale, 0, 0, SIZE, SIZE);
        close(out.toDataURL('image/jpeg', 0.85));
      });
      dlg.showModal();
    }, () => resolve(null));
  });
}
