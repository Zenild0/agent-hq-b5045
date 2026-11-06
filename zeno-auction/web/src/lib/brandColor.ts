import { hexToRgb, rgbToHex, rgbToHsl } from '../../../shared/themes';

/** The most prominent colour of a logo (ignores transparent, white and black pixels). Falls back to a neutral blue. */
export async function dominantColor(blob: Blob): Promise<string> {
  try {
    const bmp = await createImageBitmap(blob);
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (!g) return '#2f6bff';
    g.drawImage(bmp, 0, 0, size, size);
    bmp.close();
    const { data } = g.getImageData(0, 0, size, size);
    // hue histogram weighted by how vivid each pixel is
    const bins = new Array(24).fill(0);
    const sums: [number, number, number][] = Array.from({ length: 24 }, () => [0, 0, 0]);
    let grey = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      const rgb: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
      const [h, s, l] = rgbToHsl(rgb);
      if (l > 94 || l < 6) continue;
      if (s < 18) {
        grey++;
        continue;
      }
      const b = Math.floor(h / 15) % 24;
      const w = (s / 100) * (1 - Math.abs(l - 50) / 60);
      bins[b] += w;
      sums[b][0] += rgb[0] * w; sums[b][1] += rgb[1] * w; sums[b][2] += rgb[2] * w;
    }
    const best = bins.indexOf(Math.max(...bins));
    if (bins[best] > 0.5) return rgbToHex([sums[best][0] / bins[best], sums[best][1] / bins[best], sums[best][2] / bins[best]]);
    return grey > 0 ? '#94a3b8' : '#2f6bff';
  } catch {
    return '#2f6bff';
  }
}

export { hexToRgb };
