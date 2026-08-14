import { ReactNode } from 'react';

interface SummaryBarProps {
  leftIcon: ReactNode;
  leftLabel: string;
  leftValue: string;
  rightIcon: ReactNode;
  rightLabel: string;
  rightValue: string;
  accentColor: string;
}

export default function SummaryBar({
  leftIcon,
  leftLabel,
  leftValue,
  rightIcon,
  rightLabel,
  rightValue,
  accentColor,
}: SummaryBarProps) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between border border-neutral-200 hover:shadow-md transition-shadow">
      {/* Left Section */}
      <div className="flex items-center gap-3 flex-1">
        <div style={{ color: accentColor }}>
          {leftIcon}
        </div>
        <div className="flex flex-col">
          <span className="text-neutral-600 text-xs font-medium">{leftLabel}</span>
          <span className="text-neutral-900 text-lg font-bold">{leftValue}</span>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3 flex-1 justify-end">
        <div style={{ color: accentColor }}>
          {rightIcon}
        </div>
        <div className="flex flex-col items-end">
          <span className="text-neutral-600 text-xs font-medium">{rightLabel}</span>
          <span className="text-neutral-900 text-lg font-bold">{rightValue}</span>
        </div>
      </div>
    </div>
  );
}




