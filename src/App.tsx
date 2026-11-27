import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Menu } from 'lucide-react';
import { InvoiceEditorModal } from './components/InvoiceEditorModal';
import { InvoiceLedger } from './components/InvoiceLedger';
import { LoginScreen } from './components/LoginScreen';
import { ReceiptStudio } from './components/ReceiptStudio';
import { RecipientMaster } from './components/RecipientMaster';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import {
  CENTAUR_OCT_2026_INVOICE_ID,
  createCentaurOctoberInvoice,
  createSampleInvoice,
  createSampleReceipt,
  createSuperKinetic758Invoice,
  DEFAULT_BRAND_PROFILE,
  DEFAULT_RECIPIENTS,
  SUPER_KINETIC_758_INVOICE_ID,
} from './data/presets';
import {
  AuthSession,
  BrandProfile,
  InvoiceData,
  ReceiptData,
  RecipientRecord,
  WorkspaceView,
} from './types/invoice';
import { getCurrentSession, signOutWorkspace } from './utils/auth';
import {
  computeInvoice,
  createShipmentRow,
  nextInvoiceNumber,
  toSkInvoiceNumber,
  withSkInvoiceNumbers,
} from './utils/invoiceMath';
import { cancelInvoice, issueIrn } from './utils/irnGenerator';

const STORAGE_BRAND_KEY = 'kinetic_cargo_brand_profile_v1';
const STORAGE_LEDGER_KEY = 'kinetic_cargo_invoice_ledger_v1';
const STORAGE_RECIPIENTS_KEY = 'kinetic_cargo_recipients_v1';
const STORAGE_RECEIPTS_KEY = 'kinetic_cargo_receipts_v1';
const STORAGE_CENTAUR_SEEDED_KEY = 'kinetic_cargo_centaur_0934_seeded_v2';
const STORAGE_SK758_SEEDED_KEY = 'kinetic_cargo_super_kinetic_758_seeded_v1';

// Account number of the old placeholder bank that shipped as sample data.
const LEGACY_SAMPLE_ACCOUNT = '50200048192044';

// Swap the old placeholder bank for the real payment account; leave any
// bank details the user entered themselves untouched.
function withCurrentBank<T extends { bank: BrandProfile['bank'] }>(record: T): T {
  return record.bank?.accountNumber === LEGACY_SAMPLE_ACCOUNT
    ? { ...record, bank: { ...DEFAULT_BRAND_PROFILE.bank } }
    : record;
}

function loadInitialBrand(): BrandProfile {
  try {
    const raw = localStorage.getItem(STORAGE_BRAND_KEY);
    // GST e-Invoice is the only supported layout; override any older saved choice.
    if (raw) {
      return withCurrentBank({
        ...DEFAULT_BRAND_PROFILE,
        ...JSON.parse(raw),
        templateId: 'gst-standard',
      });
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_BRAND_PROFILE;
}

// Adds the Centaur invoice 0934 once; after that the user's ledger (including
// a deletion of it) is respected.
function withCentaurInvoice(list: InvoiceData[], brand: BrandProfile): InvoiceData[] {
  try {
    if (localStorage.getItem(STORAGE_CENTAUR_SEEDED_KEY) === '1') return list;
  } catch {
    // ignore storage errors
  }
  if (list.some((inv) => inv.id === CENTAUR_OCT_2026_INVOICE_ID)) return list;
  return [createCentaurOctoberInvoice(brand), ...list];
}

// Adds the reference invoice 758/25-26 once, the same way.
function withSuperKinetic758Invoice(list: InvoiceData[]): InvoiceData[] {
  try {
    if (localStorage.getItem(STORAGE_SK758_SEEDED_KEY) === '1') return list;
  } catch {
    // ignore storage errors
  }
  if (list.some((inv) => inv.id === SUPER_KINETIC_758_INVOICE_ID)) return list;
  return [createSuperKinetic758Invoice(), ...list];
}

function loadInitialLedger(brand: BrandProfile): InvoiceData[] {
  // Invoices numbered before the SK series are moved onto it.
  return withSkInvoiceNumbers(
    withSuperKinetic758Invoice(withCentaurInvoice(loadStoredLedger(brand), brand))
  );
}

function loadStoredLedger(brand: BrandProfile): InvoiceData[] {
  try {
    const raw = localStorage.getItem(STORAGE_LEDGER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return (parsed as InvoiceData[]).map(withCurrentBank);
      }
    }
  } catch {
    // ignore storage errors
  }
  return [createSampleInvoice(brand)];
}

function loadInitialRecipients(): RecipientRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_RECIPIENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_RECIPIENTS;
}

