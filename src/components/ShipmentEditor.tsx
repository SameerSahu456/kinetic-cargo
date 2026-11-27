import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { TAX_SLABS } from '../data/presets';
import { InvoiceData, ShipmentCharges, ShipmentRow } from '../types/invoice';
import {
  computeShipmentSummary,
  createShipmentRow,
  DEFAULT_SHIPMENT_HSN,
  EMPTY_SHIPMENT_CHARGES,
  formatMoney,
  round2,
} from '../utils/invoiceMath';
import {
  downloadShipmentTemplate,
  readShipmentFile,
  SHIPMENT_SHEET_COLUMNS,
} from '../utils/shipmentImport';

interface ShipmentEditorProps {
  invoice: InvoiceData;
  onPatch: (patch: Partial<InvoiceData>) => void;
}

const INPUT =
  'w-full px-2 py-1.5 text-[12.5px] bg-white border border-black/[0.1] rounded-md text-[#1D1D1F] placeholder:text-[#A1A1A6] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/15 transition-all duration-150';
const LABEL = 'block text-[11.5px] font-medium text-[#6E6E73] mb-1.5';
const ROW_GRID =
  'grid grid-cols-[28px_128px_96px_minmax(120px,1fr)_minmax(120px,1fr)_76px_56px_72px_64px_92px_28px] gap-1.5 items-center';

const toNum = (v: string) => parseFloat(v) || 0;

