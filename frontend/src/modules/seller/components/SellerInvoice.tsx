import React from 'react';
import type { OrderDetail, OrderItem } from '../../../services/api/orderService';
import { formatDeliveryAddress } from '../../../utils/addressUtils';

export interface SellerInvoiceProps {
  orderDetail: OrderDetail;
  className?: string;
}

export const SellerInvoice = React.forwardRef<HTMLDivElement, SellerInvoiceProps>(
  ({ orderDetail, className = '' }, ref) => {
    const formatDate = (dateString?: string) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    const formatCurrency = (amount?: number) => {
      const val = amount !== undefined && !isNaN(amount) ? amount : 0;
      return `₹${val.toFixed(2)}`;
    };

    const addressInfo = formatDeliveryAddress(orderDetail.deliveryAddress);
    const rawEmail = orderDetail.customerEmail || '';
    const cleanEmail = rawEmail.endsWith('@olovely.temp') ? '' : rawEmail;

    // Segment items into Quick Commerce and E-Commerce groups
    const qcItems: OrderItem[] = [];
    const ecomItems: OrderItem[] = [];

    (orderDetail.items || []).forEach((item) => {
      const isQc =
        item.productType === 'QUICK_COMMERCE' ||
        item.fulfillmentType === 'LOCAL_DELIVERY' ||
        (orderDetail.orderType === 'QUICK_COMMERCE' && item.productType !== 'ECOMMERCE');

      if (isQc) {
        qcItems.push(item);
      } else {
        ecomItems.push(item);
      }
    });

    const isHybrid = qcItems.length > 0 && ecomItems.length > 0;
    const sellerStoreName = orderDetail.items?.[0]?.soldBy && orderDetail.items[0].soldBy !== 'N/A'
      ? orderDetail.items[0].soldBy
      : 'Olovely Partner Store';

    // Financial snapshot calculations
    const itemsSubtotal = (orderDetail.items || []).reduce(
      (sum, it) => sum + (it.subtotal || (it.price * (it.qty || 1))),
      0
    );

    // Detect if this order contains items from multiple distinct sellers
    const isMultiSeller = Boolean(
      orderDetail.orderSubtotal &&
      itemsSubtotal > 0 &&
      orderDetail.orderSubtotal > itemsSubtotal + 0.01
    );

    // In multi-seller orders, shipping is scoped to seller's fulfillment groups if available
    const sellerGroupShipping = (orderDetail.fulfillmentGroups || []).reduce(
      (sum, g) => sum + (g.shippingFee || 0),
      0
    );
    const shippingCharge = isMultiSeller
      ? sellerGroupShipping
      : (orderDetail.shipping !== undefined ? orderDetail.shipping : 0);

    const isFirstOrderFree = Boolean(orderDetail.firstOrderFreeShippingApplied);
    const normalShipping = isMultiSeller ? shippingCharge : (orderDetail.normalShippingAmount || shippingCharge);
    
    // In multi-seller orders, platform fee and global coupons are platform-level and not allocated to sellers
    const platformFee = isMultiSeller ? 0 : (orderDetail.platformFee || 0);
    const discount = isMultiSeller ? 0 : (orderDetail.discount || 0);
    const taxAmount = isMultiSeller ? 0 : (orderDetail.tax || 0);

    // Authoritative grand total: strictly seller-scoped for multi-seller, order-snapshot for single-seller
    const computedGrandTotal = isMultiSeller
      ? itemsSubtotal + shippingCharge
      : (orderDetail.orderGrandTotal || orderDetail.grandTotal || (
          itemsSubtotal + shippingCharge + platformFee + taxAmount - discount
        ));

    const renderItemRows = (items: OrderItem[], startIndex: number) => {
      return items.map((item, idx) => {
        const sNo = startIndex + idx;
        const qty = item.qty || 1;
        const unitPrice = item.price || 0;
        const total = item.subtotal || unitPrice * qty;
        const isQcItem =
          item.productType === 'QUICK_COMMERCE' ||
          item.fulfillmentType === 'LOCAL_DELIVERY';

        return (
          <tr key={item.id || idx} className="border-b border-neutral-200 text-xs text-neutral-800">
            <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">{sNo}</td>
            <td className="py-2.5 px-3">
              <div className="font-semibold text-neutral-900">{item.product}</div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-neutral-500">
                {item.unit && item.unit !== 'N/A' && <span>Variant: {item.unit}</span>}
                {item.isWholesale && (
                  <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">
                    Wholesale {item.wholesaleMinimumQuantity ? `(MOQ: ${item.wholesaleMinimumQuantity})` : ''}
                  </span>
                )}
              </div>
            </td>
            <td className="py-2.5 px-3 text-center">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  isQcItem ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                {isQcItem ? '⚡ Quick Commerce' : '📦 E-Commerce'}
              </span>
            </td>
            <td className="py-2.5 px-3 text-center font-medium">{qty}</td>
            <td className="py-2.5 px-3 text-right">{formatCurrency(unitPrice)}</td>
            <td className="py-2.5 px-3 text-right text-neutral-500">
              {item.tax ? formatCurrency(item.tax) : '₹0.00'}
            </td>
            <td className="py-2.5 px-3 text-right font-semibold text-neutral-900">
              {formatCurrency(total)}
            </td>
          </tr>
        );
      });
    };

    return (
      <div
        ref={ref}
        className={`bg-white text-neutral-900 max-w-[850px] mx-auto p-6 sm:p-8 font-sans border border-neutral-200 shadow-sm print:border-none print:shadow-none print:p-0 print:max-w-none ${className}`}
        style={{ colorScheme: 'light' }}
      >
        {/* Top Header: Brand & Document Title */}
        <div className="border-b-2 border-emerald-600 pb-4 mb-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-2xl shadow-sm">
                O
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900 leading-tight">
                  OLOVELY TOTAL SUVIDHA
                </h1>
                <p className="text-xs text-neutral-500 font-medium">
                  Hyperlocal Quick Commerce & E-Commerce Platform
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                  Sold by: <span className="font-bold">{sellerStoreName}</span>
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right bg-neutral-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none w-full sm:w-auto">
              <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 font-black text-xs uppercase tracking-wider rounded border border-emerald-300 mb-1">
                TAX INVOICE
              </div>
              <div className="text-xs text-neutral-600">
                <span className="font-semibold text-neutral-800">Invoice #: </span>
                <span className="font-mono font-bold text-neutral-900">
                  {orderDetail.invoiceNumber || (orderDetail.id ? `INV-${orderDetail.id.slice(-8).toUpperCase()}` : 'N/A')}
                </span>
              </div>
              <div className="text-xs text-neutral-600 mt-0.5">
                <span className="font-semibold text-neutral-800">Order ID: </span>
                <span className="font-mono text-neutral-800">{orderDetail.id}</span>
              </div>
              <div className="text-xs text-neutral-600 mt-0.5">
                <span className="font-semibold text-neutral-800">Date: </span>
                <span>{formatDate(orderDetail.orderDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid: Customer Details, Order Meta, Payment State */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs break-inside-avoid">
          {/* Customer / Delivery Address */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5">
            <h2 className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] mb-2 text-emerald-800 flex items-center gap-1.5">
              <span>📍</span> Customer & Delivery Details
            </h2>
            <div className="space-y-1 text-neutral-700">
              <p className="font-bold text-sm text-neutral-900">{orderDetail.customerName || 'Valued Customer'}</p>
              {orderDetail.customerPhone && (
                <p className="flex items-center gap-1.5 text-neutral-800 font-medium">
                  <span className="text-neutral-500">Phone:</span> {orderDetail.customerPhone}
                </p>
              )}
              {cleanEmail && (
                <p className="flex items-center gap-1.5 text-neutral-600">
                  <span className="text-neutral-500">Email:</span> {cleanEmail}
                </p>
              )}
              <div className="mt-2 pt-2 border-t border-neutral-200">
                <span className="text-neutral-500 font-semibold block text-[10px] uppercase">Delivery Address:</span>
                <p className="text-neutral-800 font-medium leading-relaxed mt-0.5">
                  {addressInfo.formatted}
                </p>
              </div>
            </div>
          </div>

          {/* Order & Payment Metadata */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <h2 className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] mb-2 text-emerald-800 flex items-center gap-1.5">
                <span>💳</span> Payment & Order Status
              </h2>
              <div className="space-y-1.5 text-neutral-700">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-neutral-600">Payment Mode:</span>
                  <span className="font-bold text-neutral-900 uppercase tracking-wide">
                    {orderDetail.paymentMethod || 'Online'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-neutral-600">Payment Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      orderDetail.paymentStatus === 'Paid'
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {orderDetail.paymentStatus || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-neutral-600">Order Status:</span>
                  <span className="font-semibold text-neutral-800">{orderDetail.status || 'Received'}</span>
                </div>
                {orderDetail.orderType && (
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-neutral-600">Fulfillment Model:</span>
                    <span className="font-semibold text-neutral-800">
                      {isHybrid ? 'Hybrid (QC + E-Commerce)' : orderDetail.orderType === 'QUICK_COMMERCE' ? 'Quick Commerce' : 'E-Commerce'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-neutral-200 text-[11px] text-neutral-500">
              Delivery Type: <span className="font-semibold text-neutral-700">{orderDetail.deliveryOption || 'Standard Delivery'}</span>
            </div>
          </div>
        </div>

        {/* Product Items Table(s) */}
        <div className="mb-6 space-y-5">
          {/* Quick Commerce Section */}
          {qcItems.length > 0 && (
            <div className="border border-neutral-200 rounded-lg overflow-hidden break-inside-avoid">
              <div className="bg-amber-50 px-3.5 py-2 border-b border-amber-200 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <span>⚡</span> QUICK COMMERCE ITEMS ({qcItems.length})
                </span>
                <span className="text-[10px] text-amber-800 font-medium">
                  Hyperlocal Fast Delivery
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-200 text-[11px] font-bold text-neutral-700 uppercase">
                      <th className="py-2 px-3 text-center w-12">#</th>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-3 text-center w-36">Channel</th>
                      <th className="py-2 px-3 text-center w-16">Qty</th>
                      <th className="py-2 px-3 text-right w-24">Unit Price</th>
                      <th className="py-2 px-3 text-right w-20">Tax</th>
                      <th className="py-2 px-3 text-right w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody>{renderItemRows(qcItems, 1)}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* E-Commerce Section */}
          {ecomItems.length > 0 && (
            <div className="border border-neutral-200 rounded-lg overflow-hidden break-inside-avoid">
              <div className="bg-blue-50 px-3.5 py-2 border-b border-blue-200 flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <span>📦</span> E-COMMERCE ITEMS ({ecomItems.length})
                </span>
                <span className="text-[10px] text-blue-800 font-medium">
                  Standard Courier Delivery
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-200 text-[11px] font-bold text-neutral-700 uppercase">
                      <th className="py-2 px-3 text-center w-12">#</th>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-3 text-center w-36">Channel</th>
                      <th className="py-2 px-3 text-center w-16">Qty</th>
                      <th className="py-2 px-3 text-right w-24">Unit Price</th>
                      <th className="py-2 px-3 text-right w-20">Tax</th>
                      <th className="py-2 px-3 text-right w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody>{renderItemRows(ecomItems, qcItems.length + 1)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Totals & Breakdown */}
        <div className="flex flex-col sm:flex-row justify-end mb-6 break-inside-avoid">
          <div className="w-full sm:w-80 border border-neutral-200 rounded-lg p-3.5 bg-neutral-50 text-xs space-y-2">
            <div className="flex justify-between text-neutral-700">
              <span>Items Subtotal:</span>
              <span className="font-semibold text-neutral-900">{formatCurrency(itemsSubtotal)}</span>
            </div>

            {/* Delivery / Shipping Line */}
            <div className="flex justify-between items-center text-neutral-700">
              <span>
                Shipping / Delivery:
                {isFirstOrderFree && (
                  <span className="block text-[10px] text-emerald-600 font-semibold">
                    First Order Free Shipping Applied
                  </span>
                )}
              </span>
              <div className="text-right">
                {isFirstOrderFree ? (
                  <span className="font-bold text-emerald-700">FREE</span>
                ) : shippingCharge === 0 ? (
                  <span className="font-bold text-emerald-700">₹0.00</span>
                ) : (
                  <span className="font-semibold text-neutral-900">{formatCurrency(shippingCharge)}</span>
                )}
                {isFirstOrderFree && normalShipping > 0 && (
                  <span className="block line-through text-[10px] text-neutral-400">
                    {formatCurrency(normalShipping)}
                  </span>
                )}
              </div>
            </div>

            {/* Platform / Handling fee if applicable */}
            {platformFee > 0 && (
              <div className="flex justify-between text-neutral-700">
                <span>Platform / Handling Fee:</span>
                <span className="font-semibold text-neutral-900">{formatCurrency(platformFee)}</span>
              </div>
            )}

            {/* Coupon / Discount if applicable */}
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>
                  Discount {orderDetail.couponCode ? `(${orderDetail.couponCode})` : ''}:
                </span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}

            {/* Tax if stored */}
            {taxAmount > 0 && (
              <div className="flex justify-between text-neutral-700">
                <span>Taxes & GST:</span>
                <span className="font-semibold text-neutral-900">{formatCurrency(taxAmount)}</span>
              </div>
            )}

            {/* Grand Total */}
            <div className="pt-2 border-t-2 border-neutral-300 flex justify-between items-center text-sm font-black text-neutral-900">
              <span className="uppercase tracking-wide text-xs">Grand Total:</span>
              <span className="text-base text-emerald-800">{formatCurrency(computedGrandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Professional Footer */}
        <div className="border-t border-neutral-200 pt-4 text-center text-[11px] text-neutral-500 break-inside-avoid">
          <p className="font-semibold text-neutral-700">Thank you for ordering with Olovely Total Suvidha!</p>
          <p className="mt-0.5">
            This is an authoritative computer-generated tax invoice. No physical signature is required.
          </p>
          <p className="text-[10px] text-neutral-400 mt-1">
            Questions? Contact support at support@olovely.com | Helpline: 9876543210
          </p>
        </div>
      </div>
    );
  }
);

SellerInvoice.displayName = 'SellerInvoice';
export default SellerInvoice;
