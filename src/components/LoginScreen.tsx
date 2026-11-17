import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, User, Briefcase } from 'lucide-react';
import { AuthSession } from '../types/invoice';
import {
  DEMO_OPERATOR_EMAIL,
  DEMO_OPERATOR_PASSWORD,
  ensureDefaultAccount,
  registerWorkspaceAccount,
  signInWithCredentials,
} from '../utils/auth';

interface LoginScreenProps {
  onAuthenticated: (session: AuthSession) => void;
}

const INPUT_CLASS =
  'w-full pl-10 pr-3.5 py-2.5 text-[13.5px] bg-[#FAFAFC] border border-black/[0.1] rounded-xl text-[#1D1D1F] placeholder:text-[#A1A1A6] focus:outline-none focus:bg-white focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/15 transition-all';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Finance & Billing Lead');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void ensureDefaultAccount();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const res = await signInWithCredentials(email, password);
        if (res.ok) {
          onAuthenticated(res.session);
        } else {
          setError(res.error);
        }
      } else {
        const res = await registerWorkspaceAccount({ fullName, email, role, password });
        if (res.ok) {
          onAuthenticated(res.session);
        } else {
          setError(res.error);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await signInWithCredentials(DEMO_OPERATOR_EMAIL, DEMO_OPERATOR_PASSWORD);
      if (res.ok) {
        onAuthenticated(res.session);
      } else {
        setError(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] flex flex-col items-center justify-center p-5 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(0,113,227,0.05),_transparent_55%)]" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-11 h-11 rounded-[12px] bg-[#1D1D1F] flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(0,0,0,0.28)] mb-3.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12H15M15 12L10.5 7.5M15 12L10.5 16.5M19 6V18"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="font-display font-semibold text-[24px] tracking-[-0.025em] text-[#1D1D1F]">
            Kinetic Cargo
          </h1>
          <p className="text-[13.5px] text-[#6E6E73] mt-1">
            GST e-Invoicing, IRN &amp; Compliance Workspace
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl border border-black/[0.08] shadow-[0_24px_60px_-18px_rgba(0,0,0,0.08)] p-6 sm:p-7 space-y-5">
          {/* Segmented Switch */}
          <div className="grid grid-cols-2 p-1 bg-[#F5F5F7] rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              className={`py-1.5 text-[13px] font-medium rounded-lg transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`py-1.5 text-[13px] font-medium rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-[11.5px] font-medium text-[#6E6E73] mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Aarav Mehta"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11.5px] font-medium text-[#6E6E73] mb-1.5">
                    Role / Designation
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Finance & Billing Lead"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-[11.5px] font-medium text-[#6E6E73] mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ops@kineticcargo.in"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11.5px] font-medium text-[#6E6E73] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Minimum 6 characters' : 'Enter password'}
                  className={`${INPUT_CLASS} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200/80 text-[12px] text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1D1D1F] text-white text-[13.5px] font-medium hover:bg-[#333336] active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{mode === 'signin' ? 'Sign In to Workspace' : 'Create Workspace Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {mode === 'signin' && (
            <div className="pt-4 border-t border-black/[0.06] space-y-2.5">
              <button
                type="button"
                onClick={handleDemoSignIn}
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] text-[13px] font-medium hover:bg-[#E8E8ED] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#0071E3]" />
                <span>Sign In as Demo Operator</span>
              </button>
              <p className="text-[11px] text-center text-[#86868B] font-mono">
                {DEMO_OPERATOR_EMAIL} · {DEMO_OPERATOR_PASSWORD}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
