import QRCode from 'qrcode';
import { InvoiceData, IrnDetails } from '../types/invoice';
import { computeInvoice } from './invoiceMath';

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic 64-char hex if crypto.subtle unavailable
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= input.charCodeAt(input.length - 1 - i);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const seg = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return (seg(h1) + seg(h2)).repeat(4).slice(0, 64);
}

export function computeInvoiceFingerprint(invoice: InvoiceData): string {
  const { totals } = computeInvoice(invoice);
  return [
    invoice.seller.gstin.trim().toUpperCase(),
    invoice.buyer.gstin.trim().toUpperCase(),
    invoice.docType,
    invoice.invoiceNumber.trim(),
    invoice.issueDate,
    invoice.financialYear,
    invoice.placeOfSupplyCode,
    totals.grandTotal.toFixed(2),
    invoice.items.length,
  ].join('|');
}

// The IRN depends only on supplier GSTIN, document type, document number and
// financial year, so one document number can only ever map to one IRN.
export async function computeIrnHash(invoice: InvoiceData): Promise<string> {
  const sellerGstin = (invoice.seller.gstin || 'UNREGISTERED').trim().toUpperCase();
  const docNo = invoice.invoiceNumber.trim().toUpperCase();
  const fy = invoice.financialYear.trim();
  return sha256Hex(`${sellerGstin}|${invoice.docType}|${docNo}|${fy}`);
}

export class IrnIssueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IrnIssueError';
  }
}

function holdsIrn(invoice: InvoiceData, irnHash: string): boolean {
  return (
    invoice.irn?.irn === irnHash ||
    (invoice.cancelledIrns ?? []).some((c) => c.irn === irnHash)
  );
}

/**
 * Issues an IRN for the invoice, following the IRP rule that a document number
 * can be used only once: an existing IRN is never regenerated in place. To
 * re-issue, the invoice number must change first; the previous IRN is then
 * marked CANCELLED and kept in `cancelledIrns`.
 */
export async function issueIrn(invoice: InvoiceData, ledger: InvoiceData[]): Promise<InvoiceData> {
  const docNo = invoice.invoiceNumber.trim();
  if (!docNo) {
    throw new IrnIssueError('Enter an invoice number before generating an IRN.');
  }

  if (invoice.cancelledAt) {
    throw new IrnIssueError(
      `Invoice ${docNo} is cancelled, so an IRN cannot be issued for it. Create a new invoice instead.`
    );
  }

  const irnHash = await computeIrnHash(invoice);

  if (invoice.irn?.irn === irnHash) {
    throw new IrnIssueError(
      `Invoice number ${docNo} already has an IRN, and an IRN cannot be re-issued for the same number. Change the invoice number, then re-issue — the current IRN will be marked cancelled.`
    );
  }
  if (holdsIrn(invoice, irnHash)) {
    throw new IrnIssueError(
      `Invoice number ${docNo} was used for an IRN that is now cancelled, so it cannot be used again. Choose a new invoice number.`
    );
  }
  const clash = ledger.find((other) => other.id !== invoice.id && holdsIrn(other, irnHash));
  if (clash) {
    throw new IrnIssueError(
      `Invoice number ${docNo} already has an IRN on another invoice in the ledger. Choose a different invoice number.`
    );
  }

  const now = new Date().toISOString();
  const cancelledIrns = invoice.irn
    ? [
        ...(invoice.cancelledIrns ?? []),
        { ...invoice.irn, status: 'CANCELLED' as const, cancelledAt: now },
      ]
    : invoice.cancelledIrns;

  const irn = await generateIrnForInvoice(invoice);
  return { ...invoice, irn, cancelledIrns, updatedAt: now };
}

/**
 * Cancels the whole invoice. Its IRN (if any) stays on the record marked
 * CANCELLED, which also keeps the invoice number from being reused.
 */
export function cancelInvoice(invoice: InvoiceData): InvoiceData {
  if (invoice.cancelledAt) return invoice;
  const now = new Date().toISOString();
  return {
    ...invoice,
    irn: invoice.irn ? { ...invoice.irn, status: 'CANCELLED', cancelledAt: now } : null,
    cancelledAt: now,
    updatedAt: now,
  };
}

export async function generateIrnForInvoice(invoice: InvoiceData): Promise<IrnDetails> {
  const { totals } = computeInvoice(invoice);
  const sellerGstin = (invoice.seller.gstin || 'UNREGISTERED').trim().toUpperCase();
  const buyerGstin = (invoice.buyer.gstin || 'URP').trim().toUpperCase();
  const docNo = invoice.invoiceNumber.trim().toUpperCase();

  const irn = await computeIrnHash(invoice);

  // Deterministic 15-digit Acknowledgement Number starting with 1126...
  const ackSeed = await sha256Hex(`ACK|${irn}|${Date.now()}`);
  const numericDigits = ackSeed
    .split('')
    .map((ch) => parseInt(ch, 16) % 10)
    .join('')
    .slice(0, 11);
  const ackNo = `1126${numericDigits}`;
  const ackDate = new Date().toISOString();

  const mainHsn = invoice.items[0]?.hsnCode || '998314';

  const signedQrPayloadObj = {
    SellerGstin: sellerGstin,
    BuyerGstin: buyerGstin,
    DocNo: docNo,
    DocTyp: invoice.docType,
    DocDt: invoice.issueDate,
    TotInvVal: totals.grandTotal,
    ItemCnt: invoice.items.length,
    MainHsnCode: mainHsn,
    Irn: irn,
    IrnDt: ackDate,
  };

  const signedQrPayload = JSON.stringify(signedQrPayloadObj);
  const qrDataUrl = await QRCode.toDataURL(signedQrPayload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 280,
    color: {
      dark: '#1D1D1F',
      light: '#FFFFFF',
    },
  });

  return {
    irn,
    ackNo,
    ackDate,
    signedQrPayload,
    qrDataUrl,
    status: 'ACTIVE',
    docNumber: invoice.invoiceNumber.trim(),
    fingerprint: computeInvoiceFingerprint(invoice),
  };
}
