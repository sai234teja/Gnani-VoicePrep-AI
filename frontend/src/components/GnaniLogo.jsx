import React from 'react';

/**
 * GnaniLogo
 * Standalone, scalable SVG brand mark for Gnani VoicePrep
 * Combines acoustic frequency bars with speech aperture geometry.
 * Designed for clean enterprise surfaces (#FFFFFF and #F5F7FA).
 */
export const GnaniLogo = ({
  variant = 'light', // 'light' (on white/light surfaces) | 'dark' (on dark surfaces) | 'mark-only'
  size = 'md', // 'sm' (24px mark), 'md' (32px mark), 'lg' (40px mark)
  className = ''
}) => {
  const markDimensions = {
    sm: { width: 24, height: 24, rx: 6 },
    md: { width: 32, height: 32, rx: 8 },
    lg: { width: 40, height: 40, rx: 10 }
  }[size] || { width: 32, height: 32, rx: 8 };

  const isDark = variant === 'dark';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Brand Icon Mark */}
      <svg
        width={markDimensions.width}
        height={markDimensions.height}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="#315C8C" />
        <g fill="#FFFFFF">
          <rect x="7" y="12" width="2.5" height="8" rx="1.25" opacity="0.85" />
          <rect x="11.5" y="8" width="2.5" height="16" rx="1.25" opacity="0.95" />
          <rect x="16" y="5" width="2.5" height="22" rx="1.25" />
          <rect x="20.5" y="8" width="2.5" height="16" rx="1.25" opacity="0.95" />
          <rect x="25" y="12" width="2.5" height="8" rx="1.25" opacity="0.85" />
        </g>
      </svg>

      {/* Logotype */}
      {variant !== 'mark-only' && (
        <div className="flex flex-col text-left leading-tight">
          <div className="flex items-center gap-1 font-sans text-sm tracking-tight font-bold">
            <span className={isDark ? 'text-white' : 'text-[#172B45]'}>Gnani</span>
            <span className={isDark ? 'text-indigo-400' : 'text-[#315C8C]'}>VoicePrep</span>
          </div>
          <span className={`text-[9px] font-semibold tracking-wider uppercase font-mono ${isDark ? 'text-slate-400' : 'text-[#64748B]'}`}>
            Talent Assessment
          </span>
        </div>
      )}
    </div>
  );
};
