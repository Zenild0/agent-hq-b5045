import { parseMoney } from '../../../shared/money';

export interface ImportRow {
  name: string;
  role: string;
  basePrice: number;
  description: string;
  photo: string;
  team: string;
  price: number;
  /** 0 = not given. Writing the next round's number saves the player for that round. */
  round?: number;
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) (out.push(cur.trim()), (cur = ''));
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const HEADERS: Record<string, keyof ImportRow> = {
  name: 'name', player: 'name',
  role: 'role', position: 'role', category: 'role', type: 'role',
  base: 'basePrice', baseprice: 'basePrice', 'base price': 'basePrice',
  description: 'description', desc: 'description', about: 'description', bio: 'description',
  photo: 'photo', image: 'photo', url: 'photo', picture: 'photo',
  team: 'team', 'sold to': 'team', owner: 'team',
  price: 'price', 'sold price': 'price', 'sold for': 'price',
  round: 'round', 'for round': 'round', 'round no': 'round', 'round number': 'round',
};
const DEFAULT_ORDER: (keyof ImportRow)[] = ['name', 'role', 'basePrice', 'description', 'photo', 'team', 'price'];

/**
 * Pasted rows from Excel / Google Sheets (tab separated) or a CSV. A header row is optional;
 * without one the columns are: name, role, base price, description, photo URL, team, price.
 * Amounts understand "20L", "1.5cr", "250k".
 */
export function parseImport(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const delim = lines[0].includes('\t') ? '\t' : ',';
  let cols = DEFAULT_ORDER;
  const first = splitLine(lines[0], delim).map((c) => c.toLowerCase());
  if (first.some((c) => HEADERS[c] === 'name')) {
    cols = first.map((c) => HEADERS[c] ?? ('' as keyof ImportRow));
    lines.shift();
  }
  return lines.map((line) => {
    const cells = splitLine(line, delim);
    const row: ImportRow = { name: '', role: '', basePrice: 0, description: '', photo: '', team: '', price: 0 };
    cols.forEach((key, i) => {
      const v = cells[i] ?? '';
      if (!key || !v) return;
      if (key === 'basePrice' || key === 'price') row[key] = parseMoney(v) ?? 0;
      else if (key === 'round') row.round = Number(/(\d{1,2})/.exec(v)?.[1] ?? 0);
      else row[key] = v;
    });
    return row;
  });
}
