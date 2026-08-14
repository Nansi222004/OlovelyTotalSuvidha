interface GaugeChartProps {
  value: number;
  maxValue: number;
  label: string;
}

export default function GaugeChart({ value, maxValue, label }: GaugeChartProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const angle = (percentage / 100) * 180 - 90; // -90 to 90 degrees
  
  const radius = 80;
  const centerX = 120;
  const centerY = 120;
  
  // Calculate needle position
  const needleLength = radius * 0.7;
  const needleX = centerX + needleLength * Math.cos((angle * Math.PI) / 180);
  const needleY = centerY + needleLength * Math.sin((angle * Math.PI) / 180);

  return (
    <div className="flex flex-col items-center">
      <svg width="240" height="160" viewBox="0 0 240 160" className="w-full h-auto">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#eab308" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>

        {/* Gauge arc */}
        <path
          d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="20"
          strokeLinecap="round"
        />

        {/* Needle */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleX}
          y2={needleY}
          stroke="#1f2937"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Center circle */}
        <circle cx={centerX} cy={centerY} r="8" fill="#1f2937" />

        {/* Scale labels */}
        <text x={centerX - radius - 10} y={centerY + 5} className="text-xs fill-neutral-600" textAnchor="end">0</text>
        <text x={centerX + radius + 10} y={centerY + 5} className="text-xs fill-neutral-600" textAnchor="start">{maxValue}</text>
      </svg>
      
      <div className="mt-2 text-center">
        <div className="text-2xl font-bold text-neutral-900">₹{value.toFixed(2)}</div>
        <div className="text-sm text-neutral-600 mt-1">{label}</div>
      </div>
    </div>
  );
}

