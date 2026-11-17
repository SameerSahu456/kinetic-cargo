import { CURRENCY_CONFIG } from '../data/presets';
import { ComputedLineItem, CurrencyCode, InvoiceData, InvoiceTotals } from '../types/invoice';

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
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

  const computedItems: ComputedLineItem[] = invoice.items.map((item) => {
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
