import { useState, useEffect } from 'react';
import {
    getDeliveryBoys,
    updateDeliveryBoyStatus,
    updateDeliveryBoyAvailability,
    deleteDeliveryBoy,
    type DeliveryBoy,
} from '../../../services/api/admin/adminDeliveryService';
import { useAuth } from '../../../context/AuthContext';
import ConfirmationModal from '../../../components/ConfirmationModal';

export default function AdminManageDeliveryBoy() {
    const { isAuthenticated, token } = useAuth();
    const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [availabilityFilter, setAvailabilityFilter] = useState('All');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [totalPages, setTotalPages] = useState(1);
    const [totalDeliveryBoys, setTotalDeliveryBoys] = useState(0);
    const [successMessage, setSuccessMessage] = useState('');

    // Debounce search term and fetch delivery boys
    useEffect(() => {
        if (!isAuthenticated || !token) {
            setLoading(false);
            return;
        }

        const fetchDeliveryBoys = async () => {
            try {
                setLoading(true);
                setError(null);

                const params: any = {
                    page: currentPage,
                    limit: rowsPerPage,
                    search: searchTerm || undefined,
                    sortBy: sortColumn || undefined,
                    sortOrder: sortDirection,
                };

                if (statusFilter !== 'All') {
                    params.status = statusFilter;
                }

                if (availabilityFilter !== 'All') {
                    params.available = availabilityFilter;
                }

                const response = await getDeliveryBoys(params);

                if (response.success) {
                    setDeliveryBoys(response.data);
                    // Update pagination info from backend
                    if (response.pagination) {
                        setTotalPages(response.pagination.pages);
                        setTotalDeliveryBoys(response.pagination.total);
                    }
                } else {
                    setError('Failed to load delivery boys');
                }
            } catch (err: any) {
                console.error('Error fetching delivery boys:', err);
                setError(err.response?.data?.message || 'Failed to load delivery boys. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        // Debounce search term
        const timer = setTimeout(() => {
            fetchDeliveryBoys();
        }, searchTerm ? 500 : 0); // Immediate fetch if search is empty, debounce if typing

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, token, currentPage, rowsPerPage, searchTerm, statusFilter, availabilityFilter, sortColumn, sortDirection]);

    const handleSort = (column: string) => {
        // Map frontend column names to backend field names
        const columnMap: Record<string, string> = {
            'id': '_id',
            '_id': '_id',
            'name': 'name',
            'mobile': 'mobile',
            'city': 'city',
            'balance': 'balance',
            'cashCollected': 'cashCollected',
            'status': 'status',
            'available': 'available',
        };
        const backendColumn = columnMap[column] || column;

        if (sortColumn === backendColumn) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(backendColumn);
            setSortDirection('asc');
        }
        setCurrentPage(1); // Reset to first page when sorting changes
    };

    const handleStatusChange = async (deliveryBoyId: string, newStatus: 'Active' | 'Inactive') => {
        try {
            setProcessing(deliveryBoyId);
            const response = await updateDeliveryBoyStatus(deliveryBoyId, newStatus);

            if (response.success) {
                // Update local state
                setDeliveryBoys(deliveryBoys.map(deliveryBoy =>
                    deliveryBoy._id === deliveryBoyId ? { ...deliveryBoy, status: newStatus } : deliveryBoy
                ));
                setSuccessMessage(`Delivery boy status updated to ${newStatus} successfully!`);
                setError('');
                // Refresh list to get updated data
                const params: any = {
                    page: currentPage,
                    limit: rowsPerPage,
                    search: searchTerm,
                    sortBy: sortColumn || undefined,
                    sortOrder: sortDirection,
                };
                if (statusFilter !== 'All') params.status = statusFilter;
                if (availabilityFilter !== 'All') params.available = availabilityFilter;
                const refreshResponse = await getDeliveryBoys(params);
                if (refreshResponse.success && refreshResponse.data) {
                    setDeliveryBoys(refreshResponse.data);
                    if (refreshResponse.pagination) {
                        setTotalPages(refreshResponse.pagination.pages);
                        setTotalDeliveryBoys(refreshResponse.pagination.total);
                    }
                }
            } else {
                setError('Failed to update delivery boy status: ' + (response.message || 'Unknown error'));
                setSuccessMessage('');
            }
        } catch (err: any) {
            console.error('Error updating delivery boy status:', err);
            setError('Failed to update delivery boy status: ' + (err.response?.data?.message || 'Please try again.'));
            setSuccessMessage('');
        } finally {
            setProcessing(null);
        }
    };

    const handleAvailabilityChange = async (deliveryBoyId: string, newAvailability: 'Available' | 'Not Available') => {
        try {
            setProcessing(deliveryBoyId);
            const response = await updateDeliveryBoyAvailability(deliveryBoyId, newAvailability);

            if (response.success) {
                // Update local state
                setDeliveryBoys(deliveryBoys.map(deliveryBoy =>
                    deliveryBoy._id === deliveryBoyId ? { ...deliveryBoy, available: newAvailability } : deliveryBoy
                ));
                setSuccessMessage(`Delivery boy availability updated to ${newAvailability} successfully!`);
                setError('');
                // Refresh list to get updated data
                const params: any = {
                    page: currentPage,
                    limit: rowsPerPage,
                    search: searchTerm,
                    sortBy: sortColumn || undefined,
                    sortOrder: sortDirection,
                };
                if (statusFilter !== 'All') params.status = statusFilter;
                if (availabilityFilter !== 'All') params.available = availabilityFilter;
                const refreshResponse = await getDeliveryBoys(params);
                if (refreshResponse.success && refreshResponse.data) {
                    setDeliveryBoys(refreshResponse.data);
                    if (refreshResponse.pagination) {
                        setTotalPages(refreshResponse.pagination.pages);
                        setTotalDeliveryBoys(refreshResponse.pagination.total);
                    }
                }
            } else {
                setError('Failed to update delivery boy availability: ' + (response.message || 'Unknown error'));
                setSuccessMessage('');
            }
        } catch (err: any) {
            console.error('Error updating delivery boy availability:', err);
            setError('Failed to update delivery boy availability: ' + (err.response?.data?.message || 'Please try again.'));
            setSuccessMessage('');
        } finally {
            setProcessing(null);
        }
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        const deliveryBoyId = deleteId;

        try {
            setProcessing(deliveryBoyId);
            const response = await deleteDeliveryBoy(deliveryBoyId);

            if (response.success) {
                setSuccessMessage('Delivery boy deleted successfully!');
                setError('');
                setDeleteId(null);
                // Refresh list
                const params: any = {
                    page: currentPage,
                    limit: rowsPerPage,
                    search: searchTerm,
                    sortBy: sortColumn || undefined,
                    sortOrder: sortDirection,
                };
                if (statusFilter !== 'All') params.status = statusFilter;
                if (availabilityFilter !== 'All') params.available = availabilityFilter;
                const refreshResponse = await getDeliveryBoys(params);
                if (refreshResponse.success && refreshResponse.data) {
                    setDeliveryBoys(refreshResponse.data);
                    if (refreshResponse.pagination) {
                        setTotalPages(refreshResponse.pagination.pages);
                        setTotalDeliveryBoys(refreshResponse.pagination.total);
                    }
                }
            } else {
                setError('Failed to delete delivery boy: ' + (response.message || 'Unknown error'));
                setSuccessMessage('');
                setDeleteId(null);
            }
        } catch (err: any) {
            console.error('Error deleting delivery boy:', err);
            setError('Failed to delete delivery boy: ' + (err.response?.data?.message || 'Please try again.'));
            setSuccessMessage('');
            setDeleteId(null);
        } finally {
            setProcessing(null);
        }
    };

    const handleExport = () => {
        const headers = ['Id', 'Name', 'Mobile', 'Address', 'City', 'Commission', 'Balance', 'Cash Collected', 'Status', 'Available'];
        const csvContent = [
            headers.join(','),
            ...deliveryBoys.map(deliveryBoy => [
                deliveryBoy._id.slice(-6),
                `"${deliveryBoy.name}"`,
                deliveryBoy.mobile,
                `"${deliveryBoy.address}"`,
                `"${deliveryBoy.city}"`,
                deliveryBoy.commissionType === 'Percentage'
                    ? `"Commission ${deliveryBoy.commission}%"`
                    : 'Fixed',
                deliveryBoy.balance,
                deliveryBoy.cashCollected,
                deliveryBoy.status,
                deliveryBoy.available
            ].join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `delivery_boys_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const SortIcon = ({ column }: { column: string }) => {
        // Map frontend column names to backend field names for comparison
        const columnMap: Record<string, string> = {
            'id': '_id',
            '_id': '_id',
            'name': 'name',
            'mobile': 'mobile',
            'city': 'city',
            'balance': 'balance',
            'cashCollected': 'cashCollected',
            'status': 'status',
            'available': 'available',
        };
        const backendColumn = columnMap[column] || column;

        return (
            <span className="text-neutral-400 text-xs ml-1">
                {sortColumn === backendColumn ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
            </span>
        );
    };

    // Use backend data directly (already paginated, filtered, and sorted)
    const displayedDeliveryBoys = deliveryBoys;
    const startIndex = (currentPage - 1) * rowsPerPage;

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Page Content */}
            <div className="flex-1 p-6">
                {/* Main Panel */}
                <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
                    {/* Header */}
                    <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
                        <h2 className="text-lg font-semibold">View Delivery Boy List</h2>
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
                                ×
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
                                ×
                            </button>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="p-4 border-b border-neutral-200 flex flex-col gap-4">
                        {/* Filters Row */}
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                            {/* Status Filter */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-neutral-700 whitespace-nowrap">Status:</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>

                            {/* Availability Filter */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-neutral-700 whitespace-nowrap">Availability:</label>
                                <select
                                    value={availabilityFilter}
                                    onChange={(e) => {
                                        setAvailabilityFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                                >
                                    <option value="All">All Availability</option>
                                    <option value="Available">Available</option>
                                    <option value="Not Available">Not Available</option>
                                </select>
                            </div>

                            {/* Search */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-neutral-700 whitespace-nowrap">Search:</label>
                                <input
                                    type="text"
                                    className="px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none min-w-[200px]"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    placeholder="Search by name, mobile, address..."
                                />
                            </div>
                        </div>

                        {/* Controls Row */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-neutral-600">Show</span>
                                <select
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span className="text-sm text-neutral-600">entries</span>
                            </div>

                            <button
                                onClick={handleExport}
                                className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors"
                            >
                                Export
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('id')}
                                    >
                                        <div className="flex items-center">
                                            Id <SortIcon column="id" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center">
                                            Name <SortIcon column="name" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('mobile')}
                                    >
                                        <div className="flex items-center">
                                            Mobile <SortIcon column="mobile" />
                                        </div>
                                    </th>
                                    <th className="p-4">
                                        Address
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('city')}
                                    >
                                        <div className="flex items-center">
                                            City <SortIcon column="city" />
                                        </div>
                                    </th>
                                    <th className="p-4">
                                        Commission
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('balance')}
                                    >
                                        <div className="flex items-center">
                                            Balance <SortIcon column="balance" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('cashCollected')}
                                    >
                                        <div className="flex items-center">
                                            Cash Collected <SortIcon column="cashCollected" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('status')}
                                    >
                                        <div className="flex items-center">
                                            Status <SortIcon column="status" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('available')}
                                    >
                                        <div className="flex items-center">
                                            Available <SortIcon column="available" />
                                        </div>
                                    </th>
                                    <th className="p-4">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center">
                                            <div className="flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mr-2"></div>
                                                Loading delivery boys...
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center text-red-600">
                                            {error}
                                        </td>
                                    </tr>
                                ) : displayedDeliveryBoys.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center text-neutral-400">
                                            No delivery boys found.
                                        </td>
                                    </tr>
                                ) : (
                                    displayedDeliveryBoys.map((deliveryBoy) => (
                                        <tr key={deliveryBoy._id} className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700 border-b border-neutral-200">
                                            <td className="p-4 align-middle">{deliveryBoy._id.slice(-6)}</td>
                                            <td className="p-4 align-middle">{deliveryBoy.name}</td>
                                            <td className="p-4 align-middle">{deliveryBoy.mobile}</td>
                                            <td className="p-4 align-middle">{deliveryBoy.address}</td>
                                            <td className="p-4 align-middle">{deliveryBoy.city}</td>
                                            <td className="p-4 align-middle">
                                                {deliveryBoy.commissionType === 'Percentage' ? (
                                                    <div className="text-xs">
                                                        <div className="font-medium">Commission {deliveryBoy.commission}%</div>
                                                        <div className="text-neutral-500 mt-1">
                                                            Min Amt: {deliveryBoy.minAmount}
                                                        </div>
                                                        <div className="text-neutral-500">
                                                            Max Amt: {deliveryBoy.maxAmount}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs">Fixed</span>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle">₹{deliveryBoy.balance.toFixed(2)}</td>
                                            <td className="p-4 align-middle">₹{deliveryBoy.cashCollected.toFixed(2)}</td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${deliveryBoy.status === 'Active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {deliveryBoy.status}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${deliveryBoy.available === 'Available'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {deliveryBoy.available}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleStatusChange(deliveryBoy._id, deliveryBoy.status === 'Active' ? 'Inactive' : 'Active')}
                                                        disabled={processing === deliveryBoy._id}
                                                        className={`p-1.5 rounded transition-colors ${deliveryBoy.status === 'Active'
                                                            ? 'text-red-600 hover:bg-red-50'
                                                            : 'text-green-600 hover:bg-green-50'
                                                            }`}
                                                        title={deliveryBoy.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {deliveryBoy.status === 'Active' ? (
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="12" cy="12" r="10"></circle>
                                                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                                                            </svg>
                                                        ) : (
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleAvailabilityChange(deliveryBoy._id, deliveryBoy.available === 'Available' ? 'Not Available' : 'Available')}
                                                        disabled={processing === deliveryBoy._id}
                                                        className={`p-1.5 rounded transition-colors ${deliveryBoy.available === 'Available'
                                                            ? 'text-yellow-600 hover:bg-yellow-50'
                                                            : 'text-green-600 hover:bg-green-50'
                                                            }`}
                                                        title={deliveryBoy.available === 'Available' ? 'Mark as Not Available' : 'Mark as Available'}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10"></circle>
                                                            <path d="M9 12l2 2 4-4"></path>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteId(deliveryBoy._id)}
                                                        disabled={processing === deliveryBoy._id}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 disabled:text-neutral-400 disabled:cursor-not-allowed rounded transition-colors"
                                                        title="Delete"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                        <div className="text-xs sm:text-sm text-neutral-700">
                            Showing {displayedDeliveryBoys.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + displayedDeliveryBoys.length, totalDeliveryBoys)} of {totalDeliveryBoys} entries
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className={`p-2 border border-teal-600 rounded ${currentPage === 1
                                    ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                                    : 'text-teal-600 hover:bg-teal-50'
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
                                        className={`px-3 py-1.5 border border-teal-600 rounded font-medium text-sm ${currentPage === pageNum
                                            ? 'bg-teal-600 text-white'
                                            : 'text-teal-600 hover:bg-teal-50'
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
                                disabled={currentPage === totalPages}
                                className={`p-2 border border-teal-600 rounded ${currentPage === totalPages
                                    ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                                    : 'text-teal-600 hover:bg-teal-50'
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
                </div>
            </div>

            {/* Footer */}
            <footer className="text-center py-4 text-sm text-neutral-600 border-t border-neutral-200 bg-white">
                Copyright © 2025. Developed By{' '}
                <a href="#" className="text-blue-600 hover:underline">Olovely Total Suvidha</a>
            </footer>

            <ConfirmationModal
                isOpen={!!deleteId}
                title="Delete Delivery Boy"
                message="Are you sure you want to delete this delivery boy? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
}


