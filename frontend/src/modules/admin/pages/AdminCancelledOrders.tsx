import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getOrdersByStatus, type Order } from '../../../services/api/admin/adminOrderService';
import { useAuth } from '../../../context/AuthContext';

type SortField = 'orderId' | 'customerDetails' | 'address' | 'deliveryDate' | 'orderDate' | 'status' | 'deliveryBoyStatus' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function AdminCancelledOrders() {
  const { isAuthenticated, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dateRange, setDateRange] = useState('');
  const [seller, setSeller] = useState('All Sellers');
  const [status, setStatus] = useState('Cancelled');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>('orderDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        const params: any = {
          page: currentPage,
          limit: parseInt(entriesPerPage),
        };

        if (searchQuery) {
          params.search = searchQuery;
        }

        if (dateRange && dateRange.includes(' - ')) {
          const [dateFrom, dateTo] = dateRange.split(' - ').map(d => {
            const parts = d.trim().split('/');
            if (parts.length === 3) {
              return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            }
            return d.trim();
          });
          params.dateFrom = dateFrom;
          params.dateTo = dateTo;
        }

        const response = await getOrdersByStatus('Cancelled', params);
        if (response.success && Array.isArray(response.data)) {
          setOrders(response.data);
        } else {
          setOrders([]);
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosError = err as { response?: { data?: { message?: string } } };
          setError(axiosError.response?.data?.message || 'Failed to load orders. Please try again.');
        } else {
          setError('Failed to load orders. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [isAuthenticated, token, currentPage, entriesPerPage, searchQuery, dateRange]);

  const handleClearDate = () => {
    setDateRange('');
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = () => {
    const headers = ['Order ID', 'Customer Name', 'Phone', 'Address', 'Order Date', 'Payment Method', 'Payment Status', 'Status', 'Delivery Status', 'Total Amount'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedOrders.map(order =>
        [
          `"${order.orderNumber || ''}"`,
          `"${order.customerName || (typeof order.customer === 'object' ? order.customer?.name : '') || ''}"`,
          `"${order.customerPhone || (typeof order.customer === 'object' ? order.customer?.phone : '') || ''}"`,
          `"${(order.deliveryAddress?.address || '').replace(/"/g, '""')}"`,
          `"${order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN') : ''}"`,
          `"${order.paymentMethod || ''}"`,
          `"${order.paymentStatus || ''}"`,
          `"${order.status || ''}"`,
          `"${order.deliveryBoyStatus || 'Not Assigned'}"`,
          `"${order.total?.toFixed(2) || '0.00'}"`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cancelled_orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders];

    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: string | number = '';
        let bValue: string | number = '';

        switch (sortField) {
          case 'orderId':
            aValue = a.orderNumber || '';
            bValue = b.orderNumber || '';
            break;
          case 'customerDetails':
            aValue = a.customerName || (typeof a.customer === 'object' ? a.customer?.name : '') || '';
            bValue = b.customerName || (typeof b.customer === 'object' ? b.customer?.name : '') || '';
            break;
          case 'address':
            aValue = a.deliveryAddress?.address || '';
            bValue = b.deliveryAddress?.address || '';
            break;
          case 'deliveryDate':
            aValue = a.estimatedDeliveryDate || '';
            bValue = b.estimatedDeliveryDate || '';
            break;
          case 'orderDate':
            aValue = a.orderDate || a.createdAt || '';
            bValue = b.orderDate || b.createdAt || '';
            break;
          case 'status':
            aValue = a.status || '';
            bValue = b.status || '';
            break;
          case 'deliveryBoyStatus':
            aValue = a.deliveryBoyStatus || '';
            bValue = b.deliveryBoyStatus || '';
            break;
          case 'amount':
            aValue = a.total || 0;
            bValue = b.total || 0;
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'string' || typeof bValue === 'string') {
          aValue = String(aValue ?? '').toLowerCase();
          bValue = String(bValue ?? '').toLowerCase();
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [orders, sortField, sortDirection]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalCount = orders.length;
    const totalAmount = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const onlineRefundedCount = orders.filter(o => o.paymentMethod === 'Online' && o.paymentStatus === 'Refunded').length;
    const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;
    return { totalCount, totalAmount, onlineRefundedCount, avgAmount };
  }, [orders]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedOrders.length / parseInt(entriesPerPage)));
  const startIndex = (currentPage - 1) * parseInt(entriesPerPage);
  const endIndex = startIndex + parseInt(entriesPerPage);
  const paginatedOrders = filteredAndSortedOrders.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <Link to="/admin" className="hover:text-emerald-600 transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-neutral-800 font-medium">Orders</span>
            <span>/</span>
            <span className="text-red-600 font-medium">Cancelled Orders</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            Cancelled Orders
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
              {stats.totalCount}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCurrentPage(1);
              setLoading(true);
              getOrdersByStatus('Cancelled', { page: 1, limit: parseInt(entriesPerPage) })
                .then(res => { if (res.success) setOrders(res.data); })
                .finally(() => setLoading(false));
            }}
            className="px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 rounded-xl transition-all flex items-center gap-1.5"
            title="Refresh list"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          <button
            onClick={handleExport}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Analytics KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg">
            🚫
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Total Cancelled</p>
            <h3 className="text-xl font-extrabold text-neutral-900">{stats.totalCount}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
            ₹
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Cancelled Value</p>
            <h3 className="text-xl font-extrabold text-neutral-900">₹{stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
            💳
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Razorpay Refunded</p>
            <h3 className="text-xl font-extrabold text-neutral-900">{stats.onlineRefundedCount}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
            📊
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Avg. Order Value</p>
            <h3 className="text-xl font-extrabold text-neutral-900">₹{stats.avgAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
          </div>
        </div>
      </div>

      {/* Filters & Control Card */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
        <div className="p-4 bg-neutral-50/80 border-b border-neutral-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Order ID, Customer, Address..."
              className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-white border border-neutral-300/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-neutral-800 transition-all placeholder:text-neutral-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Group */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range Input */}
            <div className="flex items-center gap-2 bg-white border border-neutral-300/80 rounded-xl px-3 py-1.5 text-xs">
              <svg className="w-4 h-4 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="text"
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-40 text-neutral-700 bg-transparent focus:outline-none placeholder:text-neutral-400"
                placeholder="MM/DD/YYYY - MM/DD/YYYY"
              />
              {dateRange && (
                <button
                  onClick={handleClearDate}
                  className="text-xs text-red-600 hover:underline font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Seller Filter */}
            <select
              value={seller}
              onChange={(e) => {
                setSeller(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs bg-white border border-neutral-300/80 rounded-xl text-neutral-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="All Sellers">All Sellers</option>
            </select>

            {/* Status Filter */}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs bg-white border border-neutral-300/80 rounded-xl text-neutral-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="Cancelled">Cancelled</option>
            </select>

            {/* Entries Limit Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span>Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 bg-white border border-neutral-300/80 rounded-xl text-neutral-700 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-100/60 border-b border-neutral-200 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                <th
                  onClick={() => handleSort('orderId')}
                  className="px-4 py-3.5 cursor-pointer hover:text-neutral-900 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    Order ID
                    {sortField === 'orderId' && (<span>{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('customerDetails')}
                  className="px-4 py-3.5 cursor-pointer hover:text-neutral-900 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    Customer
                    {sortField === 'customerDetails' && (<span>{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('address')}
                  className="px-4 py-3.5 cursor-pointer hover:text-neutral-900 transition-colors max-w-[240px]"
                >
                  <div className="flex items-center gap-1">
                    Delivery Address
                    {sortField === 'address' && (<span>{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('orderDate')}
                  className="px-4 py-3.5 cursor-pointer hover:text-neutral-900 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    Order Date
                    {sortField === 'orderDate' && (<span>{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>

                <th className="px-4 py-3.5 text-center whitespace-nowrap">Payment</th>

                <th
                  onClick={() => handleSort('status')}
                  className="px-4 py-3.5 text-center cursor-pointer hover:text-neutral-900 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Order Status
                    {sortField === 'status' && (<span>{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('deliveryBoyStatus')}
                  className="px-4 py-3.5 text-center cursor-pointer hover:text-neutral-900 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Delivery Status
                    {sortField === 'deliveryBoyStatus' && (<span>{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('amount')}
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-neutral-900 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1">
                    Amount
                    {sortField === 'amount' && (<span>{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                  </div>
                </th>

                <th className="px-4 py-3.5 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200/80 text-xs text-neutral-700 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-medium text-neutral-500">Loading cancelled orders...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-red-600">
                    <p className="font-semibold">{error}</p>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-neutral-400">
                      <span className="text-4xl">📦</span>
                      <p className="text-base font-semibold text-neutral-700">No Cancelled Orders Found</p>
                      <p className="text-xs text-neutral-500">No cancelled orders match your search filters.</p>
                      {(searchQuery || dateRange) && (
                        <button
                          onClick={() => { setSearchQuery(''); setDateRange(''); }}
                          className="mt-2 text-xs font-semibold text-emerald-600 hover:underline"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const custName = order.customerName || (typeof order.customer === 'object' ? order.customer?.name : '') || 'Guest';
                  const custPhone = order.customerPhone || (typeof order.customer === 'object' ? order.customer?.phone : '');
                  const fullAddress = order.deliveryAddress?.address || 'No address provided';

                  return (
                    <tr key={order._id} className="hover:bg-neutral-50/80 transition-colors group">
                      
                      {/* Order ID & Copy */}
                      <td className="px-4 py-3.5 font-mono font-semibold text-neutral-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/admin/orders/${order._id}`}
                            className="text-emerald-700 hover:text-emerald-800 hover:underline font-mono"
                          >
                            {order.orderNumber}
                          </Link>
                          <button
                            onClick={(e) => handleCopyId(order.orderNumber, e)}
                            className="text-neutral-400 hover:text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy Order ID"
                          >
                            {copiedId === order.orderNumber ? '✓' : '📋'}
                          </button>
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-medium text-neutral-900">{custName}</div>
                        {custPhone && <div className="text-[11px] text-neutral-400 font-mono">{custPhone}</div>}
                      </td>

                      {/* Compact Address with Truncation & Hover Tooltip */}
                      <td className="px-4 py-3.5 max-w-[240px]" title={fullAddress}>
                        <p className="line-clamp-2 text-neutral-600 leading-snug">
                          {fullAddress}
                        </p>
                      </td>

                      {/* Order Date */}
                      <td className="px-4 py-3.5 text-neutral-600 whitespace-nowrap font-medium">
                        {order.orderDate
                          ? new Date(order.orderDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : '-'}
                      </td>

                      {/* Payment Method & Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-semibold text-xs text-neutral-800">
                            {order.paymentMethod || 'COD'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.paymentStatus === 'Refunded'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : order.paymentStatus === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {order.paymentStatus || 'Pending'}
                          </span>
                        </div>
                      </td>

                      {/* Order Status Badge */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          Cancelled
                        </span>
                      </td>

                      {/* Delivery Boy Assign Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          order.deliveryBoyStatus === 'Assigned'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                          {order.deliveryBoyStatus || 'Not Assigned'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 text-right font-extrabold text-neutral-900 whitespace-nowrap text-sm">
                        ₹{order.total?.toFixed(2) || '0.00'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <Link to={`/admin/orders/${order._id}`}>
                          <button
                            className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-200"
                            title="View Order Details"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3.5 bg-neutral-50/80 border-t border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-600">
          <div>
            Showing <span className="font-semibold text-neutral-900">{filteredAndSortedOrders.length === 0 ? 0 : startIndex + 1}</span> to <span className="font-semibold text-neutral-900">{Math.min(endIndex, filteredAndSortedOrders.length)}</span> of <span className="font-semibold text-neutral-900">{filteredAndSortedOrders.length}</span> entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-neutral-300/80 rounded-xl text-neutral-700 bg-white hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium"
            >
              Previous
            </button>
            <span className="px-2 font-semibold text-neutral-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1.5 border border-neutral-300/80 rounded-xl text-neutral-700 bg-white hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
