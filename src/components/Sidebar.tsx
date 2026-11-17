import React from 'react';
import { motion } from 'motion/react';
import {
  Layers,
  LogOut,
  Plus,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { AuthSession, WorkspaceView } from '../types/invoice';

interface SidebarProps {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  onNewInvoice: () => void;
  ledgerCount: number;
  recipientCount: number;
  session: AuthSession;
  onSignOut: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: WorkspaceView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ledger', label: 'Invoice Ledger', icon: Layers },
  { id: 'recipients', label: 'Recipient Master', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  onNewInvoice,
  ledgerCount,
  recipientCount,
  session,
  onSignOut,
  mobileOpen,
  onCloseMobile,
}) => {
  const initials = session.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#F5F5F7]/90 backdrop-blur-xl border-r border-black/[0.07] px-4 py-5 select-none">
      {/* Brand Wordmark */}
      <div className="flex items-center justify-between px-2.5 mb-7">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[7px] bg-[#1D1D1F] flex items-center justify-center shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12H15M15 12L10.5 7.5M15 12L10.5 16.5M19 6V18"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="font-display font-semibold text-[16px] tracking-[-0.02em] text-[#1D1D1F] whitespace-nowrap">
            Kinetic Cargo
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Quick Action */}
      <button
        type="button"
        onClick={() => {
          onNewInvoice();
          onCloseMobile();
        }}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-6 rounded-xl bg-[#1D1D1F] text-white text-[13px] font-medium tracking-[-0.01em] hover:bg-[#333336] active:scale-[0.985] transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.08)] cursor-pointer whitespace-nowrap"
      >
        <Plus className="w-4 h-4 stroke-[2]" />
        <span>New Invoice</span>
      </button>

      {/* Navigation Links */}
      <nav className="space-y-1 flex-1" aria-label="Workspace">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectView(item.id);
                onCloseMobile();
              }}
              className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                isActive ? 'text-[#1D1D1F]' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.04)]"
                />
              )}
              <span className="relative z-10 flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#1D1D1F]' : 'text-[#86868B]'}`} />
                <span>{item.label}</span>
              </span>
              {item.id === 'ledger' && ledgerCount > 0 && (
                <span className="relative z-10 font-mono text-[11px] text-[#86868B] tabular-nums">
                  {ledgerCount}
                </span>
              )}
              {item.id === 'recipients' && recipientCount > 0 && (
                <span className="relative z-10 font-mono text-[11px] text-[#86868B] tabular-nums">
                  {recipientCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Signed-in Operator & Sign Out */}
      <div className="pt-3.5 mt-4 border-t border-black/[0.06] space-y-3">
        <div className="flex items-center justify-between gap-2 px-1.5">
          <button
            type="button"
            onClick={() => {
              onSelectView('settings');
              onCloseMobile();
            }}
            className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#1D1D1F] text-white text-[11.5px] font-semibold flex items-center justify-center shrink-0">
              {initials || 'KC'}
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-[#1D1D1F] truncate group-hover:text-[#0071E3] transition-colors">
                {session.fullName}
              </p>
              <p className="text-[11px] text-[#86868B] truncate font-mono">{session.email}</p>
            </div>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            title="Sign Out"
            aria-label="Sign Out"
            className="p-1.5 rounded-lg text-[#6E6E73] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="px-1.5 text-[11px] text-[#86868B]">IRP SHA-256 Schema · A4 Vector PDF</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside className="hidden lg:block w-[252px] shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/25 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative w-[264px] max-w-[82vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
