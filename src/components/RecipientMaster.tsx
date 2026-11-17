import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  FileText,
  Receipt,
  CheckCircle2,
  AlertCircle,
  X,
  Building2,
} from 'lucide-react';
import { INDIAN_STATES } from '../data/presets';
import { RecipientRecord } from '../types/invoice';
import { validateGstin } from '../utils/invoiceMath';

interface RecipientMasterProps {
  recipients: RecipientRecord[];
  onSaveRecipient: (record: RecipientRecord) => void;
  onDeleteRecipient: (id: string) => void;
  onCreateInvoiceForRecipient: (recipient: RecipientRecord) => void;
  onCreateReceiptForRecipient: (recipient: RecipientRecord) => void;
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-[13px] bg-white border border-black/[0.1] rounded-lg text-[#1D1D1F] placeholder:text-[#A1A1A6] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/15 transition-all';

const LABEL_CLASS = 'block text-[11.5px] font-medium text-[#6E6E73] mb-1.5';

function createEmptyRecipient(): RecipientRecord {
  const now = new Date().toISOString();
  return {
    id: `rcp-${Date.now()}`,
    legalName: '',
    tradeName: '',
    gstin: '',
    pan: '',
    address: '',
    city: '',
    stateCode: '27',
    stateName: 'Maharashtra',
    pincode: '',
    email: '',
    phone: '',
    contactPerson: '',
    creditDays: 15,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export const RecipientMaster: React.FC<RecipientMasterProps> = ({
  recipients,
  onSaveRecipient,
  onDeleteRecipient,
  onCreateInvoiceForRecipient,
  onCreateReceiptForRecipient,
}) => {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<RecipientRecord | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        r.legalName.toLowerCase().includes(q) ||
        (r.tradeName?.toLowerCase().includes(q) ?? false) ||
        r.gstin.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
    );
  }, [recipients, query]);

  const handleGstinInput = (val: string) => {
    if (!editing) return;
    const upper = val.toUpperCase();
    const check = validateGstin(upper);
    const next = { ...editing, gstin: upper };
    if (check.valid && check.stateCode) {
      const st = INDIAN_STATES.find((s) => s.code === check.stateCode);
      if (st) {
        next.stateCode = st.code;
        next.stateName = st.name;
      }
      if (check.pan) next.pan = check.pan;
    }
    setEditing(next);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.legalName.trim()) return;
    onSaveRecipient({
      ...editing,
      updatedAt: new Date().toISOString(),
    });
    setEditing(null);
  };

