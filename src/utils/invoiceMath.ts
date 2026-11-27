import { CURRENCY_CONFIG } from '../data/presets';
import {
  ComputedLineItem,
  CurrencyCode,
  InvoiceData,
  InvoiceTotals,
  LineItem,
  ShipmentCharges,
  ShipmentRow,
} from '../types/invoice';

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export const DEFAULT_SHIPMENT_HSN = '996812';

const nonNeg = (v: unknown): number => Math.max(0, Number(v) || 0);

export const EMPTY_SHIPMENT_CHARGES: ShipmentCharges = {
  vehicle: 0,
  other: 0,
  fov: 0,
  oda: 0,
  fuelPercent: 0,
  docket: 0,
};

export const INVOICE_PREFIX = 'SK';

/** Forces an invoice number to start with the SK prefix. */
export function withInvoicePrefix(value: string): string {
  const v = value.toUpperCase().trimStart();
  return v.startsWith(INVOICE_PREFIX) ? v : INVOICE_PREFIX + v.replace(/^S?K?/, '');
}

/** Converts an older invoice number to the SK series: KC/26-27/0104 -> SK/26-27/0104, 0934 -> SK0934. */
export function toSkInvoiceNumber(value: string): string {
  const v = (value || '').trim();
  if (!v || v.toUpperCase().startsWith(INVOICE_PREFIX)) return v;
  return INVOICE_PREFIX + (/^KC/i.test(v) ? v.slice(2) : v);
}

/** Renumbers every invoice that does not start with SK, keeping numbers unique. */
export function withSkInvoiceNumbers(ledger: InvoiceData[]): InvoiceData[] {
  const taken = new Set(
    ledger
      .map((inv) => inv.invoiceNumber.trim().toUpperCase())
      .filter((n) => n.startsWith(INVOICE_PREFIX))
  );
  return ledger.map((inv) => {
    const base = toSkInvoiceNumber(inv.invoiceNumber);
    if (base === inv.invoiceNumber.trim()) return inv;
    let next = base;
    for (let n = 2; taken.has(next.toUpperCase()); n++) next = `${base}-${n}`;
    taken.add(next.toUpperCase());
    return { ...inv, invoiceNumber: next };
  });
}

