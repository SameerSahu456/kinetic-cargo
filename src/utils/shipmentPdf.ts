import { jsPDF } from 'jspdf';
import { BrandProfile, InvoiceData } from '../types/invoice';
import {
  computeInvoice,
  computeShipmentSummary,
  formatShortDate,
  formatSlashDate,
  ShipmentSummary,
} from './invoiceMath';

// AWB-wise tax invoice: one row per consignment, the bill header repeated on
// every page, and the charges / tax / terms block after the last row.

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 10;
const LEFT = MARGIN;
const RIGHT = PAGE_W - MARGIN;
const BOTTOM = PAGE_H - MARGIN;
const CENTER = PAGE_W / 2;
const SPLIT_X = 133; // left edge of the invoice-details grid and totals block
const AMOUNT_X = 179;
const ROW_H = 5;
const TOTAL_ROW_H = 5.5;

// Column edges: SrNo, Book Date, Awb No., Booking Branch, Destination, Mode,
// Pcs, Weight, Rate, Amount.
const COLS = [LEFT, 19, 38, 56, 90, 124, 140, 150, 164, AMOUNT_X, RIGHT];

export function shipmentDocTitle(docType: InvoiceData['docType']): string {
  if (docType === 'CRN') return 'CREDIT NOTE';
  if (docType === 'DBN') return 'DEBIT NOTE';
  return 'TAX INVOICE';
}

export function shipmentTermLines(terms: string): string[] {
  return terms
    .split('\n')
    .map((t) => t.trim().replace(/^\d+\s*[.)-]?\s*/, ''))
    .filter(Boolean);
}

export function sellerHeaderLines(invoice: InvoiceData): string[] {
  const s = invoice.seller;
  const place = [s.address, s.city].filter(Boolean).join(', ');
  return [
    [place, s.pincode].filter(Boolean).join(' - '),
    [s.email && `E-Mail: ${s.email}`, s.phone && `Contact No. ${s.phone}`].filter(Boolean).join('   '),
    [s.gstin && `GSTIN: ${s.gstin}`, s.pan && `PAN: ${s.pan}`].filter(Boolean).join('   '),
  ].filter(Boolean);
}

const money = (v: number) => v.toFixed(2);
const plain = (v: number) => String(Number(v) || 0);

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
}

function fit(doc: jsPDF, text: string, width: number): string {
  return (doc.splitTextToSize(text || '', width)[0] as string) ?? '';
}

function drawColumnLines(doc: jsPDF, fromY: number, toY: number): void {
  COLS.slice(1, -1).forEach((x) => doc.line(x, fromY, x, toY));
}

interface HeaderResult {
  bodyTop: number;
  pageBoxY: number;
}

