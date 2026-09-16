import React from 'react';
import { getTheme, Theme } from '../utils/themes';
import { useThemeContext } from '../context/ThemeContext';
import { useAppSettings } from '../context/AppSettingsContext';

export type ChannelFilterValue = 'ALL' | 'QUICK_COMMERCE' | 'ECOMMERCE' | 'WHOLESALE';

interface ChannelFilterProps {
  value: ChannelFilterValue;
  onChange: (value: ChannelFilterValue) => void;
  counts?: {
    all?: number;
    quickCommerce?: number;
    ecommerce?: number;
    wholesale?: number;
  };
  className?: string;
  theme?: Theme;
  activeTab?: string;
  variant?: 'header' | 'light';
}

export default function ChannelFilter({
  value,
  onChange,
  counts,
  className = '',
  theme: propTheme,
  activeTab,
  variant = 'header',
}: ChannelFilterProps) {
  const { settings: appSettings } = useAppSettings();
  const showWholesale = appSettings.wholesaleSettings?.wholesaleDisplayEnabled !== false;

  // If light variant requested (e.g. for Category page with white cards/background)
  if (variant === 'light') {
    return (
      <div
        className={`w-full py-2 px-3 flex items-center justify-center bg-white border-b border-slate-100 ${className}`}
      >
        <div
          role="tablist"
          aria-label="Fulfillment channel filter"
          className="inline-flex items-center p-0.5 sm:p-1 rounded-full bg-slate-100/90 border border-slate-200/80 shadow-2xs max-w-full overflow-x-auto scrollbar-hide"
        >
          <button
            type="button"
            role="tab"
            aria-selected={value === 'ALL'}
            onClick={() => onChange('ALL')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer select-none active:scale-95 ${
              value === 'ALL'
                ? 'bg-white text-green-800 shadow-xs ring-1 ring-black/5 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span>All</span>
            {counts?.all !== undefined && (
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                  value === 'ALL'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {counts.all}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={value === 'QUICK_COMMERCE'}
            onClick={() => onChange('QUICK_COMMERCE')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer select-none active:scale-95 ${
              value === 'QUICK_COMMERCE'
                ? 'bg-white text-green-800 shadow-xs ring-1 ring-black/5 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span className="text-xs">⚡</span>
            <span>Quick Commerce</span>
            {counts?.quickCommerce !== undefined && (
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                  value === 'QUICK_COMMERCE'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {counts.quickCommerce}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={value === 'ECOMMERCE'}
            onClick={() => onChange('ECOMMERCE')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer select-none active:scale-95 ${
              value === 'ECOMMERCE'
                ? 'bg-white text-green-800 shadow-xs ring-1 ring-black/5 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span className="text-xs">📦</span>
            <span>Ecommerce</span>
            {counts?.ecommerce !== undefined && (
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                  value === 'ECOMMERCE'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {counts.ecommerce}
              </span>
            )}
          </button>

          {showWholesale && (
            <button
              type="button"
              role="tab"
              aria-selected={value === 'WHOLESALE'}
              onClick={() => onChange('WHOLESALE')}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer select-none active:scale-95 ${
                value === 'WHOLESALE'
                  ? 'bg-white text-green-800 shadow-xs ring-1 ring-black/5 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span className="text-xs">🏷️</span>
              <span>Wholesale</span>
              {counts?.wholesale !== undefined && (
                <span
                  className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                    value === 'WHOLESALE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-200/70 text-slate-600'
                  }`}
                >
                  {counts.wholesale}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Consume dynamic theme from ThemeContext as the source of truth, with prop overrides
  let contextTheme: Theme | undefined;
  try {
    const themeContext = useThemeContext();
    contextTheme = themeContext?.currentTheme;
  } catch {
    // Graceful fallback if rendered outside ThemeProvider
  }

  const theme: Theme =
    propTheme ||
    (activeTab ? getTheme(activeTab) : undefined) ||
    contextTheme ||
    getTheme('all');

  // Dynamic header gradient from active category theme
  const heroGradient = `linear-gradient(to right, ${theme.primary[0]}, ${theme.primary[1] || theme.primary[0]}, ${theme.primary[0]})`;

  // Selected pill text color: theme-tinted for high contrast against pure white surface
  const selectedTextColor =
    theme.headerTextColor === '#ffffff'
      ? (theme.accentColor && theme.accentColor !== '#000' ? theme.accentColor : '#15803d')
      : (theme.headerTextColor || theme.textColor || '#15803d');

  // Unselected text color: theme header text color for readability against header background
  const unselectedTextColor = theme.headerTextColor || theme.textColor || '#1a1a1a';

  return (
    <div
      className={`w-full py-1.5 px-3 flex items-center justify-center transition-all duration-300 ${className}`}
      style={{
        background: heroGradient,
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
      }}
    >
      <div
        role="tablist"
        aria-label="Fulfillment channel filter"
        className="inline-flex items-center p-0.5 sm:p-1 rounded-full max-w-full overflow-x-auto scrollbar-hide shadow-inner transition-colors duration-300"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.35)',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={value === 'ALL'}
          onClick={() => onChange('ALL')}
          className={`flex items-center justify-center gap-1 sm:gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer select-none active:scale-95 ${
            value === 'ALL'
              ? 'bg-white shadow-xs ring-1 ring-black/5 font-extrabold'
              : 'hover:bg-white/15'
          }`}
          style={{
            color: value === 'ALL' ? selectedTextColor : unselectedTextColor,
          }}
        >
          <span>All</span>
          {counts?.all !== undefined && (
            <span
              className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors"
              style={{
                backgroundColor: value === 'ALL' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.12)',
                color: value === 'ALL' ? selectedTextColor : unselectedTextColor,
              }}
            >
              {counts.all}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={value === 'QUICK_COMMERCE'}
          onClick={() => onChange('QUICK_COMMERCE')}
          className={`flex items-center justify-center gap-1 sm:gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer select-none active:scale-95 ${
            value === 'QUICK_COMMERCE'
              ? 'bg-white shadow-xs ring-1 ring-black/5 font-extrabold'
              : 'hover:bg-white/15'
          }`}
          style={{
            color: value === 'QUICK_COMMERCE' ? selectedTextColor : unselectedTextColor,
          }}
        >
          <span className="text-xs">⚡</span>
          <span>Quick Commerce</span>
          {counts?.quickCommerce !== undefined && (
            <span
              className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors"
              style={{
                backgroundColor: value === 'QUICK_COMMERCE' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.12)',
                color: value === 'QUICK_COMMERCE' ? selectedTextColor : unselectedTextColor,
              }}
            >
              {counts.quickCommerce}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={value === 'ECOMMERCE'}
          onClick={() => onChange('ECOMMERCE')}
          className={`flex items-center justify-center gap-1 sm:gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer select-none active:scale-95 ${
            value === 'ECOMMERCE'
              ? 'bg-white shadow-xs ring-1 ring-black/5 font-extrabold'
              : 'hover:bg-white/15'
          }`}
          style={{
            color: value === 'ECOMMERCE' ? selectedTextColor : unselectedTextColor,
          }}
        >
          <span className="text-xs">📦</span>
          <span>Ecommerce</span>
          {counts?.ecommerce !== undefined && (
            <span
              className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors"
              style={{
                backgroundColor: value === 'ECOMMERCE' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.12)',
                color: value === 'ECOMMERCE' ? selectedTextColor : unselectedTextColor,
              }}
            >
              {counts.ecommerce}
            </span>
          )}
        </button>

        {showWholesale && (
          <button
            type="button"
            role="tab"
            aria-selected={value === 'WHOLESALE'}
            onClick={() => onChange('WHOLESALE')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer select-none active:scale-95 ${
              value === 'WHOLESALE'
                ? 'bg-white shadow-xs ring-1 ring-black/5 font-extrabold'
                : 'hover:bg-white/15'
            }`}
            style={{
              color: value === 'WHOLESALE' ? selectedTextColor : unselectedTextColor,
            }}
          >
            <span className="text-xs">🏷️</span>
            <span>Wholesale</span>
            {counts?.wholesale !== undefined && (
              <span
                className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors"
                style={{
                  backgroundColor: value === 'WHOLESALE' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.12)',
                  color: value === 'WHOLESALE' ? selectedTextColor : unselectedTextColor,
                }}
              >
                {counts.wholesale}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