  const gstCheck = editing ? validateGstin(editing.gstin) : null;

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[26px] tracking-[-0.025em] text-[#1D1D1F]">
            Recipient Master
          </h1>
          <p className="text-[14px] text-[#6E6E73] mt-1">
            Central directory of customers and consignees. Auto-fill invoices or generate complete payment receipts in one click.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditing(createEmptyRecipient())}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D1D1F] text-white text-[13px] font-medium hover:bg-[#333336] transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Recipient</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by legal name, GSTIN, city, or email…"
            className="w-full pl-10 pr-4 py-2 text-[13px] bg-white border border-black/[0.09] rounded-xl text-[#1D1D1F] placeholder:text-[#A1A1A6] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/15 transition-all"
          />
        </div>
        <span className="text-[12.5px] text-[#6E6E73] tabular-nums">
          {filtered.length} {filtered.length === 1 ? 'recipient' : 'recipients'}
        </span>
      </div>

      {/* Directory Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/[0.08] py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] mx-auto flex items-center justify-center mb-4">
            <Building2 className="w-5 h-5 text-[#6E6E73]" />
          </div>
          <h3 className="font-display font-semibold text-[16px] text-[#1D1D1F]">
            {recipients.length === 0 ? 'No recipients in Master' : 'No matching recipients'}
          </h3>
          <p className="text-[13.5px] text-[#6E6E73] mt-1.5 max-w-md mx-auto">
            Add your recurring buyers and logistics clients with GSTIN and billing details for instant invoicing and receipt generation.
          </p>
          {recipients.length === 0 && (
            <button
              type="button"
              onClick={() => setEditing(createEmptyRecipient())}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D1D1F] text-white text-[13px] font-medium hover:bg-[#333336] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Recipient</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/[0.06] bg-[#FAFAFC] text-[11.5px] font-medium text-[#6E6E73]">
                  <th className="py-3 px-4">Recipient / Entity</th>
                  <th className="py-3 px-4">GSTIN &amp; PAN</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-[13px]">
                {filtered.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => setEditing(rec)}
                    title="Open recipient"
                    className="hover:bg-[#FAFAFC] transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 max-w-[260px]">
                      <p className="font-medium text-[#1D1D1F] truncate">{rec.legalName}</p>
                      <p className="text-[11.5px] text-[#86868B] truncate">
                        {rec.contactPerson ? `${rec.contactPerson} · ` : ''}
                        {rec.creditDays ? `${rec.creditDays}d credit` : 'Standard terms'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-mono text-[12px] text-[#1D1D1F]">
                        {rec.gstin || 'Unregistered'}
                      </p>
                      {rec.pan && (
                        <p className="font-mono text-[11px] text-[#86868B]">PAN {rec.pan}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[12.5px] text-[#424245]">
                      <p>{rec.city}, {rec.stateName} ({rec.stateCode})</p>
                      <p className="text-[11px] text-[#86868B] truncate max-w-[220px]">{rec.address}</p>
                    </td>
                    <td className="py-3.5 px-4 text-[12px] text-[#6E6E73]">
                      <p>{rec.email || '—'}</p>
                      <p className="tabular-nums text-[#86868B]">{rec.phone || ''}</p>
                    </td>
                    <td
                      className="py-3.5 px-4 text-right whitespace-nowrap cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onCreateInvoiceForRecipient(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#E8E8ED] transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Invoice</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onCreateReceiptForRecipient(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium text-[#0071E3] bg-[#0071E3]/[0.08] hover:bg-[#0071E3]/[0.14] transition-colors cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Make Receipt</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(rec)}
                          title="Edit Recipient"
                          className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRecipient(rec.id)}
                          title="Delete Recipient"
                          className="p-1.5 rounded-lg text-[#6E6E73] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Recipient Modal */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditing(null)}
          >
            <motion.form
              onSubmit={handleFormSubmit}
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.22)] border border-black/[0.08] overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
                <h2 className="font-display font-semibold text-[16px] text-[#1D1D1F]">
                  {recipients.some((r) => r.id === editing.id) ? 'Edit Recipient' : 'New Recipient'}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLASS}>Legal Business Name *</label>
                    <input
                      type="text"
                      required
                      value={editing.legalName}
                      onChange={(e) => setEditing({ ...editing, legalName: e.target.value })}
                      className={INPUT_CLASS}
                      placeholder="e.g., Kora Ventures India Pvt. Ltd."
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Trade / Short Name</label>
                    <input
                      type="text"
                      value={editing.tradeName || ''}
                      onChange={(e) => setEditing({ ...editing, tradeName: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11.5px] font-medium text-[#6E6E73]">
                        GSTIN / Tax ID
                      </label>
                      {editing.gstin && gstCheck && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            gstCheck.valid ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {gstCheck.valid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Valid
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3" /> Check Format
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      maxLength={15}
                      value={editing.gstin}
                      onChange={(e) => handleGstinInput(e.target.value)}
                      className={`${INPUT_CLASS} font-mono uppercase`}
                      placeholder="29AAACK9012B1Z8"
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>PAN Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={editing.pan || ''}
                      onChange={(e) =>
                        setEditing({ ...editing, pan: e.target.value.toUpperCase() })
                      }
                      className={`${INPUT_CLASS} font-mono uppercase`}
                    />
                  </div>
                </div>

                <div>
                  <label className={LABEL_CLASS}>Billing Address</label>
                  <input
                    type="text"
                    value={editing.address}
                    onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                    className={INPUT_CLASS}
                    placeholder="Building, Street, Area"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3.5">
                  <div>
                    <label className={LABEL_CLASS}>City</label>
                    <input
                      type="text"
                      value={editing.city}
                      onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>State</label>
                    <select
                      value={editing.stateCode}
                      onChange={(e) => {
                        const st = INDIAN_STATES.find((s) => s.code === e.target.value);
                        if (st) {
                          setEditing({ ...editing, stateCode: st.code, stateName: st.name });
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
                    <label className={LABEL_CLASS}>PIN Code</label>
                    <input
                      type="text"
                      value={editing.pincode}
                      onChange={(e) => setEditing({ ...editing, pincode: e.target.value })}
                      className={`${INPUT_CLASS} font-mono`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3.5">
                  <div>
                    <label className={LABEL_CLASS}>Contact Person</label>
                    <input
                      type="text"
                      value={editing.contactPerson || ''}
                      onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Email</label>
                    <input
                      type="email"
                      value={editing.email}
                      onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Phone</label>
                    <input
                      type="text"
                      value={editing.phone}
                      onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3.5">
                  <div>
                    <label className={LABEL_CLASS}>Credit Days</label>
                    <input
                      type="number"
                      min="0"
                      value={editing.creditDays ?? 15}
                      onChange={(e) =>
                        setEditing({ ...editing, creditDays: parseInt(e.target.value, 10) || 0 })
                      }
                      className={`${INPUT_CLASS} tabular-nums`}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={LABEL_CLASS}>Notes</label>
                    <input
                      type="text"
                      value={editing.notes || ''}
                      onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-[#FAFAFC] border-t border-black/[0.06] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-xl border border-black/[0.1] bg-white text-[13px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1D1D1F] text-white text-[13px] font-medium hover:bg-[#333336] cursor-pointer"
                >
                  Save Recipient
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
