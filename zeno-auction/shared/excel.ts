import { parseMoney, type MoneyFmt } from './money';
import { effectiveBase, teamStats } from './rules';
import type { Captain, EventData } from './types';

/**
 * Excel import / export. `ExcelJS` is passed in (rather than imported) so the same code runs in the
 * browser (loaded on demand) and in Node (tests, template generation).
 */
type ExcelNS = any;

export interface SheetTeam {
  team: string;
  captain: string;
  purse: number; // total purse; 0 = not given
  spent?: number;
  left?: number;
  players?: number;
}

export interface SheetPlayer {
  name: string;
  role: string;
  basePrice: number; // 0 = event default
  description: string;
  photo: string;
  team: string;
  price: number;
  /** The auction round this player is for (0 = not given: use the current round). The NEXT round saves them ahead of time. */
  round?: number;
  status?: string;
  /** The row in the spreadsheet (for messages like "row 54"). */
  row?: number;
}

export interface ParsedWorkbook {
  teams: SheetTeam[];
  players: SheetPlayer[];
  /** Spreadsheet rows that have something in them but no player name (they are ignored). */
  blankRows?: number[];
}

const HEADER_FILL = 'FFFFC933';
const HEADER_TEXT = 'FF07071A';
const INDIAN_FMT = '[>=10000000]##\\,##\\,##\\,##0;[>=100000]##\\,##\\,##0;##,##0';

const PLAYER_HEADERS: Record<string, keyof SheetPlayer> = {
  name: 'name', player: 'name', 'player name': 'name',
  role: 'role', position: 'role', category: 'role', type: 'role',
  'base price': 'basePrice', base: 'basePrice', baseprice: 'basePrice',
  description: 'description', desc: 'description', about: 'description', bio: 'description',
  'photo url': 'photo', photo: 'photo', image: 'photo', url: 'photo', picture: 'photo',
  team: 'team', 'team name': 'team', 'sold to': 'team', owner: 'team',
  'price paid': 'price', price: 'price', 'sold price': 'price', 'sold for': 'price', 'sold amount': 'price',
  round: 'round', 'for round': 'round', 'round no': 'round', 'round number': 'round', 'auction round': 'round',
  status: 'status',
};

const TEAM_HEADERS: Record<string, keyof SheetTeam> = {
  team: 'team', 'team name': 'team', name: 'team',
  captain: 'captain', 'captain name': 'captain', owner: 'captain',
  purse: 'purse', budget: 'purse', 'starting purse': 'purse', 'total purse': 'purse',
};

const norm = (s: string) => s.toLowerCase().replace(/[_\s]+/g, ' ').trim();

/** Excel cells can hold numbers, rich text, hyperlinks or formulas — flatten any of them to text. */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'boolean') return v ? 'true' : '';
  if (v instanceof Date) return '';
  const o = v as Record<string, any>;
  if (Array.isArray(o.richText)) return o.richText.map((r: any) => r.text).join('').trim();
  if (o.text !== undefined) return String(o.text).trim();
  if (o.result !== undefined) return cellText(o.result);
  return '';
}

const money = (text: string): number => (text ? (parseMoney(text) ?? 0) : 0);
/** "2", "Round 2", "R2" → 2; anything else → 0 (not given). */
const wholeNumber = (text: string): number => {
  const m = /(\d{1,2})/.exec(text);
  return m ? Number(m[1]) : 0;
};

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

function readSheet<T extends string>(ws: any, headers: Record<string, T>): (Record<T, string> & { _row: number })[] {
  const cols = new Map<number, T>();
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell: any, col: number) => {
    const key = headers[norm(cellText(cell.value))];
    if (key) cols.set(col, key);
  });
  const rows: (Record<T, string> & { _row: number })[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const out = { _row: r } as Record<T, string> & { _row: number };
    let any = false;
    for (const [col, key] of cols) {
      const text = cellText(row.getCell(col).value);
      (out as Record<string, unknown>)[key] = text;
      if (text) any = true;
    }
    if (any) rows.push(out);
  }
  return rows;
}