function loadInitialReceipts(brand: BrandProfile): ReceiptData[] {
  try {
    const raw = localStorage.getItem(STORAGE_RECEIPTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Keep receipts pointing at the renumbered (SK) invoices.
        return (parsed as ReceiptData[]).map((r) => ({
          ...r,
          linkedInvoiceNumber: toSkInvoiceNumber(r.linkedInvoiceNumber),
        }));
      }
    }
  } catch {
    // ignore storage errors
  }
  return [createSampleReceipt(brand)];
}

// New invoices are billed AWB-wise: one row per consignment.
function startAwbWise(invoice: InvoiceData): void {
  invoice.docType = 'INV';
  invoice.supplyType = 'B2B';
  invoice.currency = 'INR';
  invoice.dispatch = { ...invoice.dispatch, enabled: false };
  invoice.billingMode = 'shipments';
  invoice.shipments = [createShipmentRow({ bookDate: invoice.issueDate })];
  invoice.awbNumber = '';
}

const VIEW_LABELS: Record<WorkspaceView, string> = {
  ledger: 'Invoice Ledger',
  recipients: 'Recipient Master',
  receipts: 'Payment Receipts',
  settings: 'Settings',
};

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getCurrentSession());
  const [brand, setBrand] = useState<BrandProfile>(() => loadInitialBrand());
  const [ledger, setLedger] = useState<InvoiceData[]>(() => loadInitialLedger(loadInitialBrand()));
  const [recipients, setRecipients] = useState<RecipientRecord[]>(() => loadInitialRecipients());
  const [receipts, setReceipts] = useState<ReceiptData[]>(() => loadInitialReceipts(loadInitialBrand()));
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData>(() => {
    const initialReceipts = loadInitialReceipts(loadInitialBrand());
    return initialReceipts[0] || createSampleReceipt(loadInitialBrand());
  });
  const [activeView, setActiveView] = useState<WorkspaceView>('ledger');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BRAND_KEY, JSON.stringify(brand));
    } catch {
      // ignore quota errors
    }
  }, [brand]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LEDGER_KEY, JSON.stringify(ledger));
      // Mark as seeded only once the invoice has really been in the ledger.
      if (ledger.some((inv) => inv.id === CENTAUR_OCT_2026_INVOICE_ID)) {
        localStorage.setItem(STORAGE_CENTAUR_SEEDED_KEY, '1');
      }
      if (ledger.some((inv) => inv.id === SUPER_KINETIC_758_INVOICE_ID)) {
        localStorage.setItem(STORAGE_SK758_SEEDED_KEY, '1');
      }
    } catch {
      // ignore quota errors
    }
  }, [ledger]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_RECIPIENTS_KEY, JSON.stringify(recipients));
    } catch {
      // ignore quota errors
    }
  }, [recipients]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_RECEIPTS_KEY, JSON.stringify(receipts));
    } catch {
      // ignore quota errors
    }
  }, [receipts]);

  const upsertIntoLedger = (inv: InvoiceData) => {
    setLedger((prev) => {
      const exists = prev.some((item) => item.id === inv.id);
      if (exists) {
        return prev.map((item) => (item.id === inv.id ? inv : item));
      }
      return [inv, ...prev];
    });
  };

  const handleCreateNewInvoice = () => {
    const fresh = createSampleInvoice(brand);
    fresh.id = `inv-${Date.now()}`;
    fresh.invoiceNumber = nextInvoiceNumber(ledger);
    fresh.irn = null;
    fresh.items = [
      {
        id: `item-${Date.now()}`,
        name: 'Consulting & Advisory Services',
        description: '',
        hsnCode: '998314',
        isService: true,
        quantity: 1,
        unit: 'NOS',
        unitPrice: 50000,
        discountPercent: 0,
        taxRate: 18,
        cessRate: 0,
      },
    ];
    startAwbWise(fresh);
    setEditingInvoice(fresh);
  };

  const handleOpenInvoiceEditor = (inv: InvoiceData) => {
    setEditingInvoice(inv);
  };

  const handleGenerateIrnForModal = async (inv: InvoiceData): Promise<InvoiceData> => {
    await new Promise((r) => setTimeout(r, 260));
    const updated = await issueIrn(inv, ledger);
    upsertIntoLedger(updated);
    return updated;
  };

  const handleGenerateIrnInLedger = async (id: string) => {
    const target = ledger.find((i) => i.id === id);
    if (!target) return;
    const updated = await issueIrn(target, ledger);
    upsertIntoLedger(updated);
    if (editingInvoice?.id === id) setEditingInvoice(updated);
  };

  const handleDuplicateInLedger = (inv: InvoiceData) => {
    const copy: InvoiceData = {
      ...inv,
      id: `inv-${Date.now()}`,
      invoiceNumber: nextInvoiceNumber(ledger),
      irn: null,
      cancelledIrns: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLedger((prev) => [copy, ...prev]);
  };

  const handleCancelInLedger = (id: string) => {
    setLedger((prev) => prev.map((inv) => (inv.id === id ? cancelInvoice(inv) : inv)));
  };

  const handleApplyBrandToDrafts = () => {
    setLedger((prev) =>
      prev.map((inv) =>
        inv.irn === null && !inv.cancelledAt
          ? {
              ...inv,
              seller: { ...brand.seller },
              bank: { ...brand.bank },
              terms: brand.defaultTerms,
              notes: brand.defaultNotes,
              updatedAt: new Date().toISOString(),
            }
          : inv
      )
    );
  };

  const handleSaveRecipient = (record: RecipientRecord) => {
    setRecipients((prev) => {
      const exists = prev.some((r) => r.id === record.id);
      if (exists) return prev.map((r) => (r.id === record.id ? record : r));
      return [record, ...prev];
    });
  };

  const handleSaveBuyerToMaster = (buyer: InvoiceData['buyer']) => {
    const existing = recipients.find(
      (r) =>
        (buyer.gstin && r.gstin.toUpperCase() === buyer.gstin.toUpperCase()) ||
        r.legalName.toLowerCase() === buyer.legalName.toLowerCase()
    );
    const now = new Date().toISOString();
    const record: RecipientRecord = {
      id: existing ? existing.id : `rcp-${Date.now()}`,
      ...buyer,
      contactPerson: existing?.contactPerson || '',
      creditDays: existing?.creditDays ?? 15,
      notes: existing?.notes || '',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    handleSaveRecipient(record);
  };

  const handleDeleteRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCreateInvoiceForRecipient = (rec: RecipientRecord) => {
    const fresh = createSampleInvoice(brand);
    fresh.id = `inv-${Date.now()}`;
    fresh.invoiceNumber = nextInvoiceNumber(ledger);
    fresh.irn = null;
    fresh.placeOfSupplyCode = rec.stateCode;
    fresh.placeOfSupplyName = rec.stateName;
    fresh.buyer = {
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
    };
    startAwbWise(fresh);
    setEditingInvoice(fresh);
  };

  const handleCreateReceiptForRecipient = (rec: RecipientRecord) => {
    const nextNum = receipts.length + 42;
    const fresh = createSampleReceipt(brand, rec, {
      invoiceNumber: '',
      irn: '',
      total: 0,
      currency: 'INR',
    });
    fresh.receiptNumber = `RCPT/26-27/00${nextNum}`;
    setActiveReceipt(fresh);
    setActiveView('receipts');
  };

  const handleCreateReceiptFromInvoice = (inv: InvoiceData) => {
    const nextNum = receipts.length + 42;
    const { totals: invTotals } = computeInvoice(inv);
    const fresh = createSampleReceipt(brand, undefined, {
      invoiceNumber: inv.invoiceNumber,
      irn: inv.irn?.irn || '',
      total: invTotals.grandTotal,
      currency: inv.currency,
    });
    fresh.receiptNumber = `RCPT/26-27/00${nextNum}`;
    fresh.recipient = { ...inv.buyer };
    setActiveReceipt(fresh);
    setActiveView('receipts');
  };

  const handleSaveReceipt = (rcpt: ReceiptData) => {
    setReceipts((prev) => {
      const exists = prev.some((r) => r.id === rcpt.id);
      if (exists) return prev.map((r) => (r.id === rcpt.id ? rcpt : r));
      return [rcpt, ...prev];
    });
  };

  const handleDeleteReceipt = (id: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
  };

  const handleNewReceipt = () => {
    const nextNum = receipts.length + 42;
    const fresh = createSampleReceipt(brand, recipients[0]);
    fresh.receiptNumber = `RCPT/26-27/00${nextNum}`;
    setActiveReceipt(fresh);
  };

  const handleSignOut = () => {
    signOutWorkspace();
    setSession(null);
    setEditingInvoice(null);
    setActiveView('ledger');
  };

  const editingIsNew =
    editingInvoice !== null && !ledger.some((item) => item.id === editingInvoice.id);

  if (!session) {
    return <LoginScreen onAuthenticated={(nextSession) => setSession(nextSession)} />;
  }

  return (
    <div className="min-h-screen flex bg-[#FBFBFD] text-[#1D1D1F]">
      <Sidebar
        activeView={activeView}
        onSelectView={(view) => {
          setEditingInvoice(null);
          setActiveView(view);
        }}
        onNewInvoice={handleCreateNewInvoice}
        ledgerCount={ledger.length}
        recipientCount={recipients.length}
        session={session}
        onSignOut={handleSignOut}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Top Workspace Header */}
        <header className="h-[60px] shrink-0 px-4 lg:px-6 bg-white/85 backdrop-blur-xl border-b border-black/[0.07] flex items-center justify-between gap-6 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 -ml-1 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.04] transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav className="flex items-center gap-2 text-[13px] min-w-0" aria-label="Breadcrumb">
              <span className="text-[#86868B] whitespace-nowrap hidden sm:inline">Kinetic Cargo</span>
              <span className="text-[#D2D2D7] hidden sm:inline">/</span>
              <span className="font-medium text-[#1D1D1F] whitespace-nowrap">
                {editingInvoice
                  ? editingIsNew
                    ? 'New Invoice'
                    : 'Edit Invoice'
                  : VIEW_LABELS[activeView]}
              </span>
            </nav>
          </div>

          {!editingInvoice && activeView === 'receipts' && (
            <button
              type="button"
              onClick={() => setActiveView('ledger')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.1] bg-white text-[12.5px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Ledger</span>
            </button>
          )}
        </header>

        {/* Main Workspace Viewport */}
        <main className="flex-1 min-h-0 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {editingInvoice && (
              <motion.div
                key="view-invoice-editor"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="h-full overflow-hidden"
              >
                <InvoiceEditorModal
                  invoice={editingInvoice}
                  brand={brand}
                  isNew={editingIsNew}
                  recipients={recipients}
                  onClose={() => setEditingInvoice(null)}
                  onChange={setEditingInvoice}
                  onSave={upsertIntoLedger}
                  onGenerateIrn={handleGenerateIrnForModal}
                  onSaveToRecipientMaster={handleSaveBuyerToMaster}
                />
              </motion.div>
            )}

            {!editingInvoice && activeView === 'ledger' && (
              <motion.div
                key="view-ledger"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="h-full overflow-y-auto"
              >
                <InvoiceLedger
                  invoices={ledger}
                  brand={brand}
                  onOpenInStudio={handleOpenInvoiceEditor}
                  onCancel={handleCancelInLedger}
                  onGenerateIrn={handleGenerateIrnInLedger}
                  onCreateNew={handleCreateNewInvoice}
                />
              </motion.div>
            )}

            {!editingInvoice && activeView === 'recipients' && (
              <motion.div
                key="view-recipients"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="h-full overflow-y-auto"
              >
                <RecipientMaster
                  recipients={recipients}
                  onSaveRecipient={handleSaveRecipient}
                  onDeleteRecipient={handleDeleteRecipient}
                  onCreateInvoiceForRecipient={handleCreateInvoiceForRecipient}
                  onCreateReceiptForRecipient={handleCreateReceiptForRecipient}
                />
              </motion.div>
            )}

            {!editingInvoice && activeView === 'receipts' && (
              <motion.div
                key="view-receipts"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="h-full overflow-hidden"
              >
                <ReceiptStudio
                  receipt={activeReceipt}
                  onChange={setActiveReceipt}
                  savedReceipts={receipts}
                  onSaveReceipt={handleSaveReceipt}
                  onDeleteReceipt={handleDeleteReceipt}
                  onNewReceipt={handleNewReceipt}
                  recipients={recipients}
                  invoices={ledger}
                  brand={brand}
                />
              </motion.div>
            )}

            {!editingInvoice && activeView === 'settings' && (
              <motion.div
                key="view-settings"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="h-full overflow-y-auto"
              >
                <SettingsView
                  session={session}
                  onUpdateSession={setSession}
                  onSignOut={handleSignOut}
                  brand={brand}
                  onChangeBrand={setBrand}
                  onApplyToCurrentInvoice={handleApplyBrandToDrafts}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
