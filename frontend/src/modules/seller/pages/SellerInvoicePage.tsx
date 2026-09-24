import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { getOrderById, type OrderDetail } from '../../../services/api/orderService';
import { SellerInvoice } from '../components/SellerInvoice';
import { exportElementToPdf } from '../../../utils/invoicePdfExport';
import { useToast } from '../../../context/ToastContext';

export default function SellerInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const response = await getOrderById(id);
        if (response.success && response.data) {
          setOrderDetail(response.data);
        } else {
          setError(response.message || 'Failed to load order for invoice');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!invoiceRef.current || !orderDetail) return;
    setIsExporting(true);
    try {
      const fileName = `Invoice_${orderDetail.invoiceNumber || orderDetail.id}.pdf`;
      await exportElementToPdf(invoiceRef.current, { fileName });
      showToast('Invoice PDF exported successfully!', 'success');
    } catch {
      showToast('Failed to export invoice PDF. Please try Print instead.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-neutral-600 text-sm font-medium">Loading Tax Invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !orderDetail) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-neutral-900 mb-1">Invoice Error</h2>
          <p className="text-sm text-neutral-600 mb-4">{error || 'Order record not found.'}</p>
          <button
            onClick={() => navigate(`/seller/orders/${id || ''}`)}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Back to Order Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 py-6 px-3 sm:px-6 print:bg-white print:p-0 print:m-0">
      {/* Top Action Bar (hidden during print) */}
      <div className="max-w-[850px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs print:hidden">
        <button
          onClick={() => navigate(`/seller/orders/${orderDetail.id}`)}
          className="inline-flex items-center gap-2 text-neutral-700 hover:text-neutral-900 font-semibold text-sm transition-colors cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Order
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            {isExporting ? 'Exporting PDF...' : 'Export Invoice PDF'}
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print Invoice
          </button>
        </div>
      </div>

      {/* Dedicated Invoice Document */}
      <SellerInvoice ref={invoiceRef} orderDetail={orderDetail} />

      {/* Global Print-Only CSS targeting A4 Document Flow */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
