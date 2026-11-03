import React from 'react';
import type { ShippingLabelData } from '../../../services/api/orderService';
import { formatDeliveryAddress } from '../../../utils/addressUtils';
import { BarcodeGraphic } from '../../admin/components/BarcodeLabel';

export interface ThermalShippingLabel4x6Props {
  label: ShippingLabelData;
  className?: string;
}

export const ThermalShippingLabel4x6 = React.forwardRef<HTMLDivElement, ThermalShippingLabel4x6Props>(
  ({ label, className = '' }, ref) => {
    const isQc = label.channel === 'QUICK_COMMERCE' || label.type === 'INTERNAL_THERMAL';
    const deliveryAddr = label.deliveryAddress || {};
    const addressInfo = formatDeliveryAddress(deliveryAddr);
    const city = deliveryAddr.city || 'Patna';
    const state = deliveryAddr.state || '';
    const pincode = deliveryAddr.pincode || '800001';
    const landmark = deliveryAddr.landmark || '';
    const rawAddress = deliveryAddr.address || addressInfo.cleanAddress || addressInfo.formatted;
    const isCod = Boolean(label.isCod && label.codAmount && label.codAmount > 0);

    const formatDate = (dateString?: string) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    };

    if (!isQc) {
      // Ecommerce Courier Label View
      if (!label.available || !label.labelUrl) {
        return (
          <div
            ref={ref}
            className={`thermal-4x6-document bg-white text-black p-4 border border-black font-sans ${className}`}
            style={{ width: '4in', minHeight: '6in', boxSizing: 'border-box' }}
          >
            <div className="text-center border-b-2 border-black pb-2 mb-3">
              <div className="text-base font-black tracking-tight uppercase">OLOVELY TOTAL SUVIDHA</div>
              <div className="text-[8pt] font-bold uppercase tracking-wider">ECOMMERCE SHIPPING LABEL</div>
            </div>

            <div className="border border-black p-3 mb-4 text-center">
              <div className="text-2xl mb-1">⏳</div>
              <div className="font-bold text-[9pt] uppercase text-black mb-1">
                Official Courier Label Pending
              </div>
              <p className="text-[7.5pt] text-gray-700 leading-normal">
                {label.reason ||
                  'The courier shipping label is currently pending generation. It will be available once the carrier confirms pickup and assigns the official AWB.'}
              </p>
            </div>

            <div className="border border-black p-2 text-[7.5pt] space-y-1">
              <div><strong>Carrier:</strong> {label.carrier || 'Shiprocket Courier'}</div>
              <div><strong>Order #:</strong> {label.orderNumber}</div>
              <div><strong>Package:</strong> {label.packageIndex} of {label.totalPackages}</div>
              {label.awbNumber && <div><strong>AWB:</strong> {label.awbNumber}</div>}
              <div><strong>Recipient:</strong> {label.customerName}</div>
              <div><strong>Destination:</strong> {city} ({pincode})</div>
            </div>
          </div>
        );
      }

      // If official courier label URL is available
      return (
        <div
          ref={ref}
          className={`thermal-4x6-document bg-white text-black p-2 font-sans ${className}`}
          style={{ width: '4in', minHeight: '6in', boxSizing: 'border-box' }}
        >
          <div className="text-center border-b border-black pb-1 mb-2">
            <div className="text-xs font-bold uppercase">Official Courier Shipping Label</div>
            <div className="text-[7pt] text-gray-600">AWB: {label.awbNumber} • Courier: {label.carrier}</div>
          </div>
          <iframe
            src={label.labelUrl}
            title={`Courier Label ${label.awbNumber}`}
            className="w-full border-none"
            style={{ width: '100%', height: '5.5in' }}
          />
        </div>
      );
    }

    // Quick Commerce Internal Local Delivery Thermal Label (4x6 format for XP-460B)
    return (
      <div
        ref={ref}
        className={`thermal-4x6-document bg-white text-black font-sans box-border ${className}`}
        style={{
          width: '4in',
          minHeight: '6in',
          padding: '4mm',
          margin: '0 auto',
          fontSize: '9pt',
          lineHeight: '1.25',
          color: '#000000',
          backgroundColor: '#ffffff',
          boxSizing: 'border-box',
        }}
      >
        {/* Top Header */}
        <div className="flex justify-between items-center border-b-2 border-black pb-1.5 mb-1.5">
          <div>
            <div className="text-base font-black tracking-tight leading-none uppercase">
              OLOVELY
            </div>
            <div className="text-[6.5pt] font-bold tracking-widest uppercase">
              TOTAL SUVIDHA
            </div>
          </div>
          <div className="text-right">
            <div className="text-[7.5pt] font-black uppercase border border-black px-1.5 py-0.5 inline-block">
              ⚡ QUICK COMMERCE
            </div>
            <div className="text-[6.5pt] font-bold mt-0.5">
              PKG {label.packageIndex} OF {label.totalPackages}
            </div>
          </div>
        </div>

        {/* Large COD / Prepaid Prominent Banner */}
        <div className="mb-2">
          {isCod ? (
            <div className="bg-black text-white text-center py-1 px-1.5 font-black uppercase text-[10.5pt] tracking-wide border-2 border-black">
              ★ COLLECT COD: ₹{Number(label.codAmount || 0).toFixed(2)} ★
            </div>
          ) : (
            <div className="border-2 border-black text-black text-center py-1 px-1.5 font-black uppercase text-[9.5pt] tracking-wide">
              ✓ PREPAID ORDER — DO NOT COLLECT CASH
            </div>
          )}
        </div>

        {/* Deliver To Customer Box (High Contrast & Big Pincode) */}
        <div className="border-2 border-black p-2 mb-2">
          <div className="text-[6.5pt] font-black uppercase tracking-wider border-b border-black pb-0.5 mb-1 text-gray-700">
            DELIVER TO CUSTOMER
          </div>
          <div className="text-[11pt] font-black leading-tight uppercase">
            {label.customerName || 'Valued Customer'}
          </div>
          {label.customerPhone && (
            <div className="text-[9.5pt] font-bold font-mono mt-0.5">
              📞 {label.customerPhone}
            </div>
          )}
          <div className="text-[8pt] font-medium leading-snug mt-1 border-t border-gray-300 pt-1">
            {rawAddress && <div>{rawAddress}</div>}
            {landmark && (
              <div className="text-[7.5pt] italic">Landmark: {landmark}</div>
            )}
            <div>
              {city}
              {state ? `, ${state}` : ''}
            </div>
          </div>
          {/* Prominent PINCODE Box */}
          <div className="mt-1.5 pt-1 border-t border-black flex justify-between items-center">
            <span className="text-[7pt] font-bold uppercase">DELIVERY PINCODE:</span>
            <span className="text-[12pt] font-black font-mono tracking-widest border border-black px-2 py-0.5">
              {pincode}
            </span>
          </div>
        </div>

        {/* Pickup & Rider Routing Info */}
        <div className="grid grid-cols-2 gap-1.5 border border-black p-1.5 mb-2 text-[7pt]">
          {/* Pickup Store */}
          <div className="border-r border-gray-400 pr-1">
            <div className="font-bold uppercase tracking-wider text-[6.5pt] border-b border-gray-300 pb-0.5 mb-0.5">
              Pickup Store
            </div>
            <div className="font-bold text-[7.5pt] leading-tight truncate">
              {label.pickupStoreName || 'Olovely Store'}
            </div>
            <div className="text-[6.5pt] text-gray-700 mt-0.5 line-clamp-2">
              {label.pickupAddress || 'Patna, Bihar'}
            </div>
          </div>

          {/* Rider / Delivery Info */}
          <div className="pl-1">
            <div className="font-bold uppercase tracking-wider text-[6.5pt] border-b border-gray-300 pb-0.5 mb-0.5">
              Routing / Delivery
            </div>
            <div>
              <strong>Mode:</strong> <span className="font-bold uppercase">{label.deliveryOption || 'Standard'}</span>
            </div>
            <div>
              <strong>Rider:</strong>{' '}
              <span className="font-semibold">
                {label.deliveryBoy?.name ? label.deliveryBoy.name : 'Store Self Assign'}
              </span>
            </div>
            {label.deliveryBoy?.mobile && (
              <div className="font-mono text-[6.5pt]">
                Ph: {label.deliveryBoy.mobile}
              </div>
            )}
            {label.deliveryOtp && (
              <div className="mt-0.5 font-bold">
                OTP: <span className="font-mono">{label.deliveryOtp}</span>
              </div>
            )}
          </div>
        </div>

        {/* Item Packing Checklist */}
        <div className="border border-black mb-2 text-[7pt]">
          <div className="bg-gray-100 font-bold uppercase px-1.5 py-0.5 border-b border-black text-[6.5pt] flex justify-between">
            <span>Package Contents ({label.itemCount || label.items.length} Units)</span>
            <span>Check</span>
          </div>
          <div className="p-1 space-y-0.5">
            {label.items.map((it, idx) => (
              <div key={idx} className="flex justify-between items-center text-[7pt] leading-tight border-b border-gray-200 pb-0.5 last:border-b-0">
                <span className="truncate pr-1">
                  <strong>{it.quantity}x</strong> {it.productName}
                  {it.variant && it.variant !== 'Default' && it.variant !== 'N/A' ? ` (${it.variant})` : ''}
                </span>
                <span className="inline-block w-3 h-3 border border-black text-center font-mono text-[6pt]"></span>
              </div>
            ))}
          </div>
        </div>

        {/* Scannable Code 128 Barcode for XP-460B (203 DPI optimized) */}
        <div className="text-center pt-1 border-t-2 border-black">
          <div className="mx-auto" style={{ maxWidth: '90%' }}>
            <BarcodeGraphic value={label.barcodeValue || label.orderNumber} height={42} />
          </div>
          <div className="font-mono text-[8pt] font-black tracking-widest mt-0.5">
            *{label.barcodeValue || label.orderNumber}*
          </div>
          <div className="text-[6pt] text-gray-600 uppercase font-semibold mt-0.5">
            Date: {formatDate(label.orderDate)} • Order ID: {label.orderNumber}
          </div>
        </div>
      </div>
    );
  }
);