export const ShipmentEditor: React.FC<ShipmentEditorProps> = ({ invoice, onPatch }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<{ ok: boolean; text: string } | null>(null);

  const rows = invoice.shipments ?? [];
  const charges: ShipmentCharges = { ...EMPTY_SHIPMENT_CHARGES, ...(invoice.shipmentCharges ?? {}) };
  const summary = computeShipmentSummary(invoice);

  const setRows = (next: ShipmentRow[]) => onPatch({ shipments: next });

  const updateRow = (id: string, patch: Partial<ShipmentRow>) => {
    setRows(
      rows.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (
          !('amount' in patch) &&
          (next.chargedWeight !== row.chargedWeight || next.rate !== row.rate)
        ) {
          next.amount = round2(next.chargedWeight * next.rate);
        }
        return next;
      })
    );
  };

  const addRow = () => {
    const last = rows[rows.length - 1];
    setRows([
      ...rows,
      createShipmentRow({
        bookDate: last?.bookDate || invoice.issueDate,
        bookingBranch: last?.bookingBranch || '',
      }),
    ]);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    setImportNote(null);
    try {
      const imported = await readShipmentFile(file);
      if (imported.length === 0) {
        setImportNote({
          ok: false,
          text: `No shipment rows found in ${file.name}. Check that the columns are: ${SHIPMENT_SHEET_COLUMNS.join(', ')}.`,
        });
        return;
      }
      // Rows left blank in the form are dropped; filled ones are kept.
      const kept = rows.filter((r) => r.awbNo.trim() || r.amount > 0);
      setRows([...kept, ...imported]);
      setImportNote({
        ok: true,
        text: `Added ${imported.length} shipment${imported.length === 1 ? '' : 's'} from ${file.name}.`,
      });
    } catch {
      setImportNote({ ok: false, text: `Could not read ${file.name}. Upload an .xlsx, .xls or .csv file.` });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setCharge = (key: keyof ShipmentCharges, value: number) =>
    onPatch({ shipmentCharges: { ...charges, [key]: value } });

  const chargeFields: [keyof ShipmentCharges, string][] = [
    ['vehicle', 'Vehicle Charges'],
    ['other', 'Other Charge'],
    ['fov', 'FOV Charges'],
    ['oda', 'ODA Charges'],
    ['fuelPercent', 'Fuel Charges %'],
    ['docket', 'Docket Charges'],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div>
          <label className={LABEL}>Bill From Date</label>
          <input
            type="date"
            value={invoice.periodFrom ?? ''}
            onChange={(e) => onPatch({ periodFrom: e.target.value })}
            className={`${INPUT} tabular-nums`}
          />
        </div>
        <div>
          <label className={LABEL}>Bill To Date</label>
          <input
            type="date"
            value={invoice.periodTo ?? ''}
            onChange={(e) => onPatch({ periodTo: e.target.value })}
            className={`${INPUT} tabular-nums`}
          />
        </div>
        <div>
          <label className={LABEL}>HSN / SAC</label>
          <input
            type="text"
            value={invoice.shipmentHsn ?? DEFAULT_SHIPMENT_HSN}
            onChange={(e) => onPatch({ shipmentHsn: e.target.value })}
            className={`${INPUT} font-mono`}
          />
        </div>
        <div>
          <label className={LABEL}>GST %</label>
          <select
            value={invoice.shipmentTaxRate ?? 18}
            onChange={(e) => onPatch({ shipmentTaxRate: toNum(e.target.value) })}
            className={`${INPUT} tabular-nums`}
          >
            {TAX_SLABS.map((slab) => (
              <option key={slab} value={slab}>
                {slab}%
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[11.5px] text-[#86868B] -mt-2">
        Leave the bill dates blank to use the earliest and latest book date.
      </p>

      {/* Shipment rows */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[860px] space-y-1.5">
          <div className={`${ROW_GRID} text-[11px] font-medium text-[#6E6E73]`}>
            <span>Sr</span>
            <span>Book Date</span>
            <span>AWB No.</span>
            <span>Booking Branch</span>
            <span>Destination</span>
            <span>Mode</span>
            <span className="text-right">Pcs</span>
            <span className="text-right">Weight</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          {rows.map((row, idx) => (
            <div key={row.id} className={ROW_GRID}>
              <span className="font-mono text-[11px] text-[#86868B]">{idx + 1}</span>
              <input
                type="date"
                aria-label={`Book date, row ${idx + 1}`}
                value={row.bookDate}
                onChange={(e) => updateRow(row.id, { bookDate: e.target.value })}
                className={`${INPUT} tabular-nums`}
              />
              <input
                type="text"
                aria-label={`AWB number, row ${idx + 1}`}
                value={row.awbNo}
                onChange={(e) => updateRow(row.id, { awbNo: e.target.value })}
                className={`${INPUT} font-mono`}
                placeholder="22397716"
              />
              <input
                type="text"
                aria-label={`Booking branch, row ${idx + 1}`}
                value={row.bookingBranch}
                onChange={(e) => updateRow(row.id, { bookingBranch: e.target.value })}
                className={`${INPUT} uppercase`}
                placeholder="DELHI"
              />
              <input
                type="text"
                aria-label={`Destination, row ${idx + 1}`}
                value={row.destination}
                onChange={(e) => updateRow(row.id, { destination: e.target.value })}
                className={`${INPUT} uppercase`}
                placeholder="MUMBAI"
              />
              <input
                type="text"
                aria-label={`Mode, row ${idx + 1}`}
                value={row.mode ?? ''}
                onChange={(e) => updateRow(row.id, { mode: e.target.value })}
                className={`${INPUT} uppercase`}
                placeholder="AIR"
              />
              {(
                [
                  ['pcs', 'Pieces'],
                  ['chargedWeight', 'Weight'],
                  ['rate', 'Rate'],
                  ['amount', 'Amount'],
                ] as [keyof ShipmentRow, string][]
              ).map(([key, label]) => (
                <input
                  key={key}
                  type="number"
                  min="0"
                  step="any"
                  aria-label={`${label}, row ${idx + 1}`}
                  value={row[key] ?? 0}
                  onChange={(e) => updateRow(row.id, { [key]: toNum(e.target.value) })}
                  className={`${INPUT} tabular-nums text-right`}
                />
              ))}
              <button
                type="button"
                onClick={() => setRows(rows.filter((r) => r.id !== row.id))}
                title="Remove shipment"
                aria-label={`Remove row ${idx + 1}`}
                className="p-1.5 rounded-md text-[#6E6E73] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {rows.length > 0 && (
            <div className={`${ROW_GRID} pt-1.5 border-t border-black/[0.08] text-[12px] font-medium tabular-nums`}>
              <span />
              <span className="col-span-5 text-[#6E6E73]">
                {rows.length} AWB · amount = Weight × Rate, and can be overridden
              </span>
              <span className="text-right pr-2">{summary.totalPcs}</span>
              <span className="text-right pr-2">{summary.totalChargedWeight}</span>
              <span />
              <span className="text-right pr-2">{summary.freightTotal.toFixed(2)}</span>
              <span />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={addRow}
          className="py-2.5 rounded-xl border border-dashed border-black/20 text-[13px] font-medium text-[#1D1D1F] hover:bg-[#FAFAFC] hover:border-black/35 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Shipment</span>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="py-2.5 rounded-xl border border-dashed border-black/20 text-[13px] font-medium text-[#1D1D1F] hover:bg-[#FAFAFC] hover:border-black/35 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>{importing ? 'Reading file…' : 'Upload Excel'}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#86868B] -mt-2">
        <span>Excel columns: {SHIPMENT_SHEET_COLUMNS.join(', ')}.</span>
        <button
          type="button"
          onClick={() => downloadShipmentTemplate()}
          className="inline-flex items-center gap-1 font-medium text-[#0071E3] hover:underline cursor-pointer"
        >
          <Download className="w-3 h-3" />
          <span>Download template</span>
        </button>
      </div>

      {importNote && (
        <p
          role="status"
          className={`px-3.5 py-2 rounded-xl border text-[12px] ${
            importNote.ok
              ? 'bg-emerald-50 border-emerald-200/80 text-emerald-900'
              : 'bg-red-50 border-red-200/80 text-red-900'
          }`}
        >
          {importNote.text}
        </p>
      )}

      {/* Additional charges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {chargeFields.map(([key, label]) => (
          <div key={key}>
            <label className={LABEL}>{label}</label>
            <input
              type="number"
              min="0"
              step="any"
              value={charges[key]}
              onChange={(e) => setCharge(key, toNum(e.target.value))}
              className={`${INPUT} tabular-nums text-right`}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#FAFAFC] border border-black/[0.07] text-[12.5px] tabular-nums">
        <span className="text-[#6E6E73]">
          Total {formatMoney(summary.freightTotal, invoice.currency)}
          {summary.vehicle > 0 && ` · Vehicle ${formatMoney(summary.vehicle, invoice.currency)}`}
          {summary.fuelAmount > 0 && ` · Fuel ${formatMoney(summary.fuelAmount, invoice.currency)}`}
        </span>
        <span className="font-semibold text-[#1D1D1F]">
          Sub Total {formatMoney(summary.subTotal, invoice.currency)} · GST {summary.taxRate}% on
          the sub total
        </span>
      </div>
    </div>
  );
};
