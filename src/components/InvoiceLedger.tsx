import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Search,
  Download,
  ShieldCheck,
  Edit3,
  FileText,
  Files,
  Plus,
  Eye,
  Ban,
} from 'lucide-react';
import { BrandProfile, InvoiceData } from '../types/invoice';
import { computeInvoice, formatMoney } from '../utils/invoiceMath';
import { exportBatchInvoicesPdf, exportInvoicePdf } from '../utils/pdfExporter';
import { InvoicePreviewModal } from './InvoicePreviewModal';

interface InvoiceLedgerProps {
  invoices: InvoiceData[];
  brand: BrandProfile;
  onOpenInStudio: (invoice: InvoiceData) => void;
  onCancel: (id: string) => void;
  onGenerateIrn: (id: string) => Promise<void>;
  onCreateNew: () => void;
}

type StatusFilter = 'all' | 'verified' | 'draft' | 'cancelled';

export const InvoiceLedger: React.FC<InvoiceLedgerProps> = ({
  invoices,
  brand,
  onOpenInStudio,
  onCancel,
  onGenerateIrn,
  onCreateNew,
}) => {
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [irnError, setIrnError] = useState<{ id: string; message: string } | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkIrnRunning, setBulkIrnRunning] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      const cancelled = Boolean(inv.cancelledAt);
      if (filter === 'verified' && (cancelled || !inv.irn)) return false;
      if (filter === 'draft' && (cancelled || inv.irn)) return false;
      if (filter === 'cancelled' && !cancelled) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.buyer.legalName.toLowerCase().includes(q) ||
        inv.buyer.gstin.toLowerCase().includes(q) ||
        (inv.irn?.irn.toLowerCase().includes(q) ?? false)
      );
    });
  }, [invoices, query, filter]);

  const totalValue = useMemo(
    () =>
      filtered.reduce((sum, inv) => {
        if (inv.cancelledAt) return sum;
        const { totals } = computeInvoice(inv);
        return sum + totals.grandTotal;
      }, 0),
    [filtered]
  );

  // Selection only ever applies to rows currently visible in the list.
  const selected = filtered.filter((inv) => selectedIds.has(inv.id));
  const allSelected = filtered.length > 0 && selected.length === filtered.length;
  const selectedDrafts = selected.filter((inv) => !inv.irn && !inv.cancelledAt);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((inv) => inv.id)));
  };

  const handleBulkIrn = async () => {
    setBulkIrnRunning(true);
    setIrnError(null);
    const failures: string[] = [];
    for (const inv of selectedDrafts) {
      setGeneratingId(inv.id);
      try {
        await onGenerateIrn(inv.id);
      } catch (err) {
        failures.push(
          `${inv.invoiceNumber}: ${err instanceof Error ? err.message : 'Could not generate the IRN.'}`
        );
      }
    }
    setGeneratingId(null);
    setBulkIrnRunning(false);
    if (failures.length > 0) {
      setIrnError({ id: 'bulk', message: `IRN failed for ${failures.join('; ')}` });
    }
  };

  const cancelTarget = invoices.find((i) => i.id === cancelTargetId) ?? null;

  const handleIrnClick = async (id: string) => {
    setGeneratingId(id);
    setIrnError(null);
    try {
      await onGenerateIrn(id);
      setPreviewInvoiceId(id);
    } catch (err) {
      setIrnError({
        id,
        message: err instanceof Error ? err.message : 'Could not generate the IRN.',
      });
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-7">
      {irnError && irnError.id !== previewInvoiceId && (
        <div
          role="alert"
          className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200/80 flex items-start justify-between gap-3 text-[12.5px] text-red-900"
        >
          <span>{irnError.message}</span>
          <button
            type="button"
            onClick={() => setIrnError(null)}
            className="font-medium underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[26px] tracking-[-0.025em] text-[#1D1D1F]">
            Invoice Ledger
          </h1>
          <p className="text-[14px] text-[#6E6E73] mt-1 tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'document' : 'documents'} · Aggregate value{' '}
            <span className="font-medium text-[#1D1D1F]">
              {formatMoney(totalValue, filtered[0]?.currency || 'INR')}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={() => exportBatchInvoicesPdf(filtered, brand)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-black/[0.1] text-[13px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Files className="w-4 h-4 text-[#6E6E73]" />
              <span>Export All PDF ({filtered.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D1D1F] text-white text-[13px] font-medium hover:bg-[#333336] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      {/* Search & Segmented Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by invoice #, buyer, GSTIN, or IRN hash…"
            className="w-full pl-10 pr-4 py-2 text-[13px] bg-white border border-black/[0.09] rounded-xl text-[#1D1D1F] placeholder:text-[#A1A1A6] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/15 transition-all"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F0F0F3] rounded-xl">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'verified', label: 'IRN Verified' },
              { id: 'draft', label: 'Pending IRN' },
              { id: 'cancelled', label: 'Cancelled' },
            ] as { id: StatusFilter; label: string }[]
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`relative px-3.5 py-1.5 text-[12.5px] font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active ? 'text-[#1D1D1F]' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="ledger-filter-pill"
                    transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                    className="absolute inset-0 bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk Actions for Selected Invoices */}
      {selected.length > 0 && (
        <div className="px-4 py-2.5 rounded-xl bg-[#1D1D1F] text-white flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <span className="font-medium">
            {selected.length} invoice{selected.length === 1 ? '' : 's'} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportBatchInvoicesPdf(selected, brand)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#1D1D1F] text-[12.5px] font-medium hover:bg-[#F5F5F7] transition-colors cursor-pointer"
            >
              <Files className="w-3.5 h-3.5" />
              <span>Export PDF ({selected.length})</span>
            </button>
            <button
              type="button"
              onClick={handleBulkIrn}
              disabled={selectedDrafts.length === 0 || bulkIrnRunning}
              title={
                selectedDrafts.length === 0
                  ? 'None of the selected invoices is awaiting an IRN'
                  : undefined
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 text-white text-[12.5px] font-medium hover:bg-white/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {bulkIrnRunning ? 'Generating…' : `Generate IRN (${selectedDrafts.length})`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Ledger Table or Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/[0.08] py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] mx-auto flex items-center justify-center mb-4">
            <FileText className="w-5 h-5 text-[#6E6E73]" />
          </div>
          <h3 className="font-display font-semibold text-[16px] text-[#1D1D1F]">
            {invoices.length === 0 ? 'No invoices saved yet' : 'No matching invoices'}
          </h3>
          <p className="text-[13.5px] text-[#6E6E73] mt-1.5 max-w-md mx-auto">
            {invoices.length === 0
              ? 'Create your first invoice to generate an IRN and export GST e-Invoice PDFs.'
              : 'Try adjusting your search query or status filter.'}
          </p>
          {invoices.length === 0 && (
            <button
              type="button"
              onClick={onCreateNew}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D1D1F] text-white text-[13px] font-medium hover:bg-[#333336] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Invoice</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.06] bg-[#FAFAFC] text-[11.5px] font-medium text-[#6E6E73]">
                  <th className="py-3 pl-4 pr-1 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = selected.length > 0 && !allSelected;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Select all invoices"
                      className="w-4 h-4 align-middle accent-[#1D1D1F] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">IRN Reference</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-[13px]">
                {filtered.map((inv) => {
                  const { totals } = computeInvoice(inv);
                  const cancelled = Boolean(inv.cancelledAt);
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => (cancelled ? setPreviewInvoiceId(inv.id) : onOpenInStudio(inv))}
                      title={cancelled ? 'Preview cancelled invoice' : 'Open invoice'}
                      className={`transition-colors cursor-pointer ${
                        selectedIds.has(inv.id) ? 'bg-[#F5F5F7]' : 'hover:bg-[#FAFAFC]'
                      }`}
                    >
                      <td
                        className="py-3 pl-4 pr-1 w-8 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(inv.id)}
                          onChange={() => toggleSelected(inv.id)}
                          aria-label={`Select invoice ${inv.invoiceNumber}`}
                          className="w-4 h-4 align-middle accent-[#1D1D1F] cursor-pointer"
                        />
                      </td>
                      <td
                        className={`py-3 px-4 font-mono font-medium whitespace-nowrap ${
                          cancelled ? 'text-[#86868B] line-through' : 'text-[#1D1D1F]'
                        }`}
                      >
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-[#6E6E73] tabular-nums whitespace-nowrap">
                        {inv.issueDate}
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        <p className="text-[#1D1D1F] font-medium truncate">
                          {inv.buyer.legalName}
                        </p>
                        <p className="font-mono text-[11px] text-[#86868B] truncate">
                          {inv.buyer.gstin || 'Unregistered'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-[12px] text-[#6E6E73] capitalize whitespace-nowrap">
                        {inv.source}
                      </td>
                      <td
                        className={`py-3 px-4 text-right tabular-nums font-semibold whitespace-nowrap ${
                          cancelled ? 'text-[#86868B] line-through' : 'text-[#1D1D1F]'
                        }`}
                      >
                        {formatMoney(totals.grandTotal, inv.currency)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {cancelled ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[12px] font-medium text-red-700">
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancelled</span>
                            </div>
                            {inv.irn && (
                              <p className="font-mono text-[10.5px] text-[#86868B]">
                                IRN {inv.irn.irn.slice(0, 12)}… cancelled
                              </p>
                            )}
                          </div>
                        ) : inv.irn ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span className="font-mono">{inv.irn.irn.slice(0, 12)}…</span>
                            </div>
                            <p className="font-mono text-[10.5px] text-[#86868B]">
                              Ack {inv.irn.ackNo}
                            </p>
                            {!!inv.cancelledIrns?.length && (
                              <p className="text-[10.5px] text-[#86868B]">
                                {inv.cancelledIrns.length} earlier IRN
                                {inv.cancelledIrns.length > 1 ? 's' : ''} cancelled
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleIrnClick(inv.id);
                            }}
                            disabled={generatingId === inv.id}
                            className="text-[12px] font-medium text-[#0071E3] hover:underline cursor-pointer disabled:opacity-50"
                          >
                            {generatingId === inv.id ? 'Generating…' : 'Generate IRN'}
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewInvoiceId(inv.id)}
                            title="Preview Invoice"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#E8E8ED] transition-colors cursor-pointer mr-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                          {!cancelled && (
                            <button
                              type="button"
                              onClick={() => onOpenInStudio(inv)}
                              title="Edit Invoice"
                              className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => exportInvoicePdf(inv, brand)}
                            title="Download Branded PDF"
                            className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#0071E3] hover:bg-[#0071E3]/10 transition-colors cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {!cancelled && (
                            <button
                              type="button"
                              onClick={() => setCancelTargetId(inv.id)}
                              title="Cancel Invoice"
                              className="p-1.5 rounded-lg text-[#6E6E73] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {cancelTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
            onClick={() => setCancelTargetId(null)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="cancel-invoice-title"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_32px_80px_-12px_rgba(0,0,0,0.35)] p-6"
            >
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                <Ban className="w-5 h-5 text-red-600" />
              </div>
              <h3
                id="cancel-invoice-title"
                className="font-display font-semibold text-[16px] text-[#1D1D1F]"
              >
                Do you want to cancel this invoice?
              </h3>
              <p className="text-[13px] text-[#6E6E73] mt-1.5">
                Invoice <span className="font-mono text-[#1D1D1F]">{cancelTarget.invoiceNumber}</span>{' '}
                for {cancelTarget.buyer.legalName} will be marked cancelled
                {cancelTarget.irn ? ', along with its IRN' : ''}. This cannot be undone, and the
                invoice number cannot be used again.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setCancelTargetId(null)}
                  className="px-4 py-1.5 rounded-xl border border-black/[0.1] bg-white text-[12.5px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
                >
                  No, keep it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCancel(cancelTarget.id);
                    setCancelTargetId(null);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-[12.5px] font-medium hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Yes, cancel invoice
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <InvoicePreviewModal
        invoice={invoices.find((i) => i.id === previewInvoiceId) ?? null}
        brand={brand}
        onClose={() => {
          setPreviewInvoiceId(null);
          setIrnError(null);
        }}
        onExportPdf={(inv) => exportInvoicePdf(inv, brand)}
        onGenerateIrn={(inv) => handleIrnClick(inv.id)}
        irnLoading={generatingId !== null && generatingId === previewInvoiceId}
        irnError={irnError && irnError.id === previewInvoiceId ? irnError.message : null}
      />
    </div>
  );
};
