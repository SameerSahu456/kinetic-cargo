import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ZoomIn, ZoomOut, AlertTriangle, RefreshCw } from 'lucide-react';
import { BrandProfile, InvoiceData } from '../types/invoice';
import {
  computeInvoice,
  formatMoney,
  formatShortDate,
  groupItemsByHsn,
  isShipmentInvoice,
  numberToCurrencyWords,
} from '../utils/invoiceMath';
import { ShipmentInvoiceSheet } from './ShipmentInvoiceSheet';
import { computeInvoiceFingerprint } from '../utils/irnGenerator';

interface InvoicePreviewProps {
  invoice: InvoiceData;
  brand: BrandProfile;
  onRegenerateIrn?: () => void;
}

// Matches the typeface of the standard GST e-Invoice print format.
const INVOICE_FONT_FAMILY = 'Arial, Helvetica, "Liberation Sans", sans-serif';

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  invoice,
  brand,
  onRegenerateIrn,
}) => {
  const [zoom, setZoom] = useState<number>(0.88);
  const { items, totals } = computeInvoice(invoice);
  const hsnRows = groupItemsByHsn(items, totals.isIntraState);

  const isCancelled = Boolean(invoice.cancelledAt);
  const isIrnStale =
    !isCancelled && invoice.irn !== null && invoice.irn.fingerprint !== computeInvoiceFingerprint(invoice);

  return (
    <div className="flex flex-col h-full">
      {/* Preview Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white/80 backdrop-blur-md border-b border-black/[0.06] shrink-0">
        <span className="text-[12px] font-medium text-[#6E6E73]">
          {isShipmentInvoice(invoice) ? 'AWB-wise Tax Invoice' : 'GST e-Invoice'}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}
            aria-label="Zoom out"
            className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11.5px] text-[#6E6E73] w-11 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.15, +(z + 0.1).toFixed(2)))}
            aria-label="Zoom in"
            className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stale IRN Notice */}
      <AnimatePresence>
        {isIrnStale && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-between gap-3 text-[12px] text-amber-900"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Invoice details changed after IRN generation. An issued IRN cannot be edited — change the invoice number, then re-issue; the current IRN will be marked cancelled.</span>
            </div>
            {onRegenerateIrn && (
              <button
                type="button"
                onClick={onRegenerateIrn}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-900 text-white text-[11.5px] font-medium hover:bg-amber-800 transition-colors shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Re-issue IRN</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {isCancelled && (
        <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200/80 flex items-center gap-2 text-[12px] text-red-900">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>
            This invoice was cancelled on {formatShortDate(invoice.cancelledAt!)}. It cannot be
            edited or issued a new IRN.
          </span>
        </div>
      )}

      {/* Scrollable A4 Paper Stage */}
      <div className="flex-1 overflow-auto p-5 lg:p-8 flex justify-center items-start bg-[#F5F5F7]">
        <motion.div
          initial={{ opacity: 0.7, scale: zoom * 0.985 }}
          animate={{ opacity: 1, scale: zoom }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: 'top center' }}
          className="w-[794px] shrink-0"
        >
          <div
            id="printable-invoice-sheet"
            className={`relative w-[794px] min-h-[1123px] bg-white text-[#1D1D1F] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] rounded-[4px] overflow-hidden flex flex-col justify-between`}
            style={{ fontFamily: INVOICE_FONT_FAMILY }}
          >
              {isCancelled && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
                >
                  <span className="-rotate-[35deg] text-[110px] font-bold tracking-[0.08em] text-red-600/20 select-none">
                    CANCELLED
                  </span>
                </div>
              )}
              {isShipmentInvoice(invoice) ? (
                <ShipmentInvoiceSheet invoice={invoice} brand={brand} />
              ) : (
              <div className="p-9 flex-1 flex flex-col justify-between text-[11.5px] text-[#141416] leading-snug">
                <div>
                  {/* Top Title + e-Invoice IRN / QR Header */}
                  <div className="relative mb-3">
                    {brand.logoDataUrl && (
                      <img
                        src={brand.logoDataUrl}
                        alt={invoice.seller.legalName}
                        className="w-11 h-11 object-contain absolute left-0 top-0"
                      />
                    )}
                    <p className="text-center font-bold text-[15px]">
                      {invoice.docType === 'CRN'
                        ? 'Credit Note'
                        : invoice.docType === 'DBN'
                        ? 'Debit Note'
                        : 'Tax Invoice'}
                    </p>

                    {invoice.irn ? (
                      <div className="mt-2 flex items-end justify-between gap-6">
                        <div className="space-y-1 text-[11px] flex-1 min-w-0 pt-3">
                          <div className="flex items-start gap-2">
                            <span className="w-16 shrink-0 text-[#2C2C30]">IRN</span>
                            <span>:</span>
                            <span className="font-bold text-[10.5px] break-all leading-tight">
                              {invoice.irn.irn}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-16 shrink-0 text-[#2C2C30]">Ack. No.</span>
                            <span>:</span>
                            <span className="font-bold">{invoice.irn.ackNo}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-16 shrink-0 text-[#2C2C30]">Ack. Date</span>
                            <span>:</span>
                            <span className="font-bold">{formatShortDate(invoice.irn.ackDate)}</span>
                          </div>
                        </div>

                        <div className="text-center shrink-0">
                          <p className="font-bold text-[11px] mb-1">e-Invoice</p>
                          <img
                            src={invoice.irn.qrDataUrl}
                            alt="Signed e-Invoice QR Code"
                            className="w-[116px] h-[116px] border border-black/15 p-0.5 bg-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-right text-[10.5px] font-semibold text-[#6E6E73] -mt-4">
                        e-Invoice (IRN Pending)
                      </p>
                    )}
                  </div>

                  {/* Main Enclosed GST Grid Box */}
                  <div className="border border-[#28282C]">
                    {/* Upper 50/50 Split */}
                    <div className="grid grid-cols-2 border-b border-[#28282C]">
                      {/* Left 50%: Seller, Consignee, Buyer */}
                      <div className="border-r border-[#28282C] divide-y divide-[#28282C]">
                        <div className="p-2.5 space-y-0.5">
                          <p className="font-bold text-[12px]">{invoice.seller.legalName}</p>
                          <p>{invoice.seller.address}</p>
                          <p>{invoice.seller.city}</p>
                          <p>GSTIN/UIN : {invoice.seller.gstin || 'Unregistered'}</p>
                          <p>
                            State Name : {invoice.seller.stateName}, Code : {invoice.seller.stateCode}
                          </p>
                        </div>

                        <div className="p-2.5 space-y-0.5">
                          <p className="text-[10.5px] text-[#3A3A3E]">Consignee (Ship to)</p>
                          <p className="font-bold text-[12px]">
                            {invoice.dispatch.enabled && invoice.dispatch.shipToName
                              ? invoice.dispatch.shipToName
                              : invoice.buyer.legalName}
                          </p>
                          <p>
                            {invoice.dispatch.enabled && invoice.dispatch.shipToAddress
                              ? `${invoice.dispatch.shipToAddress}, ${invoice.dispatch.shipToCity}`
                              : `${invoice.buyer.address}, ${invoice.buyer.city}`}
                          </p>
                          <p>
                            <span className="inline-block w-20">GSTIN/UIN</span>:{' '}
                            {invoice.buyer.gstin || 'Unregistered'}
                          </p>
                          <p>
                            <span className="inline-block w-20">State Name</span>:{' '}
                            {invoice.dispatch.enabled && invoice.dispatch.shipToStateName
                              ? `${invoice.dispatch.shipToStateName}, Code : ${invoice.dispatch.shipToStateCode}`
                              : `${invoice.buyer.stateName}, Code : ${invoice.buyer.stateCode}`}
                          </p>
                        </div>

                        <div className="p-2.5 space-y-0.5">
                          <p className="text-[10.5px] text-[#3A3A3E]">Buyer (Bill to)</p>
                          <p className="font-bold text-[12px]">
                            {invoice.buyer.legalName || 'Buyer Legal Name'}
                          </p>
                          <p>
                            {invoice.buyer.address}, {invoice.buyer.city}
                          </p>
                          <p>
                            <span className="inline-block w-20">GSTIN/UIN</span>:{' '}
                            {invoice.buyer.gstin || 'Unregistered'}
                          </p>
                          <p>
                            <span className="inline-block w-20">State Name</span>:{' '}
                            {invoice.buyer.stateName}, Code : {invoice.buyer.stateCode}
                          </p>
                        </div>
                      </div>

                      {/* Right 50%: Metadata Grid */}
                      <div className="flex flex-col">
                        <div className="grid grid-cols-2 divide-x divide-[#28282C] border-b border-[#28282C]">
                          <div className="px-2 py-1.5">
                            <p className="text-[10px] text-[#3A3A3E]">Invoice No.</p>
                            <p className="font-bold text-[11.5px] mt-0.5">{invoice.invoiceNumber}</p>
                          </div>
                          <div className="px-2 py-1.5">
                            <p className="text-[10px] text-[#3A3A3E]">Dated</p>
                            <p className="font-bold text-[11.5px] mt-0.5">
                              {formatShortDate(invoice.issueDate)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-[#28282C] border-b border-[#28282C]">
                          <div className="px-2 py-1.5 min-h-[38px]">
                            <p className="text-[10px] text-[#3A3A3E]">Mode/Terms of Payment</p>
                            <p className="text-[11px] mt-0.5">
                              {invoice.paymentTerms || '15 Days / NEFT'}
                            </p>
                          </div>
                          <div className="px-2 py-1.5 min-h-[38px]">
                            <p className="text-[10px] text-[#3A3A3E]">Reference No. &amp; Date.</p>
                            <p className="text-[11px] mt-0.5">{invoice.poNumber || ''}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-[#28282C] border-b border-[#28282C]">
                          <div className="px-2 py-1.5 min-h-[38px]">
                            <p className="text-[10px] text-[#3A3A3E]">Dispatch Doc No.</p>
                            <p className="text-[11px] mt-0.5">{invoice.dispatch.ewayBillNo || ''}</p>
                          </div>
                          <div className="px-2 py-1.5 min-h-[38px]" />
                        </div>
                      </div>
                    </div>

                    {/* Line Items Table */}
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-[#28282C] divide-x divide-[#28282C]">
                          <th className="py-1.5 px-1 text-center font-normal w-9">Sl No.</th>
                          <th className="py-1.5 px-2 text-center font-normal">Description of Goods</th>
                          <th className="py-1.5 px-2 text-center font-normal w-20">HSN/SAC</th>
                          <th className="py-1.5 px-2 text-center font-normal w-20">Quantity</th>
                          <th className="py-1.5 px-2 text-center font-normal w-20">Rate</th>
                          <th className="py-1.5 px-1.5 text-center font-normal w-12">per</th>
                          <th className="py-1.5 px-1.5 text-center font-normal w-14">Disc. %</th>
                          <th className="py-1.5 px-2 text-center font-normal w-28">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-x divide-[#28282C]">
                        {items.map((item, idx) => (
                          <tr key={item.id} className="divide-x divide-[#28282C] align-top">
                            <td className="py-2 px-1 text-center tabular-nums">{idx + 1}</td>
                            <td className="py-2 px-2">
                              <p className="font-bold">{item.name || 'Item'}</p>
                              {item.description && (
                                <p className="text-[10px] text-[#424245] mt-0.5">{item.description}</p>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">{item.hsnCode || '-'}</td>
                            <td className="py-2 px-2 text-right font-bold tabular-nums whitespace-nowrap">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                              {formatMoney(item.unitPrice, invoice.currency).replace(/^[^\d]+/, '')}
                            </td>
                            <td className="py-2 px-1.5 text-center">{item.unit}</td>
                            <td className="py-2 px-1.5 text-right tabular-nums">
                              {item.discountPercent > 0 ? `${item.discountPercent}%` : ''}
                            </td>
                            <td className="py-2 px-2 text-right font-bold tabular-nums whitespace-nowrap">
                              {formatMoney(item.taxableValue, invoice.currency).replace(/^[^\d]+/, '')}
                            </td>
                          </tr>
                        ))}

                        {/* Tax Rows inside Table Body */}
                        {totals.isIntraState ? (
                          <>
                            <tr className="divide-x divide-[#28282C]">
                              <td className="py-1.5" />
                              <td className="py-1.5 px-2 text-right font-bold italic">CGST</td>
                              <td />
                              <td />
                              <td />
                              <td />
                              <td />
                              <td className="py-1.5 px-2 text-right font-bold tabular-nums">
                                {formatMoney(totals.cgstTotal, invoice.currency).replace(/^[^\d]+/, '')}
                              </td>
                            </tr>
                            <tr className="divide-x divide-[#28282C]">
                              <td className="py-1.5" />
                              <td className="py-1.5 px-2 text-right font-bold italic">SGST</td>
                              <td />
                              <td />
                              <td />
                              <td />
                              <td />
                              <td className="py-1.5 px-2 text-right font-bold tabular-nums">
                                {formatMoney(totals.sgstTotal, invoice.currency).replace(/^[^\d]+/, '')}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr className="divide-x divide-[#28282C]">
                            <td className="py-2" />
                            <td className="py-2 px-2 text-right font-bold italic">IGST</td>
                            <td />
                            <td />
                            <td />
                            <td />
                            <td />
                            <td className="py-2 px-2 text-right font-bold tabular-nums">
                              {formatMoney(totals.igstTotal, invoice.currency).replace(/^[^\d]+/, '')}
                            </td>
                          </tr>
                        )}

                        {Math.abs(totals.roundOff) > 0 && (
                          <tr className="divide-x divide-[#28282C]">
                            <td className="py-1" />
                            <td className="py-1 px-2 text-right font-bold italic">Round Off</td>
                            <td />
                            <td />
                            <td />
                            <td />
                            <td />
                            <td className="py-1 px-2 text-right font-bold tabular-nums">
                              {totals.roundOff.toFixed(2)}
                            </td>
                          </tr>
                        )}

                        {/* Spacer row for Tally proportional height */}
                        <tr className="divide-x divide-[#28282C] h-20">
                          <td />
                          <td />
                          <td />
                          <td />
                          <td />
                          <td />
                          <td />
                          <td />
                        </tr>

                        {/* Total Row */}
                        <tr className="border-t border-b border-[#28282C] divide-x divide-[#28282C]">
                          <td className="py-1.5" />
                          <td className="py-1.5 px-2 text-right">Total</td>
                          <td />
                          <td className="py-1.5 px-2 text-right font-bold tabular-nums whitespace-nowrap">
                            {items.reduce((s, i) => s + i.quantity, 0)} {items[0]?.unit || 'NOS'}
                          </td>
                          <td />
                          <td />
                          <td />
                          <td className="py-1.5 px-2 text-right font-bold text-[12.5px] tabular-nums whitespace-nowrap">
                            {formatMoney(totals.grandTotal, invoice.currency)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Amount Chargeable in Words */}
                    <div className="px-2.5 py-2 border-b border-[#28282C]">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span>Amount Chargeable (in words)</span>
                        <span className="italic">E. &amp; O.E</span>
                      </div>
                      <p className="font-bold text-[12px] mt-0.5">{totals.amountInWords}</p>
                    </div>

                    {/* HSN/SAC Summary Table */}
                    <table className="w-full border-collapse text-[10.5px] border-b border-[#28282C]">
                      <thead>
                        {!totals.isIntraState ? (
                          <>
                            <tr className="border-b border-[#28282C] divide-x divide-[#28282C]">
                              <th rowSpan={2} className="py-1 px-2 text-center font-normal">
                                HSN/SAC
                              </th>
                              <th rowSpan={2} className="py-1 px-2 text-center font-normal w-28">
                                Taxable Value
                              </th>
                              <th colSpan={2} className="py-1 px-2 text-center font-normal">
                                Integrated Tax
                              </th>
                              <th rowSpan={2} className="py-1 px-2 text-center font-normal w-28">
                                Total Tax Amount
                              </th>
                            </tr>
                            <tr className="border-b border-[#28282C] divide-x divide-[#28282C]">
                              <th className="py-0.5 px-2 text-center font-normal w-16">Rate</th>
                              <th className="py-0.5 px-2 text-center font-normal w-24">Amount</th>
                            </tr>
                          </>
                        ) : (
                          <>
                            <tr className="border-b border-[#28282C] divide-x divide-[#28282C]">
                              <th rowSpan={2} className="py-1 px-2 text-center font-normal">
                                HSN/SAC
                              </th>
                              <th rowSpan={2} className="py-1 px-2 text-center font-normal w-24">
                                Taxable Value
                              </th>
                              <th colSpan={2} className="py-1 px-2 text-center font-normal">
                                Central Tax
                              </th>
                              <th colSpan={2} className="py-1 px-2 text-center font-normal">
                                State Tax
                              </th>
                              <th rowSpan={2} className="py-1 px-2 text-center font-normal w-24">
                                Total Tax Amount
                              </th>
                            </tr>
                            <tr className="border-b border-[#28282C] divide-x divide-[#28282C]">
                              <th className="py-0.5 px-1.5 text-center font-normal w-12">Rate</th>
                              <th className="py-0.5 px-2 text-center font-normal w-20">Amount</th>
                              <th className="py-0.5 px-1.5 text-center font-normal w-12">Rate</th>
                              <th className="py-0.5 px-2 text-center font-normal w-20">Amount</th>
                            </tr>
                          </>
                        )}
                      </thead>
                      <tbody>
                        {hsnRows.map((hr, idx) => (
                          <tr
                            key={`${hr.hsnCode}-${idx}`}
                            className="border-b border-[#28282C] divide-x divide-[#28282C] tabular-nums"
                          >
                            <td className="py-1 px-2">{hr.hsnCode}</td>
                            <td className="py-1 px-2 text-right">
                              {formatMoney(hr.taxableValue, invoice.currency).replace(/^[^\d]+/, '')}
                            </td>
                            {!totals.isIntraState ? (
                              <>
                                <td className="py-1 px-2 text-right">{hr.igstRate}%</td>
                                <td className="py-1 px-2 text-right">
                                  {formatMoney(hr.igstAmount, invoice.currency).replace(/^[^\d]+/, '')}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-1 px-1.5 text-right">{hr.cgstRate}%</td>
                                <td className="py-1 px-2 text-right">
                                  {formatMoney(hr.cgstAmount, invoice.currency).replace(/^[^\d]+/, '')}
                                </td>
                                <td className="py-1 px-1.5 text-right">{hr.sgstRate}%</td>
                                <td className="py-1 px-2 text-right">
                                  {formatMoney(hr.sgstAmount, invoice.currency).replace(/^[^\d]+/, '')}
                                </td>
                              </>
                            )}
                            <td className="py-1 px-2 text-right">
                              {formatMoney(hr.totalTaxAmount, invoice.currency).replace(/^[^\d]+/, '')}
                            </td>
                          </tr>
                        ))}

                        <tr className="divide-x divide-[#28282C] font-bold tabular-nums">
                          <td className="py-1 px-2 text-right">Total</td>
                          <td className="py-1 px-2 text-right">
                            {formatMoney(totals.taxableTotal, invoice.currency).replace(/^[^\d]+/, '')}
                          </td>
                          {!totals.isIntraState ? (
                            <>
                              <td />
                              <td className="py-1 px-2 text-right">
                                {formatMoney(totals.igstTotal, invoice.currency).replace(/^[^\d]+/, '')}
                              </td>
                            </>
                          ) : (
                            <>
                              <td />
                              <td className="py-1 px-2 text-right">
                                {formatMoney(totals.cgstTotal, invoice.currency).replace(/^[^\d]+/, '')}
                              </td>
                              <td />
                              <td className="py-1 px-2 text-right">
                                {formatMoney(totals.sgstTotal, invoice.currency).replace(/^[^\d]+/, '')}
                              </td>
                            </>
                          )}
                          <td className="py-1 px-2 text-right">
                            {formatMoney(totals.taxTotal, invoice.currency).replace(/^[^\d]+/, '')}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Tax Amount in words */}
                    <div className="px-2.5 py-1.5 text-[11px]">
                      <span className="mr-2">Tax Amount (in words) :</span>
                      <span className="font-bold">
                        {numberToCurrencyWords(totals.taxTotal, invoice.currency)}
                      </span>
                    </div>

                    {/* Declaration & Authorised Signatory */}
                    <div className="grid grid-cols-2 items-stretch">
                      <div className="px-2.5 py-2 space-y-1">
                        <p className="underline text-[10.5px]">Declaration</p>
                        <p className="text-[10.5px] leading-snug">
                          We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.
                        </p>
                        {invoice.bank.accountNumber && (
                          <div className="text-[10.5px] leading-snug pt-1.5">
                            <p className="font-bold">
                              Please make payments in favor of{' '}
                              {(invoice.bank.accountName || invoice.seller.legalName).toUpperCase()} ONLY.
                            </p>
                            <p>. Bank: {invoice.bank.bankName}</p>
                            <p>. Account No: {invoice.bank.accountNumber}</p>
                            <p>. Ifs Code: {invoice.bank.ifscCode}</p>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-l border-[#28282C] px-2.5 py-2 flex flex-col justify-between text-right min-h-[76px]">
                        <p className="font-bold text-[10.5px]">for {invoice.seller.legalName}</p>
                        <div className="h-9 flex items-center justify-end">
                          {brand.signatureDataUrl && (
                            <img
                              src={brand.signatureDataUrl}
                              alt="Authorised Signatory"
                              className="max-h-9 object-contain"
                            />
                          )}
                        </div>
                        <p className="text-[10.5px]">Authorised Signatory</p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-center text-[10.5px] text-[#28282C] mt-3">
                  This is a Computer Generated Invoice
                </p>
              </div>
              )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