export async function readWorkbook(ExcelJS: ExcelNS, data: ArrayBuffer | Uint8Array): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  const sheets: any[] = wb.worksheets;
  const playerSheet = sheets.find((s) => /player/i.test(s.name)) ?? sheets[0];
  const teamSheet = sheets.find((s) => /^teams?$/i.test(s.name.trim()));

  const playerRows = playerSheet ? readSheet(playerSheet, PLAYER_HEADERS) : [];
  const blankRows = playerRows.filter((r) => !r.name).map((r) => r._row);
  const players = playerSheet
    ? playerRows
        .filter((r) => r.name)
        .map<SheetPlayer>((r) => ({
          name: r.name,
          role: r.role ?? '',
          basePrice: money(r.basePrice ?? ''),
          description: r.description ?? '',
          photo: r.photo ?? '',
          team: r.team ?? '',
          price: money(r.price ?? ''),
          round: wholeNumber(r.round ?? ''),
          status: r.status ?? '',
          row: r._row,
        }))
    : [];

  const teams = teamSheet
    ? readSheet(teamSheet, TEAM_HEADERS)
        .filter((r) => r.team)
        .map<SheetTeam>((r) => ({ team: r.team, captain: r.captain ?? '', purse: money(r.purse ?? '') }))
    : [];

  return { teams, players, blankRows };
}

// ---------------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------------

