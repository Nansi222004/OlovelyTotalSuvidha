/**
 * Mock Order and Return Data
 * This file contains mock data that was previously used in order pages.
 * Kept for reference and potential future use (testing, development, etc.)
 */

// From SellerOrders.tsx
export interface OrderMock {
  id: number;
  orderId: string;
  deliveryDate: string;
  orderDate: string;
  status: string;
  amount: number;
}

export const mockOrders: OrderMock[] = [
  { id: 1, orderId: 'ORD-001', deliveryDate: '01/16/2025', orderDate: '01/15/2025', status: 'On the way', amount: 340.00 },
  { id: 2, orderId: 'ORD-002', deliveryDate: '01/15/2025', orderDate: '01/14/2025', status: 'Delivered', amount: 141.70 },
  { id: 3, orderId: 'ORD-003', deliveryDate: '01/14/2025', orderDate: '01/13/2025', status: 'Pending', amount: 250.50 },
  { id: 4, orderId: 'ORD-004', deliveryDate: '01/13/2025', orderDate: '01/12/2025', status: 'On the way', amount: 180.00 },
  { id: 5, orderId: 'ORD-005', deliveryDate: '01/12/2025', orderDate: '01/11/2025', status: 'Delivered', amount: 420.75 },
  { id: 6, orderId: 'ORD-006', deliveryDate: '01/11/2025', orderDate: '01/10/2025', status: 'Cancelled', amount: 150.00 },
  { id: 7, orderId: 'ORD-007', deliveryDate: '01/10/2025', orderDate: '01/09/2025', status: 'Accepted', amount: 275.30 },
  { id: 8, orderId: 'ORD-008', deliveryDate: '01/09/2025', orderDate: '01/08/2025', status: 'Pending', amount: 195.50 },
  { id: 9, orderId: 'ORD-009', deliveryDate: '01/08/2025', orderDate: '01/07/2025', status: 'Delivered', amount: 320.00 },
  { id: 10, orderId: 'ORD-010', deliveryDate: '01/07/2025', orderDate: '01/06/2025', status: 'On the way', amount: 210.25 },
  { id: 11, orderId: 'ORD-011', deliveryDate: '01/06/2025', orderDate: '01/05/2025', status: 'Delivered', amount: 380.00 },
  { id: 12, orderId: 'ORD-012', deliveryDate: '01/05/2025', orderDate: '01/04/2025', status: 'Accepted', amount: 165.75 },
  { id: 13, orderId: 'ORD-013', deliveryDate: '12/05/2025', orderDate: '12/04/2025', status: 'Pending', amount: 290.00 },
  { id: 14, orderId: 'ORD-014', deliveryDate: '12/05/2025', orderDate: '12/05/2025', status: 'On the way', amount: 450.50 },
  { id: 15, orderId: 'ORD-015', deliveryDate: '12/05/2025', orderDate: '12/05/2025', status: 'Delivered', amount: 175.25 },
];

// From mockData.ts - Order related interfaces and functions
export interface OrderDetailItem {
  srNo: number;
  product: string;
  soldBy: string;
  unit: string;
  price: number;
  tax: number;
  taxPercent: number;
  qty: number;
  subtotal: number;
}

export interface SellerOrderDetail {
  id: number;
  invoiceNumber: string;
  orderDate: string;
  deliveryDate: string;
  timeSlot: string;
  status: 'Out For Delivery' | 'Received' | 'Payment Pending' | 'Cancelled';
  items: OrderDetailItem[];
}

