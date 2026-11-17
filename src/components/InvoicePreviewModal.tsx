import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Loader2, Printer, ShieldCheck, X } from 'lucide-react';
import { BrandProfile, InvoiceData } from '../types/invoice';
import { InvoicePreview } from './InvoicePreview';

interface InvoicePreviewModalProps {
  invoice: InvoiceData | null;
  brand: BrandProfile;
  onClose: () => void;
  onExportPdf: (inv: InvoiceData) => void;
  onGenerateIrn?: (inv: InvoiceData) => Promise<void>;
  irnLoading?: boolean;
  irnError?: string | null;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  invoice,
  brand,
  onClose,
  onExportPdf,
  onGenerateIrn,
  irnLoading = false,
  irnError = null,
}) => {
  return (
    <AnimatePresence>
      {invoice && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[1040px] h-[92vh] bg-[#F5F5F7] rounded-2xl shadow-[0_32px_80px_-12px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.12)] overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-white/95 backdrop-blur-md border-b border-black/[0.08] flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <p className="font-display font-semibold text-[15px] text-[#1D1D1F] truncate">
                  Invoice Preview · <span className="font-mono">{invoice.invoiceNumber}</span>
                </p>
                <p className="text-[12px] text-[#6E6E73] truncate">
                  {invoice.buyer.legalName} · {invoice.issueDate}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onGenerateIrn && !invoice.cancelledAt && (
                  <button
                    type="button"
                    onClick={() => onGenerateIrn(invoice)}
                    disabled={irnLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F5F7] text-[12.5px] font-medium text-[#1D1D1F] hover:bg-[#E8E8ED] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
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
                      {irnLoading
                        ? 'Issuing IRN…'
                        : invoice.irn
                        ? 'Re-issue IRN'
                        : 'Generate IRN'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  title="Print Invoice"
                  className="hidden sm:inline-flex items-center justify-center p-2 rounded-xl border border-black/[0.1] bg-white text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onExportPdf(invoice)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1D1D1F] text-white text-[12.5px] font-medium hover:bg-[#333336] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close preview"
                  className="p-2 rounded-xl text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {irnError && (
              <div
                role="alert"
                className="px-5 py-2.5 bg-red-50 border-b border-red-200/80 text-[12.5px] text-red-900 shrink-0"
              >
                {irnError}
              </div>
            )}

            {/* Live A4 Preview Body */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <InvoicePreview
                invoice={invoice}
                brand={brand}
                onRegenerateIrn={onGenerateIrn ? () => onGenerateIrn(invoice) : undefined}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
