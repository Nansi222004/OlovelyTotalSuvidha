export interface AdminDashboardStats {
  totalUser: number;
  totalCategory: number;
  totalSubcategory: number;
  totalProduct: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  soldOutProducts: number;
  lowStockProducts: number;
  orderDataDec2025: { date: string; value: number }[];
  orderData2025: { date: string; value: number }[];
  salesThisMonth: { date: string; value: number }[];
  salesLastMonth: { date: string; value: number }[];
  salesByLocation: { location: string; amount: number }[];
  avgCompletedOrderValue: number;
}

export const getAdminDashboardStats = (): AdminDashboardStats => {
  const orderDataDec2025 = [
    { date: '01-Dec', value: 0 },
    { date: '02-Dec', value: 1 },
    { date: '03-Dec', value: 0 },
    { date: '04-Dec', value: 3 },
    { date: '05-Dec', value: 3 },
    { date: '06-Dec', value: 2 },
    { date: '07-Dec', value: 2 },
    { date: '08-Dec', value: 2 },
    { date: '09-Dec', value: 0 },
    { date: '10-Dec', value: 0 },
    { date: '11-Dec', value: 0 },
    { date: '12-Dec', value: 0 },
    { date: '13-Dec', value: 0 },
    { date: '14-Dec', value: 0 },
    { date: '15-Dec', value: 0 },
    { date: '16-Dec', value: 0 },
    { date: '17-Dec', value: 0 },
    { date: '18-Dec', value: 0 },
    { date: '19-Dec', value: 0 },
    { date: '20-Dec', value: 0 },
    { date: '21-Dec', value: 0 },
    { date: '22-Dec', value: 0 },
    { date: '23-Dec', value: 0 },
    { date: '24-Dec', value: 0 },
    { date: '25-Dec', value: 0 },
    { date: '26-Dec', value: 0 },
    { date: '27-Dec', value: 0 },
    { date: '28-Dec', value: 0 },
    { date: '29-Dec', value: 0 },
    { date: '30-Dec', value: 0 },
    { date: '31-Dec', value: 0 },
  ];

  const orderData2025 = [
    { date: 'January', value: 0 },
    { date: 'February', value: 0 },
    { date: 'March', value: 20 },
    { date: 'April', value: 40 },
    { date: 'May', value: 30 },
    { date: 'June', value: 60 },
    { date: 'July', value: 20 },
    { date: 'August', value: 30 },
    { date: 'September', value: 40 },
    { date: 'October', value: 75 },
    { date: 'November', value: 60 },
    { date: 'December', value: 10 },
  ];

  // Sales data for line chart (This Month vs Last Month)
  const salesThisMonth = [
    { date: 'Week 1', value: 5000 },
    { date: 'Week 2', value: 15000 },
    { date: 'Week 3', value: 28000 },
    { date: 'Week 4', value: 10000 },
    { date: 'Week 5', value: 12000 },
  ];

  const salesLastMonth = [
    { date: 'Week 1', value: 20000 },
    { date: 'Week 2', value: 35000 },
    { date: 'Week 3', value: 58000 },
    { date: 'Week 4', value: 45000 },
    { date: 'Week 5', value: 30000 },
  ];

  return {
    totalUser: 775,
    totalCategory: 13,
    totalSubcategory: 26,
    totalProduct: 83,
    totalOrders: 405,
    completedOrders: 13,
    pendingOrders: 22,
    cancelledOrders: 195,
    soldOutProducts: 6,
    lowStockProducts: 5,
    orderDataDec2025,
    orderData2025,
    salesThisMonth,
    salesLastMonth,
    salesByLocation: [
      { location: 'Bhandara', amount: 247200 },
      { location: 'Unknown', amount: 210400 },
      { location: 'Bengaluru', amount: 100 },
    ],
    avgCompletedOrderValue: 781.98,
  };
};

export interface NewOrder {
  id: number;
  userDetails: string;
  orderDate: string;
  status: string;
  amount: number;
}

export const getNewOrders = (): NewOrder[] => {
  return [];
};

export interface TopSeller {
  id: number;
  sellerName: string;
  storeName: string;
  totalRevenue: number;
}

export const getTopSellers = (): TopSeller[] => {
  return [
    {
      id: 1,
      sellerName: 'Chirag Seller',
      storeName: 'Chirag store',
      totalRevenue: 41094.7,
    },
    {
      id: 2,
      sellerName: 'Vaishnavi Seller',
      storeName: 'Vaishnavi Store',
      totalRevenue: 9295.75,
    },
    {
      id: 3,
      sellerName: 'Pratik Seller',
      storeName: 'Pratik Store',
      totalRevenue: 8379,
    },
  ];
};