// Helper function to convert date from MM/DD/YYYY to YYYY-MM-DD
const convertDate = (dateStr: string): string => {
  const [month, day, year] = dateStr.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export const getOrderDetailById = (id: number): SellerOrderDetail | null => {
  // Order data from SellerOrders page
  const orderData: Record<number, { orderDate: string; deliveryDate: string; status: string; amount: number }> = {
    1: { orderDate: '01/15/2025', deliveryDate: '01/16/2025', status: 'On the way', amount: 340.00 },
    2: { orderDate: '01/14/2025', deliveryDate: '01/15/2025', status: 'Delivered', amount: 141.70 },
    3: { orderDate: '01/13/2025', deliveryDate: '01/14/2025', status: 'Pending', amount: 250.50 },
    4: { orderDate: '01/12/2025', deliveryDate: '01/13/2025', status: 'On the way', amount: 180.00 },
    5: { orderDate: '01/11/2025', deliveryDate: '01/12/2025', status: 'Delivered', amount: 420.75 },
    6: { orderDate: '01/10/2025', deliveryDate: '01/11/2025', status: 'Cancelled', amount: 150.00 },
    7: { orderDate: '01/09/2025', deliveryDate: '01/10/2025', status: 'Accepted', amount: 275.30 },
    8: { orderDate: '01/08/2025', deliveryDate: '01/09/2025', status: 'Pending', amount: 195.50 },
    9: { orderDate: '01/07/2025', deliveryDate: '01/08/2025', status: 'Delivered', amount: 320.00 },
    10: { orderDate: '01/06/2025', deliveryDate: '01/07/2025', status: 'On the way', amount: 210.25 },
    11: { orderDate: '01/05/2025', deliveryDate: '01/06/2025', status: 'Delivered', amount: 380.00 },
    12: { orderDate: '01/04/2025', deliveryDate: '01/05/2025', status: 'Accepted', amount: 165.75 },
    13: { orderDate: '12/04/2025', deliveryDate: '12/05/2025', status: 'Pending', amount: 290.00 },
    14: { orderDate: '12/05/2025', deliveryDate: '12/06/2025', status: 'On the way', amount: 450.50 },
    15: { orderDate: '12/05/2025', deliveryDate: '12/06/2025', status: 'Delivered', amount: 175.25 },
  };

  const order = orderData[id];
  if (!order) return null;

  // Map status from SellerOrders to SellerOrderDetail status
  const statusMap: Record<string, 'Out For Delivery' | 'Received' | 'Payment Pending' | 'Cancelled'> = {
    'On the way': 'Out For Delivery',
    'Delivered': 'Received',
    'Pending': 'Payment Pending',
    'Accepted': 'Out For Delivery',
    'Cancelled': 'Cancelled',
  };

  const orderStatus = statusMap[order.status] || 'Out For Delivery';
  const orderDateFormatted = convertDate(order.orderDate);
  const deliveryDateFormatted = convertDate(order.deliveryDate);

  // Generate items based on order amount
  // Create realistic item breakdowns
  const generateItems = (amount: number): OrderDetailItem[] => {
    const items: OrderDetailItem[] = [];
    const productList = [
      { name: 'Fresh Tomatoes', unit: '1 kg', basePrice: 80 },
      { name: 'Organic Onions', unit: '1 kg', basePrice: 60 },
      { name: 'Premium Basmati Rice', unit: '1 kg', basePrice: 120 },
      { name: 'Fresh Milk', unit: '1 L', basePrice: 65 },
      { name: 'Organic Potatoes', unit: '1 kg', basePrice: 45 },
      { name: 'Carrots', unit: '500 g', basePrice: 40 },
      { name: 'Capsicum', unit: '500 g', basePrice: 70 },
      { name: 'Cauliflower', unit: '1 pc', basePrice: 50 },
      { name: 'Brinjal', unit: '500 g', basePrice: 55 },
      { name: 'Cucumber', unit: '500 g', basePrice: 35 },
    ];

    let remainingAmount = amount;
    let srNo = 1;

    // Distribute items
    while (remainingAmount > 0 && srNo <= 5) {
      const product = productList[(id + srNo - 1) % productList.length];
      const maxQty = Math.floor(remainingAmount / (product.basePrice * 1.18));
      const qty = Math.max(1, Math.min(maxQty || 1, 3));
      const itemSubtotal = product.basePrice * qty;
      const itemTax = itemSubtotal * 0.18;
      const itemTotal = itemSubtotal + itemTax;

      if (itemTotal <= remainingAmount) {
        items.push({
          srNo: srNo++,
          product: product.name,
          soldBy: 'Olovely Store',
          unit: product.unit,
          price: product.basePrice,
          tax: itemTax,
          taxPercent: 18.00,
          qty: qty,
          subtotal: itemSubtotal,
        });
        remainingAmount -= itemTotal;
      } else {
        // Last item - adjust to match remaining amount
        const lastQty = Math.max(1, Math.floor(remainingAmount / (product.basePrice * 1.18)));
        const lastSubtotal = product.basePrice * lastQty;
        const lastTax = lastSubtotal * 0.18;
        items.push({
          srNo: srNo++,
          product: product.name,
          soldBy: 'Olovely Store',
          unit: product.unit,
          price: product.basePrice,
          tax: lastTax,
          taxPercent: 18.00,
          qty: lastQty,
          subtotal: lastSubtotal,
        });
        break;
      }
    }

    // If no items were added, add at least one
    if (items.length === 0) {
      const product = productList[id % productList.length];
      const qty = 1;
      const itemSubtotal = product.basePrice * qty;
      const itemTax = itemSubtotal * 0.18;
      items.push({
        srNo: 1,
        product: product.name,
        soldBy: 'Olovely Store',
        unit: product.unit,
        price: product.basePrice,
        tax: itemTax,
        taxPercent: 18.00,
        qty: qty,
        subtotal: itemSubtotal,
      });
    }

    return items;
  };

  const timeSlots = [
    '10:00 AM - 12:00 PM',
    '2:00 PM - 4:00 PM',
    '4:00 PM - 6:00 PM',
    '6:00 PM - 8:00 PM',
    '12:00 PM - 2:00 PM',
  ];

  return {
    id: id,
    invoiceNumber: `INV-2025-${String(id).padStart(3, '0')}`,
    orderDate: orderDateFormatted,
    deliveryDate: deliveryDateFormatted,
    timeSlot: timeSlots[id % timeSlots.length],
    status: orderStatus,
    items: generateItems(order.amount),
  };
};

// From SellerReturnRequest.tsx
export interface ReturnRequestMock {
  orderItemId: number;
  product: string;
  variant: string;
  price: number;
  discPrice: number;
  quantity: number;
  total: number;
  status: string;
  date: string;
}

export const RETURN_REQUESTS_MOCK: ReturnRequestMock[] = []; // Empty as shown in image

