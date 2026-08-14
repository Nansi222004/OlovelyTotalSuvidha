import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface OrderChartProps {
  title: string;
  data: { date: string; value: number }[];
  maxValue: number;
  height?: number;
}

export default function OrderChart({ title, data, maxValue, height = 400 }: OrderChartProps) {
  // Extract categories (dates) and series data (values)
  const categories = data.map(item => item.date);
  const seriesData = data.map(item => item.value);

  const options: ApexOptions = {
    chart: {
      type: 'area',
      height: height,
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      fontFamily: 'Inter, sans-serif',
    },
    colors: ['#a855f7'], // Purple theme
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
      width: 3,
    },
    xaxis: {
      categories: categories,
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '12px',
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '12px',
        },
        formatter: (value) => value.toFixed(0),
      },
      max: maxValue, // Maintain consistent scale with prop
    },
    grid: {
      show: true,
      borderColor: '#f3f4f6',
      strokeDashArray: 4,
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 10,
      },
    },
    tooltip: {
      theme: 'light',
      y: {
        formatter: function (val) {
          return val.toString();
        },
      },
      marker: {
        show: true,
      },
    },
    markers: {
      size: 0,
      hover: {
        size: 6,
      },
    },
  };

  const series = [
    {
      name: 'Orders',
      data: seriesData,
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg border border-neutral-200 p-4 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-bold text-neutral-900">{title}</h3>
      </div>
      <div className="w-full">
        <Chart options={options} series={series} type="area" height={height} />
      </div>
    </div>
  );
}