function styleHeader(ws: any) {
  const row = ws.getRow(1);
  row.height = 22;
  row.eachCell((cell: any) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle' };
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

export interface WorkbookInput {
  fmt: MoneyFmt;
  teams: SheetTeam[];
  players: SheetPlayer[];
  /** Adds the read-only Status / spent / left columns and skips the instructions sheet. */
  forExport: boolean;
}

export function buildWorkbook(ExcelJS: ExcelNS, input: WorkbookInput) {
  const { fmt, teams, players, forExport } = input;
  const numFmt = fmt.moneyStyle === 'indian' ? INDIAN_FMT : '#,##0';
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ZenoBid';

  // ---- Players ----
  const ps = wb.addWorksheet('Players');
  ps.columns = [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Role', key: 'role', width: 16 },
    { header: 'Base Price', key: 'basePrice', width: 15 },
    { header: 'Description', key: 'description', width: 44 },
    { header: 'Photo URL', key: 'photo', width: 30 },
    { header: 'Team', key: 'team', width: 22 },
    { header: 'Price Paid', key: 'price', width: 15 },
    { header: 'Round', key: 'round', width: 9 },
    ...(forExport ? [{ header: 'Status', key: 'status', width: 12 }] : []),
  ];
  for (const p of players) {
    ps.addRow({
      name: p.name,
      role: p.role,
      basePrice: p.basePrice || null,
      description: p.description,
      photo: p.photo,
      team: p.team || null,
      price: p.team ? p.price || null : null,
      round: p.round || null,
      status: p.status,
    });
  }
  styleHeader(ps);
  ps.getColumn('basePrice').numFmt = numFmt;
  ps.getColumn('price').numFmt = numFmt;
  const lastRow = Math.max(players.length + 1, 300);
  ps.autoFilter = { from: 'A1', to: { row: 1, column: forExport ? 9 : 8 } };
  // Team column gets a drop-down of the teams in the Teams sheet.
  for (let r = 2; r <= lastRow; r++) {
    ps.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['Teams!$A$2:$A$40'],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Unknown team',
      error: 'This team is not on the Teams sheet. Add it there first.',
    };
  }

  // ---- Teams ----
  const ts = wb.addWorksheet('Teams');
  ts.columns = [
    { header: 'Team', key: 'team', width: 24 },
    { header: 'Captain', key: 'captain', width: 22 },
    { header: 'Purse', key: 'purse', width: 16 },
    ...(forExport
      ? [
          { header: 'Spent', key: 'spent', width: 16 },
          { header: 'Left', key: 'left', width: 16 },
          { header: 'Players', key: 'players', width: 10 },
        ]
      : []),
  ];
  for (const t of teams) ts.addRow({ team: t.team, captain: t.captain, purse: t.purse || null, spent: t.spent, left: t.left, players: t.players });
  styleHeader(ts);
  for (const k of ['purse', 'spent', 'left']) if (ts.columns.some((c: any) => c.key === k)) ts.getColumn(k).numFmt = numFmt;

  // ---- How to use ----
  if (!forExport) {
    const hs = wb.addWorksheet('How to use');
    hs.getColumn(1).width = 110;
    const lines = [
      'ZenoBid import template',
      '',
      '1. Teams sheet — one row per team. Purse is the total purse (leave blank to use the event default).',
      '   Importing a team that already exists simply sets its purse.',
      '2. Players sheet — one row per player. Only Name is required.',
      '3. Already-bought players: fill Team (pick from the drop-down) and Price Paid. They are placed on that team and the price comes off its purse.',
      '4. Leave Team and Price Paid empty for players who are still up for auction.',
      '5. Amounts: type full numbers (2000000) or short forms as text (20L, 1.2cr, 250k, 2m).',
      '6. Base Price empty = the event\'s default base price. Photo URL is optional (you can also upload photos in the app).',
      '7. Re-importing a player with the same Name updates them instead of adding a duplicate.',
      '8. Round: leave it empty for players who are up for auction now. Write the NEXT round number (for example 2 while round 1 is on) to save a player for the next round:',
      '   they stay hidden from captains and the big screen, and join the pool when the auctioneer starts that round. Only the very next round can be prepared ahead.',
      '',
      'In ZenoBid: Players tab → Import Excel → choose this file → check the preview → Import.',
      'You can delete the sample rows and this sheet.',
    ];
    lines.forEach((l, i) => {
      const c = hs.getCell(`A${i + 1}`);
      c.value = l;
      c.alignment = { wrapText: true, vertical: 'top' };
      if (i === 0) c.font = { bold: true, size: 16 };
    });
  }

  return wb;
}

/** Everything in the auction as sheet rows (the in-app Export button). */
export function exportRows(data: Omit<EventData, 'log'>): { teams: SheetTeam[]; players: SheetPlayer[] } {
  const teamName = (id: string | null) => data.captains.find((c) => c.id === id)?.team ?? '';
  const teams = data.captains.map((c: Captain) => {
    const st = teamStats(data, c);
    return { team: c.team, captain: c.name, purse: c.budget, spent: st.spent, left: st.remaining, players: st.count };
  });
  const order = [...data.players].sort((a, b) => a.order - b.order);
  const players = order.map<SheetPlayer>((p) => ({
    name: p.name,
    role: p.role,
    basePrice: p.basePrice || effectiveBase(data.settings, p),
    description: p.description,
    photo: p.photo,
    team: p.status === 'sold' ? teamName(p.teamId) : '',
    price: p.status === 'sold' ? p.price : 0,
    round: p.status === 'upcoming' ? data.round + 1 : p.status === 'sold' ? p.soldRound || data.round : data.round,
    status: p.status === 'sold' ? 'Sold' : p.status === 'unsold' ? 'Unsold' : p.status === 'upcoming' ? 'Next round' : 'In pool',
  }));
  return { teams, players };
}

/** Sample rows for the downloadable template. */
export function templateRows(fmt: MoneyFmt): { teams: SheetTeam[]; players: SheetPlayer[] } {
  const indian = fmt.moneyStyle === 'indian';
  const u = indian ? 100_000 : 1_000; // lakh or thousand
  return {
    teams: [
      { team: 'Thunder Hawks', captain: 'Priya', purse: indian ? 120_000_000 : 10_000_000 },
      { team: 'Royal Rockets', captain: 'Arjun', purse: indian ? 120_000_000 : 10_000_000 },
    ],
    players: [
      { name: 'Aarav Mehta', role: 'Batter', basePrice: 20 * u, description: 'Opens the innings and never leaves the crease.', photo: '', team: '', price: 0 },
      { name: 'Rohan Iyer', role: 'Bowler', basePrice: 25 * u, description: 'Yorker specialist.', photo: '', team: '', price: 0 },
      { name: 'Meera Kapoor', role: 'All-rounder', basePrice: 30 * u, description: 'Already bought before the app was used →', photo: '', team: 'Thunder Hawks', price: 120 * u },
      { name: 'Dev Patel', role: 'Bowler', basePrice: 20 * u, description: 'Round 2 example: saved for the next round, hidden until it starts.', photo: '', team: '', price: 0, round: 2 },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// What an import will do, worked out before anything is changed
// ---------------------------------------------------------------------------------------------

export interface ImportExisting {
  name: string;
  status: 'available' | 'sold' | 'unsold' | 'upcoming';
}

export interface ImportSummary {
  /** The auction after the import (existing players that are not in the file keep their status). */
  total: number;
  pool: number;
  sold: number;
  unsold: number;
  saved: number; // saved for the next round
  /** Things worth checking before pressing Import, in plain words. */
  warnings: string[];
}

const lc = (s: string) => s.trim().toLowerCase();

/**
 * Mirrors what the server's import does (server/engine.ts "players.import"), so the preview can say, for example,
 * "15 in the pool" before anything is changed. A test keeps the two in step.
 */
export function summarizeImport(
  rows: SheetPlayer[],
  ctx: { currentRound: number; existing: ImportExisting[]; knownTeams: string[]; blankRows?: number[] },
): ImportSummary {
  const next = ctx.currentRound + 1;
  const known = new Set(ctx.knownTeams.map(lc));
  const state = new Map<string, ImportExisting['status']>(ctx.existing.map((p) => [lc(p.name), p.status]));
  const warnings: string[] = [];
  const firstSeen = new Map<string, number>();
  const dupes = new Map<string, number[]>();
  const nr = (r: SheetPlayer) => (r.row ? `row ${r.row}` : 'a row');

  for (const r of rows) {
    const key = lc(r.name);
    if (!key) continue;
    const askedRound = r.round ?? 0;
    const hasTeam = !!r.team && known.has(lc(r.team));
    if (r.row !== undefined) {
      if (firstSeen.has(key)) dupes.set(key, [...(dupes.get(key) ?? [firstSeen.get(key)!]), r.row]);
      else firstSeen.set(key, r.row);
    }
    if (askedRound > next) {
      warnings.push(`${nr(r)} (${r.name}) is for round ${askedRound}: only the next round, ${next}, can be prepared ahead, so it is skipped.`);
      continue;
    }
    const toNext = askedRound ? askedRound === next : false;
    const cur = state.get(key);
    if (cur === undefined) state.set(key, hasTeam ? 'sold' : toNext && !r.team ? 'upcoming' : 'available');
    else {
      let st = cur;
      if (askedRound && !r.team && st !== 'sold') {
        if (toNext && st !== 'upcoming') st = 'upcoming';
        else if (!toNext && st === 'upcoming') st = 'available';
      }
      if (hasTeam) st = 'sold';
      state.set(key, st);
    }
    // the spreadsheet's own Status column is only a note; the Team column decides
    const said = lc(r.status ?? '');
    if (r.team && !known.has(lc(r.team))) warnings.push(`${nr(r)} (${r.name}): team “${r.team}” does not exist, so the player is left unassigned.`);
    else if (hasTeam && said && said !== 'sold') warnings.push(`${nr(r)} (${r.name}): Team is ${r.team} but Status says “${r.status}”. The Team column wins, so this player will be SOLD to ${r.team}.`);
    else if (!r.team && said === 'sold') warnings.push(`${nr(r)} (${r.name}): Status says Sold but there is no Team, so this player goes ${toNext ? 'to the next round' : 'into the pool'}.`);
  }
  for (const [key, list] of dupes) {
    const name = rows.find((r) => lc(r.name) === key)!.name;
    warnings.push(`“${name}” is listed twice (rows ${list.join(' and ')}). It is one player, and the later row can change the earlier one.`);
  }
  for (const row of ctx.blankRows ?? []) warnings.push(`Row ${row} has no name, so it is ignored.`);

  let pool = 0, sold = 0, unsold = 0, saved = 0;
  for (const st of state.values()) st === 'available' ? pool++ : st === 'sold' ? sold++ : st === 'unsold' ? unsold++ : saved++;
  return { total: state.size, pool, sold, unsold, saved, warnings };
}
