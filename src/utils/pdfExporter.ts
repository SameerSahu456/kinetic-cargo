import { jsPDF } from 'jspdf';
import { BrandProfile, InvoiceData, ReceiptData } from '../types/invoice';
import {
  computeInvoice,
  formatMoney,
  formatShortDate,
  groupItemsByHsn,
  isShipmentInvoice,
  numberToCurrencyWords,
} from './invoiceMath';
import { renderShipmentInvoicePages } from './shipmentPdf';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [29, 29, 31];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [29, 29, 31];
  return [r, g, b];
}

function docTitle(docType: InvoiceData['docType']): string {
  switch (docType) {
    case 'CRN':
      return 'CREDIT NOTE';
    case 'DBN':
      return 'DEBIT NOTE';
    default:
      return 'TAX INVOICE';
  }
}

function gstStandardTitle(docType: InvoiceData['docType']): string {
  switch (docType) {
    case 'CRN':
      return 'Credit Note';
    case 'DBN':
      return 'Debit Note';
    default:
      return 'Tax Invoice';
  }
}

function drawRupeeGlyph(doc: jsPDF, x: number, baselineY: number): void {
  doc.setDrawColor(20, 20, 22);
  doc.setLineWidth(0.32);
  // Top horizontal bar
  doc.line(x, baselineY - 2.35, x + 1.85, baselineY - 2.35);
  // Middle horizontal bar
  doc.line(x, baselineY - 1.45, x + 1.85, baselineY - 1.45);
  // Curve approximation on right of bars
  doc.line(x + 0.75, baselineY - 2.35, x + 1.2, baselineY - 1.9);
  doc.line(x + 1.2, baselineY - 1.9, x + 1.2, baselineY - 1.45);
  doc.line(x + 1.2, baselineY - 1.45, x + 0.2, baselineY - 0.85);
  // Diagonal leg
  doc.line(x + 0.2, baselineY - 0.85, x + 1.45, baselineY + 0.15);
}

