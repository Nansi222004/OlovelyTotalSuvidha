import { useState, useEffect } from 'react';
import { getUsers, updateUserStatus, type User as UserType } from '../../../services/api/admin/adminMiscService';
import { useAuth } from '../../../context/AuthContext';

interface User {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    registrationDate: string;
    status: 'Active' | 'Inactive' | 'Suspended';
    refCode?: string;
    walletAmount: number;
    totalOrders: number;
    totalSpent: number;
}

export default function AdminUsers() {
    const { isAuthenticated, token } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);

    // Fetch users on component mount
    useEffect(() => {
        if (!isAuthenticated || !token) {
            setLoading(false);
            return;
        }

        const fetchUsers = async () => {
            try {
                setLoading(true);
                setError(null);

                const params: any = {
                    page: currentPage,
                    limit: entriesPerPage,
                };

                if (statusFilter !== 'All') {
                    params.status = statusFilter;
                }

                if (searchTerm) {
                    params.search = searchTerm;
                }

                // Add sorting parameters
                if (sortColumn) {
                    params.sortBy = sortColumn;
                    params.sortOrder = sortDirection;
                }

                const response = await getUsers(params);

                if (response.success) {
                    setUsers(response.data);
                    // Update pagination info from backend
                    if (response.pagination) {
                        setTotalPages(response.pagination.pages);
                        setTotalUsers(response.pagination.total);
                    }
                } else {
                    setError('Failed to load users');
                }
            } catch (err: any) {
                console.error('Error fetching users:', err);
                setError(err.response?.data?.message || 'Failed to load users. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [isAuthenticated, token, currentPage, entriesPerPage, statusFilter, searchTerm, sortColumn, sortDirection]);

    const handleSort = (column: string) => {
        // Map frontend column names to backend field names
        const columnMap: Record<string, string> = {
            'id': '_id',
            'name': 'name',
            '_id': '_id',
            'registrationDate': 'registrationDate',
            'status': 'status',
            'refCode': 'refCode',
            'walletAmount': 'walletAmount',
            'totalOrders': 'totalOrders',
            'totalSpent': 'totalSpent',
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

    const handleExport = () => {
        const headers = ['ID', 'Name', 'Email', 'Phone', 'Registration Date', 'Status', 'Wallet Amount', 'Total Orders', 'Total Spent'];
        const csvContent = [
            headers.join(','),
            ...users.map(user => [
                user._id.slice(-6),
                `"${user.name}"`,
                `"${user.email}"`,
                `"${user.phone || ''}"`,
                `"${new Date(user.registrationDate).toLocaleString()}"`,
                user.status,
                user.walletAmount.toFixed(2),
                user.totalOrders,
                user.totalSpent.toFixed(2),
            ].join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Use backend data directly (already paginated)
    const displayedUsers = users;
    const startIndex = (currentPage - 1) * entriesPerPage;

    const handleStatusChange = async (userId: string, newStatus: 'Active' | 'Suspended') => {
        try {
            const response = await updateUserStatus(userId, newStatus);

            if (response.success) {
                // Update local state
                setUsers(users.map(user =>
                    user._id === userId ? { ...user, status: newStatus } : user
                ));
                // Show success message (can be replaced with toast notification)
                setError('');
                setTimeout(() => {
                    alert(`User status updated to ${newStatus} successfully!`);
                }, 100);
            } else {
                alert('Failed to update user status: ' + (response.message || 'Unknown error'));
            }
        } catch (err: any) {
            console.error('Error updating user status:', err);
            alert('Failed to update user status: ' + (err.response?.data?.message || 'Please try again.'));
        }
    };

    const SortIcon = ({ column }: { column: string }) => {
        // Map frontend column names to backend field names for comparison
        const columnMap: Record<string, string> = {
            'id': '_id',
            'name': 'name',
            '_id': '_id',
            'registrationDate': 'registrationDate',
            'status': 'status',
            'refCode': 'refCode',
            'walletAmount': 'walletAmount',
            'totalOrders': 'totalOrders',
            'totalSpent': 'totalSpent',
        };
        const backendColumn = columnMap[column] || column;

        return (
            <span className="text-neutral-400 text-xs ml-1">
                {sortColumn === backendColumn ? (sortDirection === 'asc' ? 'â†‘' : 'â†“') : 'â‡…'}
            </span>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Page Header */}
            <div className="p-6 pb-0">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-semibold text-teal-800">User List</h1>
                    <div className="text-sm text-blue-500">
                        <span className="text-blue-500 hover:underline cursor-pointer">Home</span>{' '}
                        <span className="text-neutral-400">/</span> User List
                    </div>
                </div>
            </div>

            {/* Page Content */}
            <div className="flex-1 px-6 pb-6">
                {/* Main Panel */}
                <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
                    {/* Header */}
                    <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
                        <h2 className="text-lg font-semibold">View Users</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-sm">Show</span>
                            <select
                                value={entriesPerPage}
                                onChange={(e) => {
                                    setEntriesPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="bg-white text-teal-600 border border-teal-300 rounded py-1 px-2 text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="text-sm">entries</span>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
                                    <th className="p-4">
                                        Sr No
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center">
                                            Name <SortIcon column="name" />
                                        </div>
                                    </th>
                                    <th className="p-4">
                                        Contact
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('registrationDate')}
                                    >
                                        <div className="flex items-center">
                                            registration Date <SortIcon column="registrationDate" />
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
                                        onClick={() => handleSort('refCode')}
                                    >
                                        <div className="flex items-center">
                                            Ref Code <SortIcon column="refCode" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('walletAmount')}
                                    >
                                        <div className="flex items-center">
                                            Wallet Amt <SortIcon column="walletAmount" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('totalOrders')}
                                    >
                                        <div className="flex items-center">
                                            Total Orders <SortIcon column="totalOrders" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('totalSpent')}
                                    >
                                        <div className="flex items-center">
                                            Total Spent <SortIcon column="totalSpent" />
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
                                                Loading users...
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center text-red-600">
                                            {error}
                                        </td>
                                    </tr>
                                ) : displayedUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center text-neutral-400">
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    displayedUsers.map((user, index) => (
                                        <tr key={user._id} className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700 border-b border-neutral-200">
                                            <td className="p-4 align-middle">{startIndex + index + 1}</td>
                                            <td className="p-4 align-middle">{user.name}</td>
                                            <td className="p-4 align-middle">
                                                <div className="text-xs">
                                                    <div>{user.email}</div>
                                                    {user.phone && (
                                                        <div className="text-neutral-500">{user.phone}</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">{new Date(user.registrationDate).toLocaleString()}</td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.status === 'Active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : user.status === 'Suspended'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">{user.refCode || '-'}</td>
                                            <td className="p-4 align-middle">₹{user.walletAmount.toFixed(2)}</td>
                                            <td className="p-4 align-middle">{user.totalOrders}</td>
                                            <td className="p-4 align-middle">₹{user.totalSpent.toFixed(2)}</td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleStatusChange(user._id, user.status === 'Active' ? 'Suspended' : 'Active')}
                                                        className={`p-1.5 text-white rounded transition-colors ${user.status === 'Active'
                                                            ? 'bg-red-600 hover:bg-red-700'
                                                            : 'bg-green-600 hover:bg-green-700'
                                                            }`}
                                                        title={user.status === 'Active' ? 'Suspend User' : 'Activate User'}
                                                    >
                                                        {user.status === 'Active' ? (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="12" cy="12" r="10"></circle>
                                                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                                                            </svg>
                                                        ) : (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                        )}
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
                            Showing {displayedUsers.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + displayedUsers.length, totalUsers)} of {totalUsers} entries
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
        </div>
    );
}


