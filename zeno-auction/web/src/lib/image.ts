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
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process that image'))), 'image/jpeg', quality),
  );
}

export const normaliseName = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '');
