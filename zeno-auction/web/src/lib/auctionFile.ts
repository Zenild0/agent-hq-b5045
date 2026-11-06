import { exportEvent } from './api';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'auction';

/** Downloads the whole auction (teams, players, results, history, settings, photos) to this computer. */
export async function downloadAuctionFile(code: string, adminKey: string, name: string): Promise<string> {
  const file = await exportEvent(code, adminKey);
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const fileName = `zenobid-${slug(name)}-${code}-${new Date().toISOString().slice(0, 10)}.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return fileName;
}