function formatNumericPart(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function drawMonogramBadge(doc: jsPDF, x: number, y: number, brand: BrandProfile, rgb: [number, number, number]) {
  const initial = (brand.seller.tradeName || brand.seller.legalName || 'K').trim().charAt(0).toUpperCase();
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.roundedRect(x, y, 11, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(initial, x + 5.5, y + 7.6, { align: 'center' });
}

function renderGstStandardInvoicePage(doc: jsPDF, invoice: InvoiceData, brand: BrandProfile): void {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm
  const rightEdge = pageWidth - margin; // 198mm
  const accentRgb = hexToRgb(brand.accentColor);
  const lineColor: [number, number, number] = [40, 40, 44];

  const { items, totals } = computeInvoice(invoice);
  const hsnRows = groupItemsByHsn(items, totals.isIntraState);
  const locale = invoice.currency === 'INR' ? 'en-IN' : 'en-US';
  const fmtNum = (val: number) => formatNumericPart(val, locale);

  // Optional uploaded brand logo at top-left
  if (brand.logoDataUrl) {
    try {
      const format = brand.logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(brand.logoDataUrl, format, margin, 9, 12, 12, undefined, 'FAST');
    } catch {
      // ignore invalid logo
    }
  }

  // Centered bold title: Tax Invoice
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 22);
  doc.text(gstStandardTitle(invoice.docType), pageWidth / 2, 13.5, { align: 'center' });

  let boxTopY = 20;

  if (invoice.irn) {
    // Top-right e-Invoice label + QR code
    const qrSize = 31;
    const qrX = rightEdge - qrSize - 2;
    const qrY = 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(20, 20, 22);
    doc.text('e-Invoice', qrX + qrSize / 2, 13.5, { align: 'center' });

    try {
      doc.addImage(invoice.irn.qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize, undefined, 'FAST');
    } catch {
      // ignore QR error
    }

    // Left IRN / Ack. No. / Ack. Date
    const irnLabelX = margin;
    const irnValX = margin + 21;
    let irnY = 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 44);
    doc.text('IRN', irnLabelX, irnY);
    doc.text(':', irnValX - 2.5, irnY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 22);
    const irnLines = doc.splitTextToSize(invoice.irn.irn, qrX - irnValX - 6);
    doc.text(irnLines, irnValX, irnY);
    irnY += irnLines.length * 3.8 + 1.5;

    doc.setFont('helvetica', 'normal');
    doc.text('Ack. No.', irnLabelX, irnY);
    doc.text(':', irnValX - 2.5, irnY);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.irn.ackNo, irnValX, irnY);
    irnY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.text('Ack. Date', irnLabelX, irnY);
    doc.text(':', irnValX - 2.5, irnY);
    doc.setFont('helvetica', 'bold');
    doc.text(formatShortDate(invoice.irn.ackDate), irnValX, irnY);

    boxTopY = Math.max(qrY + qrSize + 3, irnY + 4);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 126);
    doc.text('e-Invoice (IRN Pending)', rightEdge, 13.5, { align: 'right' });
    boxTopY = 21;
  }

  doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
  doc.setLineWidth(0.28);

  // Upper 50 / 50 Split Section
  const midX = margin + contentWidth * 0.49; // ~103
  const rightHalfW = rightEdge - midX;
  const rMidX = midX + rightHalfW / 2;

  const leftColW = midX - margin - 4;
  let lY = boxTopY + 4.2;

  // Left Block 1: Seller
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(20, 20, 22);
  const sNameLines = doc.splitTextToSize(invoice.seller.legalName, leftColW);
  doc.text(sNameLines, margin + 2, lY);
  lY += sNameLines.length * 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const sAddr = [invoice.seller.address, invoice.seller.city].filter(Boolean).join(', ');
  const sAddrLines = doc.splitTextToSize(sAddr, leftColW);
  doc.text(sAddrLines, margin + 2, lY);
  lY += sAddrLines.length * 3.5;
  doc.text(`GSTIN/UIN : ${invoice.seller.gstin || 'Unregistered'}`, margin + 2, lY);
  lY += 3.6;
  doc.text(`State Name : ${invoice.seller.stateName}, Code : ${invoice.seller.stateCode}`, margin + 2, lY);
  lY += 2.5;
  const sellerSepY = lY;

  // Left Block 2: Consignee (Ship to)
  lY += 3.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 66);
  doc.text('Consignee (Ship to)', margin + 2, lY);
  lY += 4;

  const shipName = invoice.dispatch.enabled && invoice.dispatch.shipToName
    ? invoice.dispatch.shipToName
    : invoice.buyer.legalName;
  const shipAddr = invoice.dispatch.enabled && invoice.dispatch.shipToAddress
    ? `${invoice.dispatch.shipToAddress}, ${invoice.dispatch.shipToCity}`
    : [invoice.buyer.address, invoice.buyer.city].filter(Boolean).join(', ');
  const shipStateName = invoice.dispatch.enabled && invoice.dispatch.shipToStateName
    ? invoice.dispatch.shipToStateName
    : invoice.buyer.stateName;
  const shipStateCode = invoice.dispatch.enabled && invoice.dispatch.shipToStateCode
    ? invoice.dispatch.shipToStateCode
    : invoice.buyer.stateCode;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor(20, 20, 22);
  const cNameLines = doc.splitTextToSize(shipName || 'Consignee', leftColW);
  doc.text(cNameLines, margin + 2, lY);
  lY += cNameLines.length * 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const cAddrLines = doc.splitTextToSize(shipAddr || '', leftColW);
  doc.text(cAddrLines, margin + 2, lY);
  lY += Math.max(1, cAddrLines.length) * 3.5;
  doc.text(`GSTIN/UIN   : ${invoice.buyer.gstin || 'Unregistered'}`, margin + 2, lY);
  lY += 3.6;
  doc.text(`State Name  : ${shipStateName}, Code : ${shipStateCode}`, margin + 2, lY);
  lY += 2.5;
  const consigneeSepY = lY;

  // Left Block 3: Buyer (Bill to)
  lY += 3.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 66);
  doc.text('Buyer (Bill to)', margin + 2, lY);
  lY += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor(20, 20, 22);
  const bNameLines = doc.splitTextToSize(invoice.buyer.legalName || 'Buyer', leftColW);
  doc.text(bNameLines, margin + 2, lY);
  lY += bNameLines.length * 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const bAddr = [invoice.buyer.address, invoice.buyer.city].filter(Boolean).join(', ');
  const bAddrLines = doc.splitTextToSize(bAddr, leftColW);
  doc.text(bAddrLines, margin + 2, lY);
  lY += Math.max(1, bAddrLines.length) * 3.5;
  doc.text(`GSTIN/UIN   : ${invoice.buyer.gstin || 'Unregistered'}`, margin + 2, lY);
  lY += 3.6;
  doc.text(`State Name  : ${invoice.buyer.stateName}, Code : ${invoice.buyer.stateCode}`, margin + 2, lY);
  lY += 3;

  // Right 50% Metadata Grid
  const metaRowH = 9.2;
  const metaRows: [string, string, string, string, boolean?][] = [
    ['Invoice No.', invoice.invoiceNumber, 'Dated', formatShortDate(invoice.issueDate), true],
    ['Mode/Terms of Payment', invoice.paymentTerms || '15 Days / NEFT', 'Reference No. & Date.', invoice.poNumber || ''],
    ['Dispatch Doc No.', invoice.dispatch.ewayBillNo || '', '', ''],
  ];

  const rightMinBottom = boxTopY + metaRows.length * metaRowH;
  const topBottomY = Math.max(lY, rightMinBottom);

  // Draw Left Horizontal Separators
  doc.line(margin, sellerSepY, midX, sellerSepY);
  doc.line(margin, consigneeSepY, midX, consigneeSepY);

  // Draw Right Grid Rows & Cells
  let rY = boxTopY;
  metaRows.forEach(([lLbl, lVal, rLbl, rVal, boldVal]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(70, 70, 76);
    doc.text(lLbl, midX + 2, rY + 3.4);
    doc.text(rLbl, rMidX + 2, rY + 3.4);

    doc.setFont('helvetica', boldVal ? 'bold' : 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(20, 20, 22);
    if (lVal) doc.text(doc.splitTextToSize(lVal, rightHalfW / 2 - 4).slice(0, 1), midX + 2, rY + 7.6);
    if (rVal) doc.text(doc.splitTextToSize(rVal, rightHalfW / 2 - 4).slice(0, 1), rMidX + 2, rY + 7.6);

    rY += metaRowH;
    doc.line(midX, rY, rightEdge, rY);
  });

  // Vertical divider inside right metadata grid
  doc.line(rMidX, boxTopY, rMidX, rY);
  // Vertical divider between left & right 50%
  doc.line(midX, boxTopY, midX, topBottomY);

  // Horizontal line ending Upper Split Box
  doc.line(margin, topBottomY, rightEdge, topBottomY);

  // Line Items Table Column Coordinates
  const cSl = margin; // 12
  const cDesc = margin + 8; // 20
  const cHsn = margin + 80; // 92
  const cQty = margin + 98; // 110
  const cRate = margin + 116; // 128
  const cPer = margin + 134; // 146
  const cDisc = margin + 144; // 156
  const cAmt = margin + 157; // 169
  // rightEdge = 198

  const drawItemsColLines = (startY: number, endY: number) => {
    [cDesc, cHsn, cQty, cRate, cPer, cDisc, cAmt].forEach((xPos) => {
      doc.line(xPos, startY, xPos, endY);
    });
  };

  const drawItemsHeader = (startY: number): number => {
    const hdrH = 8.5;
    if (brand.accentColor.toLowerCase() !== '#1d1d1f') {
      const tintR = Math.round(255 * 0.92 + accentRgb[0] * 0.08);
      const tintG = Math.round(255 * 0.92 + accentRgb[1] * 0.08);
      const tintB = Math.round(255 * 0.92 + accentRgb[2] * 0.08);
      doc.setFillColor(tintR, tintG, tintB);
      doc.rect(margin, startY, contentWidth, hdrH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 34);
    doc.text('Sl', cSl + 4, startY + 3.6, { align: 'center' });
    doc.text('No.', cSl + 4, startY + 7.0, { align: 'center' });
    doc.text('Description of Goods', (cDesc + cHsn) / 2, startY + 5.2, { align: 'center' });
    doc.text('HSN/SAC', (cHsn + cQty) / 2, startY + 5.2, { align: 'center' });
    doc.text('Quantity', (cQty + cRate) / 2, startY + 5.2, { align: 'center' });
    doc.text('Rate', (cRate + cPer) / 2, startY + 5.2, { align: 'center' });
    doc.text('per', (cPer + cDisc) / 2, startY + 5.2, { align: 'center' });
    doc.text('Disc. %', (cDisc + cAmt) / 2, startY + 5.2, { align: 'center' });
    doc.text('Amount', (cAmt + rightEdge) / 2, startY + 5.2, { align: 'center' });

    doc.line(margin, startY + hdrH, rightEdge, startY + hdrH);
    drawItemsColLines(startY, startY + hdrH);
    return startY + hdrH;
  };

  let curY = drawItemsHeader(topBottomY);
  const tableStartY = curY;
  let totalQty = 0;

  items.forEach((item, idx) => {
    totalQty += item.quantity;
    const nameLines = doc.splitTextToSize(item.name || 'Item', cHsn - cDesc - 4);
    const descLines = item.description ? doc.splitTextToSize(item.description, cHsn - cDesc - 4) : [];
    const rowH = Math.max(6.5, 3.8 + nameLines.length * 3.6 + descLines.length * 3.2);

    if (curY + rowH > pageHeight - 107) {
      drawItemsColLines(tableStartY, curY);
      doc.rect(margin, boxTopY, contentWidth, curY - boxTopY);
      doc.addPage();
      boxTopY = 14;
      curY = drawItemsHeader(boxTopY);
    }

    const ty = curY + 4.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 34);
    doc.text(String(idx + 1), cSl + 4, ty, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.text(nameLines, cDesc + 2, ty);
    if (descLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(90, 90, 96);
      doc.text(descLines, cDesc + 2, ty + nameLines.length * 3.6);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 34);
    doc.text(item.hsnCode || '-', (cHsn + cQty) / 2, ty, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.text(`${item.quantity} ${item.unit}`, cRate - 2, ty, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text(fmtNum(item.unitPrice), cPer - 1.5, ty, { align: 'right' });
    doc.text(item.unit, (cPer + cDisc) / 2, ty, { align: 'center' });
    if (item.discountPercent > 0) {
      doc.text(`${item.discountPercent}%`, cAmt - 1.5, ty, { align: 'right' });
    }

    doc.setFont('helvetica', 'bold');
    doc.text(fmtNum(item.taxableValue), rightEdge - 2, ty, { align: 'right' });

    curY += rowH;
  });

  // Tax Summary Rows inside Item Table (CGST/SGST or IGST)
  curY += 3;
  const addTaxTableRow = (label: string, amount: number) => {
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(8.2);
    doc.setTextColor(20, 20, 22);
    doc.text(label, cHsn - 2, curY + 4, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(fmtNum(amount), rightEdge - 2, curY + 4, { align: 'right' });
    curY += 5.5;
  };

  if (totals.isIntraState) {
    addTaxTableRow('CGST', totals.cgstTotal);
    addTaxTableRow('SGST', totals.sgstTotal);
  } else {
    addTaxTableRow('IGST', totals.igstTotal);
  }
  if (totals.cessTotal > 0) {
    addTaxTableRow('Cess', totals.cessTotal);
  }
  if (Math.abs(totals.roundOff) > 0) {
    addTaxTableRow('Round Off', totals.roundOff);
  }

  // Ensure table stretches cleanly down if page has ample room
  const hsnBlockEstH = 26 + hsnRows.length * 5.2 + 46;
  const targetTableBottom = pageHeight - 14 - hsnBlockEstH;
  if (curY < targetTableBottom) {
    curY = targetTableBottom;
  }

  // Draw vertical column lines for the entire item body
  drawItemsColLines(tableStartY, curY);

  // Total Row
  const totalRowH = 7;
  doc.line(margin, curY, rightEdge, curY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 34);
  doc.text('Total', cHsn - 2, curY + 4.8, { align: 'right' });

  const primaryUnit = items[0]?.unit || 'NOS';
  doc.setFont('helvetica', 'bold');
  doc.text(`${totalQty} ${primaryUnit}`, cRate - 2, curY + 4.8, { align: 'right' });

  // Grand Total with crisp vector Rupee symbol when INR
  const grandTotalText = fmtNum(totals.grandTotal);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  const numW = doc.getTextWidth(grandTotalText);
  if (invoice.currency === 'INR') {
    drawRupeeGlyph(doc, rightEdge - 2 - numW - 3.2, curY + 4.8);
    doc.text(grandTotalText, rightEdge - 2, curY + 4.8, { align: 'right' });
  } else {
    doc.text(formatMoney(totals.grandTotal, invoice.currency, true), rightEdge - 2, curY + 4.8, { align: 'right' });
  }

  drawItemsColLines(curY, curY + totalRowH);
  curY += totalRowH;
  doc.line(margin, curY, rightEdge, curY);

  // Amount Chargeable (in words)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 56);
  doc.text('Amount Chargeable (in words)', margin + 2, curY + 4);
  doc.setFont('helvetica', 'italic');
  doc.text('E. & O.E', rightEdge - 2, curY + 4, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(20, 20, 22);
  const amtWordsLines = doc.splitTextToSize(totals.amountInWords, contentWidth - 4);
  doc.text(amtWordsLines, margin + 2, curY + 8.2);
  curY += 6 + amtWordsLines.length * 3.8;
  doc.line(margin, curY, rightEdge, curY);

  // HSN/SAC Tax Summary Table
  const hsnHdrH = 9.5;
  const hsnRowH = 5.2;

  if (!totals.isIntraState) {
    const hTaxVal = margin + 96;
    const hIgst = margin + 122;
    const hIgstAmt = margin + 136;
    const hTotTax = margin + 162;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(30, 30, 34);
    doc.text('HSN/SAC', (margin + hTaxVal) / 2, curY + 5.8, { align: 'center' });
    doc.text('Taxable', (hTaxVal + hIgst) / 2, curY + 4, { align: 'center' });
    doc.text('Value', (hTaxVal + hIgst) / 2, curY + 7.5, { align: 'center' });
    doc.text('Integrated Tax', (hIgst + hTotTax) / 2, curY + 3.6, { align: 'center' });
    doc.text('Rate', (hIgst + hIgstAmt) / 2, curY + 8, { align: 'center' });
    doc.text('Amount', (hIgstAmt + hTotTax) / 2, curY + 8, { align: 'center' });
    doc.text('Total', (hTotTax + rightEdge) / 2, curY + 4, { align: 'center' });
    doc.text('Tax Amount', (hTotTax + rightEdge) / 2, curY + 7.5, { align: 'center' });

    doc.line(hIgst, curY + 4.8, hTotTax, curY + 4.8);
    doc.line(hTaxVal, curY, hTaxVal, curY + hsnHdrH);
    doc.line(hIgst, curY, hIgst, curY + hsnHdrH);
    doc.line(hIgstAmt, curY + 4.8, hIgstAmt, curY + hsnHdrH);
    doc.line(hTotTax, curY, hTotTax, curY + hsnHdrH);
    curY += hsnHdrH;
    doc.line(margin, curY, rightEdge, curY);

    hsnRows.forEach((hr) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.text(hr.hsnCode, margin + 2, curY + 3.8);
      doc.text(fmtNum(hr.taxableValue), hIgst - 2, curY + 3.8, { align: 'right' });
      doc.text(`${hr.igstRate}%`, hIgstAmt - 2, curY + 3.8, { align: 'right' });
      doc.text(fmtNum(hr.igstAmount), hTotTax - 2, curY + 3.8, { align: 'right' });
      doc.text(fmtNum(hr.totalTaxAmount), rightEdge - 2, curY + 3.8, { align: 'right' });
      [hTaxVal, hIgst, hIgstAmt, hTotTax].forEach((x) => doc.line(x, curY, x, curY + hsnRowH));
      curY += hsnRowH;
      doc.line(margin, curY, rightEdge, curY);
    });

    // HSN Total Row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.text('Total', hTaxVal - 2, curY + 3.8, { align: 'right' });
    doc.text(fmtNum(totals.taxableTotal), hIgst - 2, curY + 3.8, { align: 'right' });
    doc.text(fmtNum(totals.igstTotal), hTotTax - 2, curY + 3.8, { align: 'right' });
    doc.text(fmtNum(totals.taxTotal), rightEdge - 2, curY + 3.8, { align: 'right' });
    [hTaxVal, hIgst, hIgstAmt, hTotTax].forEach((x) => doc.line(x, curY, x, curY + hsnRowH));
    curY += hsnRowH;
    doc.line(margin, curY, rightEdge, curY);
  } else {
    const hTaxVal = margin + 68;
    const hCgst = margin + 94;
    const hCgstAmt = margin + 107;
    const hSgst = margin + 128;
    const hSgstAmt = margin + 141;
    const hTotTax = margin + 162;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(30, 30, 34);
    doc.text('HSN/SAC', (margin + hTaxVal) / 2, curY + 5.8, { align: 'center' });
    doc.text('Taxable', (hTaxVal + hCgst) / 2, curY + 4, { align: 'center' });
    doc.text('Value', (hTaxVal + hCgst) / 2, curY + 7.5, { align: 'center' });
    doc.text('Central Tax', (hCgst + hSgst) / 2, curY + 3.6, { align: 'center' });
    doc.text('Rate', (hCgst + hCgstAmt) / 2, curY + 8, { align: 'center' });
    doc.text('Amount', (hCgstAmt + hSgst) / 2, curY + 8, { align: 'center' });
    doc.text('State Tax', (hSgst + hTotTax) / 2, curY + 3.6, { align: 'center' });
    doc.text('Rate', (hSgst + hSgstAmt) / 2, curY + 8, { align: 'center' });
    doc.text('Amount', (hSgstAmt + hTotTax) / 2, curY + 8, { align: 'center' });
    doc.text('Total', (hTotTax + rightEdge) / 2, curY + 4, { align: 'center' });
    doc.text('Tax Amount', (hTotTax + rightEdge) / 2, curY + 7.5, { align: 'center' });

    doc.line(hCgst, curY + 4.8, hTotTax, curY + 4.8);
    [hTaxVal, hCgst, hSgst, hTotTax].forEach((x) => doc.line(x, curY, x, curY + hsnHdrH));
    [hCgstAmt, hSgstAmt].forEach((x) => doc.line(x, curY + 4.8, x, curY + hsnHdrH));
    curY += hsnHdrH;
    doc.line(margin, curY, rightEdge, curY);

    hsnRows.forEach((hr) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.text(hr.hsnCode, margin + 2, curY + 3.8);
      doc.text(fmtNum(hr.taxableValue), hCgst - 2, curY + 3.8, { align: 'right' });
      doc.text(`${hr.cgstRate}%`, hCgstAmt - 1.5, curY + 3.8, { align: 'right' });
      doc.text(fmtNum(hr.cgstAmount), hSgst - 2, curY + 3.8, { align: 'right' });
      doc.text(`${hr.sgstRate}%`, hSgstAmt - 1.5, curY + 3.8, { align: 'right' });
      doc.text(fmtNum(hr.sgstAmount), hTotTax - 2, curY + 3.8, { align: 'right' });
      doc.text(fmtNum(hr.totalTaxAmount), rightEdge - 2, curY + 3.8, { align: 'right' });
      [hTaxVal, hCgst, hCgstAmt, hSgst, hSgstAmt, hTotTax].forEach((x) =>
        doc.line(x, curY, x, curY + hsnRowH)
      );
      curY += hsnRowH;
      doc.line(margin, curY, rightEdge, curY);
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.text('Total', hTaxVal - 2, curY + 3.8, { align: 'right' });
    doc.text(fmtNum(totals.taxableTotal), hCgst - 2, curY + 3.8, { align: 'right' });
    doc.text(fmtNum(totals.cgstTotal), hSgst - 2, curY + 3.8, { align: 'right' });
    doc.text(fmtNum(totals.sgstTotal), hTotTax - 2, curY + 3.8, { align: 'right' });
    doc.text(fmtNum(totals.taxTotal), rightEdge - 2, curY + 3.8, { align: 'right' });
    [hTaxVal, hCgst, hCgstAmt, hSgst, hSgstAmt, hTotTax].forEach((x) =>
      doc.line(x, curY, x, curY + hsnRowH)
    );
    curY += hsnRowH;
    doc.line(margin, curY, rightEdge, curY);
  }

  // Tax Amount (in words)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(40, 40, 44);
  doc.text('Tax Amount (in words) :', margin + 2, curY + 4.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 22);
  const taxWords = numberToCurrencyWords(totals.taxTotal, invoice.currency);
  doc.text(doc.splitTextToSize(taxWords, contentWidth - 40).slice(0, 1), margin + 35, curY + 4.4);
  curY += 6.5;

  // Declaration & Authorised Signatory Bottom Split
  const decBoxH = 34;
  const sigBoxX = margin + contentWidth * 0.49;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(30, 30, 34);
  doc.text('Declaration', margin + 2, curY + 3.8);
  doc.line(margin + 2, curY + 4.3, margin + 16, curY + 4.3);

  doc.setFontSize(7.3);
  const declText =
    'We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.';
  doc.text(doc.splitTextToSize(declText, sigBoxX - margin - 5), margin + 2, curY + 8);
  if (invoice.bank.accountNumber) {
    const payee = (invoice.bank.accountName || invoice.seller.legalName).toUpperCase();
    doc.setFontSize(7.3);
    doc.setTextColor(20, 20, 22);
    doc.setFont('helvetica', 'bold');
    doc.text(`Please make payments in favor of ${payee} ONLY.`, margin + 2, curY + 18.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`. Bank: ${invoice.bank.bankName}`, margin + 2, curY + 22.5);
    doc.text(`. Account No: ${invoice.bank.accountNumber}`, margin + 2, curY + 26.5);
    doc.text(`. Ifs Code: ${invoice.bank.ifscCode}`, margin + 2, curY + 30.5);
  }

  // Right Signatory Sub-box
  doc.line(sigBoxX, curY, rightEdge, curY);
  doc.line(sigBoxX, curY, sigBoxX, curY + decBoxH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(20, 20, 22);
  doc.text(`for ${invoice.seller.legalName}`, rightEdge - 2, curY + 4, { align: 'right' });

  if (brand.signatureDataUrl) {
    try {
      const sigFormat = brand.signatureDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(brand.signatureDataUrl, sigFormat, rightEdge - 34, curY + 5.2, 30, 10, undefined, 'FAST');
    } catch {
      // ignore invalid image
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Authorised Signatory', rightEdge - 2, curY + decBoxH - 2, { align: 'right' });

  curY += decBoxH;
  // Main outer enclosing rectangle
  doc.rect(margin, boxTopY, contentWidth, curY - boxTopY);

  // Footer below box
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 66);
  doc.text('This is a Computer Generated Invoice', pageWidth / 2, curY + 4.5, { align: 'center' });
}

function stampCancelled(doc: jsPDF, fromPage: number, toPage: number): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let page = fromPage; page <= toPage; page++) {
    doc.setPage(page);
    doc.saveGraphicsState();
    doc.setGState(doc.GState({ opacity: 0.18 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(84);
    doc.setTextColor(220, 38, 38);
    doc.text('CANCELLED', pageW / 2, pageH / 2, { align: 'center', baseline: 'middle', angle: 35 });
    doc.restoreGraphicsState();
  }
  doc.setPage(toPage);
}

function renderInvoicePage(doc: jsPDF, invoice: InvoiceData, brand: BrandProfile): void {
  const firstPage = doc.getNumberOfPages();
  if (isShipmentInvoice(invoice)) {
    renderShipmentInvoicePages(doc, invoice, brand);
  } else {
    renderGstStandardInvoicePage(doc, invoice, brand);
  }
  if (invoice.cancelledAt) stampCancelled(doc, firstPage, doc.getNumberOfPages());
}

export function exportInvoicePdf(invoice: InvoiceData, brand: BrandProfile): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  renderInvoicePage(doc, invoice, brand);
  const safeName = invoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`${safeName}.pdf`);
}

export function exportBatchInvoicesPdf(invoices: InvoiceData[], brand: BrandProfile): void {
  if (!invoices.length) return;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  invoices.forEach((inv, idx) => {
    if (idx > 0) doc.addPage();
    renderInvoicePage(doc, inv, brand);
  });
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`Kinetic_Cargo_Batch_Invoices_${stamp}.pdf`);
}

export function exportReceiptPdf(receipt: ReceiptData, brand: BrandProfile): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const accentRgb = hexToRgb(brand.accentColor);
  const isExecutive: boolean = false;
  const isEditorial: boolean = false;
  const bodyFont = isEditorial ? 'times' : 'helvetica';

  let y = 16;

  if (isExecutive) {
    doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.rect(0, 0, pageWidth, 34, 'F');
    y = 9;
  } else if (isEditorial) {
    doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.setLineWidth(0.8);
    doc.line(margin, 10, pageWidth - margin, 10);
    y = 15;
  }

  let logoOffset = 0;
  if (brand.logoDataUrl) {
    try {
      const format = brand.logoDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(brand.logoDataUrl, format, margin, y, 14, 14, undefined, 'FAST');
      logoOffset = 17;
    } catch {
      drawMonogramBadge(doc, margin, y, brand, isExecutive ? [255, 255, 255] : accentRgb);
      logoOffset = 14;
    }
  } else if (brand.monogramId !== 'none') {
    if (isExecutive) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, y, 11, 11, 2, 2, 'F');
      doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text((brand.seller.legalName || 'K').charAt(0).toUpperCase(), margin + 5.5, y + 7.6, { align: 'center' });
    } else {
      drawMonogramBadge(doc, margin, y, brand, accentRgb);
    }
    logoOffset = 14;
  }

  doc.setFont(bodyFont, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(isExecutive ? 255 : 29, isExecutive ? 255 : 29, isExecutive ? 255 : 31);
  doc.text(receipt.seller.legalName || 'Kinetic Cargo Logistics Pvt. Ltd.', margin + logoOffset, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(isExecutive ? 235 : 100, isExecutive ? 238 : 102, isExecutive ? 245 : 108);
  doc.text(
    [receipt.seller.gstin ? `GSTIN: ${receipt.seller.gstin}` : '', receipt.seller.pan ? `PAN: ${receipt.seller.pan}` : '']
      .filter(Boolean)
      .join('   |   '),
    margin + logoOffset,
    y + 9.2
  );

  doc.setFont(bodyFont, 'bold');
  doc.setFontSize(14);
  if (isExecutive) {
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  }
  doc.text('PAYMENT RECEIPT', pageWidth - margin, y + 4.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(isExecutive ? 245 : 29, isExecutive ? 245 : 29, isExecutive ? 248 : 31);
  doc.text(`# ${receipt.receiptNumber}`, pageWidth - margin, y + 9.5, { align: 'right' });

  y = isExecutive ? 42 : y + 18;
  if (!isExecutive) {
    doc.setDrawColor(228, 228, 232);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
  }

  // Amount Highlight Card
  doc.setFillColor(248, 248, 250);
  doc.setDrawColor(226, 226, 232);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(125, 125, 132);
  doc.text('AMOUNT RECEIVED', margin + 5, y + 6.5);

  doc.setFont(bodyFont, 'bold');
  doc.setFontSize(17);
  doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.text(formatMoney(receipt.amountReceived, receipt.currency, true), margin + 5, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 96);
  doc.text(`Receipt Date: ${receipt.receiptDate}`, pageWidth - margin - 5, y + 8, { align: 'right' });
  doc.text(`Payment Mode: ${receipt.paymentMode}`, pageWidth - margin - 5, y + 13.5, { align: 'right' });
  if (receipt.referenceNumber) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${receipt.referenceNumber}`, pageWidth - margin - 5, y + 19, { align: 'right' });
  }

  y += 32;

  // 2-Column Payer & Linked Reference Details
  const halfW = (contentWidth - 8) / 2;
  const col2X = margin + halfW + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(125, 125, 132);
  doc.text('RECEIVED FROM (RECIPIENT)', margin, y);
  doc.text('ISSUED BY (SUPPLIER)', col2X, y);
  y += 5;

  doc.setFont(bodyFont, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 29, 31);
  doc.text(receipt.recipient.legalName || 'Recipient Name', margin, y);
  doc.text(receipt.seller.legalName || 'Supplier Name', col2X, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 86);
  const recAddr = `${receipt.recipient.address}, ${receipt.recipient.city}, ${receipt.recipient.stateName} (${receipt.recipient.stateCode}) - ${receipt.recipient.pincode}`;
  const selAddr = `${receipt.seller.address}, ${receipt.seller.city}, ${receipt.seller.stateName} (${receipt.seller.stateCode}) - ${receipt.seller.pincode}`;
  const recLines = doc.splitTextToSize(recAddr, halfW);
  const selLines = doc.splitTextToSize(selAddr, halfW);
  doc.text(recLines, margin, y);
  doc.text(selLines, col2X, y);

  let yL = y + recLines.length * 3.8 + 1.5;
  let yR = y + selLines.length * 3.8 + 1.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(`GSTIN: ${receipt.recipient.gstin || 'Unregistered'}`, margin, yL);
  doc.text(`GSTIN: ${receipt.seller.gstin || 'Unregistered'}`, col2X, yR);
  yL += 4;
  yR += 4;

  if (receipt.recipient.email) {
    doc.setFont('helvetica', 'normal');
    doc.text(`${receipt.recipient.email}${receipt.recipient.phone ? `  |  ${receipt.recipient.phone}` : ''}`, margin, yL);
    yL += 4;
  }
  if (receipt.seller.email) {
    doc.setFont('helvetica', 'normal');
    doc.text(`${receipt.seller.email}${receipt.seller.phone ? `  |  ${receipt.seller.phone}` : ''}`, col2X, yR);
    yR += 4;
  }

  y = Math.max(yL, yR) + 8;

  // Settlement Allocation Table
  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('PARTICULARS', margin + 3, y + 5.2);
  doc.text('REFERENCE', margin + 88, y + 5.2);
  doc.text('AMOUNT', pageWidth - margin - 3, y + 5.2, { align: 'right' });
  y += 8;

  const balanceDue = Math.max(0, receipt.invoiceTotal - receipt.amountReceived - receipt.tdsDeducted);
  const rows: [string, string, string][] = [
    ['Linked Invoice Total', receipt.linkedInvoiceNumber || 'On-Account Settlement', formatMoney(receipt.invoiceTotal, receipt.currency, true)],
    ['Amount Received Now', `${receipt.paymentMode}${receipt.referenceNumber ? ` · ${receipt.referenceNumber}` : ''}`, formatMoney(receipt.amountReceived, receipt.currency, true)],
  ];
  if (receipt.tdsDeducted > 0) {
    rows.push(['TDS Deducted at Source', 'Tax Withheld', formatMoney(receipt.tdsDeducted, receipt.currency, true)]);
  }
  rows.push(['Remaining Balance Due', balanceDue === 0 ? 'Settled in Full' : 'Outstanding', formatMoney(balanceDue, receipt.currency, true)]);

  rows.forEach(([part, ref, amt], idx) => {
    const rowH = 9.5;
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 252);
      doc.rect(margin, y, contentWidth, rowH, 'F');
    }
    doc.setDrawColor(235, 235, 240);
    doc.line(margin, y + rowH, pageWidth - margin, y + rowH);
    doc.setFont('helvetica', idx === 1 ? 'bold' : 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(29, 29, 31);
    doc.text(part, margin + 3, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(100, 100, 108);
    doc.text(doc.splitTextToSize(ref, 65).slice(0, 1), margin + 88, y + 6);
    doc.setFont('helvetica', idx === 1 ? 'bold' : 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(29, 29, 31);
    doc.text(amt, pageWidth - margin - 3, y + 6, { align: 'right' });
    y += rowH;
  });

  y += 8;

  if (receipt.linkedIrn) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(125, 125, 132);
    doc.text('LINKED INVOICE IRN', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(45, 45, 50);
    doc.text(receipt.linkedIrn, margin, y);
    y += 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(125, 125, 132);
  doc.text('AMOUNT RECEIVED IN WORDS', margin, y);
  y += 4.2;
  doc.setFont(bodyFont, 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(29, 29, 31);
  doc.text(doc.splitTextToSize(numberToCurrencyWords(receipt.amountReceived, receipt.currency), contentWidth), margin, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(125, 125, 132);
  doc.text('CREDITED TO BANK ACCOUNT', margin, y);
  y += 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 76);
  doc.text(`${receipt.bank.bankName} — ${receipt.bank.branch}  |  A/C: ${receipt.bank.accountNumber}  |  IFSC: ${receipt.bank.ifscCode}`, margin, y);
  y += 10;

  if (receipt.remarks) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(125, 125, 132);
    doc.text('REMARKS', margin, y);
    y += 4.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(65, 65, 72);
    doc.text(doc.splitTextToSize(receipt.remarks, 115), margin, y);
  }

  // Signature Block
  const sigY = Math.max(y + 12, 232);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(100, 100, 108);
  doc.text(`For ${receipt.seller.legalName}`, pageWidth - margin, sigY, { align: 'right' });

  if (brand.signatureDataUrl) {
    try {
      const sigFormat = brand.signatureDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(brand.signatureDataUrl, sigFormat, pageWidth - margin - 42, sigY + 2, 34, 12, undefined, 'FAST');
    } catch {
      // ignore invalid signature
    }
  }
  doc.setDrawColor(190, 190, 198);
  doc.line(pageWidth - margin - 52, sigY + 16, pageWidth - margin, sigY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(29, 29, 31);
  doc.text(brand.signatoryName || 'Authorized Signatory', pageWidth - margin, sigY + 20.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(115, 115, 122);
  doc.text(brand.signatoryTitle || 'Authorized Signatory', pageWidth - margin, sigY + 24.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 156);
  doc.text('Electronically generated payment receipt · Kinetic Cargo', pageWidth / 2, pageHeight - 9, { align: 'center' });

  const safeName = receipt.receiptNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`${safeName}.pdf`);
}
