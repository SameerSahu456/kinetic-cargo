import { ShipmentRow } from '../types/invoice';
import { createShipmentRow, round2 } from './invoiceMath';

// Excel / CSV upload of shipment rows. Expected columns, in this order when
// the sheet has no recognisable header row:
export const SHIPMENT_SHEET_COLUMNS = [
  'Date',
  'AWB No',
  'From',
  'Destination',
  'Weight',
  'Rate',
  'Mode',
  'PCS',
  'Amount',
] as const;

type Field =
  | 'date'
  | 'awb'
  | 'from'
  | 'destination'
  | 'weight'
  | 'rate'
  | 'mode'
  | 'pcs'
  | 'amount';

const FIELD_ORDER: Field[] = [
  'date',
  'awb',
  'from',
  'destination',
  'weight',
  'rate',
  'mode',
  'pcs',
  'amount',
];

type Cell = string | number | boolean | Date | null | undefined;

function headerField(cell: Cell): Field | null {
  const h = String(cell ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (!h) return null;
  if (h.includes('awb') || h.includes('docket') || h.includes('consignment')) return 'awb';
  // Vehicle charges are billed once per invoice, so a per-row column is ignored.
  if (h.includes('vehicle')) return null;
  if (h.includes('date')) return 'date';
  if (h.startsWith('dest') || h === 'to') return 'destination';
  if (h.includes('from') || h.includes('branch') || h.includes('origin')) return 'from';
  if (h.includes('mode')) return 'mode';
  if (h.includes('pcs') || h.includes('piece') || h.includes('pkg') || h === 'qty') return 'pcs';
  if (h.includes('rate')) return 'rate';
  if (h.includes('amount') || h.includes('amt')) return 'amount';
  if (h.includes('weight') || h === 'wt' || h.endsWith('wt')) return 'weight';
  return null;
}

/** Accepts dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd, a Date or an Excel serial; returns ISO or ''. */
export function parseSheetDate(value: Cell): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    if (value < 20000 || value > 80000) return '';
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000).toISOString().slice(0, 10);
  }
  const s = String(value ?? '').trim();
  if (!s) return '';
  const pad = (v: string) => v.padStart(2, '0');
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (iso) return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s);
  if (dmy) return `${dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]}-${pad(dmy[2])}-${pad(dmy[1])}`;
  if (/^\d{5}$/.test(s)) return parseSheetDate(Number(s));
  return '';
}

function toNumber(value: Cell): number {
  if (typeof value === 'number') return value;
  return Number(String(value ?? '').replace(/[,\s₹]/g, '')) || 0;
}

const toText = (value: Cell): string => String(value ?? '').trim();

/** Turns sheet rows (arrays of cells) into shipment rows. */
export function shipmentRowsFromGrid(grid: Cell[][]): ShipmentRow[] {
  // Locate a header row: the first of the top rows naming an AWB column.
  let columnOf = new Map<Field, number>();
  let firstDataRow = 0;
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const found = new Map<Field, number>();
    (grid[r] ?? []).forEach((cell, c) => {
      const field = headerField(cell);
      if (field && !found.has(field)) found.set(field, c);
    });
    if (found.has('awb') && found.size >= 3) {
      columnOf = found;
      firstDataRow = r + 1;
      break;
    }
  }
  if (columnOf.size === 0) FIELD_ORDER.forEach((field, c) => columnOf.set(field, c));

  const cell = (row: Cell[], field: Field): Cell => {
    const c = columnOf.get(field);
    return c === undefined ? undefined : row[c];
  };

  const rows: ShipmentRow[] = [];
  grid.slice(firstDataRow).forEach((row) => {
    if (!row || row.every((c) => toText(c) === '')) return;
    const bookDate = parseSheetDate(cell(row, 'date'));
    const awbNo = toText(cell(row, 'awb'));
    // Skip total / note lines: a shipment has a date or an AWB number.
    if (!bookDate && !awbNo) return;
    if (/^total/i.test(toText(row[0]))) return;

    const weight = toNumber(cell(row, 'weight'));
    const rate = toNumber(cell(row, 'rate'));
    const amountCell = cell(row, 'amount');
    rows.push(
      createShipmentRow({
        bookDate,
        awbNo,
        bookingBranch: toText(cell(row, 'from')),
        destination: toText(cell(row, 'destination')),
        mode: toText(cell(row, 'mode')),
        pcs: toNumber(cell(row, 'pcs')),
        chargedWeight: weight,
        rate,
        amount: toText(amountCell) === '' ? round2(weight * rate) : round2(toNumber(amountCell)),
      })
    );
  });
  return rows;
}

/** Reads the first sheet of an .xlsx / .xls / .csv file. */
export async function readShipmentFile(file: File): Promise<ShipmentRow[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const grid = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: '' });
  return shipmentRowsFromGrid(grid);
}

/** Downloads a blank sheet with only the expected column headings. */
export async function downloadShipmentTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([[...SHIPMENT_SHEET_COLUMNS]]);
  sheet['!cols'] = SHIPMENT_SHEET_COLUMNS.map(() => ({ wch: 16 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Shipments');
  XLSX.writeFile(workbook, 'shipment-upload-template.xlsx');
}
