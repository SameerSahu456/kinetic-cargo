import React from 'react';
import { BrandProfile } from '../types/invoice';

interface BrandMonogramProps {
  brand: BrandProfile;
  size?: number;
  inverted?: boolean;
}

export const BrandMonogram: React.FC<BrandMonogramProps> = ({
  brand,
  size = 38,
  inverted = false,
}) => {
  if (brand.logoDataUrl) {
    return (
      <img
        src={brand.logoDataUrl}
        alt={brand.seller.tradeName || brand.seller.legalName}
        referrerPolicy="no-referrer"
        style={{ width: size, height: size }}
        className="object-contain rounded-lg shrink-0"
      />
    );
  }

  if (brand.monogramId === 'none') return null;

  const bg = inverted ? '#FFFFFF' : brand.accentColor;
  const fg = inverted ? brand.accentColor : '#FFFFFF';
  const initial = (brand.seller.tradeName || brand.seller.legalName || 'V')
    .trim()
    .charAt(0)
    .toUpperCase();

  if (brand.monogramId === 'atelier') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="shrink-0">
        <rect width="40" height="40" rx="10" fill={bg} />
        <path d="M12 28L20 11L28 28" stroke={fg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.2 22.5H24.8" stroke={fg} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (brand.monogramId === 'nordic') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="shrink-0">
        <rect width="40" height="40" rx="10" fill={bg} />
        <rect x="11" y="11" width="7.5" height="18" rx="1.5" fill={fg} />
        <rect x="21.5" y="11" width="7.5" height="11" rx="1.5" fill={fg} fillOpacity="0.65" />
      </svg>
    );
  }

  if (brand.monogramId === 'prism') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="shrink-0">
        <rect width="40" height="40" rx="10" fill={bg} />
        <polygon points="20,9 31,28 9,28" stroke={fg} strokeWidth="2.2" strokeLinejoin="round" />
        <line x1="20" y1="9" x2="20" y2="28" stroke={fg} strokeWidth="1.6" strokeOpacity="0.7" />
      </svg>
    );
  }

  return (
    <div
      style={{ width: size, height: size, backgroundColor: bg, color: fg }}
      className="rounded-[9px] flex items-center justify-center font-display font-bold text-base tracking-tight shrink-0 select-none"
    >
      {initial}
    </div>
  );
};
