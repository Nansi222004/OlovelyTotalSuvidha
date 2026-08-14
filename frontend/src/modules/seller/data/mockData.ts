export interface SellerDashboardStats {
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
}

export const getSellerDashboardStats = (): SellerDashboardStats => {
  // Mock data matching the image
  const orderDataDec2025 = [
    { date: '01-Dec', value: 0 },
    { date: '02-Dec', value: 0 },
    { date: '03-Dec', value: 0.2 },
    { date: '04-Dec', value: 1 },
    { date: '05-Dec', value: 0 },
    { date: '06-Dec', value: 0 },
    { date: '07-Dec', value: 0 },
    { date: '08-Dec', value: 0 },
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
    { date: '30-Dec', value: 0.1 },
    { date: '31-Dec', value: 0.2 },
  ];

  const orderData2025 = [
    { date: 'January', value: 2 },
    { date: 'February', value: 4 },
    { date: 'March', value: 16 },
    { date: 'April', value: 17 },
    { date: 'May', value: 16 },
    { date: 'June', value: 8 },
    { date: 'July', value: 19 },
    { date: 'August', value: 0 },
    { date: 'September', value: 0 },
    { date: 'October', value: 0 },
    { date: 'November', value: 0 },
    { date: 'December', value: 0 },
  ];

  return {
    totalUser: 734,
    totalCategory: 7,
    totalSubcategory: 17,
    totalProduct: 25,
    totalOrders: 521,
    completedOrders: 1,
    pendingOrders: 1,
    cancelledOrders: 1,
    soldOutProducts: 1,
    lowStockProducts: 3,
    orderDataDec2025,
    orderData2025,
  };
};


export interface NewOrder {
  id: number;
  orderDate: string;
  status: 'Out For Delivery' | 'Received' | 'Payment Pending' | 'Cancelled';
  amount: number;
}

export const getNewOrders = (): NewOrder[] => {
  return [
    {
      id: 1,
      orderDate: '2025-01-15',
      status: 'Out For Delivery',
      amount: 340.00,
    },
    {
      id: 2,
      orderDate: '2025-01-14',
      status: 'Received',
      amount: 141.70,
    },
    {
      id: 3,
      orderDate: '2025-01-13',
      status: 'Payment Pending',
      amount: 250.50,
    },
    {
      id: 4,
      orderDate: '2025-01-12',
      status: 'Out For Delivery',
      amount: 180.00,
    },
    {
      id: 5,
      orderDate: '2025-01-11',
      status: 'Received',
      amount: 420.75,
    },
    {
      id: 6,
      orderDate: '2025-01-10',
      status: 'Cancelled',
      amount: 150.00,
    },
    {
      id: 7,
      orderDate: '2025-01-09',
      status: 'Out For Delivery',
      amount: 275.30,
    },
    {
      id: 8,
      orderDate: '2025-01-08',
      status: 'Payment Pending',
      amount: 195.50,
    },
    {
      id: 9,
      orderDate: '2025-01-07',
      status: 'Received',
      amount: 320.00,
    },
    {
      id: 10,
      orderDate: '2025-01-06',
      status: 'Out For Delivery',
      amount: 210.25,
    },
    {
      id: 11,
      orderDate: '2025-01-05',
      status: 'Received',
      amount: 380.00,
    },
    {
      id: 12,
      orderDate: '2025-01-04',
      status: 'Payment Pending',
      amount: 165.75,
    },
  ];
};

