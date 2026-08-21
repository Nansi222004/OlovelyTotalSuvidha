import { useState, useEffect } from 'react';
import {
  getNotifications,
  createNotification,
  deleteNotification,
  Notification as NotificationType,
  CreateNotificationData,
} from '../../../services/api/admin/adminNotificationService';
import ConfirmationModal from '../../../components/ConfirmationModal';

export default function AdminNotification() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    recipientType: 'All' as 'All' | 'Admin' | 'Seller' | 'Customer' | 'Delivery',
    title: '',
    message: '',
  });

  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [totalPages, setTotalPages] = useState(1);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [filterRecipientType, setFilterRecipientType] = useState<string>('All');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, rowsPerPage, filterRecipientType]);

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {
        page: currentPage,
        limit: rowsPerPage,
      };

      if (filterRecipientType !== 'All') {
        params.recipientType = filterRecipientType;
      }

      const response = await getNotifications(params);

      if (response.success && response.data) {
        setNotifications(response.data);
        if (response.pagination) {
          setTotalPages(response.pagination.pages);
          setTotalNotifications(response.pagination.total);
        }
      } else {
        setError(response.message || 'Failed to fetch notifications');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error fetching notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!formData.title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (!formData.message.trim()) {
      setError('Please enter a message');
      return;
    }

    setLoading(true);
    try {
      const notificationData: CreateNotificationData = {
        recipientType: formData.recipientType,
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: 'Info',
        priority: 'Medium',
      };

      const response = await createNotification(notificationData);

      if (response.success) {
        setSuccessMessage('Notification sent successfully!');
        setFormData({
          recipientType: 'All',
          title: '',
          message: '',
        });
        fetchNotifications();
      } else {
        setError(response.message || 'Failed to send notification');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error sending notification');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;

    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await deleteNotification(id);
      if (response.success) {
        setSuccessMessage('Notification deleted successfully!');
        setDeleteId(null);
        fetchNotifications();
      } else {
        setError(response.message || 'Failed to delete notification');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error deleting notification');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: string }) => (
    <span className="text-neutral-400 text-xs ml-1 inline-block">
      {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  let filteredNotifications = notifications;

  if (searchTerm) {
    const searchLower = String(searchTerm || "").toLowerCase();
    filteredNotifications = filteredNotifications.filter((notification) =>
      String(notification.title || "").toLowerCase().includes(searchLower) ||
      String(notification.message || "").toLowerCase().includes(searchLower) ||
      String(notification.recipientType || "").toLowerCase().includes(searchLower)
    );
  }

  let sortedNotifications = [...filteredNotifications];
  if (sortColumn) {
    sortedNotifications = [...filteredNotifications].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'recipientType':
          aValue = a.recipientType;
          bValue = b.recipientType;
          break;
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        case 'message':
          aValue = a.message;
          bValue = b.message;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt || '').getTime();
          bValue = new Date(b.createdAt || '').getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const displayedNotifications = sortedNotifications;
  const startIndex = (currentPage - 1) * rowsPerPage;

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

  const renderRecipientBadge = (recipientType: string) => {
    switch (recipientType) {
      case 'All':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            All Users
          </span>
        );
      case 'Customer':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            Customer
          </span>
        );
      case 'Seller':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            Seller
          </span>
        );
      case 'Delivery':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
            Delivery
          </span>
        );
      case 'Admin':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
            Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {recipientType}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200/80">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Notification Center</span>
            {totalNotifications > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {totalNotifications} Total
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Broadcast announcement push notifications to Customers, Sellers, Delivery partners, or Admins.
          </p>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1.5 self-start sm:self-center">
          <span className="text-emerald-600 font-medium hover:underline cursor-pointer">Home</span>
          <span>/</span>
          <span className="text-slate-600">Notification</span>
        </div>
      </div>

      {/* Main Grid: 5 Cols Form, 7 Cols Table with min-w-0 and items-start */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Send Notification Form (col-span-5) */}
        <div className="lg:col-span-5 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white px-5 py-4 flex items-center justify-between">
            <h2 className="text-base font-bold tracking-wide flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" />
              </svg>
              <span>Send Notification</span>
            </h2>
            <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium backdrop-blur-xs">
              Broadcast
            </span>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            {/* Banner Messages */}
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start justify-between gap-2">
                <div className="flex gap-2 items-center">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
                <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold text-base leading-none">
                  ×
                </button>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-start justify-between gap-2">
                <div className="flex gap-2 items-center">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{successMessage}</span>
                </div>
                <button onClick={() => setSuccessMessage('')} className="text-emerald-600 hover:text-emerald-800 font-bold text-base leading-none">
                  ×
                </button>
              </div>
            )}

            <form onSubmit={handleSendNotification} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Select User Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="recipientType"
                  value={formData.recipientType}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all outline-none cursor-pointer"
                >
                  <option value="All">All Users</option>
                  <option value="Admin">Admin</option>
                  <option value="Seller">Seller</option>
                  <option value="Customer">Customer</option>
                  <option value="Delivery">Delivery</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  placeholder="e.g. Special Offer or System Maintenance"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  placeholder="Enter detailed notification content..."
                  rows={4}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all outline-none resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] text-white font-semibold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      <span>Send Notification</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Panel: View Notification Table (col-span-7) */}
        <div className="lg:col-span-7 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden flex flex-col">
          {/* Card Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Notification History</h2>
              <p className="text-xs text-slate-500">View and manage sent notifications</p>
            </div>
          </div>

          {/* Controls / Filter Toolbar */}
          <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Filter:</span>
                <select
                  value={filterRecipientType}
                  onChange={(e) => {
                    setFilterRecipientType(e.target.value);
                    setCurrentPage(1);
                  }}
                  disabled={loading}
                  className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-1.5 px-2.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none cursor-pointer"
                >
                  <option value="All">All Types</option>
                  <option value="Admin">Admin</option>
                  <option value="Seller">Seller</option>
                  <option value="Customer">Customer</option>
                  <option value="Delivery">Delivery</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Show:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  disabled={loading}
                  className="bg-slate-50 border border-slate-300 text-slate-800 rounded-lg py-1.5 px-2.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:flex-none">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="w-full sm:w-56 pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search title, message..."
                disabled={loading}
              />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center space-y-2">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
                <p className="text-xs font-medium text-slate-500">Loading notifications...</p>
              </div>
            </div>
          )}

          {/* Table Container with Overflow Protection */}
          {!loading && (
            <div className="overflow-x-auto w-full min-w-0">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                      onClick={() => handleSort('recipientType')}
                    >
                      <div className="flex items-center">
                        User <SortIcon column="recipientType" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center">
                        Title <SortIcon column="title" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                      onClick={() => handleSort('message')}
                    >
                      <div className="flex items-center">
                        Message <SortIcon column="message" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center">
                        Date <SortIcon column="createdAt" />
                      </div>
                    </th>
                    <th className="py-3 px-4 w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedNotifications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                        No notifications match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedNotifications.map((notification, index) => (
                      <tr
                        key={notification._id}
                        className="hover:bg-slate-50/80 transition-colors text-xs text-slate-700"
                      >
                        <td className="py-3 px-4 font-mono text-slate-400 text-center">{startIndex + index + 1}</td>
                        <td className="py-3 px-4 font-medium whitespace-nowrap">
                          {renderRecipientBadge(notification.recipientType)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 max-w-[140px] truncate" title={notification.title}>
                          {notification.title}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-[220px] truncate" title={notification.message}>
                          {notification.message}
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                          {formatDate(notification.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setDeleteId(notification._id)}
                            disabled={loading}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete notification"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && totalNotifications > 0 && (
            <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-600 font-medium">
                Showing {displayedNotifications.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + displayedNotifications.length, totalNotifications)} of {totalNotifications} entries
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || loading}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    aria-label="Previous page"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M15 18L9 12L15 6" />
                    </svg>
                  </button>

                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={loading}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center border transition-all cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || loading}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    aria-label="Next page"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M9 18L15 12L9 6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center pt-4 text-xs text-slate-400">
        Copyright © 2026. Developed By{' '}
        <a href="#" className="text-emerald-600 font-medium hover:underline">
          Olovely Total Suvidha
        </a>
      </footer>

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Delete Notification"
        message="Are you sure you want to delete this notification? This action cannot be undone."
        confirmText="Delete Notification"
        variant="danger"
        isLoading={loading}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
