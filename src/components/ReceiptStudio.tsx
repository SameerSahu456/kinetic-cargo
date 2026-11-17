import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Download,
  Eye,
  Bookmark,
  BookmarkCheck,
  Plus,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  Printer,
} from 'lucide-react';
import { CURRENCY_CONFIG, INDIAN_STATES } from '../data/presets';
import {
  BrandProfile,
  CurrencyCode,
  InvoiceData,
  PaymentMode,
  ReceiptData,
  RecipientRecord,
} from '../types/invoice';
import { computeInvoice, formatMoney, numberToCurrencyWords } from '../utils/invoiceMath';
import { exportReceiptPdf } from '../utils/pdfExporter';
import { BrandMonogram } from './BrandMonogram';

interface ReceiptStudioProps {
  receipt: ReceiptData;
  onChange: (updated: ReceiptData) => void;
  savedReceipts: ReceiptData[];
  onSaveReceipt: (receipt: ReceiptData) => void;
  onDeleteReceipt: (id: string) => void;
  onNewReceipt: () => void;
  recipients: RecipientRecord[];
  invoices: InvoiceData[];
  brand: BrandProfile;
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-[13px] bg-white border border-black/[0.1] rounded-lg text-[#1D1D1F] placeholder:text-[#A1A1A6] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/15 transition-all';

const LABEL_CLASS = 'block text-[11.5px] font-medium text-[#6E6E73] mb-1.5';

const PAYMENT_MODES: PaymentMode[] = [
  'NEFT / RTGS',
  'UPI',
  'Cheque',
  'Wire Transfer',
  'Card',
  'Cash',
];

export const ReceiptStudio: React.FC<ReceiptStudioProps> = ({
  receipt,
  onChange,
  savedReceipts,
  onSaveReceipt,
  onDeleteReceipt,
  onNewReceipt,
  recipients,
  invoices,
  brand,
}) => {
  const [zoom, setZoom] = useState(0.84);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Alternate layouts were retired; receipts always use the standard style.
  const isExecutive: boolean = false;
  const isEditorial: boolean = false;
  const balanceDue = Math.max(
    0,
    receipt.invoiceTotal - receipt.amountReceived - receipt.tdsDeducted
  );
  const isSaved = savedReceipts.some((r) => r.id === receipt.id);

  const handleSelectRecipient = (recipientId: string) => {
    const rec = recipients.find((r) => r.id === recipientId);
    if (!rec) return;
    onChange({
      ...receipt,
      recipient: {
        legalName: rec.legalName,
        tradeName: rec.tradeName,
        gstin: rec.gstin,
        pan: rec.pan,
        address: rec.address,
        city: rec.city,
        stateCode: rec.stateCode,
        stateName: rec.stateName,
        pincode: rec.pincode,
        email: rec.email,
        phone: rec.phone,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleLinkInvoice = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const { totals } = computeInvoice(inv);
    onChange({
      ...receipt,
      linkedInvoiceNumber: inv.invoiceNumber,
      linkedIrn: inv.irn?.irn || '',
      currency: inv.currency,
      invoiceTotal: totals.grandTotal,
      amountReceived: totals.grandTotal,
      recipient: { ...inv.buyer },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSave = () => {
    onSaveReceipt({ ...receipt, updatedAt: new Date().toISOString() });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2200);
  };

  const renderPaper = (scale: number) => (
    <motion.div
      key={brand.templateId}
      initial={{ opacity: 0.75, scale: scale * 0.985 }}
      animate={{ opacity: 1, scale }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: 'top center' }}
      className="w-[794px] shrink-0"
    >
      <div
        id="printable-invoice-sheet"
        className={`w-[794px] min-h-[1040px] bg-white text-[#1D1D1F] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] rounded-[4px] overflow-hidden flex flex-col justify-between ${
          isEditorial ? 'font-serif' : ''
        }`}
      >
        <div>
          {isExecutive ? (
            <div
              style={{ backgroundColor: brand.accentColor }}
              className="px-10 py-7 text-white flex items-start justify-between gap-6"
            >
              <div className="flex items-center gap-4">
                <BrandMonogram brand={brand} size={44} inverted />
                <div>
                  <h2 className="font-display font-semibold text-[19px] tracking-[-0.02em]">
                    {receipt.seller.legalName}
                  </h2>
                  <p className="text-[11.5px] text-white/80 mt-0.5 font-mono">
                    {receipt.seller.gstin ? `GSTIN ${receipt.seller.gstin}` : ''}
                    {receipt.seller.pan ? ` · PAN ${receipt.seller.pan}` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-[18px] tracking-[0.04em]">
                  PAYMENT RECEIPT
                </p>
                <p className="font-mono text-[12.5px] text-white/90 mt-1">
                  # {receipt.receiptNumber}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-10 pt-9 pb-6">
              {isEditorial && (
                <div style={{ backgroundColor: brand.accentColor }} className="h-[3px] w-full mb-6" />
              )}
              <div className="flex items-start justify-between gap-6 pb-6 border-b border-black/[0.08]">
                <div className="flex items-center gap-3.5">
                  <BrandMonogram brand={brand} size={42} />
                  <div>
                    <h2 className="font-display font-semibold text-[18px] tracking-[-0.02em]">
                      {receipt.seller.legalName}
                    </h2>
                    <p className="text-[11.5px] text-[#6E6E73] mt-0.5 font-mono">
                      {receipt.seller.gstin ? `GSTIN: ${receipt.seller.gstin}` : ''}
                      {receipt.seller.pan ? ` · PAN: ${receipt.seller.pan}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    style={{ color: brand.accentColor }}
                    className="font-display font-bold text-[19px] tracking-[0.03em]"
                  >
                    PAYMENT RECEIPT
                  </p>
                  <p className="font-mono text-[12.5px] font-medium text-[#1D1D1F] mt-1">
                    # {receipt.receiptNumber}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={`px-10 ${isExecutive ? 'pt-7' : 'pt-1'} pb-8 space-y-7`}>
            {/* Amount Highlight Band */}
            <div className="rounded-xl bg-[#F8F8FA] border border-black/[0.08] p-5 flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[#86868B]">
                  Amount Received
                </p>
                <p
                  style={{ color: brand.accentColor }}
                  className="font-display font-bold text-[28px] tracking-[-0.02em] tabular-nums mt-1"
                >
                  {formatMoney(receipt.amountReceived, receipt.currency)}
                </p>
              </div>
              <div className="text-right space-y-1 text-[12px]">
                <p className="text-[#424245]">
                  <span className="text-[#86868B] mr-2">Receipt Date:</span>
                  <span className="font-medium text-[#1D1D1F] tabular-nums">
                    {receipt.receiptDate}
                  </span>
                </p>
                <p className="text-[#424245]">
                  <span className="text-[#86868B] mr-2">Payment Mode:</span>
                  <span className="font-medium text-[#1D1D1F]">{receipt.paymentMode}</span>
                </p>
                {receipt.referenceNumber && (
                  <p className="font-mono text-[11px] text-[#6E6E73]">
                    Ref: {receipt.referenceNumber}
                  </p>
                )}
              </div>
            </div>

            {/* Recipient & Supplier Details */}
            <div className="grid grid-cols-2 gap-8 text-[12px]">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#86868B] mb-1.5">
                  Received From (Recipient)
                </p>
                <p className="font-semibold text-[13.5px] text-[#1D1D1F]">
                  {receipt.recipient.legalName || 'Recipient Legal Name'}
                </p>
                <p className="text-[#6E6E73] leading-relaxed">
                  {receipt.recipient.address}, {receipt.recipient.city}, {receipt.recipient.stateName} ({receipt.recipient.stateCode}) - {receipt.recipient.pincode}
                </p>
                <p className="font-mono text-[11px] text-[#1D1D1F] pt-0.5">
                  GSTIN: {receipt.recipient.gstin || 'Unregistered'}
                  {receipt.recipient.pan ? ` · PAN: ${receipt.recipient.pan}` : ''}
                </p>
                {receipt.recipient.email && (
                  <p className="text-[#6E6E73]">
                    {receipt.recipient.email}
                    {receipt.recipient.phone ? ` · ${receipt.recipient.phone}` : ''}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#86868B] mb-1.5">
                  Issued By (Supplier)
                </p>
                <p className="font-semibold text-[13.5px] text-[#1D1D1F]">
                  {receipt.seller.legalName}
                </p>
                <p className="text-[#6E6E73] leading-relaxed">
                  {receipt.seller.address}, {receipt.seller.city}, {receipt.seller.stateName} ({receipt.seller.stateCode}) - {receipt.seller.pincode}
                </p>
                <p className="text-[#6E6E73] pt-0.5">
                  {receipt.seller.email}
                  {receipt.seller.phone ? ` · ${receipt.seller.phone}` : ''}
                </p>
              </div>
            </div>

            {/* Allocation Table */}
            <div className="border border-black/[0.08] rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    style={{ backgroundColor: brand.accentColor }}
                    className="text-white text-[10.5px] font-semibold tracking-[0.04em] uppercase"
                  >
                    <th className="py-2.5 px-4">Particulars</th>
                    <th className="py-2.5 px-4">Reference</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-[12.5px]">
                  <tr className="bg-white">
                    <td className="py-3 px-4 text-[#424245]">Linked Invoice Total</td>
                    <td className="py-3 px-4 font-mono text-[11.5px] text-[#6E6E73]">
                      {receipt.linkedInvoiceNumber || 'On-Account'}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#1D1D1F]">
                      {formatMoney(receipt.invoiceTotal, receipt.currency)}
                    </td>
                  </tr>
                  <tr className="bg-[#FAFAFC]">
                    <td className="py-3 px-4 font-semibold text-[#1D1D1F]">Amount Received Now</td>
                    <td className="py-3 px-4 text-[12px] text-[#6E6E73]">
                      {receipt.paymentMode}
                      {receipt.referenceNumber ? ` · ${receipt.referenceNumber}` : ''}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-[#1D1D1F]">
                      {formatMoney(receipt.amountReceived, receipt.currency)}
                    </td>
                  </tr>
                  {receipt.tdsDeducted > 0 && (
                    <tr className="bg-white">
                      <td className="py-3 px-4 text-[#424245]">TDS Deducted</td>
                      <td className="py-3 px-4 text-[12px] text-[#6E6E73]">Tax Withheld</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#1D1D1F]">
                        {formatMoney(receipt.tdsDeducted, receipt.currency)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-white">
                    <td className="py-3 px-4 text-[#424245]">Balance Remaining</td>
                    <td className="py-3 px-4 text-[12px] text-[#6E6E73]">
                      {balanceDue === 0 ? 'Settled in Full' : 'Outstanding'}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-[#1D1D1F]">
                      {formatMoney(balanceDue, receipt.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {receipt.linkedIrn && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#86868B]">
                  Linked Invoice IRN
                </p>
                <p className="font-mono text-[11px] text-[#424245] break-all">
                  {receipt.linkedIrn}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#86868B]">
                Amount Received in Words
              </p>
              <p className="text-[13px] font-medium text-[#1D1D1F]">
                {numberToCurrencyWords(receipt.amountReceived, receipt.currency)}
              </p>
            </div>

            <div className="pt-3 border-t border-black/[0.06] text-[12px] text-[#424245] space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#86868B]">
                Credited Settlement Bank
              </p>
              <p>
                {receipt.bank.bankName} — {receipt.bank.branch} · A/C {receipt.bank.accountNumber} · IFSC {receipt.bank.ifscCode}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 pb-8 pt-4 border-t border-black/[0.06] flex items-end justify-between gap-8">
          <div className="max-w-md space-y-1">
            {receipt.remarks && (
              <>
                <p className="text-[9.5px] font-semibold tracking-[0.08em] uppercase text-[#86868B]">
                  Remarks
                </p>
                <p className="text-[11.5px] text-[#424245] leading-relaxed">{receipt.remarks}</p>
              </>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10.5px] text-[#6E6E73] mb-2">For {receipt.seller.legalName}</p>
            <div className="h-12 flex items-end justify-end mb-1.5">
              {brand.signatureDataUrl && (
                <img
                  src={brand.signatureDataUrl}
                  alt="Authorized Signature"
                  className="max-h-12 max-w-[140px] object-contain"
                />
              )}
            </div>
            <div className="border-t border-black/20 pt-1.5 min-w-[150px]">
              <p className="text-[12px] font-semibold text-[#1D1D1F]">
                {brand.signatoryName || 'Authorized Signatory'}
              </p>
              <p className="text-[10.5px] text-[#6E6E73]">
                {brand.signatoryTitle || 'Authorized Signatory'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="h-full flex flex-col lg:grid lg:grid-cols-12 overflow-hidden">
      {/* Left: Receipt Builder Form + Saved Receipts List */}
      <div className="lg:col-span-5 h-full flex flex-col bg-white border-r border-black/[0.07] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-black/[0.06] flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="font-display font-semibold text-[15px] text-[#1D1D1F]">
              Receipt Maker
            </h2>
            <p className="text-[11.5px] text-[#86868B]">
              Pick a recipient from Master or link an invoice
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onNewReceipt}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F5F5F7] text-[12px] font-medium text-[#1D1D1F] hover:bg-[#E8E8ED] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-black/[0.1] bg-white text-[12px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] cursor-pointer"
            >
              {savedToast || isSaved ? (
                <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Bookmark className="w-3.5 h-3.5 text-[#6E6E73]" />
              )}
              <span>{savedToast ? 'Saved' : isSaved ? 'Update' : 'Save'}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick Pickers: Recipient Master & Linked Invoice */}
          <div className="p-3.5 rounded-xl bg-[#FAFAFC] border border-black/[0.07] space-y-3">
            <div>
              <label className={LABEL_CLASS}>Select from Recipient Master</label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleSelectRecipient(e.target.value);
                }}
                className={INPUT_CLASS}
              >
                <option value="">Choose saved recipient to auto-fill…</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.legalName} ({r.gstin || 'Unregistered'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Link Invoice from Ledger (Optional)</label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleLinkInvoice(e.target.value);
                }}
                className={INPUT_CLASS}
              >
                <option value="">Link an existing invoice &amp; IRN…</option>
                {invoices.map((inv) => {
                  const { totals } = computeInvoice(inv);
                  return (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.buyer.legalName} ({formatMoney(totals.grandTotal, inv.currency)})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Core Receipt Fields */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={LABEL_CLASS}>Receipt Number</label>
              <input
                type="text"
                value={receipt.receiptNumber}
                onChange={(e) => onChange({ ...receipt, receiptNumber: e.target.value })}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Receipt Date</label>
              <input
                type="date"
                value={receipt.receiptDate}
                onChange={(e) => onChange({ ...receipt, receiptDate: e.target.value })}
                className={`${INPUT_CLASS} tabular-nums`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={LABEL_CLASS}>Payment Mode</label>
              <select
                value={receipt.paymentMode}
                onChange={(e) =>
                  onChange({ ...receipt, paymentMode: e.target.value as PaymentMode })
                }
                className={INPUT_CLASS}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>UTR / Cheque / Ref No.</label>
              <input
                type="text"
                value={receipt.referenceNumber}
                onChange={(e) => onChange({ ...receipt, referenceNumber: e.target.value })}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLASS}>Currency</label>
              <select
                value={receipt.currency}
                onChange={(e) =>
                  onChange({ ...receipt, currency: e.target.value as CurrencyCode })
                }
                className={INPUT_CLASS}
              >
                {Object.entries(CURRENCY_CONFIG).map(([code, cfg]) => (
                  <option key={code} value={code}>
                    {code} ({cfg.symbol.trim()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Invoice Total</label>
              <input
                type="number"
                min="0"
                step="any"
                value={receipt.invoiceTotal}
                onChange={(e) =>
                  onChange({ ...receipt, invoiceTotal: parseFloat(e.target.value) || 0 })
                }
                className={`${INPUT_CLASS} tabular-nums text-right`}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>TDS Deducted</label>
              <input
                type="number"
                min="0"
                step="any"
                value={receipt.tdsDeducted}
                onChange={(e) =>
                  onChange({ ...receipt, tdsDeducted: parseFloat(e.target.value) || 0 })
                }
                className={`${INPUT_CLASS} tabular-nums text-right`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={LABEL_CLASS}>Amount Received Now</label>
              <input
                type="number"
                min="0"
                step="any"
                value={receipt.amountReceived}
                onChange={(e) =>
                  onChange({ ...receipt, amountReceived: parseFloat(e.target.value) || 0 })
                }
                className={`${INPUT_CLASS} tabular-nums text-right font-semibold`}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Linked Invoice No.</label>
              <input
                type="text"
                value={receipt.linkedInvoiceNumber}
                onChange={(e) => onChange({ ...receipt, linkedInvoiceNumber: e.target.value })}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>

          {/* Recipient Full Details */}
          <div className="pt-3 border-t border-black/[0.06] space-y-3">
            <p className="text-[12px] font-semibold text-[#1D1D1F]">Recipient Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Legal Name</label>
                <input
                  type="text"
                  value={receipt.recipient.legalName}
                  onChange={(e) =>
                    onChange({
                      ...receipt,
                      recipient: { ...receipt.recipient, legalName: e.target.value },
                    })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>GSTIN</label>
                <input
                  type="text"
                  value={receipt.recipient.gstin}
                  onChange={(e) =>
                    onChange({
                      ...receipt,
                      recipient: { ...receipt.recipient, gstin: e.target.value.toUpperCase() },
                    })
                  }
                  className={`${INPUT_CLASS} font-mono uppercase`}
                />
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>Address</label>
              <input
                type="text"
                value={receipt.recipient.address}
                onChange={(e) =>
                  onChange({
                    ...receipt,
                    recipient: { ...receipt.recipient, address: e.target.value },
                  })
                }
                className={INPUT_CLASS}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LABEL_CLASS}>City</label>
                <input
                  type="text"
                  value={receipt.recipient.city}
                  onChange={(e) =>
                    onChange({
                      ...receipt,
                      recipient: { ...receipt.recipient, city: e.target.value },
                    })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>State</label>
                <select
                  value={receipt.recipient.stateCode}
                  onChange={(e) => {
                    const st = INDIAN_STATES.find((s) => s.code === e.target.value);
                    if (st) {
                      onChange({
                        ...receipt,
                        recipient: { ...receipt.recipient, stateCode: st.code, stateName: st.name },
                      });
                    }
                  }}
                  className={INPUT_CLASS}
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.code} — {st.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Email</label>
                <input
                  type="email"
                  value={receipt.recipient.email}
                  onChange={(e) =>
                    onChange({
                      ...receipt,
                      recipient: { ...receipt.recipient, email: e.target.value },
                    })
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Remarks</label>
            <textarea
              rows={2}
              value={receipt.remarks}
              onChange={(e) => onChange({ ...receipt, remarks: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          {/* Saved Receipts History */}
          {savedReceipts.length > 0 && (
            <div className="pt-3 border-t border-black/[0.06] space-y-2">
              <p className="text-[12px] font-semibold text-[#1D1D1F]">
                Saved Receipts ({savedReceipts.length})
              </p>
              <div className="space-y-1.5">
                {savedReceipts.map((sr) => (
                  <div
                    key={sr.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-[12px] transition-colors ${
                      sr.id === receipt.id
                        ? 'border-[#1D1D1F] bg-[#FAFAFC]'
                        : 'border-black/[0.07] bg-white hover:bg-[#FAFAFC]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onChange(sr)}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <p className="font-mono font-medium text-[#1D1D1F] truncate">
                        {sr.receiptNumber} · {formatMoney(sr.amountReceived, sr.currency)}
                      </p>
                      <p className="text-[11px] text-[#6E6E73] truncate">
                        {sr.recipient.legalName} · {sr.receiptDate}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => exportReceiptPdf(sr, brand)}
                        title="Download Receipt PDF"
                        className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#0071E3] hover:bg-[#0071E3]/10 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteReceipt(sr.id)}
                        title="Delete Receipt"
                        className="p-1.5 rounded-lg text-[#6E6E73] hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Live A4 Receipt Preview */}
      <div className="lg:col-span-7 h-full flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white/80 backdrop-blur-md border-b border-black/[0.06] shrink-0">
          <span className="text-[12px] font-medium text-[#6E6E73]">Receipt Preview</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}
              aria-label="Zoom out"
              className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.04] cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11.5px] text-[#6E6E73] w-11 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.15, +(z + 0.1).toFixed(2)))}
              aria-label="Zoom in"
              className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.04] cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.1] bg-white text-[12px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] cursor-pointer ml-1"
            >
              <Eye className="w-3.5 h-3.5 text-[#6E6E73]" />
              <span>Preview</span>
            </button>

            <button
              type="button"
              onClick={() => exportReceiptPdf(receipt, brand)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1D1D1F] text-white text-[12px] font-medium hover:bg-[#333336] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5 lg:p-8 flex justify-center items-start bg-[#F5F5F7]">
          {renderPaper(zoom)}
        </div>
      </div>

      {/* Full-Screen Receipt Preview Modal */}
      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
            onClick={() => setPreviewOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[1000px] h-[90vh] bg-[#F5F5F7] rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col"
            >
              <div className="px-5 py-3.5 bg-white border-b border-black/[0.08] flex items-center justify-between gap-4 shrink-0">
                <div>
                  <p className="font-display font-semibold text-[15px] text-[#1D1D1F]">
                    Receipt Preview · <span className="font-mono">{receipt.receiptNumber}</span>
                  </p>
                  <p className="text-[12px] text-[#6E6E73]">
                    {receipt.recipient.legalName} · {receipt.receiptDate}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="p-2 rounded-xl border border-black/[0.1] bg-white text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => exportReceiptPdf(receipt, brand)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1D1D1F] text-white text-[12.5px] font-medium hover:bg-[#333336] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    className="p-2 rounded-xl text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 flex justify-center items-start">
                {renderPaper(0.92)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
