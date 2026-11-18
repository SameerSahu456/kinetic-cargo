export type DocumentType = 'INV' | 'CRN' | 'DBN';

export type SupplyType = 'B2B' | 'SEZWP' | 'SEZWOP' | 'EXPWP' | 'EXPWOP' | 'DEXP';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';

export type PdfTemplateId = 'gst-standard';

export type WorkspaceView = 'ledger' | 'recipients' | 'receipts' | 'settings';

export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  role: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface AuthSession {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  signedInAt: string;
}

export type PaymentMode = 'NEFT / RTGS' | 'UPI' | 'Cheque' | 'Wire Transfer' | 'Card' | 'Cash';

export interface PartyDetails {
  legalName: string;
  tradeName?: string;
  gstin: string;
  pan?: string;
  address: string;
  city: string;
  stateCode: string;
  stateName: string;
  pincode: string;
  email: string;
  phone: string;
}

export interface DispatchDetails {
  enabled: boolean;
  shipToName: string;
  shipToAddress: string;
  shipToCity: string;
  shipToStateCode: string;
  shipToStateName: string;
  shipToPincode: string;
  transporterName: string;
  transporterId: string;
  transportMode: 'Road' | 'Rail' | 'Air' | 'Ship';
  vehicleNumber: string;
  ewayBillNo: string;
}

export interface LineItem {
  id: string;
  name: string;
  description?: string;
  hsnCode: string;
  isService: boolean;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  taxRate: number; // total GST % (e.g., 18 => 9% CGST + 9% SGST or 18% IGST)
  cessRate: number;
}

// One consignment on an AWB-wise courier/cargo bill.
export interface ShipmentRow {
  id: string;
  bookDate: string; // ISO yyyy-mm-dd
  awbNo: string;
  bookingBranch: string;
  destination: string;
  mode?: string; // e.g. AIR / SURFACE
  pcs: number;
  actualWeight: number;
  chargedWeight: number;
  rate: number;
  vehicleCharges?: number;
  amount: number; // normally chargedWeight x rate + vehicleCharges, editable for minimum charges
}

export interface ShipmentCharges {
  other: number;
  fov: number;
  oda: number;
  fuelPercent: number; // % of the freight total
  docket: number;
}

export type BillingMode = 'items' | 'shipments';

export interface ComputedLineItem extends LineItem {
  grossAmount: number;
  discountAmount: number;
  taxableValue: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalAmount: number;
}

export interface InvoiceTotals {
  isIntraState: boolean;
  grossTotal: number;
  totalDiscount: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  taxTotal: number;
  preRoundTotal: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
}

export interface IrnDetails {
  irn: string; // 64-char SHA-256 hex
  ackNo: string; // 15-digit acknowledgement number
  ackDate: string; // ISO string
  signedQrPayload: string;
  qrDataUrl: string; // PNG data URL
  status: 'ACTIVE' | 'CANCELLED';
  cancelledAt?: string; // ISO string, set when status becomes CANCELLED
  docNumber?: string; // invoice number this IRN was issued against
  fingerprint: string; // hash of invoice fields at generation time to detect edits
}

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId?: string;
}

export interface BrandProfile {
  seller: PartyDetails;
  bank: BankDetails;
  logoDataUrl: string | null;
  monogramId: 'vellum' | 'atelier' | 'nordic' | 'prism' | 'none';
  accentColor: string;
  templateId: PdfTemplateId;
  signatoryName: string;
  signatoryTitle: string;
  signatureDataUrl: string | null;
  defaultTerms: string;
  defaultNotes: string;
  footerTagline: string;
}

export interface InvoiceData {
  id: string;
  docType: DocumentType;
  supplyType: SupplyType;
  invoiceNumber: string;
  financialYear: string;
  issueDate: string;
  dueDate: string;
  poNumber: string;
  awbNumber?: string;
  deliveryNote?: string;
  paymentTerms?: string;
  otherReferences?: string;
  termsOfDelivery?: string;
  currency: CurrencyCode;
  reverseCharge: boolean;
  placeOfSupplyCode: string;
  placeOfSupplyName: string;
  seller: PartyDetails;
  buyer: PartyDetails;
  dispatch: DispatchDetails;
  items: LineItem[];
  // 'shipments' bills AWB-wise from `shipments`; absent/'items' uses `items`.
  billingMode?: BillingMode;
  shipments?: ShipmentRow[];
  shipmentCharges?: ShipmentCharges;
  shipmentHsn?: string;
  shipmentTaxRate?: number;
  periodFrom?: string; // ISO date; defaults to the earliest book date
  periodTo?: string; // ISO date; defaults to the latest book date
  bank: BankDetails;
  notes: string;
  terms: string;
  autoRoundOff: boolean;
  irn: IrnDetails | null;
  cancelledIrns?: IrnDetails[]; // earlier IRNs cancelled by a re-issue, oldest first
  cancelledAt?: string; // ISO string, set once the whole invoice is cancelled
  createdAt: string;
  updatedAt: string;
  source: 'manual' | 'sheet';
}

export interface SheetColumnMapping {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  buyerName: string;
  buyerGstin: string;
  buyerAddress: string;
  buyerCity: string;
  buyerState: string;
  buyerPincode: string;
  buyerEmail: string;
  itemName: string;
  hsnCode: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercent: string;
  taxRate: string;
  poNumber: string;
}

export interface RecipientRecord extends PartyDetails {
  id: string;
  contactPerson?: string;
  creditDays?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptData {
  id: string;
  receiptNumber: string;
  receiptDate: string;
  currency: CurrencyCode;
  paymentMode: PaymentMode;
  referenceNumber: string;
  linkedInvoiceNumber: string;
  linkedIrn?: string;
  invoiceTotal: number;
  amountReceived: number;
  tdsDeducted: number;
  seller: PartyDetails;
  recipient: PartyDetails;
  bank: BankDetails;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}
