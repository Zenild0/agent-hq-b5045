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
  assert.equal(parsed.players.length, 3);
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