function drawPageHeader(
  doc: jsPDF,
  invoice: InvoiceData,
  brand: BrandProfile,
  summary: ShipmentSummary,
  showIrn: boolean
): HeaderResult {
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(LEFT, MARGIN, RIGHT - LEFT, BOTTOM - MARGIN);

  if (brand.logoDataUrl) {
    try {
      doc.addImage(brand.logoDataUrl, imageFormat(brand.logoDataUrl), LEFT + 2, MARGIN + 2, 14, 14, undefined, 'FAST');
    } catch {
      // ignore invalid logo
    }
  }

  let y = MARGIN + 7.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((invoice.seller.legalName || '').toUpperCase(), CENTER, y, { align: 'center' });
  y += 4.6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  sellerHeaderLines(invoice).forEach((raw) => {
    (doc.splitTextToSize(raw, 150) as string[]).forEach((line) => {
      doc.text(line, CENTER, y, { align: 'center' });
      y += 3.6;
    });
  });

  y += 1.6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(shipmentDocTitle(invoice.docType), CENTER, y, { align: 'center' });
  const pageBoxY = y;
  doc.rect(RIGHT - 28, y - 3.7, 28, 5.2);
  y += 1.5;
  doc.line(LEFT, y, RIGHT, y);

  // e-Invoice band (first page only, once an IRN is issued)
  if (showIrn && invoice.irn) {
    const bandH = 25;
    try {
      doc.addImage(invoice.irn.qrDataUrl, 'PNG', RIGHT - 24, y + 1.5, 22, 22, undefined, 'FAST');
    } catch {
      // ignore QR error
    }
    const labelX = LEFT + 2;
    const valueX = LEFT + 20;
    let iy = y + 6;
    const pair = (label: string, value: string | string[]) => {
      doc.setFont('helvetica', 'normal');
      doc.text(label, labelX, iy);
      doc.text(':', valueX - 2.5, iy);
      doc.setFont('helvetica', 'bold');
      doc.text(value, valueX, iy);
      iy += (Array.isArray(value) ? value.length : 1) * 3.8 + 1;
    };
    doc.setFontSize(8);
    pair('IRN', doc.splitTextToSize(invoice.irn.irn, RIGHT - 30 - valueX) as string[]);
    pair('Ack. No.', invoice.irn.ackNo);
    pair('Ack. Date', formatShortDate(invoice.irn.ackDate));
    y += bandH;
    doc.line(LEFT, y, RIGHT, y);
  }

  // "To" block (left) and invoice details grid (right)
  const blockTop = y;
  const buyer = invoice.buyer;
  const textX = LEFT + 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('To,', LEFT + 1, blockTop + 3.8);
  doc.setFont('helvetica', 'normal');
  let ly = blockTop + 3.8;
  const addressLines = [
    (buyer.legalName || '').toUpperCase(),
    ...(doc.splitTextToSize(buyer.address || '', 78) as string[]),
    buyer.city,
    buyer.pincode,
  ].filter(Boolean);
  addressLines.forEach((line) => {
    doc.text(line, textX, ly);
    ly += 3.6;
  });

  const labelled = (label: string, value: string, x: number, valueX: number, atY: number) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, atY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, valueX, atY);
  };
  labelled('Customer GST No.:', buyer.gstin || 'Unregistered', textX, textX + 27, ly);
  labelled('State:', (buyer.stateName || '').toUpperCase(), LEFT + 66, LEFT + 84, ly);
  ly += 3.6;
  labelled('HSN No.:', summary.hsnCode, textX, textX + 27, ly);
  labelled('State code:', buyer.stateCode || '', LEFT + 66, LEFT + 84, ly);

  const blockBottom = Math.max(blockTop + 24, ly + 1.8);
  const gridRowH = (blockBottom - blockTop) / 4;
  const gridValueX = 153;
  const gridRows: [string, string][] = [
    ['Invoice No.', invoice.invoiceNumber],
    ['From Date', formatSlashDate(summary.periodFrom)],
    ['To Date', formatSlashDate(summary.periodTo)],
    ['Invoice Date', formatSlashDate(invoice.issueDate)],
  ];
  gridRows.forEach(([label, value], idx) => {
    const rowTop = blockTop + idx * gridRowH;
    const baseline = rowTop + gridRowH / 2 + 1.3;
    doc.setFont('helvetica', 'bold');
    doc.text(label, SPLIT_X + 1.5, baseline);
    doc.setFont('helvetica', 'normal');
    doc.text(fit(doc, value, RIGHT - gridValueX - 4), gridValueX + 3, baseline);
    if (idx > 0) doc.line(SPLIT_X, rowTop, RIGHT, rowTop);
  });
  doc.line(SPLIT_X, blockTop, SPLIT_X, blockBottom);
  doc.line(gridValueX, blockTop, gridValueX, blockBottom);
  doc.line(LEFT, blockBottom, RIGHT, blockBottom);

  // Column header
  const headH = 8;
  const headTop = blockBottom;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const heads: string[][] = [
    ['SrNo.'],
    ['Book Date'],
    ['Awb No.'],
    ['Booking', 'Branch'],
    ['Destination'],
    ['Mode'],
    ['Pcs'],
    ['Weight'],
    ['Rate'],
    ['Amount'],
  ];
  heads.forEach((lines, idx) => {
    const cx = (COLS[idx] + COLS[idx + 1]) / 2;
    if (lines.length === 1) {
      doc.text(lines[0], cx, headTop + 5, { align: 'center' });
    } else {
      doc.text(lines[0], cx, headTop + 3.4, { align: 'center' });
      doc.text(lines[1], cx, headTop + 6.8, { align: 'center' });
    }
  });
  drawColumnLines(doc, headTop, headTop + headH);
  doc.line(LEFT, headTop + headH, RIGHT, headTop + headH);

  return { bodyTop: headTop + headH, pageBoxY };
}

