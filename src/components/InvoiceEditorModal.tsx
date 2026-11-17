import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { BrandProfile, InvoiceData, RecipientRecord } from '../types/invoice';
import { computeInvoice, formatMoney } from '../utils/invoiceMath';
import { exportInvoicePdf } from '../utils/pdfExporter';
import { InvoiceForm } from './InvoiceForm';
import { InvoicePreviewModal } from './InvoicePreviewModal';

interface InvoiceEditorModalProps {
  invoice: InvoiceData | null;
  brand: BrandProfile;
  isNew: boolean;
  recipients: RecipientRecord[];
  onClose: () => void;
  onChange: (updated: InvoiceData) => void;
  onSave: (invoice: InvoiceData) => void;
  onGenerateIrn: (invoice: InvoiceData) => Promise<InvoiceData>;
  onSaveToRecipientMaster: (buyer: InvoiceData['buyer']) => void;
}

export const InvoiceEditorModal: React.FC<InvoiceEditorModalProps> = ({
  invoice,
  brand,
  isNew,
  recipients,
  onClose,
  onChange,
  onSave,
  onGenerateIrn,
  onSaveToRecipientMaster,
}) => {
  const [irnLoading, setIrnLoading] = useState(false);
  const [irnError, setIrnError] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  if (!invoice) return null;

  const { totals } = computeInvoice(invoice);

  const handleIrn = async () => {
    setIrnLoading(true);
    setIrnError(null);
    try {
      const updated = await onGenerateIrn(invoice);
      onChange(updated);
      setPreviewModalOpen(true);
    } catch (err) {
      setIrnError(err instanceof Error ? err.message : 'Could not generate the IRN.');
    } finally {
      setIrnLoading(false);
    }
  };

  const handleSaveAndClose = () => {
    onSave(invoice);
    onClose();
  };

  return (
    <div className="h-full flex flex-col bg-[#FBFBFD]">
          {/* Page Header */}
          <div className="px-4 sm:px-6 py-3.5 bg-white border-b border-black/[0.07] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to ledger"
                title="Back to ledger"
                className="p-1.5 -ml-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="font-display font-semibold text-[16px] text-[#1D1D1F] whitespace-nowrap">
                {isNew ? 'New Invoice' : 'Edit Invoice'}
              </h2>
              <span className="font-mono text-[12.5px] text-[#6E6E73] truncate">
                {invoice.invoiceNumber}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.1] bg-white text-[12.5px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-[#6E6E73]" />
                <span>Preview</span>
              </button>

              <button
                type="button"
                onClick={handleIrn}
                disabled={irnLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F5F7] text-[12.5px] font-medium text-[#1D1D1F] hover:bg-[#E8E8ED] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {irnLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0071E3]" />
                ) : (
                  <ShieldCheck
                    className={`w-3.5 h-3.5 ${
                      invoice.irn ? 'text-emerald-600' : 'text-[#1D1D1F]'
                    }`}
                  />
                )}
                <span>
                  {irnLoading ? 'Issuing IRN…' : invoice.irn ? 'Re-issue IRN' : 'Generate IRN'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => exportInvoicePdf(invoice, brand)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.1] bg-white text-[12.5px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndClose}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1D1D1F] text-white text-[12.5px] font-medium hover:bg-[#333336] transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save to Ledger</span>
              </button>
            </div>
          </div>

          {irnError && !previewModalOpen && (
            <div
              role="alert"
              className="px-4 sm:px-6 py-2.5 bg-red-50 border-b border-red-200/80 flex items-start justify-between gap-3 text-[12.5px] text-red-900 shrink-0"
            >
              <span>{irnError}</span>
              <button
                type="button"
                onClick={() => setIrnError(null)}
                className="font-medium underline shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Form Body — the A4 preview opens only from the Preview button */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-[980px] mx-auto my-0 lg:my-6 bg-white lg:rounded-2xl lg:border border-black/[0.08] overflow-hidden">
              <InvoiceForm
                invoice={invoice}
                onChange={onChange}
                recipients={recipients}
                onSaveToRecipientMaster={onSaveToRecipientMaster}
              />
              </div>
            </div>

            <div className="shrink-0 px-5 py-3 bg-[#FAFAFC] border-t border-black/[0.07] flex items-center justify-between gap-4">
              <div className="text-[12px] text-[#6E6E73] tabular-nums">
                <span>Taxable {formatMoney(totals.taxableTotal, invoice.currency)}</span>
                <span className="mx-1.5">·</span>
                <span>
                  {totals.isIntraState ? 'CGST+SGST' : 'IGST'}{' '}
                  {formatMoney(totals.taxTotal, invoice.currency)}
                </span>
              </div>
              <span className="font-display font-bold text-[15px] text-[#1D1D1F] tabular-nums">
                {formatMoney(totals.grandTotal, invoice.currency)}
              </span>
            </div>
          </div>

        <InvoicePreviewModal
          invoice={previewModalOpen ? invoice : null}
          brand={brand}
          onClose={() => setPreviewModalOpen(false)}
          onExportPdf={(inv) => exportInvoicePdf(inv, brand)}
          onGenerateIrn={handleIrn}
          irnLoading={irnLoading}
          irnError={irnError}
        />
    </div>
  );
};
