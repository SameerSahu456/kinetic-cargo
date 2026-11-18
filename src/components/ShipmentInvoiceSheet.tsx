import React from 'react';
import { BrandProfile, InvoiceData } from '../types/invoice';
import {
  computeInvoice,
  computeShipmentSummary,
  formatShortDate,
  formatSlashDate,
} from '../utils/invoiceMath';
import { sellerHeaderLines, shipmentDocTitle, shipmentTermLines } from '../utils/shipmentPdf';

interface ShipmentInvoiceSheetProps {
  invoice: InvoiceData;
  brand: BrandProfile;
}

const money = (v: number) => (Number(v) || 0).toFixed(2);
const CELL = 'px-1.5 py-[3px] border-r border-black last:border-r-0';

// On-screen version of the AWB-wise tax invoice (see utils/shipmentPdf.ts).
export const ShipmentInvoiceSheet: React.FC<ShipmentInvoiceSheetProps> = ({ invoice, brand }) => {
  const summary = computeShipmentSummary(invoice);
  const { items, totals } = computeInvoice(invoice);
  const first = items[0];
  const buyer = invoice.buyer;
  const bank = invoice.bank;
  const terms = shipmentTermLines(invoice.terms);

  const totalRows: [string, number, boolean?][] = [
    ['Total', summary.freightTotal],
    ['Other Charge', summary.other],
    ['Fov.Charges', summary.fov],
    ['Oda.charges', summary.oda],
    [`Fuel Charges ${summary.fuelPercent}%`, summary.fuelAmount],
    ['Docket Charges', summary.docket],
    ['Sub Total', totals.taxableTotal],
    [`IGST@ of ${first?.igstRate ?? 0}%`, totals.igstTotal],
    [`CGST@ of ${first?.cgstRate ?? 0}%`, totals.cgstTotal],
    [`SGST@ of ${first?.sgstRate ?? 0}%`, totals.sgstTotal],
  ];
  if (Math.abs(totals.roundOff) > 0) totalRows.push(['Round Off', totals.roundOff]);
  totalRows.push(['BILL AMOUNT', totals.grandTotal, true]);

  return (
    <div className="p-7 flex-1 text-[11px] text-black leading-snug">
      <div className="border border-black">
        {/* Seller header */}
        <div className="relative text-center px-3 pt-2 pb-1 border-b border-black">
          {brand.logoDataUrl && (
            <img
              src={brand.logoDataUrl}
              alt=""
              className="w-12 h-12 object-contain absolute left-2 top-2"
            />
          )}
          <p className="font-bold text-[21px] leading-tight uppercase">{invoice.seller.legalName}</p>
          {sellerHeaderLines(invoice).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="font-bold mt-1">{shipmentDocTitle(invoice.docType)}</p>
        </div>

        {/* e-Invoice band */}
        {invoice.irn && (
          <div className="flex items-center justify-between gap-4 px-2 py-1.5 border-b border-black">
            <div className="space-y-0.5 min-w-0">
              <p className="break-all">
                <span className="inline-block w-16">IRN</span>:{' '}
                <span className="font-bold">{invoice.irn.irn}</span>
              </p>
              <p>
                <span className="inline-block w-16">Ack. No.</span>:{' '}
                <span className="font-bold">{invoice.irn.ackNo}</span>
              </p>
              <p>
                <span className="inline-block w-16">Ack. Date</span>:{' '}
                <span className="font-bold">{formatShortDate(invoice.irn.ackDate)}</span>
              </p>
            </div>
            <img
              src={invoice.irn.qrDataUrl}
              alt="Signed e-Invoice QR Code"
              className="w-[84px] h-[84px] shrink-0"
            />
          </div>
        )}

        {/* To block + invoice details */}
        <div className="flex border-b border-black">
          <div className="flex-1 min-w-0 flex gap-2 px-1.5 py-1">
            <span className="font-bold">To,</span>
            <div className="min-w-0 flex-1">
              <p className="uppercase">{buyer.legalName || 'Customer Name'}</p>
              {buyer.address && <p>{buyer.address}</p>}
              {buyer.city && <p>{buyer.city}</p>}
              {buyer.pincode && <p>{buyer.pincode}</p>}
              <div className="grid grid-cols-2 gap-x-3">
                <p>
                  <span className="font-bold">Customer GST No.:</span>{' '}
                  {buyer.gstin || 'Unregistered'}
                </p>
                <p>
                  <span className="font-bold">State:</span>{' '}
                  <span className="uppercase">{buyer.stateName}</span>
                </p>
                <p>
                  <span className="font-bold">HSN No.:</span> {summary.hsnCode}
                </p>
                <p>
                  <span className="font-bold">State code:</span> {buyer.stateCode}
                </p>
              </div>
            </div>
          </div>
          <div className="w-[254px] shrink-0 border-l border-black grid grid-rows-4 divide-y divide-black">
            {(
              [
                ['Invoice No.', invoice.invoiceNumber],
                ['From Date', formatSlashDate(summary.periodFrom)],
                ['To Date', formatSlashDate(summary.periodTo)],
                ['Invoice Date', formatSlashDate(invoice.issueDate)],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex items-stretch">
                <span className="w-[76px] shrink-0 px-1.5 py-1 font-bold border-r border-black flex items-center">
                  {label}
                </span>
                <span className="px-2.5 py-1 flex items-center tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shipment rows */}
        <table className="w-full border-collapse tabular-nums">
          <thead>
            <tr className="border-b border-black font-bold text-center align-middle">
              <th className={`${CELL} w-9`}>SrNo.</th>
              <th className={`${CELL} w-[66px]`}>Book Date</th>
              <th className={CELL}>Awb No.</th>
              <th className={`${CELL} w-[66px]`}>
                Booking
                <br />
                Branch
              </th>
              <th className={`${CELL} w-[84px]`}>Destination</th>
              <th className={`${CELL} w-[46px]`}>Mode</th>
              <th className={`${CELL} w-10`}>Pcs</th>
              <th className={`${CELL} w-[50px]`}>
                Actual
                <br />
                Wt
              </th>
              <th className={`${CELL} w-[50px]`}>Weight</th>
              <th className={`${CELL} w-10`}>Rate</th>
              <th className={`${CELL} w-[54px]`}>
                Vehicle
                <br />
                Chg
              </th>
              <th className={`${CELL} w-[78px]`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row, idx) => (
              <tr key={row.id}>
                <td className={CELL}>{idx + 1}</td>
                <td className={CELL}>{formatSlashDate(row.bookDate)}</td>
                <td className={CELL}>{row.awbNo}</td>
                <td className={`${CELL} uppercase`}>{row.bookingBranch}</td>
                <td className={`${CELL} uppercase`}>{row.destination}</td>
                <td className={`${CELL} uppercase`}>{row.mode ?? ''}</td>
                <td className={`${CELL} text-center`}>{Number(row.pcs) || 0}</td>
                <td className={`${CELL} text-right`}>{Number(row.actualWeight) || 0}</td>
                <td className={`${CELL} text-right`}>{Number(row.chargedWeight) || 0}</td>
                <td className={`${CELL} text-right`}>{money(row.rate)}</td>
                <td className={`${CELL} text-right`}>{money(row.vehicleCharges ?? 0)}</td>
                <td className={`${CELL} text-right`}>{money(row.amount)}</td>
              </tr>
            ))}
            {summary.rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-2 py-6 text-center text-[#6E6E73]">
                  No shipments added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Words + bank (left), charges and tax (right) */}
        <div className="flex border-t border-black">
          <div className="flex-1 min-w-0 px-2 py-1.5 flex flex-col justify-between gap-4">
            <p>
              RUPEES IN WORDS :{' '}
              <span className="font-bold uppercase">
                {totals.amountInWords.replace(/^\S+\s/, '')}
              </span>
            </p>
            {bank.accountNumber && (
              <div>
                <p>Bank Detail For Payment Transfer</p>
                {bank.accountName && <p>A/C NAME. {bank.accountName}</p>}
                {bank.bankName && <p>BANK NAME. {bank.bankName}</p>}
                <p>AC/NO. {bank.accountNumber}</p>
                {bank.ifscCode && <p>IFSC CODE. {bank.ifscCode}</p>}
                {bank.branch && <p>BRANCH NAME - {bank.branch}</p>}
                {bank.upiId && <p>UPI ID. {bank.upiId}</p>}
              </div>
            )}
          </div>
          <div className="w-[254px] shrink-0 border-l border-black divide-y divide-black tabular-nums">
            {totalRows.map(([label, amount, emphasise]) => (
              <div key={label} className={`flex items-stretch ${emphasise ? 'text-[12px]' : ''}`}>
                <span className="flex-1 px-2 py-[3px] font-bold border-r border-black">{label}</span>
                <span
                  className={`w-[78px] shrink-0 px-1.5 py-[3px] text-right ${
                    emphasise ? 'font-bold' : ''
                  }`}
                >
                  {money(amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Terms + signatory */}
        <div className="flex border-t border-black min-h-[130px]">
          <div className="flex-1 min-w-0 px-2 py-1.5">
            <p className="font-bold">TERMS &amp; CONDITIONS</p>
            {terms.map((line, idx) => (
              <p key={idx} className="flex gap-1.5">
                <span className="shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                <span>{line}</span>
              </p>
            ))}
          </div>
          <div className="w-[254px] shrink-0 px-2 py-2 flex flex-col items-center justify-between text-center font-bold">
            <p className="uppercase">For {invoice.seller.legalName}</p>
            {brand.signatureDataUrl && (
              <img
                src={brand.signatureDataUrl}
                alt="Authorised Signatory"
                className="max-h-14 object-contain"
              />
            )}
            <p>Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
};
