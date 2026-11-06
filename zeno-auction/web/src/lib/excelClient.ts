import { buildWorkbook, exportRows, readWorkbook, templateRows, type ParsedWorkbook } from '../../../shared/excel';
import type { MoneyFmt } from '../../../shared/money';
import type { Snapshot } from '../../../shared/types';
import { parseImport } from './csv';

// ExcelJS is large, so it is only fetched when someone actually uses Excel.
async function excel(): Promise<any> {
  const m: any = await import('exceljs');
  return m.default ?? m;
}

function download(data: ArrayBuffer | Uint8Array, filename: string) {
  const blob = new Blob([data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const safe = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'auction';

export async function downloadTemplate(fmt: MoneyFmt) {
  const ExcelJS = await excel();
  const wb = buildWorkbook(ExcelJS, { fmt, ...templateRows(fmt), forExport: false });
  download(await wb.xlsx.writeBuffer(), 'ZenoBid-import-template.xlsx');
}

export async function exportAuction(snap: Snapshot) {
  const ExcelJS = await excel();
  const wb = buildWorkbook(ExcelJS, { fmt: snap.settings, ...exportRows(snap), forExport: true });
  download(await wb.xlsx.writeBuffer(), `${safe(snap.settings.name)}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** .xlsx (Teams + Players sheets) or a plain .csv of players. */
export async function parseFile(file: File): Promise<ParsedWorkbook> {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    return { teams: [], players: parseImport(await file.text()).filter((r) => r.name) };
  }
  if (/\.xls$/i.test(file.name)) throw new Error('Old .xls files are not supported — in Excel use Save As → .xlsx');
  return readWorkbook(await excel(), await file.arrayBuffer());
}
