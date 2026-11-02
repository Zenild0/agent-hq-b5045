import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildWorkbook, exportRows, readWorkbook, templateRows } from './excel';
import { createStore, runAction } from '../server/engine';

const ADMIN = { role: 'admin' as const };
const inr = { symbol: '₹', moneyStyle: 'indian' as const };

test('template reads back with teams, players and the already-bought row', async () => {
  const { teams, players } = templateRows(inr);
  const buf = await buildWorkbook(ExcelJS, { fmt: inr, teams, players, forExport: false }).xlsx.writeBuffer();
  const parsed = await readWorkbook(ExcelJS, buf as ArrayBuffer);
  assert.equal(parsed.teams.length, 2);
  assert.equal(parsed.teams[0].team, 'Thunder Hawks');
  assert.equal(parsed.teams[0].purse, 120_000_000);
  assert.equal(parsed.players.length, 4);
  const bought = parsed.players.find((p) => p.name === 'Meera Kapoor')!;
  assert.equal(bought.team, 'Thunder Hawks');
  assert.equal(bought.price, 12_000_000);
});

test('export → import round-trips an auction in progress', async () => {
  const s = createStore('RT0001', { defaultBudget: 100_000_000, defaultBasePrice: 2_000_000 });
  const red = (runAction(s, ADMIN, 'captain.add', { team: 'Red', name: 'Ann' }) as { id: string }).id;
  runAction(s, ADMIN, 'captain.add', { team: 'Blue' });
  runAction(s, ADMIN, 'players.import', { rows: [{ name: 'Sold Guy', role: 'Bowler', basePrice: 3_000_000, team: 'Red', price: 45_000_000 }, { name: 'Free Agent' }] });
  runAction(s, ADMIN, 'captain.budget', { id: red, mode: 'add', amount: 10_000_000 });

  const rows = exportRows(s.data);
  const buf = await buildWorkbook(ExcelJS, { fmt: s.data.settings, ...rows, forExport: true }).xlsx.writeBuffer();
  const parsed = await readWorkbook(ExcelJS, buf as ArrayBuffer);

  assert.deepEqual(parsed.teams.map((t) => [t.team, t.captain, t.purse]), [['Red', 'Ann', 110_000_000], ['Blue', '', 100_000_000]]);
  const sold = parsed.players.find((p) => p.name === 'Sold Guy')!;
  assert.deepEqual([sold.team, sold.price, sold.basePrice, sold.role], ['Red', 45_000_000, 3_000_000, 'Bowler']);
  assert.equal(parsed.players.find((p) => p.name === 'Free Agent')!.team, '');

  // importing it into a fresh event rebuilds the same position
  const fresh = createStore('RT0002', {});
  for (const t of parsed.teams) runAction(fresh, ADMIN, 'captain.add', { team: t.team, name: t.captain, budget: t.purse });
  runAction(fresh, ADMIN, 'players.import', { rows: parsed.players });
  assert.equal(fresh.data.players.find((p) => p.name === 'Sold Guy')!.status, 'sold');
  assert.equal(fresh.data.players.length, 2);
});

test('reads text amounts like 20L and 1.2cr typed into cells', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Players');
  ws.addRow(['Name', 'Base Price', 'Team', 'Price Paid']);
  ws.addRow(['Typed Amounts', '20L', 'Red', '1.2cr']);
  const buf = await wb.xlsx.writeBuffer();
  const [p] = (await readWorkbook(ExcelJS, buf as ArrayBuffer)).players;
  assert.deepEqual([p.basePrice, p.price], [2_000_000, 12_000_000]);
});

test('a Round column in the Excel file saves players for the next round; export and re-import keep it', async () => {
  // the template carries the new column with a worked example
  const { teams, players } = templateRows(inr);
  const parsed0 = await readWorkbook(ExcelJS, (await buildWorkbook(ExcelJS, { fmt: inr, teams, players, forExport: false }).xlsx.writeBuffer()) as ArrayBuffer);
  assert.equal(parsed0.players.find((p) => p.name === 'Dev Patel')!.round, 2);
  assert.equal(parsed0.players.find((p) => p.name === 'Aarav Mehta')!.round, 0, 'an empty cell means "not given"');

  // headings are forgiving ("Round", "For round", "R2", "Round 2")
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Players');
  ws.addRow(['Name', 'For Round']);
  ws.addRow(['A', 2]); ws.addRow(['B', 'Round 2']); ws.addRow(['C', 'R3']); ws.addRow(['D', '']); ws.addRow(['E', 1]);
  const read = await readWorkbook(ExcelJS, (await wb.xlsx.writeBuffer()) as ArrayBuffer);
  assert.deepEqual(read.players.map((p) => [p.name, p.round]), [['A', 2], ['B', 2], ['C', 3], ['D', 0], ['E', 1]]);

  // importing: round 1 now, round 2 saved ahead, round 3 refused (only the NEXT round can be prepared)
  const s = createStore('RND001', { defaultBudget: 100_000_000 });
  runAction(s, ADMIN, 'captain.add', { team: 'Red' });
  const res = runAction(s, ADMIN, 'players.import', { rows: read.players }) as { added: number; queued: number; skipped: string[] };
  const status = (n: string) => s.data.players.find((p) => p.name === n)?.status;
  assert.deepEqual([status('A'), status('B'), status('C'), status('D'), status('E')], ['upcoming', 'upcoming', undefined, 'available', 'available']);
  assert.equal(res.queued, 2);
  assert.match(res.skipped.join(), /C \(round 3 is too far ahead/);

  // export writes the round (next round for saved players), and importing the export again changes nothing
  const rows = exportRows(s.data);
  assert.equal(rows.players.find((p) => p.name === 'A')!.round, 2);
  assert.equal(rows.players.find((p) => p.name === 'D')!.round, 1);
  assert.equal(rows.players.find((p) => p.name === 'A')!.status, 'Next round');
  const again = await readWorkbook(ExcelJS, (await buildWorkbook(ExcelJS, { fmt: s.data.settings, ...rows, forExport: true }).xlsx.writeBuffer()) as ArrayBuffer);
  runAction(s, ADMIN, 'players.import', { rows: again.players });
  assert.deepEqual([status('A'), status('B'), status('D'), status('E')], ['upcoming', 'upcoming', 'available', 'available']);

  // a later import can move an existing player either way, but never touches a sold player
  runAction(s, ADMIN, 'players.import', { rows: [{ name: 'D', round: 2 }, { name: 'A', round: 1 }] });
  assert.deepEqual([status('D'), status('A')], ['upcoming', 'available']);
  runAction(s, ADMIN, 'players.import', { rows: [{ name: 'Sold Z', team: 'Red', price: 1 }] });
  runAction(s, ADMIN, 'players.import', { rows: [{ name: 'Sold Z', round: 2 }] });
  assert.equal(status('Sold Z'), 'sold');

  // once round 2 has started, "2" means now and "3" is the next round
  runAction(s, { role: 'host' }, 'round.next', {});
  assert.equal(s.data.round, 2);
  runAction(s, ADMIN, 'players.import', { rows: [{ name: 'F', round: 2 }, { name: 'G', round: 3 }, { name: 'H', round: 4 }] });
  assert.deepEqual([status('F'), status('G'), status('H')], ['available', 'upcoming', undefined]);

  // a team in the row still wins: an already-bought player is placed, not hidden
  runAction(s, ADMIN, 'players.import', { rows: [{ name: 'Bought Early', team: 'Red', price: 5, round: 3 }] });
  assert.equal(status('Bought Early'), 'sold');
});
