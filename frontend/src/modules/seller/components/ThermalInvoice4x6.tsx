import React from 'react';
import type { OrderDetail, OrderItem } from '../../../services/api/orderService';
import { formatDeliveryAddress } from '../../../utils/addressUtils';
import { BarcodeGraphic } from '../../admin/components/BarcodeLabel';

export interface ThermalInvoice4x6Props {
  orderDetail: OrderDetail;
  channel?: 'QUICK_COMMERCE' | 'ECOMMERCE';
  className?: string;
}

export const ThermalInvoice4x6 = React.forwardRef<HTMLDivElement, ThermalInvoice4x6Props>(
  ({ orderDetail, channel, className = '' }, ref) => {
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

    // Filter items by requested channel if specified
    const items = (orderDetail.items || []).filter((item) => {
      if (!channel) return true;
      const isQc =
        item.productType === 'QUICK_COMMERCE' ||
        item.fulfillmentType === 'LOCAL_DELIVERY' ||
        (orderDetail.orderType === 'QUICK_COMMERCE' && item.productType !== 'ECOMMERCE');
      return channel === 'QUICK_COMMERCE' ? isQc : !isQc;
    });

    // Check seller / platform identity
    const isPlatformOwner = items.some(
      (it) => it.ownerType === 'PLATFORM' || (!it.soldBy || it.soldBy === 'N/A')
    );
    const defaultStoreName = isPlatformOwner
      ? 'Olovely Total Suvidha (Platform Central)'
      : 'Olovely Partner Store';
    const sellerStoreName = items[0]?.soldBy && items[0].soldBy !== 'N/A'
      ? items[0].soldBy
      : defaultStoreName;
    const seller = orderDetail.sellerDetails;
    const billingEntityName = seller?.storeName || items[0]?.billingEntityName || sellerStoreName;
    const billingEntityGstin = seller?.gstin || items[0]?.billingEntityGstin;
    const sellerAddress = seller?.address || '';
    const sellerPhone = seller?.phone || '';

    // Subtotal and tax calculations
    const itemsSubtotal = items.reduce(
      (sum, it) => sum + (it.subtotal || (it.price * (it.qty || 1))),
      0
    );

    // Multi-seller & shipping scoping
    const isMultiSeller = Boolean(
      orderDetail.orderSubtotal &&
      itemsSubtotal > 0 &&
      orderDetail.orderSubtotal > itemsSubtotal + 0.01
    );

    const sellerGroupShipping = (orderDetail.fulfillmentGroups || []).reduce(
      (sum, g) => sum + (g.shippingFee || 0),
      0
    );
    const shippingCharge = orderDetail.invoiceChannel
      ? (orderDetail.shipping || 0)
      : isMultiSeller
      ? sellerGroupShipping
      : (orderDetail.shipping !== undefined ? orderDetail.shipping : 0);

    const grandTotal = itemsSubtotal + shippingCharge;

    // Determine document type: Tax Invoice (if delivered & paid or invoiceEnabled) vs Packing Slip / Bill
    const isDeliveredOrCompleted =
      orderDetail.status === 'Delivered' ||
      orderDetail.fulfillmentStatus === 'Delivered' ||
      orderDetail.parentStatus === 'Delivered';
    const isPaymentCompleted =
      orderDetail.paymentStatus === 'Paid' ||
      orderDetail.paymentStatus === 'PAID';
    const isFormalInvoice = Boolean(
      (orderDetail as any).invoiceEnabled ||
      (isDeliveredOrCompleted && isPaymentCompleted)
    );

    const docTitle = isFormalInvoice
      ? (channel === 'QUICK_COMMERCE'
          ? 'TAX INVOICE (QUICK COMMERCE)'
          : channel === 'ECOMMERCE'
          ? 'TAX INVOICE (ECOMMERCE)'
          : 'TAX INVOICE')
      : (channel === 'QUICK_COMMERCE'
          ? 'PACKING SLIP / BILL (QC)'
          : channel === 'ECOMMERCE'
          ? 'PACKING SLIP / BILL (ECOM)'
          : 'PACKING SLIP / BILL');

    const invoiceNum = orderDetail.invoiceNumber || `INV-${orderDetail.id.slice(-8).toUpperCase()}`;

    return (
      <div
        ref={ref}
        className={`thermal-4x6-document bg-white text-black font-sans box-border ${className}`}
        style={{
          width: '4in',
          minHeight: '6in',
          // Thermal printers (e.g. XP-460B) cannot print the outer few mm of a 4in label and the
          // label often sits slightly off-centre, so keep a wide safe margin on the left/right.
          padding: '3mm 7mm',
          margin: '0 auto',
          fontSize: '9.5pt',
          lineHeight: '1.25',
          color: '#000000',
          backgroundColor: '#ffffff',
          boxSizing: 'border-box',
          overflowWrap: 'anywhere',
        }}
      >
        {/* Header: Brand & Document Heading */}
        <div className="text-center border-b-2 border-black pb-2 mb-2">
          <div className="text-[15pt] font-black tracking-tight uppercase leading-tight">
            OLOVELY TOTAL SUVIDHA
          </div>
          <div className="text-[9.5pt] uppercase tracking-wider font-semibold">
            {docTitle}
          </div>
          <div className="text-[9pt] mt-0.5">
            Your Trusted Hyperlocal & E-Commerce Partner
          </div>
        </div>

        {/* Metadata Grid: Invoice & Order */}
        {/* One fact per line: long IDs next to the date pushed the date off the label edge */}
        <div className="border border-black p-1.5 mb-2 text-[9pt] space-y-0.5">
          <div style={{ wordBreak: 'break-all' }}>
            <strong className="uppercase">Doc #:</strong>{' '}
            <span className="font-mono font-bold">{invoiceNum}</span>
          </div>
          <div style={{ wordBreak: 'break-all' }}>
            <strong className="uppercase">Order ID:</strong>{' '}
            <span className="font-mono">{orderDetail.orderNumber || orderDetail.id}</span>
          </div>
          <div className="flex justify-between gap-2 border-t border-gray-400 pt-0.5">
            <span>
              <strong>Date:</strong> {formatDate(orderDetail.orderDate)}
            </span>
            <span className="text-right">
              <strong>Pay:</strong>{' '}
              <span className="font-bold uppercase">
                {orderDetail.paymentMethod || 'Prepaid'}{' '}
                ({orderDetail.paymentStatus === 'Paid' ? 'PAID' : 'COD'})
              </span>
            </span>
          </div>
        </div>

        {/* Seller & Customer Information Side-by-Side */}
        <div className="grid grid-cols-2 gap-1.5 border border-black p-1.5 mb-2 text-[9pt]">
          {/* Seller / Billing Entity */}
          <div className="border-r border-gray-400 pr-1">
            <div className="font-bold uppercase tracking-wider border-b border-gray-300 pb-0.5 mb-0.5 text-[8.5pt]">
              Sold By (Seller)
            </div>
            <div className="font-bold text-[9.5pt]">{billingEntityName}</div>
            {billingEntityGstin && (
              <div>
                GSTIN: <span className="font-mono font-bold">{billingEntityGstin}</span>
              </div>
            )}
            {sellerAddress && <div className="text-gray-700 leading-tight">{sellerAddress}</div>}
            {sellerPhone && <div>Ph: {sellerPhone}</div>}
          </div>

          {/* Customer / Delivery Details */}
          <div className="pl-1">
            <div className="font-bold uppercase tracking-wider border-b border-gray-300 pb-0.5 mb-0.5 text-[8.5pt]">
              Customer (Ship To)
            </div>
            <div className="font-bold text-[9.5pt]">{orderDetail.customerName || 'Customer'}</div>
            {orderDetail.customerPhone && (
              <div>Phone: {orderDetail.customerPhone}</div>
            )}
            <div className="leading-tight mt-0.5 line-clamp-3">
              {addressInfo.formatted}
            </div>
          </div>
        </div>

        {/* Itemized Products Table */}
        <div className="border border-black mb-2">
          {/* Fixed layout + explicit column widths so the price columns can never push past the edge */}
          <table className="w-full text-left text-[8.5pt] border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '6%' }} />
              <col />
              <col style={{ width: '9%' }} />
              <col style={{ width: '19%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-black bg-gray-100 font-bold uppercase text-[7.5pt]">
                <th className="py-1 px-0.5 text-center">#</th>
                <th className="py-1 px-0.5">Item</th>
                <th className="py-1 px-0.5 text-center">Qty</th>
                <th className="py-1 px-0.5 text-right">Price</th>
                <th className="py-1 px-0.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const qty = item.qty || 1;
                const price = item.price || 0;
                const total = item.subtotal || price * qty;
                const isWholesale = Boolean(item.isWholesale);

                return (
                  <tr
                    key={item.id || idx}
                    className="border-b border-gray-300 last:border-b-0"
                    style={{ pageBreakInside: 'avoid' }}
                  >
                    <td className="py-1 px-0.5 text-center font-mono text-[8.5pt] align-top">
                      {idx + 1}
                    </td>
                    <td className="py-1 px-0.5 align-top">
                      <div className="font-semibold leading-tight">{item.product}</div>
                      <div className="text-[8.5pt] text-gray-700 flex flex-wrap gap-1">
                        {item.unit && item.unit !== 'N/A' && <span>Var: {item.unit}</span>}
                        {isWholesale && (
                          <span className="font-bold uppercase">[Wholesale]</span>
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-0.5 text-center font-bold align-top">
                      {qty}
                    </td>
                    <td className="py-1 px-0.5 text-right font-mono align-top">
                      {formatCurrency(price)}
                    </td>
                    <td className="py-1 px-0.5 text-right font-mono font-bold align-top">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Totals Box */}
        <div className="border border-black p-1.5 mb-2 text-[9.5pt]">
          <div className="flex justify-between py-0.5">
            <span>Items Subtotal:</span>
            <span className="font-mono">{formatCurrency(itemsSubtotal)}</span>
          </div>
          {shippingCharge > 0 && (
            <div className="flex justify-between py-0.5">
              <span>Delivery / Shipping Fee:</span>
              <span className="font-mono">{formatCurrency(shippingCharge)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-t border-black mt-1 font-bold text-[11pt]">
            <span className="uppercase">Final Total:</span>
            <span className="font-mono">{formatCurrency(grandTotal)}</span>
          </div>
          <div className="text-[8pt] text-gray-600 text-right mt-0.5">
            *All taxes included under applicable GST laws
          </div>
        </div>

        {/* Barcode & Footer: Fast Scanning on XP-460B */}
        <div className="text-center pt-1 border-t border-black">
          <div className="mx-auto" style={{ maxWidth: '85%' }}>
            <BarcodeGraphic value={orderDetail.orderNumber || orderDetail.id} height={36} />
          </div>
          <div className="font-mono text-[9pt] font-bold tracking-wider mt-0.5">
            *{orderDetail.orderNumber || orderDetail.id}*
          </div>
          <div className="text-[8pt] text-gray-700 mt-1 uppercase font-semibold">
            Thank you for shopping on Olovely Total Suvidha!
          </div>
          <div className="text-[7.5pt] text-gray-500">
            Support: Contact store via Olovely App • Returns valid as per policy
          </div>
        </div>
      </div>
    );
  }
);
