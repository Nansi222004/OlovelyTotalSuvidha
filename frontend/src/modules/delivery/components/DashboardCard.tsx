import { ReactNode } from 'react';

interface DashboardCardProps {
  icon: ReactNode;
  title: string;
  value: string | number;
  accentColor: string;
  onClick?: () => void;
}

export default function DashboardCard({ icon, title, value, accentColor, onClick }: DashboardCardProps) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl p-4 shadow-sm flex flex-col items-center justify-center min-h-[120px] border border-neutral-200 hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="mb-3" style={{ color: accentColor }}>
        {icon}
      </div>
      <p className="text-neutral-600 text-xs font-medium text-center mb-2">{title}</p>
      <p className="text-neutral-900 text-2xl font-bold">{value}</p>
    </div>
  );
}