export function renderShipmentInvoicePages(doc: jsPDF, invoice: InvoiceData, brand: BrandProfile): void {
  const startPage = doc.getNumberOfPages();
  const summary = computeShipmentSummary(invoice);
  const { items, totals } = computeInvoice(invoice);

  let header = drawPageHeader(doc, invoice, brand, summary, true);
  let y = header.bodyTop;
  let tableTop = y;

  const newPage = () => {
    doc.addPage();
    header = drawPageHeader(doc, invoice, brand, summary, false);
    y = header.bodyTop;
    tableTop = y;
  };

  // Shipment rows
  summary.rows.forEach((row, idx) => {
    if (y + ROW_H > BOTTOM) {
      drawColumnLines(doc, tableTop, y);
      newPage();
    }
    const ty = y + 3.7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const cells = [
      String(idx + 1),
      formatSlashDate(row.bookDate),
      row.awbNo,
      row.bookingBranch.toUpperCase(),
      row.destination.toUpperCase(),
      (row.mode ?? '').toUpperCase(),
      plain(row.pcs),
      plain(row.chargedWeight),
      money(Number(row.rate) || 0),
      money(Number(row.amount) || 0),
    ];
    cells.forEach((text, c) => {
      const width = COLS[c + 1] - COLS[c];
      doc.text(fit(doc, text, width - 2), COLS[c] + width / 2, ty, { align: 'center' });
    });
    y += ROW_H;
  });
  drawColumnLines(doc, tableTop, y);
  if (y > tableTop) doc.line(LEFT, y, RIGHT, y);

  // Charges, tax and bill amount
  const taxLabel = (name: string, rate: number) => `${name}@ of ${rate}%`;
  const first = items[0];
  const totalRows: [string, number, boolean?][] = [
    ['Total', summary.freightTotal],
    ['Vehicle Charges', summary.vehicle],
    ['Other Charge', summary.other],
    ['Fov.Charges', summary.fov],
    ['Oda.charges', summary.oda],
    [`Fuel Charges ${summary.fuelPercent}%`, summary.fuelAmount],
    ['Docket Charges', summary.docket],
    ['Sub Total', totals.taxableTotal],
    [taxLabel('IGST', first?.igstRate ?? 0), totals.igstTotal],
    [taxLabel('CGST', first?.cgstRate ?? 0), totals.cgstTotal],
    [taxLabel('SGST', first?.sgstRate ?? 0), totals.sgstTotal],
  ];
  if (Math.abs(totals.roundOff) > 0) totalRows.push(['Round Off', totals.roundOff]);
  totalRows.push(['BILL AMOUNT', totals.grandTotal, true]);

  doc.setFontSize(7.5);
  const termsWidth = SPLIT_X - LEFT - 12;
  const termLines = shipmentTermLines(invoice.terms).map(
    (t) => doc.splitTextToSize(t, termsWidth) as string[]
  );
  const termsTextH = termLines.reduce((h, lines) => h + lines.length * 3.4, 0);
  const totalsH = totalRows.length * TOTAL_ROW_H;
  const termsH = Math.max(36, 9 + termsTextH + 3);

  if (y + totalsH + termsH > BOTTOM) newPage();

  const totalsTop = y;
  totalRows.forEach(([label, amount, emphasise], idx) => {
    const rowTop = totalsTop + idx * TOTAL_ROW_H;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(emphasise ? 9 : 8);
    doc.text(label, SPLIT_X + 2, rowTop + 3.9);
    doc.setFont('helvetica', emphasise ? 'bold' : 'normal');
    doc.text(money(amount), RIGHT - 1.5, rowTop + 3.9, { align: 'right' });
    doc.line(SPLIT_X, rowTop + TOTAL_ROW_H, RIGHT, rowTop + TOTAL_ROW_H);
  });
  const totalsBottom = totalsTop + totalsH;
  doc.line(SPLIT_X, totalsTop, SPLIT_X, totalsBottom);
  doc.line(AMOUNT_X, totalsTop, AMOUNT_X, totalsBottom);
  doc.line(LEFT, totalsBottom, RIGHT, totalsBottom);

  // Amount in words (left of the totals)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('RUPEES IN WORDS :', LEFT + 2, totalsTop + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  const words = totals.amountInWords.replace(/^\S+\s/, '').toUpperCase();
  doc.text(doc.splitTextToSize(words, SPLIT_X - LEFT - 36) as string[], LEFT + 32, totalsTop + 5);

  // Bank details (bottom-left of the totals)
  const bank = invoice.bank;
  if (bank.accountNumber) {
    const bankLines = [
      'Bank Detail For Payment Transfer',
      bank.accountName && `A/C NAME. ${bank.accountName}`,
      bank.bankName && `BANK NAME. ${bank.bankName}`,
      `AC/NO. ${bank.accountNumber}`,
      bank.ifscCode && `IFSC CODE. ${bank.ifscCode}`,
      bank.branch && `BRANCH NAME - ${bank.branch}`,
      bank.upiId && `UPI ID. ${bank.upiId}`,
    ].filter(Boolean) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let by = totalsBottom - 2.5 - (bankLines.length - 1) * 3.6;
    bankLines.forEach((line) => {
      doc.text(line, LEFT + 2, by);
      by += 3.6;
    });
  }

  // Terms & conditions (left) and signatory (right)
  const termsTop = totalsBottom;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('TERMS & CONDITIONS', LEFT + 2, termsTop + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  let ty = termsTop + 9;
  termLines.forEach((lines, idx) => {
    doc.text(String(idx + 1).padStart(2, '0'), LEFT + 2, ty);
    doc.text(lines, LEFT + 7, ty);
    ty += lines.length * 3.4;
  });

  const sigX = (SPLIT_X + RIGHT) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    fit(doc, `For ${(invoice.seller.legalName || '').toUpperCase()}`, RIGHT - SPLIT_X + 20),
    sigX,
    termsTop + 6.5,
    { align: 'center' }
  );
  if (brand.signatureDataUrl) {
    try {
      doc.addImage(
        brand.signatureDataUrl,
        imageFormat(brand.signatureDataUrl),
        sigX - 15,
        termsTop + 10,
        30,
        12,
        undefined,
        'FAST'
      );
    } catch {
      // ignore invalid signature
    }
  }
  doc.text('Authorised Signatory', sigX, termsTop + termsH - 4, { align: 'center' });
  doc.line(LEFT, termsTop + termsH, RIGHT, termsTop + termsH);

  // Page x of y, now that the page count is known
  const endPage = doc.getNumberOfPages();
  const pageCount = endPage - startPage + 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (let page = startPage; page <= endPage; page++) {
    doc.setPage(page);
    doc.text(`Page ${page - startPage + 1} of ${pageCount}`, RIGHT - 14, header.pageBoxY, {
      align: 'center',
    });
  }
  doc.setPage(endPage);
}
