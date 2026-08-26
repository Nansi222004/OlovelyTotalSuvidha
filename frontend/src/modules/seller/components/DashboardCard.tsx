import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export interface DashboardCardProps {
  icon: ReactNode;
  title: string;
  value: number | string;
  accentColor: string;
  to?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

export default function DashboardCard({
  icon,
  title,
  value,
  accentColor,
  to,
  onClick,
  ariaLabel,
}: DashboardCardProps) {
  const navigate = useNavigate();
  const isClickable = Boolean(to || onClick);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isClickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={ariaLabel || (isClickable ? `View ${title}: ${value}` : undefined)}
      className={`bg-white rounded-lg shadow-sm border border-neutral-200 p-3 sm:p-4 md:p-5 ${
        isClickable
          ? 'cursor-pointer hover:shadow-md hover:border-neutral-300 hover:-translate-y-0.5 active:translate-y-0 active:shadow-xs transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-500 select-none'
          : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="p-2 sm:p-3 rounded-lg" style={{ backgroundColor: `${accentColor}20` }}>
          <div style={{ color: accentColor }} className="w-6 h-6 sm:w-8 sm:h-8">
            {icon}
          </div>
        </div>
      </div>
      <h3 className="text-neutral-600 text-xs sm:text-sm font-medium mb-1">{title}</h3>
      <p className="text-xl sm:text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}