/** Next unused SK number: one past the highest SK<digits> number in the ledger. */
export function nextInvoiceNumber(ledger: InvoiceData[]): string {
  const used = new Set(ledger.map((inv) => inv.invoiceNumber.trim().toUpperCase()));
  let seq = ledger.reduce((max, inv) => {
    const m = /^SK(\d+)$/.exec(inv.invoiceNumber.trim().toUpperCase());
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  let candidate: string;
  do {
    seq += 1;
    candidate = `${INVOICE_PREFIX}${String(seq).padStart(4, '0')}`;
  } while (used.has(candidate));
  return candidate;
}

export function isShipmentInvoice(invoice: InvoiceData): boolean {
  return invoice.billingMode === 'shipments';
}

export function createShipmentRow(patch: Partial<ShipmentRow> = {}): ShipmentRow {
  return {
    id: `shp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bookDate: '',
    awbNo: '',
    bookingBranch: '',
    destination: '',
    mode: '',
    pcs: 1,
    chargedWeight: 0,
    rate: 0,
    amount: 0,
    ...patch,
  };
}

/**
 * Moves an older line-item invoice onto the AWB-wise layout: every line
 * becomes a shipment row carrying its taxable value, and a "fuel @ N%" line
 * becomes the fuel percentage. Invoices whose lines carry different GST rates
 * or a cess are left alone, because one rate per bill could not reproduce
 * their tax.
 */
export function toShipmentLayout(invoice: InvoiceData): InvoiceData {
  if (isShipmentInvoice(invoice)) return invoice;
  const items = invoice.items ?? [];
  const taxRate = items[0]?.taxRate ?? 18;
  if (items.some((i) => i.taxRate !== taxRate || (Number(i.cessRate) || 0) > 0)) return invoice;

  const amountOf = (i: LineItem) =>
    round2(nonNeg(i.quantity) * nonNeg(i.unitPrice) * (1 - Math.min(100, nonNeg(i.discountPercent)) / 100));
  const fuelPct = (i: LineItem): number | null => {
    const m = /fuel/i.test(i.name) ? /@\s*([\d.]+)\s*%/.exec(i.name) : null;
    return m ? Number(m[1]) : null;
  };

  const freightItems = items.filter((i) => fuelPct(i) === null);
  const freight = round2(freightItems.reduce((s, i) => s + amountOf(i), 0));
  // A fuel line is folded into the percentage only when it matches exactly.
  const fuelItems = items.filter((i) => fuelPct(i) !== null);
  const fuel = fuelItems.length === 1 ? fuelItems[0] : null;
  const foldFuel = fuel !== null && round2((freight * fuelPct(fuel)!) / 100) === amountOf(fuel);
  const rowItems = foldFuel ? freightItems : items;

  const shipments = rowItems.map((item, idx) => {
    const text = `${item.name} ${item.description ?? ''}`;
    const awb = /^AWB\s+(\S+)/i.exec(item.name);
    const date = /(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/.exec(item.description ?? '');
    const pad = (v: string) => v.padStart(2, '0');
    const weight = /Weight\s+([\d.]+)/i.exec(text);
    const chargedWeight = weight ? Number(weight[1]) : 0;
    const amount = amountOf(item);
    return createShipmentRow({
      id: `shp-${invoice.id}-${idx + 1}`,
      bookDate: date
        ? `${date[3].length === 2 ? `20${date[3]}` : date[3]}-${pad(date[2])}-${pad(date[1])}`
        : invoice.issueDate,
      awbNo: awb ? awb[1] : '',
      // Lines that are not consignments keep their description here.
      destination: awb ? item.name.slice(item.name.lastIndexOf(',') + 1).trim() : item.name,
      mode: /Mode\s+(\S+)/i.exec(text)?.[1] ?? '',
      pcs: nonNeg(item.quantity),
      chargedWeight,
      rate: chargedWeight > 0 ? round2(amount / chargedWeight) : 0,
      amount,
    });
  });

  return {
    ...invoice,
    billingMode: 'shipments',
    shipments,
    shipmentCharges: { ...EMPTY_SHIPMENT_CHARGES, fuelPercent: foldFuel ? fuelPct(fuel!)! : 0 },
    shipmentHsn: (items[0]?.hsnCode || DEFAULT_SHIPMENT_HSN).trim(),
    shipmentTaxRate: taxRate,
  };
}

export interface ShipmentSummary {
  rows: ShipmentRow[];
  totalPcs: number;
  totalChargedWeight: number;
  freightTotal: number;
  vehicle: number;
  other: number;
  fov: number;
  oda: number;
  fuelPercent: number;
  fuelAmount: number;
  docket: number;
  subTotal: number;
  taxRate: number;
  hsnCode: string;
  periodFrom: string;
  periodTo: string;
}

export function computeShipmentSummary(invoice: InvoiceData): ShipmentSummary {
  const rows = invoice.shipments ?? [];
  const charges = { ...EMPTY_SHIPMENT_CHARGES, ...(invoice.shipmentCharges ?? {}) };
  const freightTotal = round2(rows.reduce((s, r) => s + nonNeg(r.amount), 0));
  const vehicle = round2(nonNeg(charges.vehicle));
  const other = round2(nonNeg(charges.other));
  const fov = round2(nonNeg(charges.fov));
  const oda = round2(nonNeg(charges.oda));
  const docket = round2(nonNeg(charges.docket));
  const fuelPercent = nonNeg(charges.fuelPercent);
  const fuelAmount = round2((freightTotal * fuelPercent) / 100);
  const dates = rows.map((r) => r.bookDate).filter(Boolean).sort();

  return {
    rows,
    totalPcs: rows.reduce((s, r) => s + nonNeg(r.pcs), 0),
    totalChargedWeight: round2(rows.reduce((s, r) => s + nonNeg(r.chargedWeight), 0)),
    freightTotal,
    vehicle,
    other,
    fov,
    oda,
    fuelPercent,
    fuelAmount,
    docket,
    subTotal: round2(freightTotal + vehicle + other + fov + oda + fuelAmount + docket),
    taxRate: invoice.shipmentTaxRate ?? 18,
    hsnCode: (invoice.shipmentHsn ?? DEFAULT_SHIPMENT_HSN).trim(),
    periodFrom: invoice.periodFrom || dates[0] || '',
    periodTo: invoice.periodTo || dates[dates.length - 1] || '',
  };
}

/**
 * The lines GST is charged on. An AWB-wise invoice is taxed on its freight
 * total plus each non-zero surcharge; any other invoice on its line items.
 */
export function getBillableItems(invoice: InvoiceData): LineItem[] {
  if (!isShipmentInvoice(invoice)) return invoice.items;
  const s = computeShipmentSummary(invoice);
  const line = (key: string, name: string, amount: number): LineItem => ({
    id: `shipment-${key}`,
    name,
    hsnCode: s.hsnCode,
    isService: true,
    quantity: 1,
    unit: 'NOS',
    unitPrice: amount,
    discountPercent: 0,
    taxRate: s.taxRate,
    cessRate: 0,
  });
  const lines = [
    line('freight', `Freight Charges (${s.rows.length} AWB)`, s.freightTotal),
    line('vehicle', 'Vehicle Charges', s.vehicle),
    line('other', 'Other Charge', s.other),
    line('fov', 'FOV Charges', s.fov),
    line('oda', 'ODA Charges', s.oda),
    line('fuel', `Fuel Charges ${s.fuelPercent}%`, s.fuelAmount),
    line('docket', 'Docket Charges', s.docket),
  ];
  return lines.filter((l, idx) => idx === 0 || l.unitPrice > 0);
}

export function formatSlashDate(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : dateStr || '';
}

export function computeInvoice(invoice: InvoiceData): {
  items: ComputedLineItem[];
  totals: InvoiceTotals;
} {
  const isExport = invoice.supplyType === 'EXPWP' || invoice.supplyType === 'EXPWOP';
  const isIntraState =
    !isExport &&
    invoice.seller.stateCode.trim() !== '' &&
    invoice.seller.stateCode === invoice.placeOfSupplyCode;

  let grossTotal = 0;
  let totalDiscount = 0;
  let taxableTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let cessTotal = 0;

  const computedItems: ComputedLineItem[] = getBillableItems(invoice).map((item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const discPct = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
    const taxRate =
      invoice.supplyType === 'EXPWOP' || invoice.supplyType === 'SEZWOP'
        ? 0
        : Math.max(0, Number(item.taxRate) || 0);
    const cessRate = Math.max(0, Number(item.cessRate) || 0);

    const grossAmount = round2(qty * price);
    const discountAmount = round2((grossAmount * discPct) / 100);
    const taxableValue = round2(grossAmount - discountAmount);

    const cgstRate = isIntraState ? taxRate / 2 : 0;
    const sgstRate = isIntraState ? taxRate / 2 : 0;
    const igstRate = isIntraState ? 0 : taxRate;

    const cgstAmount = round2((taxableValue * cgstRate) / 100);
    const sgstAmount = round2((taxableValue * sgstRate) / 100);
    const igstAmount = round2((taxableValue * igstRate) / 100);
    const cessAmount = round2((taxableValue * cessRate) / 100);
    const totalAmount = round2(taxableValue + cgstAmount + sgstAmount + igstAmount + cessAmount);

    grossTotal += grossAmount;
    totalDiscount += discountAmount;
    taxableTotal += taxableValue;
    cgstTotal += cgstAmount;
    sgstTotal += sgstAmount;
    igstTotal += igstAmount;
    cessTotal += cessAmount;

    return {
      ...item,
      grossAmount,
      discountAmount,
      taxableValue,
      cgstRate,
      sgstRate,
      igstRate,
      cgstAmount,
      sgstAmount,
      igstAmount,
      cessAmount,
      totalAmount,
    };
  });

  grossTotal = round2(grossTotal);
  totalDiscount = round2(totalDiscount);
  taxableTotal = round2(taxableTotal);
  cgstTotal = round2(cgstTotal);
  sgstTotal = round2(sgstTotal);
  igstTotal = round2(igstTotal);
  cessTotal = round2(cessTotal);

  const taxTotal = round2(cgstTotal + sgstTotal + igstTotal + cessTotal);
  const preRoundTotal = round2(taxableTotal + taxTotal);
  const grandTotal = invoice.autoRoundOff ? Math.round(preRoundTotal) : preRoundTotal;
  const roundOff = round2(grandTotal - preRoundTotal);

  return {
    items: computedItems,
    totals: {
      isIntraState,
      grossTotal,
      totalDiscount,
      taxableTotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      cessTotal,
      taxTotal,
      preRoundTotal,
      roundOff,
      grandTotal,
      amountInWords: numberToCurrencyWords(grandTotal, invoice.currency),
    },
  };
}

export function formatMoney(amount: number, currency: CurrencyCode = 'INR', asciiSafe = false): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  const formatted = new Intl.NumberFormat(cfg.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  if (asciiSafe) {
    return `${cfg.pdfCode} ${formatted}`;
  }
  return `${cfg.symbol}${formatted}`;
}

export function validateGstin(gstin: string): { valid: boolean; stateCode?: string; pan?: string } {
  const cleaned = gstin.trim().toUpperCase();
  if (!cleaned) return { valid: false };
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const valid = regex.test(cleaned);
  return {
    valid,
    stateCode: cleaned.slice(0, 2),
    pan: cleaned.slice(2, 12),
  };
}

export function getFinancialYear(dateStr: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(d.getTime())) return '2026-27';
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const startYear = month >= 4 ? year : year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endShort}`;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seven' + 'ty', 'Eighty', 'Ninety'];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return `${TENS[ten]}${one ? ' ' + ONES[one] : ''}`.trim();
}

function threeDigitsToWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundred > 0) parts.push(`${ONES[hundred]} Hundred`);
  if (rest > 0) parts.push(twoDigitsToWords(rest));
  return parts.join(' ');
}

function indianNumberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const rest = num;

  if (crore > 0) parts.push(`${indianNumberToWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (rest > 0) parts.push(threeDigitsToWords(rest));

  return parts.join(' ').trim();
}

function internationalNumberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion'];
  const parts: string[] = [];
  let scaleIdx = 0;

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      const chunkWords = threeDigitsToWords(chunk);
      parts.unshift(scales[scaleIdx] ? `${chunkWords} ${scales[scaleIdx]}` : chunkWords);
    }
    num = Math.floor(num / 1000);
    scaleIdx++;
  }
  return parts.join(' ').trim();
}

export function numberToCurrencyWords(amount: number, currency: CurrencyCode = 'INR'): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.INR;
  const safe = Math.max(0, round2(amount));
  const whole = Math.floor(safe);
  const fraction = Math.round((safe - whole) * 100);

  const wholeWords =
    currency === 'INR' ? indianNumberToWords(whole) : internationalNumberToWords(whole);

  if (fraction > 0) {
    const fracWords = twoDigitsToWords(fraction);
    return `${cfg.majorUnit} ${wholeWords} and ${fracWords} ${cfg.minorUnit} Only`;
  }
  return `${cfg.majorUnit} ${wholeWords} Only`;
}

export interface HsnSummaryRow {
  hsnCode: string;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTaxAmount: number;
}

export function groupItemsByHsn(items: ComputedLineItem[], isIntraState: boolean): HsnSummaryRow[] {
  const map = new Map<string, HsnSummaryRow>();
  items.forEach((item) => {
    const hsn = (item.hsnCode || '-').trim() || '-';
    const rate = isIntraState ? item.cgstRate + item.sgstRate : item.igstRate;
    const key = `${hsn}|${rate}`;
    const existing = map.get(key);
    if (existing) {
      existing.taxableValue = round2(existing.taxableValue + item.taxableValue);
      existing.cgstAmount = round2(existing.cgstAmount + item.cgstAmount);
      existing.sgstAmount = round2(existing.sgstAmount + item.sgstAmount);
      existing.igstAmount = round2(existing.igstAmount + item.igstAmount);
      existing.totalTaxAmount = round2(
        existing.cgstAmount + existing.sgstAmount + existing.igstAmount
      );
    } else {
      map.set(key, {
        hsnCode: hsn,
        taxableValue: round2(item.taxableValue),
        cgstRate: item.cgstRate,
        cgstAmount: round2(item.cgstAmount),
        sgstRate: item.sgstRate,
        sgstAmount: round2(item.sgstAmount),
        igstRate: item.igstRate,
        igstAmount: round2(item.igstAmount),
        totalTaxAmount: round2(item.cgstAmount + item.sgstAmount + item.igstAmount),
      });
    }
  });
  return Array.from(map.values());
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const mon = SHORT_MONTHS[d.getMonth()];
  const yr = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
}
