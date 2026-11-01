import { LIMITS } from '../../../shared/limits';

/** Shrinks a photo to a web-friendly JPEG before upload (phone photos are often 5 MB+). */
export async function resizeImage(file: Blob, max = 720, quality = 0.86): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file couldn't be read as an image — please use a JPG, PNG or WebP photo.");
  });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Could not process that image');
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (q: number) =>
    new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process that image'))), 'image/jpeg', q));
  // Photos must stay under the 1 MB limit: lower the quality a little until it fits.
  let blob = await encode(quality);
  for (const q of [0.7, 0.55, 0.4]) {
    if (blob.size <= LIMITS.photoBytes) break;
    blob = await encode(q);
  }
  if (blob.size > LIMITS.photoBytes) throw new Error('That photo is too detailed to shrink under 1 MB — try a simpler picture.');
  return blob;
}

export const normaliseName = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '');
