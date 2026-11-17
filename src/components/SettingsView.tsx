import React, { useRef, useState } from 'react';
import {
  Check,
  KeyRound,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import { INDIAN_STATES } from '../data/presets';
import { AuthSession, BrandProfile } from '../types/invoice';
import { changeAccountPassword, updateProfileSession } from '../utils/auth';

interface SettingsViewProps {
  session: AuthSession;
  onUpdateSession: (next: AuthSession) => void;
  onSignOut: () => void;
  brand: BrandProfile;
  onChangeBrand: (updated: BrandProfile) => void;
  onApplyToCurrentInvoice: () => void;
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-[13px] bg-white border border-black/[0.1] rounded-lg text-[#1D1D1F] placeholder:text-[#A1A1A6] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/15 transition-all';

const LABEL_CLASS = 'block text-[11.5px] font-medium text-[#6E6E73] mb-1.5';

export const SettingsView: React.FC<SettingsViewProps> = ({
  session,
  onUpdateSession,
  onSignOut,
  brand,
  onChangeBrand,
  onApplyToCurrentInvoice,
}) => {
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const sigInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [drawing, setDrawing] = useState(false);
  const [appliedToast, setAppliedToast] = useState(false);

  const [fullName, setFullName] = useState(session.fullName);
  const [role, setRole] = useState(session.role);
  const [profileSavedToast, setProfileSavedToast] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwFeedback, setPwFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleImageUpload = (file: File, field: 'logoDataUrl' | 'signatureDataUrl') => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChangeBrand({ ...brand, [field]: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasPoint(e);
    ctx.strokeStyle = '#1D1D1F';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!drawing) return;
    setDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onChangeBrand({ ...brand, signatureDataUrl: canvas.toDataURL('image/png') });
    }
  };

  const clearSignatureCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    onChangeBrand({ ...brand, signatureDataUrl: null });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = updateProfileSession(session.userId, { fullName, role });
    if (updated) {
      onUpdateSession(updated);
      setProfileSavedToast(true);
      setTimeout(() => setProfileSavedToast(false), 2200);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwFeedback(null);
    const res = await changeAccountPassword(session.userId, currentPw, newPw);
    if (res.ok) {
      setCurrentPw('');
      setNewPw('');
      setPwFeedback({ type: 'ok', text: 'Password updated successfully.' });
    } else {
      setPwFeedback({ type: 'err', text: res.error });
    }
  };

  const handleSyncClick = () => {
    onApplyToCurrentInvoice();
    setAppliedToast(true);
    setTimeout(() => setAppliedToast(false), 2500);
  };

  const initials = session.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

  return (
    <div className="max-w-[1040px] mx-auto px-6 py-8 space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[26px] tracking-[-0.025em] text-[#1D1D1F]">
            Settings
          </h1>
          <p className="text-[14px] text-[#6E6E73] mt-1">
            Manage your login session, company logo, authorised signatory, and GST billing defaults.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSyncClick}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D1D1F] text-white text-[13px] font-medium hover:bg-[#333336] transition-colors cursor-pointer whitespace-nowrap"
        >
          {appliedToast ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Applied to Draft Invoices</span>
            </>
          ) : (
            <span>Apply Defaults to Draft Invoices</span>
          )}
        </button>
      </div>

      {/* 01. Account & Login Session */}
      <div className="bg-white rounded-2xl border border-black/[0.08] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#1D1D1F] text-white font-display font-semibold text-[14px] flex items-center justify-center shrink-0">
              {initials || 'KC'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-semibold text-[15px] text-[#1D1D1F]">
                  {session.fullName}
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Signed In
                </span>
              </div>
              <p className="text-[12.5px] text-[#6E6E73] font-mono">{session.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setShowPasswordForm((prev) => !prev);
                setPwFeedback(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-black/[0.1] bg-white text-[12.5px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#6E6E73]" />
              <span>Change Password</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-red-50/70 text-[12.5px] font-medium text-red-700 hover:bg-red-100/70 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-2 border-t border-black/[0.06] items-end">
          <div className="md:col-span-4">
            <label className={LABEL_CLASS}>Operator Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-5">
            <label className={LABEL_CLASS}>Role / Designation</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-lg bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] text-[13px] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {profileSavedToast ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Profile Saved</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-[#6E6E73]" />
                  <span>Update Profile</span>
                </>
              )}
            </button>
          </div>
        </form>

        {showPasswordForm && (
          <form
            onSubmit={handleChangePassword}
            className="p-4 rounded-xl bg-[#FAFAFC] border border-black/[0.07] space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className={LABEL_CLASS}>Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>New Password</label>
                <input
                  type="password"
                  required
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Min. 6 characters"
                  className={INPUT_CLASS}
                />
              </div>
              <button
                type="submit"
                className="py-2 px-4 rounded-lg bg-[#1D1D1F] text-white text-[13px] font-medium hover:bg-[#333336] transition-colors cursor-pointer"
              >
                Save New Password
              </button>
            </div>
            {pwFeedback && (
              <p
                className={`text-[12px] ${
                  pwFeedback.type === 'ok' ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {pwFeedback.text}
              </p>
            )}
          </form>
        )}
      </div>

      {/* 02. Relevant Brand & Signatory Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-black/[0.08] p-6 space-y-5">
          <h2 className="font-display font-semibold text-[15px] text-[#1D1D1F]">
            Company Logo &amp; Invoice Layout
          </h2>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#F5F5F7] border border-black/[0.06] flex items-center justify-center overflow-hidden shrink-0">
              {brand.logoDataUrl ? (
                <img
                  src={brand.logoDataUrl}
                  alt="Company Logo"
                  className="w-full h-full object-contain p-1.5"
                />
              ) : (
                <span className="font-display font-bold text-[18px] text-[#1D1D1F]">
                  {(brand.seller.legalName || 'K').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f, 'logoDataUrl');
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5F5F7] text-[12.5px] font-medium text-[#1D1D1F] hover:bg-[#E8E8ED] transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Logo</span>
                </button>
                {brand.logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => onChangeBrand({ ...brand, logoDataUrl: null })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12.5px] text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <p className="text-[11.5px] text-[#86868B]">
                PNG or JPG company mark rendered on exported invoice PDFs.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.08] p-6 space-y-4">
          <h2 className="font-display font-semibold text-[15px] text-[#1D1D1F]">
            Authorised Signatory
          </h2>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={LABEL_CLASS}>Signatory Name</label>
              <input
                type="text"
                value={brand.signatoryName}
                onChange={(e) => onChangeBrand({ ...brand, signatoryName: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Designation</label>
              <input
                type="text"
                value={brand.signatoryTitle}
                onChange={(e) => onChangeBrand({ ...brand, signatoryTitle: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11.5px] font-medium text-[#6E6E73]">
                Signature (Draw or Upload PNG)
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  ref={sigInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f, 'signatureDataUrl');
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => sigInputRef.current?.click()}
                  className="text-[11.5px] font-medium text-[#0071E3] hover:underline cursor-pointer"
                >
                  Upload Image
                </button>
                <button
                  type="button"
                  onClick={clearSignatureCanvas}
                  className="inline-flex items-center gap-1 text-[11.5px] text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-black/[0.1] bg-[#FAFAFC] overflow-hidden">
              <canvas
                ref={canvasRef}
                width={480}
                height={110}
                onPointerDown={startDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
                className="w-full h-[104px] touch-none cursor-crosshair block"
              />
              {brand.signatureDataUrl && (
                <div className="px-3 py-1.5 bg-white border-t border-black/[0.06] flex items-center justify-between">
                  <span className="text-[11px] text-[#6E6E73]">Active signature</span>
                  <img
                    src={brand.signatureDataUrl}
                    alt="Active signature"
                    className="h-7 object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 03. Supplier Entity & Settlement Bank Defaults */}
      <div className="bg-white rounded-2xl border border-black/[0.08] p-6 space-y-5">
        <h2 className="font-display font-semibold text-[15px] text-[#1D1D1F]">
          Default Supplier Entity &amp; Settlement Bank
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={LABEL_CLASS}>Supplier Legal Name</label>
            <input
              type="text"
              value={brand.seller.legalName}
              onChange={(e) =>
                onChangeBrand({ ...brand, seller: { ...brand.seller, legalName: e.target.value } })
              }
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Supplier GSTIN</label>
            <input
              type="text"
              maxLength={15}
              value={brand.seller.gstin}
              onChange={(e) =>
                onChangeBrand({
                  ...brand,
                  seller: { ...brand.seller, gstin: e.target.value.toUpperCase() },
                })
              }
              className={`${INPUT_CLASS} font-mono uppercase`}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>PAN Number</label>
            <input
              type="text"
              maxLength={10}
              value={brand.seller.pan || ''}
              onChange={(e) =>
                onChangeBrand({
                  ...brand,
                  seller: { ...brand.seller, pan: e.target.value.toUpperCase() },
                })
              }
              className={`${INPUT_CLASS} font-mono uppercase`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className={LABEL_CLASS}>Registered Address</label>
            <input
              type="text"
              value={brand.seller.address}
              onChange={(e) =>
                onChangeBrand({ ...brand, seller: { ...brand.seller, address: e.target.value } })
              }
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>City</label>
            <input
              type="text"
              value={brand.seller.city}
              onChange={(e) =>
                onChangeBrand({ ...brand, seller: { ...brand.seller, city: e.target.value } })
              }
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>State</label>
            <select
              value={brand.seller.stateCode}
              onChange={(e) => {
                const st = INDIAN_STATES.find((s) => s.code === e.target.value);
                if (st) {
                  onChangeBrand({
                    ...brand,
                    seller: { ...brand.seller, stateCode: st.code, stateName: st.name },
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-black/[0.06]">
          <div className="md:col-span-4">
            <label className={LABEL_CLASS}>Payments in Favor of (Account Name)</label>
            <input
              type="text"
              value={brand.bank.accountName}
              onChange={(e) =>
                onChangeBrand({ ...brand, bank: { ...brand.bank, accountName: e.target.value } })
              }
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Bank Name</label>
            <input
              type="text"
              value={brand.bank.bankName}
              onChange={(e) =>
                onChangeBrand({ ...brand, bank: { ...brand.bank, bankName: e.target.value } })
              }
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Account Number</label>
            <input
              type="text"
              value={brand.bank.accountNumber}
              onChange={(e) =>
                onChangeBrand({ ...brand, bank: { ...brand.bank, accountNumber: e.target.value } })
              }
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>IFSC Code</label>
            <input
              type="text"
              value={brand.bank.ifscCode}
              onChange={(e) =>
                onChangeBrand({
                  ...brand,
                  bank: { ...brand.bank, ifscCode: e.target.value.toUpperCase() },
                })
              }
              className={`${INPUT_CLASS} font-mono uppercase`}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>UPI ID</label>
            <input
              type="text"
              value={brand.bank.upiId || ''}
              onChange={(e) =>
                onChangeBrand({ ...brand, bank: { ...brand.bank, upiId: e.target.value } })
              }
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
