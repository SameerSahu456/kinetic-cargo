import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, CheckCircle2, AlertCircle, UserPlus, Check } from 'lucide-react';
import { INDIAN_STATES } from '../data/presets';
import { InvoiceData, RecipientRecord } from '../types/invoice';
import {
  getFinancialYear,
  isShipmentInvoice,
  validateGstin,
  withInvoicePrefix,
} from '../utils/invoiceMath';
import { ShipmentEditor } from './ShipmentEditor';

interface InvoiceFormProps {
  invoice: InvoiceData;
  onChange: (updated: InvoiceData) => void;
  recipients?: RecipientRecord[];
  onSaveToRecipientMaster?: (buyer: InvoiceData['buyer']) => void;
}

type SectionKey = 'document' | 'buyer' | 'items' | 'settlement';

const INPUT_CLASS =
  'w-full px-3 py-2 text-[13px] bg-white border border-black/[0.1] rounded-lg text-[#1D1D1F] placeholder:text-[#A1A1A6] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/15 transition-all duration-150';

const LABEL_CLASS = 'block text-[11.5px] font-medium text-[#6E6E73] mb-1.5';

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  invoice,
  onChange,
  recipients = [],
  onSaveToRecipientMaster,
}) => {
  const [openSection, setOpenSection] = useState<SectionKey | null>('document');
  const [savedRecipientToast, setSavedRecipientToast] = useState(false);

  const updateField = <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => {
    onChange({
      ...invoice,
      [key]: value,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateBuyer = (patch: Partial<InvoiceData['buyer']>) => {
    const nextBuyer = { ...invoice.buyer, ...patch };
    const nextInvoice: InvoiceData = {
      ...invoice,
      buyer: nextBuyer,
      updatedAt: new Date().toISOString(),
    };
    if (patch.stateCode && patch.stateName) {
      nextInvoice.placeOfSupplyCode = patch.stateCode;
      nextInvoice.placeOfSupplyName = patch.stateName;
    }
    onChange(nextInvoice);
  };

  const handleBuyerGstinChange = (val: string) => {
    const upper = val.toUpperCase();
    const check = validateGstin(upper);
    const patch: Partial<InvoiceData['buyer']> = { gstin: upper };
    if (check.valid && check.stateCode) {
      const st = INDIAN_STATES.find((s) => s.code === check.stateCode);
      if (st) {
        patch.stateCode = st.code;
        patch.stateName = st.name;
      }
      if (check.pan) patch.pan = check.pan;
    }
    updateBuyer(patch);
  };

  const buyerGstinCheck = validateGstin(invoice.buyer.gstin);
  const shipmentMode = isShipmentInvoice(invoice);
  const shipmentCount = invoice.shipments?.length ?? 0;

  const patchInvoice = (patch: Partial<InvoiceData>) =>
    onChange({ ...invoice, ...patch, updatedAt: new Date().toISOString() });

  const sections: { key: SectionKey; title: string; summary: string }[] = [
    {
      key: 'document',
      title: '01. Document & Supply',
      summary: `Tax Invoice · ${invoice.invoiceNumber}`,
    },
    {
      key: 'buyer',
      title: '02. Recipient (Bill To)',
      summary: invoice.buyer.legalName || 'Add recipient details',
    },
    {
      key: 'items',
      title: '03. Shipments (AWB-wise) & Taxes',
      summary: shipmentMode ? `${shipmentCount} AWB` : `${invoice.items.length} line items (legacy)`,
    },
    {
      key: 'settlement',
      title: '04. Banking, Notes & Terms',
      summary: invoice.bank.bankName || 'Settlement account',
    },
  ];

  return (
    <div className="divide-y divide-black/[0.06]">
      {sections.map((sec) => {
        const isOpen = openSection === sec.key;
        return (
          <div key={sec.key} className="bg-white">
            <button
              type="button"
              onClick={() => setOpenSection(isOpen ? null : sec.key)}
              aria-expanded={isOpen}
              className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#FAFAFC] transition-colors cursor-pointer"
            >
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-[14px] text-[#1D1D1F] tracking-[-0.01em]">
                  {sec.title}
                </h3>
                <p className="text-[12px] text-[#86868B] truncate mt-0.5">{sec.summary}</p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-[#86868B] shrink-0 transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-[#1D1D1F]' : ''
                }`}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="px-5 pb-6 pt-1 space-y-4"
                >
                  {sec.key === 'document' && (
                    <>
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className={LABEL_CLASS}>Invoice Number</label>
                          <input
                            type="text"
                            value={invoice.invoiceNumber}
                            onChange={(e) => updateField('invoiceNumber', withInvoicePrefix(e.target.value))}
                            className={`${INPUT_CLASS} font-mono`}
                            placeholder="SK0001"
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>PO / Reference No.</label>
                          <input
                            type="text"
                            value={invoice.poNumber}
                            onChange={(e) => updateField('poNumber', e.target.value)}
                            className={INPUT_CLASS}
                            placeholder="PO-8842"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className={LABEL_CLASS}>Issue Date</label>
                          <input
                            type="date"
                            value={invoice.issueDate}
                            onChange={(e) => {
                              const date = e.target.value;
                              onChange({
                                ...invoice,
                                issueDate: date,
                                financialYear: getFinancialYear(date),
                                updatedAt: new Date().toISOString(),
                              });
                            }}
                            className={`${INPUT_CLASS} tabular-nums`}
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>Due Date</label>
                          <input
                            type="date"
                            value={invoice.dueDate}
                            onChange={(e) => updateField('dueDate', e.target.value)}
                            className={`${INPUT_CLASS} tabular-nums`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={LABEL_CLASS}>Mode / Terms of Payment</label>
                        <input
                          type="text"
                          value={invoice.paymentTerms ?? ''}
                          onChange={(e) => updateField('paymentTerms', e.target.value)}
                          className={INPUT_CLASS}
                          placeholder="15 Days / NEFT"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3.5 items-end">
                        <div>
                          <label className={LABEL_CLASS}>Place of Supply (State)</label>
                          <select
                            value={invoice.placeOfSupplyCode}
                            onChange={(e) => {
                              const st = INDIAN_STATES.find((s) => s.code === e.target.value);
                              if (st) {
                                onChange({
                                  ...invoice,
                                  placeOfSupplyCode: st.code,
                                  placeOfSupplyName: st.name,
                                  updatedAt: new Date().toISOString(),
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
                        <div className="flex items-center justify-between gap-4 pb-2">
                          <label className="inline-flex items-center gap-2 text-[12.5px] text-[#1D1D1F] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={invoice.reverseCharge}
                              onChange={(e) => updateField('reverseCharge', e.target.checked)}
                              className="rounded border-black/20 text-[#1D1D1F] focus:ring-[#0071E3]"
                            />
                            <span>Reverse Charge</span>
                          </label>
                          <label className="inline-flex items-center gap-2 text-[12.5px] text-[#1D1D1F] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={invoice.autoRoundOff}
                              onChange={(e) => updateField('autoRoundOff', e.target.checked)}
                              className="rounded border-black/20 text-[#1D1D1F] focus:ring-[#0071E3]"
                            />
                            <span>Round Off</span>
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {sec.key === 'buyer' && (
                    <>
                      <div className="p-3 rounded-xl bg-[#FAFAFC] border border-black/[0.07] flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex-1 min-w-[180px]">
                          <select
                            value=""
                            onChange={(e) => {
                              const rec = recipients.find((r) => r.id === e.target.value);
                              if (!rec) return;
                              onChange({
                                ...invoice,
                                placeOfSupplyCode: rec.stateCode,
                                placeOfSupplyName: rec.stateName,
                                buyer: {
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
                            }}
                            className={INPUT_CLASS}
                          >
                            <option value="">Load from Recipient Master…</option>
                            {recipients.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.legalName} ({r.gstin || r.city})
                              </option>
                            ))}
                          </select>
                        </div>
                        {onSaveToRecipientMaster && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!invoice.buyer.legalName.trim()) return;
                              onSaveToRecipientMaster(invoice.buyer);
                              setSavedRecipientToast(true);
                              setTimeout(() => setSavedRecipientToast(false), 2200);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/[0.1] text-[12px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {savedRecipientToast ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Saved to Master</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-3.5 h-3.5 text-[#6E6E73]" />
                                <span>Save to Master</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className={LABEL_CLASS}>Buyer Legal Name</label>
                          <input
                            type="text"
                            value={invoice.buyer.legalName}
                            onChange={(e) => updateBuyer({ legalName: e.target.value })}
                            className={INPUT_CLASS}
                            placeholder="Acme Enterprises Pvt. Ltd."
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11.5px] font-medium text-[#6E6E73]">
                              Buyer GSTIN / Tax ID
                            </label>
                            {invoice.buyer.gstin && (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                                  buyerGstinCheck.valid ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {buyerGstinCheck.valid ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" /> Valid Format
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
                            value={invoice.buyer.gstin}
                            onChange={(e) => handleBuyerGstinChange(e.target.value)}
                            className={`${INPUT_CLASS} font-mono uppercase`}
                            placeholder="29AAACK9012B1Z8"
                          />
                        </div>
                      </div>

                      <div>
                        <label className={LABEL_CLASS}>Billing Address</label>
                        <input
                          type="text"
                          value={invoice.buyer.address}
                          onChange={(e) => updateBuyer({ address: e.target.value })}
                          className={INPUT_CLASS}
                          placeholder="Street, Floor, Building"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3.5">
                        <div>
                          <label className={LABEL_CLASS}>City</label>
                          <input
                            type="text"
                            value={invoice.buyer.city}
                            onChange={(e) => updateBuyer({ city: e.target.value })}
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>State</label>
                          <select
                            value={invoice.buyer.stateCode}
                            onChange={(e) => {
                              const st = INDIAN_STATES.find((s) => s.code === e.target.value);
                              if (st) updateBuyer({ stateCode: st.code, stateName: st.name });
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
                          <label className={LABEL_CLASS}>PIN / Postal Code</label>
                          <input
                            type="text"
                            value={invoice.buyer.pincode}
                            onChange={(e) => updateBuyer({ pincode: e.target.value })}
                            className={`${INPUT_CLASS} font-mono`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className={LABEL_CLASS}>Recipient Email</label>
                          <input
                            type="email"
                            value={invoice.buyer.email}
                            onChange={(e) => updateBuyer({ email: e.target.value })}
                            className={INPUT_CLASS}
                            placeholder="accounts@company.com"
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>Phone</label>
                          <input
                            type="text"
                            value={invoice.buyer.phone}
                            onChange={(e) => updateBuyer({ phone: e.target.value })}
                            className={INPUT_CLASS}
                            placeholder="+91 98..."
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {sec.key === 'items' && (
                    <>
                      {!shipmentMode && (
                        <p className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[12px] text-amber-900">
                          This invoice was created with line items and still bills from them.
                          Adding shipments here converts it to AWB-wise billing.
                        </p>
                      )}
                      <ShipmentEditor
                        invoice={invoice}
                        onPatch={(patch) => patchInvoice({ ...patch, billingMode: 'shipments' })}
                      />
                    </>
                  )}

                  {sec.key === 'settlement' && (
                    <div className="space-y-3.5">
                      <div>
                        <label className={LABEL_CLASS}>Payments in Favor of (Account Name)</label>
                        <input
                          type="text"
                          value={invoice.bank.accountName}
                          onChange={(e) =>
                            updateField('bank', { ...invoice.bank, accountName: e.target.value })
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className={LABEL_CLASS}>Bank Name</label>
                          <input
                            type="text"
                            value={invoice.bank.bankName}
                            onChange={(e) =>
                              updateField('bank', { ...invoice.bank, bankName: e.target.value })
                            }
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>Branch</label>
                          <input
                            type="text"
                            value={invoice.bank.branch}
                            onChange={(e) =>
                              updateField('bank', { ...invoice.bank, branch: e.target.value })
                            }
                            className={INPUT_CLASS}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className={LABEL_CLASS}>Account Number</label>
                          <input
                            type="text"
                            value={invoice.bank.accountNumber}
                            onChange={(e) =>
                              updateField('bank', { ...invoice.bank, accountNumber: e.target.value })
                            }
                            className={`${INPUT_CLASS} font-mono`}
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>IFSC / SWIFT Code</label>
                          <input
                            type="text"
                            value={invoice.bank.ifscCode}
                            onChange={(e) =>
                              updateField('bank', { ...invoice.bank, ifscCode: e.target.value })
                            }
                            className={`${INPUT_CLASS} font-mono uppercase`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>UPI ID (Optional)</label>
                        <input
                          type="text"
                          value={invoice.bank.upiId || ''}
                          onChange={(e) =>
                            updateField('bank', { ...invoice.bank, upiId: e.target.value })
                          }
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Invoice Note</label>
                        <input
                          type="text"
                          value={invoice.notes}
                          onChange={(e) => updateField('notes', e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Terms &amp; Conditions</label>
                        <textarea
                          rows={3}
                          value={invoice.terms}
                          onChange={(e) => updateField('terms', e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};
