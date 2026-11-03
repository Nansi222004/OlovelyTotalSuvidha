import React, { useState, useEffect, useRef } from 'react';
import type { OrderDetail, ShippingLabelData } from '../../../services/api/orderService';
import { getOrderShippingLabel } from '../../../services/api/orderService';
import { ThermalInvoice4x6 } from './ThermalInvoice4x6';
import { ThermalShippingLabel4x6 } from './ThermalShippingLabel4x6';

export interface ThermalPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderDetail: OrderDetail;
  initialMode?: 'INVOICE' | 'SHIPPING_LABEL';
}

export const ThermalPrintModal: React.FC<ThermalPrintModalProps> = ({
  isOpen,
  onClose,
  orderDetail,
  initialMode = 'INVOICE',
}) => {
  const [mode, setMode] = useState<'INVOICE' | 'SHIPPING_LABEL'>(initialMode);
  const [selectedChannel, setSelectedChannel] = useState<'QUICK_COMMERCE' | 'ECOMMERCE' | 'ALL'>('ALL');
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number>(0);
  const [labels, setLabels] = useState<ShippingLabelData[]>([]);
  const [isLoadingLabels, setIsLoadingLabels] = useState<boolean>(false);
  const [labelError, setLabelError] = useState<string>('');
  const printAreaRef = useRef<HTMLDivElement>(null);

  const hasQc = Boolean(
    orderDetail.hasQcItems ||
    orderDetail.fulfillmentGroups?.some((g: any) => g.fulfillmentType === 'LOCAL_DELIVERY') ||
    orderDetail.orderType === 'QUICK_COMMERCE'
  );
  const hasEcom = Boolean(
    orderDetail.hasEcomItems ||
    orderDetail.fulfillmentGroups?.some((g: any) => g.fulfillmentType === 'COURIER_SHIPPING' || g.fulfillmentType === 'THIRD_PARTY_API') ||
    orderDetail.orderType === 'ECOMMERCE'
  );
  const isMixed = hasQc && hasEcom;

  // Sync mode with initialMode prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      if (isMixed && selectedChannel === 'ALL') {
        setSelectedChannel('QUICK_COMMERCE');
      }
    }
  }, [isOpen, initialMode, isMixed]);

  // Fetch shipping labels when mode is SHIPPING_LABEL or modal opens
  useEffect(() => {
    if (!isOpen || mode !== 'SHIPPING_LABEL') return;

    let isMounted = true;
    const fetchLabels = async () => {
      setIsLoadingLabels(true);
      setLabelError('');
      try {
        const response = await getOrderShippingLabel(orderDetail.id);
        if (isMounted) {
          if (response.success && response.data?.labels) {
            setLabels(response.data.labels);
            setSelectedGroupIndex(0);
          } else {
            setLabelError(response.message || 'Failed to fetch shipping labels');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setLabelError(err.response?.data?.message || err.message || 'Error loading shipping labels');
        }
      } finally {
        if (isMounted) {
          setIsLoadingLabels(false);
        }
      }
    };

    fetchLabels();
    return () => {
      isMounted = false;
    };
  }, [isOpen, mode, orderDetail.id]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const activeLabel = labels[selectedGroupIndex] || labels[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white print:static">
      {/* Modal Dialog Card (hidden during print) */}
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-300 max-w-2xl w-full flex flex-col max-h-[92vh] overflow-hidden print:hidden">
        {/* Top Title Bar */}
        <div className="bg-neutral-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🖨️</span>
            <div>
              <h3 className="font-bold text-base leading-tight">
                4×6 Thermal Printer Preview (Xprinter XP-460B)
              </h3>
              <p className="text-[11px] text-neutral-400">
                Order #{orderDetail.orderNumber || orderDetail.id} • 101.6 × 152.4 mm (203 DPI)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-md transition-colors text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Action & Filter Controls */}
        <div className="bg-neutral-100 p-3 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Mode Switcher: Invoice vs Shipping Label */}
          <div className="flex items-center bg-white p-1 rounded-lg border border-neutral-300 shadow-xs">
            <button
              type="button"
              onClick={() => setMode('INVOICE')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                mode === 'INVOICE'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-700 hover:text-black'
              }`}
            >
              📄 4×6 Invoice / Bill
            </button>
            <button
              type="button"
              onClick={() => setMode('SHIPPING_LABEL')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                mode === 'SHIPPING_LABEL'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-700 hover:text-black'
              }`}
            >
              🏷️ 4×6 Shipping Label
            </button>
          </div>

          {/* Mixed Order Channel / Package Selector */}
          {mode === 'INVOICE' && isMixed && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-neutral-600">Channel:</span>
              <button
                type="button"
                onClick={() => setSelectedChannel('QUICK_COMMERCE')}
                className={`px-2.5 py-1 rounded text-xs font-bold border ${
                  selectedChannel === 'QUICK_COMMERCE'
                    ? 'bg-amber-100 text-amber-900 border-amber-400'
                    : 'bg-white text-neutral-700 border-neutral-300'
                }`}
              >
                ⚡ QC Bill
              </button>
              <button
                type="button"
                onClick={() => setSelectedChannel('ECOMMERCE')}
                className={`px-2.5 py-1 rounded text-xs font-bold border ${
                  selectedChannel === 'ECOMMERCE'
                    ? 'bg-blue-100 text-blue-900 border-blue-400'
                    : 'bg-white text-neutral-700 border-neutral-300'
                }`}
              >
                📦 Ecommerce Bill
              </button>
            </div>
          )}

          {mode === 'SHIPPING_LABEL' && labels.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-neutral-600">Package:</span>
              <select
                value={selectedGroupIndex}
                onChange={(e) => setSelectedGroupIndex(Number(e.target.value))}
                className="bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-semibold"
              >
                {labels.map((lbl, idx) => (
                  <option key={lbl.groupId || idx} value={idx}>
                    Package {lbl.packageIndex} ({lbl.channel === 'QUICK_COMMERCE' ? 'Quick Commerce' : 'Ecommerce'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Scrollable Document Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-200 flex justify-center items-start">
          <div className="bg-white shadow-lg border border-neutral-400">
            {mode === 'INVOICE' ? (
              <ThermalInvoice4x6
                ref={printAreaRef}
                orderDetail={orderDetail}
                channel={selectedChannel === 'ALL' ? undefined : selectedChannel}
              />
            ) : isLoadingLabels ? (
              <div style={{ width: '4in', height: '6in' }} className="flex flex-col items-center justify-center p-6 text-center bg-white">
                <div className="w-8 h-8 border-3 border-neutral-800 border-t-transparent rounded-full animate-spin mb-3"></div>
                <div className="text-xs font-bold text-neutral-800">Generating Shipping Label...</div>
                <div className="text-[10px] text-neutral-500 mt-1">Retrieving official fulfillment data</div>
              </div>
            ) : labelError ? (
              <div style={{ width: '4in', height: '6in' }} className="flex flex-col items-center justify-center p-6 text-center bg-white">
                <div className="text-2xl mb-2">⚠️</div>
                <div className="text-xs font-bold text-red-700 mb-1">Label Unavailable</div>
                <p className="text-[10px] text-neutral-600">{labelError}</p>
              </div>
            ) : activeLabel ? (
              <ThermalShippingLabel4x6 ref={printAreaRef} label={activeLabel} />
            ) : (
              <div style={{ width: '4in', height: '6in' }} className="flex flex-col items-center justify-center p-6 text-center bg-white">
                <div className="text-xs font-bold text-neutral-800">No Shipping Labels Found</div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Footer */}
        <div className="bg-white px-5 py-3.5 border-t border-neutral-200 flex items-center justify-between">
          <div className="text-xs text-neutral-500 flex items-center gap-1.5">
            <span>ℹ️</span> Standard 4×6 inch thermal roll • Scale: 100% in driver
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={mode === 'SHIPPING_LABEL' && (isLoadingLabels || Boolean(labelError) || !activeLabel)}
              className="px-5 py-2 bg-neutral-900 hover:bg-black text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print (4×6 Thermal)
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Print Container - ONLY this element prints during 4x6 print */}
      <div id="thermal-print-area" className="hidden print:block">
        {mode === 'INVOICE' ? (
          <ThermalInvoice4x6
            orderDetail={orderDetail}
            channel={selectedChannel === 'ALL' ? undefined : selectedChannel}
          />
        ) : activeLabel ? (
          <ThermalShippingLabel4x6 label={activeLabel} />
        ) : null}
      </div>

      {/* Embedded 4x6 Thermal CSS */}
      <style>{`
        @media print {
          @page {
            size: 4in 6in !important;
            margin: 0 !important;
          }
          html, body {
            width: 4in !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide all application chrome, modals, headers, sidebars */
          body * {
            visibility: hidden !important;
          }
          /* Show ONLY the designated 4x6 print area */
          #thermal-print-area,
          #thermal-print-area * {
            visibility: visible !important;
          }
          #thermal-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 4in !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
};
