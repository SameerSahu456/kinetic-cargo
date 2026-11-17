import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Copy, ChevronDown, CheckCircle2, AlertCircle, UserPlus, Check } from 'lucide-react';
import { CURRENCY_CONFIG, INDIAN_STATES, TAX_SLABS, UNIT_OPTIONS } from '../data/presets';
import { CurrencyCode, DocumentType, InvoiceData, LineItem, RecipientRecord, SupplyType } from '../types/invoice';
import { getFinancialYear, validateGstin } from '../utils/invoiceMath';

interface InvoiceFormProps {
  invoice: InvoiceData;
  onChange: (updated: InvoiceData) => void;
  recipients?: RecipientRecord[];
  onSaveToRecipientMaster?: (buyer: InvoiceData['buyer']) => void;
}

type SectionKey = 'document' | 'buyer' | 'items' | 'dispatch' | 'settlement';

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

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    const nextItems = invoice.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    updateField('items', nextItems);
  };

  const addItem = () => {
    const newItem: LineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      description: '',
      hsnCode: '998314',
      isService: true,
      quantity: 1,
      unit: 'NOS',
      unitPrice: 0,
      discountPercent: 0,
      taxRate: 18,
      cessRate: 0,
    };
    updateField('items', [...invoice.items, newItem]);
  };

  const duplicateItem = (item: LineItem) => {
    const copy: LineItem = {
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    updateField('items', [...invoice.items, copy]);
  };

  const removeItem = (id: string) => {
    if (invoice.items.length <= 1) return;
    updateField(
      'items',
      invoice.items.filter((it) => it.id !== id)
    );
  };

  const buyerGstinCheck = validateGstin(invoice.buyer.gstin);

  const sections: { key: SectionKey; title: string; summary: string }[] = [
    {
      key: 'document',
      title: '01. Document & Supply',
      summary: `${invoice.invoiceNumber} · ${invoice.supplyType} · ${invoice.currency}`,
    },
    {
      key: 'buyer',
      title: '02. Recipient (Bill To)',
      summary: invoice.buyer.legalName || 'Add recipient details',
    },
    {
      key: 'items',
      title: '03. Line Items & Taxes',
      summary: `${invoice.items.length} ${invoice.items.length === 1 ? 'item' : 'items'}`,
    },
    {
      key: 'dispatch',
      title: '04. Dispatch & E-Way Bill',
      summary: invoice.dispatch.enabled ? `${invoice.dispatch.transportMode} · Enabled` : 'Optional',
    },
    {
      key: 'settlement',
      title: '05. Banking, Notes & Terms',
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
                          <label className={LABEL_CLASS}>Document Type</label>
                          <select
                            value={invoice.docType}
                            onChange={(e) => updateField('docType', e.target.value as DocumentType)}
                            className={INPUT_CLASS}
                          >
                            <option value="INV">Tax Invoice (INV)</option>
                            <option value="CRN">Credit Note (CRN)</option>
                            <option value="DBN">Debit Note (DBN)</option>
                          </select>
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>Supply Type</label>
                          <select
                            value={invoice.supplyType}
                            onChange={(e) => updateField('supplyType', e.target.value as SupplyType)}
                            className={INPUT_CLASS}
                          >
                            <option value="B2B">B2B (Regular Taxable)</option>
                            <option value="SEZWP">SEZ With Payment</option>
                            <option value="SEZWOP">SEZ Without Payment</option>
                            <option value="EXPWP">Export With Payment</option>
                            <option value="EXPWOP">Export Without Payment</option>
                            <option value="DEXP">Deemed Export</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className={LABEL_CLASS}>Invoice Number</label>
                          <input
                            type="text"
                            value={invoice.invoiceNumber}
                            onChange={(e) => updateField('invoiceNumber', e.target.value)}
                            className={`${INPUT_CLASS} font-mono`}
                            placeholder="INV/26-27/0104"
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

                      <div className="grid grid-cols-3 gap-3.5">
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
                        <div>
                          <label className={LABEL_CLASS}>Currency</label>
                          <select
                            value={invoice.currency}
                            onChange={(e) => updateField('currency', e.target.value as CurrencyCode)}
                            className={INPUT_CLASS}
                          >
                            {Object.entries(CURRENCY_CONFIG).map(([code, cfg]) => (
                              <option key={code} value={code}>
                                {cfg.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
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
                        <div>
                          <label className={LABEL_CLASS}>Delivery Note</label>
                          <input
                            type="text"
                            value={invoice.deliveryNote ?? ''}
                            onChange={(e) => updateField('deliveryNote', e.target.value)}
                            className={INPUT_CLASS}
                            placeholder="DN-2026-014"
                          />
                        </div>
                      </div>

                      <div>
                        <label className={LABEL_CLASS}>AWB No. (Air Waybill)</label>
                        <input
                          type="text"
                          value={invoice.awbNumber ?? ''}
                          onChange={(e) => updateField('awbNumber', e.target.value)}
                          className={INPUT_CLASS}
                          placeholder="e.g. 176-1234 5675"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className={LABEL_CLASS}>Other References</label>
                          <input
                            type="text"
                            value={invoice.otherReferences ?? ''}
                            onChange={(e) => updateField('otherReferences', e.target.value)}
                            className={INPUT_CLASS}
                            placeholder="Contract / LR Ref"
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>Terms of Delivery</label>
                          <input
                            type="text"
                            value={invoice.termsOfDelivery ?? ''}
                            onChange={(e) => updateField('termsOfDelivery', e.target.value)}
                            className={INPUT_CLASS}
                            placeholder="Ex-Works / Door Delivery"
                          />
                        </div>
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
                    <div className="space-y-3.5">
                      {invoice.items.map((item, index) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl bg-[#FAFAFC] border border-black/[0.07] space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-medium text-[#86868B]">
                              Item {String(index + 1).padStart(2, '0')}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => duplicateItem(item)}
                                title="Duplicate line item"
                                className="p-1.5 rounded-md text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition-colors cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                disabled={invoice.items.length <= 1}
                                title="Remove line item"
                                className="p-1.5 rounded-md text-[#6E6E73] hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-12 gap-2.5">
                            <div className="col-span-8">
                              <label className={LABEL_CLASS}>Item / Service Name</label>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                                className={INPUT_CLASS}
                                placeholder="e.g., Enterprise Design System"
                              />
                            </div>
                            <div className="col-span-4">
                              <label className={LABEL_CLASS}>HSN / SAC</label>
                              <input
                                type="text"
                                value={item.hsnCode}
                                onChange={(e) => updateItem(item.id, { hsnCode: e.target.value })}
                                className={`${INPUT_CLASS} font-mono`}
                                placeholder="998314"
                              />
                            </div>
                          </div>

                          <div>
                            <input
                              type="text"
                              value={item.description || ''}
                              onChange={(e) => updateItem(item.id, { description: e.target.value })}
                              className={INPUT_CLASS}
                              placeholder="Optional scope or technical specification"
                            />
                          </div>

                          <div className="grid grid-cols-5 gap-2.5">
                            <div>
                              <label className={LABEL_CLASS}>Qty</label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })
                                }
                                className={`${INPUT_CLASS} tabular-nums text-right`}
                              />
                            </div>
                            <div>
                              <label className={LABEL_CLASS}>Unit</label>
                              <select
                                value={item.unit}
                                onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                                className={INPUT_CLASS}
                              >
                                {UNIT_OPTIONS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={LABEL_CLASS}>Rate</label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })
                                }
                                className={`${INPUT_CLASS} tabular-nums text-right`}
                              />
                            </div>
                            <div>
                              <label className={LABEL_CLASS}>Disc %</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={item.discountPercent}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    discountPercent: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className={`${INPUT_CLASS} tabular-nums text-right`}
                              />
                            </div>
                            <div>
                              <label className={LABEL_CLASS}>GST %</label>
                              <select
                                value={item.taxRate}
                                onChange={(e) =>
                                  updateItem(item.id, { taxRate: parseFloat(e.target.value) || 0 })
                                }
                                className={`${INPUT_CLASS} tabular-nums`}
                              >
                                {TAX_SLABS.map((slab) => (
                                  <option key={slab} value={slab}>
                                    {slab}%
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addItem}
                        className="w-full py-2.5 rounded-xl border border-dashed border-black/20 text-[13px] font-medium text-[#1D1D1F] hover:bg-[#FAFAFC] hover:border-black/35 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Line Item</span>
                      </button>
                    </div>
                  )}

                  {sec.key === 'dispatch' && (
                    <div className="space-y-4">
                      <label className="inline-flex items-center gap-2.5 text-[13px] font-medium text-[#1D1D1F] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={invoice.dispatch.enabled}
                          onChange={(e) =>
                            updateField('dispatch', {
                              ...invoice.dispatch,
                              enabled: e.target.checked,
                            })
                          }
                          className="rounded border-black/20 text-[#1D1D1F] focus:ring-[#0071E3]"
                        />
                        <span>Include Separate Ship-To &amp; E-Way Bill Logistics</span>
                      </label>

                      {invoice.dispatch.enabled && (
                        <div className="space-y-3.5 pt-1">
                          <div className="grid grid-cols-2 gap-3.5">
                            <div>
                              <label className={LABEL_CLASS}>Ship-To Consignee Name</label>
                              <input
                                type="text"
                                value={invoice.dispatch.shipToName}
                                onChange={(e) =>
                                  updateField('dispatch', {
                                    ...invoice.dispatch,
                                    shipToName: e.target.value,
                                  })
                                }
                                className={INPUT_CLASS}
                              />
                            </div>
                            <div>
                              <label className={LABEL_CLASS}>Ship-To City</label>
                              <input
                                type="text"
                                value={invoice.dispatch.shipToCity}
                                onChange={(e) =>
                                  updateField('dispatch', {
                                    ...invoice.dispatch,
                                    shipToCity: e.target.value,
                                  })
                                }
                                className={INPUT_CLASS}
                              />
                            </div>
                          </div>
                          <div>
                            <label className={LABEL_CLASS}>Ship-To Street Address</label>
                            <input
                              type="text"
                              value={invoice.dispatch.shipToAddress}
                              onChange={(e) =>
                                updateField('dispatch', {
                                  ...invoice.dispatch,
                                  shipToAddress: e.target.value,
                                })
                              }
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3.5">
                            <div>
                              <label className={LABEL_CLASS}>Mode</label>
                              <select
                                value={invoice.dispatch.transportMode}
                                onChange={(e) =>
                                  updateField('dispatch', {
                                    ...invoice.dispatch,
                                    transportMode: e.target.value as InvoiceData['dispatch']['transportMode'],
                                  })
                                }
                                className={INPUT_CLASS}
                              >
                                <option value="Road">Road</option>
                                <option value="Air">Air</option>
                                <option value="Rail">Rail</option>
                                <option value="Ship">Ship</option>
                              </select>
                            </div>
                            <div>
                              <label className={LABEL_CLASS}>Vehicle / Doc No.</label>
                              <input
                                type="text"
                                value={invoice.dispatch.vehicleNumber}
                                onChange={(e) =>
                                  updateField('dispatch', {
                                    ...invoice.dispatch,
                                    vehicleNumber: e.target.value,
                                  })
                                }
                                className={`${INPUT_CLASS} font-mono uppercase`}
                              />
                            </div>
                            <div>
                              <label className={LABEL_CLASS}>E-Way Bill No.</label>
                              <input
                                type="text"
                                value={invoice.dispatch.ewayBillNo}
                                onChange={(e) =>
                                  updateField('dispatch', {
                                    ...invoice.dispatch,
                                    ewayBillNo: e.target.value,
                                  })
                                }
                                className={`${INPUT_CLASS} font-mono`}
                                placeholder="12-digit EWB"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
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
