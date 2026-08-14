import { useState, useEffect } from 'react';
import {
  getNotifications,
  createNotification,
  deleteNotification,
  Notification as NotificationType,
  CreateNotificationData,
} from '../../../services/api/admin/adminNotificationService';

export default function AdminNotification() {
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
      setCurrentPage(1); // Reset to first page when search changes
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch notifications on component mount and when filters change
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
        // Reset form
        setFormData({
          recipientType: 'All',
          title: '',
          message: '',
        });
        // Refresh notifications list
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await deleteNotification(id);
      if (response.success) {
        setSuccessMessage('Notification deleted successfully!');
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
    <span className="text-neutral-400 text-xs ml-1">
      {sortColumn === column ? (sortDirection === 'asc' ? 'â†‘' : 'â†“') : 'â‡…'}
    </span>
  );

  // Client-side filtering and sorting
  let filteredNotifications = notifications;

  // Client-side search filter
  if (searchTerm) {
    const searchLower = String(searchTerm || "").toLowerCase();
    filteredNotifications = filteredNotifications.filter((notification) =>
      String(notification.title || "").toLowerCase().includes(searchLower) ||
      String(notification.message || "").toLowerCase().includes(searchLower) ||
      String(notification.recipientType || "").toLowerCase().includes(searchLower)
    );
  }

  // Client-side sorting (since backend sorting might not support all columns)
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
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  };

  const getRecipientDisplayName = (recipientType: string): string => {
    if (recipientType === 'All') return 'All Users';
    return recipientType;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Page Content */}
      <div className="flex-1 p-6 min-h-0 overflow-y-auto pb-10">
        {/* Header with Title and Breadcrumb */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800">Notification</h1>
          <div className="text-sm">
            <span className="text-blue-600 hover:underline cursor-pointer">Home</span>
            <span className="text-neutral-400 mx-1">/</span>
            <span className="text-neutral-600">Notification</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Left Panel: Send Notification */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col">
            <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-lg font-semibold">Send Notification</h2>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center justify-between">
                <p className="text-sm">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="text-red-700 hover:text-red-900 ml-4 text-lg font-bold"
                  type="button"
                >
                  Ã—
                </button>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-700 flex items-center justify-between">
                <p className="text-sm">{successMessage}</p>
                <button
                  onClick={() => setSuccessMessage('')}
                  className="text-green-700 hover:text-green-900 ml-4 text-lg font-bold"
                  type="button"
                >
                  Ã—
                </button>
              </div>
            )}

            <div className="p-6 flex-1 flex flex-col">
              <form onSubmit={handleSendNotification} className="space-y-4 flex-1 flex flex-col">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Select User Type
                  </label>
                  <select
                    name="recipientType"
                    value={formData.recipientType}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white"
                  >
                    <option value="All">All Users</option>
                    <option value="Admin">Admin</option>
                    <option value="Seller">Seller</option>
                    <option value="Customer">Customer</option>
                    <option value="Delivery">Delivery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    placeholder="Enter Title"
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    placeholder="Enter Message"
                    rows={6}
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
                  />
                </div>

                <div className="mt-auto">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors"
                  >
                    {loading ? 'Sending...' : 'Send Notification'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Panel: View Notification */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-800">View Notification</h2>
            </div>

            {/* Controls */}
            <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-neutral-600">Filter by Type:</span>
                <select
                  value={filterRecipientType}
                  onChange={(e) => {
                    setFilterRecipientType(e.target.value);
                    setCurrentPage(1);
                  }}
                  disabled={loading}
                  className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-green-500 focus:outline-none cursor-pointer"
                >
                  <option value="All">All</option>
                  <option value="Admin">Admin</option>
                  <option value="Seller">Seller</option>
                  <option value="Customer">Customer</option>
                  <option value="Delivery">Delivery</option>
                </select>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  disabled={loading}
                  className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-green-500 focus:outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">Search:</span>
                  <input
                    type="text"
                    className="pl-14 pr-3 py-1.5 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-green-500 w-48"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder=""
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  <p className="mt-2 text-sm text-neutral-600">Loading...</p>
                </div>
              </div>
            )}

            {/* Table */}
            {!loading && (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
                      <th className="p-4">Sr No</th>
                      <th
                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                        onClick={() => handleSort('recipientType')}
                      >
                        <div className="flex items-center">
                          Users <SortIcon column="recipientType" />
                        </div>
                      </th>
                      <th
                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                        onClick={() => handleSort('title')}
                      >
                        <div className="flex items-center">
                          Title <SortIcon column="title" />
                        </div>
                      </th>
                      <th
                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                        onClick={() => handleSort('message')}
                      >
                        <div className="flex items-center">
                          Message <SortIcon column="message" />
                        </div>
                      </th>
                      <th
                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="flex items-center">
                          Date <SortIcon column="createdAt" />
                        </div>
                      </th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedNotifications.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-neutral-400">
                          No notifications found.
                        </td>
                      </tr>
                    ) : (
                      displayedNotifications.map((notification, index) => (
                        <tr
                          key={notification._id}
                          className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700 border-b border-neutral-200"
                        >
                          <td className="p-4 align-middle">{startIndex + index + 1}</td>
                          <td className="p-4 align-middle">{getRecipientDisplayName(notification.recipientType)}</td>
                          <td className="p-4 align-middle">{notification.title}</td>
                          <td className="p-4 align-middle max-w-md">{notification.message}</td>
                          <td className="p-4 align-middle">{formatDate(notification.createdAt)}</td>
                          <td className="p-4 align-middle">
                            <button
                              onClick={() => handleDelete(notification._id)}
                              disabled={loading}
                              className="p-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                              title="Delete"
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
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
            {!loading && totalPages > 1 && (
              <div className="px-4 sm:px-6 py-2 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mb-1">
                <div className="text-xs sm:text-sm text-neutral-700">
                  Showing {displayedNotifications.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + displayedNotifications.length, totalNotifications)} of {totalNotifications} entries
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || loading}
                    className={`p-2 border border-green-600 rounded ${
                      currentPage === 1
                        ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                    aria-label="Previous page"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M15 18L9 12L15 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
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
                        className={`px-3 py-1.5 border border-green-600 rounded font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                          currentPage === pageNum
                            ? 'bg-green-600 text-white'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <span className="px-2 text-neutral-400">...</span>
                  )}
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || loading}
                    className={`p-2 border border-green-600 rounded ${
                      currentPage === totalPages
                        ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                    aria-label="Next page"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9 18L15 12L9 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-sm text-neutral-600 border-t border-neutral-200 bg-white">
        Copyright © 2025. Developed By{' '}
        <a href="#" className="text-blue-600 hover:underline">
          Olovely Total Suvidha
        </a>
      </footer>
    </div>
  );
}

