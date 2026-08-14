import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface SalesLineChartProps {
  thisMonthData: { date: string; value: number }[];
  lastMonthData: { date: string; value: number }[];
  height?: number;
}

export default function SalesLineChart({ thisMonthData, lastMonthData, height = 250 }: SalesLineChartProps) {
  // Prepare data for ApexCharts
  // We assume the dates align roughly or we use the 'thisMonthData' dates as categories
  const categories = thisMonthData.map(item => item.date);
  const thisMonthValues = thisMonthData.map(item => item.value);
  const lastMonthValues = lastMonthData.map(item => item.value);

  const options: ApexOptions = {
    chart: {
      type: 'area',
      height: height,
      toolbar: {
        show: false,
      },
      fontFamily: 'Inter, sans-serif',
      zoom: {
        enabled: false,
      },
    },
    colors: ['#3b82f6', '#eab308'], // Blue for This Month, Yellow for Last Month
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
      width: 2,
    },
    xaxis: {
      categories: categories,
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '10px',
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
          fontSize: '10px',
        },
        formatter: (value) => `₹${value.toLocaleString()}`,
      },
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
          return `₹${val.toLocaleString()}`;
        },
      },
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontFamily: 'Inter, sans-serif',
      markers: {
        size: 6,
      },
    },
  };

  const series = [
    {
      name: 'This Month',
      data: thisMonthValues,
    },
    {
      name: 'Last Month',
      data: lastMonthValues,
    },
  ];

  return (
    <div className="w-full">
      <Chart options={options} series={series} type="area" height={height} />
    </div>
  );
}


