import { useState, useEffect } from 'react';
import { getAllSellers, updateSellerStatus, deleteSeller, Seller as SellerType, updateSeller, updateSellerCategoryCommissions } from '../../../services/api/sellerService';
import { getHeaderCategoriesAdmin, HeaderCategory } from '../../../services/api/headerCategoryService';
import SellerServiceMap from '../components/SellerServiceMap';
import ConfirmationModal from '../../../components/ConfirmationModal';

interface Seller {
    _id: string;
    id?: number; // For backward compatibility with existing code
    name: string;
    sellerName: string;
    storeName: string;
    phone: string;
    mobile: string;
    email: string;
    logo?: string;
    balance: number;
    commission: number;
    categories: string[];
    categoryCommissions?: Array<{
        headerCategory: string;
        commissionRate: number;
    }>;
    status: 'Approved' | 'Pending' | 'Rejected';
    needApproval: boolean;
    // Additional fields from signup
    category?: string;
    address?: string;
    city?: string;
    serviceableArea?: string;
    panCard?: string;
    taxName?: string;
    taxNumber?: string;
    searchLocation?: string;
    latitude?: string;
    longitude?: string;
    serviceRadiusKm?: number;
    accountName?: string;
    bankName?: string;
    branch?: string;
    accountNumber?: string;
    ifsc?: string;
    profile?: string;
    idProof?: string;
    addressProof?: string;
    requireProductApproval?: boolean;
    viewCustomerDetails?: boolean;
}

// Helper function to convert backend seller to frontend format
const mapSellerToFrontend = (seller: SellerType): Seller => {
    return {
        _id: seller._id,
        id: parseInt(seller._id.slice(-6), 16) || 0, // Generate a numeric ID from MongoDB _id
        name: seller.sellerName,
        sellerName: seller.sellerName,
        storeName: seller.storeName,
        phone: seller.mobile,
        mobile: seller.mobile,
        email: seller.email,
        logo: seller.logo || '/api/placeholder/40/40',
        balance: seller.balance || 0,
        commission: seller.commission || 0,
        categories: seller.categories || [],
        categoryCommissions: seller.categoryCommissions || [],
        status: seller.status,
        needApproval: seller.status === 'Pending',
        category: seller.category,
        address: seller.address,
        city: seller.city,
        serviceableArea: seller.serviceableArea,
        panCard: seller.panCard,
        taxName: seller.taxName,
        taxNumber: seller.taxNumber,
        searchLocation: seller.searchLocation,
        latitude: seller.latitude,
        longitude: seller.longitude,
        serviceRadiusKm: seller.serviceRadiusKm,
        accountName: seller.accountName,
        bankName: seller.bankName,
        branch: seller.branch,
        accountNumber: seller.accountNumber,
        ifsc: seller.ifsc,
        profile: seller.profile,
        idProof: seller.idProof,
        addressProof: seller.addressProof,
        requireProductApproval: seller.requireProductApproval,
        viewCustomerDetails: seller.viewCustomerDetails,
    };
};

// Stable fallback logo to avoid endless reload loops when logo is missing
const FALLBACK_LOGO =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="#E5F3F2"/>
            <path d="M20 19c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5Zm0 2.5c-3.333 0-10 1.667-10 5v1.5c0 .552.448 1 1 1h18c.552 0 1-.448 1-1V26.5c0-3.333-6.667-5-10-5Z" fill="#0F766E"/>
        </svg>`
    );

export default function AdminManageSellerList() {
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Seller>>({});
    const [isSavingSeller, setIsSavingSeller] = useState(false);
    const [editError, setEditError] = useState<string>('');
    const [isUpdatingRadius, setIsUpdatingRadius] = useState(false);
    const [newRadius, setNewRadius] = useState<number>(10);

    // Category Commission Modal state
    const [commissionModalSeller, setCommissionModalSeller] = useState<Seller | null>(null);
    const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
    const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
    const [commissionRates, setCommissionRates] = useState<Record<string, number>>({});
    const [isSavingCommissions, setIsSavingCommissions] = useState(false);
    const [commissionSuccess, setCommissionSuccess] = useState('');

    // Fetch sellers from backend
    useEffect(() => {
        const fetchSellers = async () => {
            try {
                setLoading(true);
                setError('');
                const response = await getAllSellers();
                if (response.success && response.data) {
                    const mappedSellers = response.data.map(mapSellerToFrontend);
                    setSellers(mappedSellers);
                } else {
                    setError('Failed to fetch sellers');
                }
            } catch (err: any) {
                console.error('Error fetching sellers:', err);
                // Show a clear message when the admin is not authenticated/authorized
                if (err?.response?.status === 401 || err?.response?.status === 403) {
                    setError('Please login as admin to view sellers.');
                } else {
                    setError(err.response?.data?.message || 'Failed to fetch sellers. Please try again.');
                }
                // Show empty on error - no mock data fallback
                setSellers([]);
            } finally {
                setLoading(false);
            }
        };

        fetchSellers();
    }, []);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ column }: { column: string }) => (
        <span className="text-neutral-400 text-xs ml-1">
            {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
        </span>
    );

    // Filter sellers
    let filteredSellers = sellers.filter(seller => {
        const q = String(searchTerm || "").toLowerCase();
        return (
            String(seller.name || "").toLowerCase().includes(q) ||
            String(seller.storeName || "").toLowerCase().includes(q) ||
            String(seller.email || "").toLowerCase().includes(q) ||
            String(seller.phone || "").includes(searchTerm || "") ||
            String(seller.mobile || "").includes(searchTerm || "")
        );
    });

    // Sort sellers
    if (sortColumn) {
        filteredSellers = [...filteredSellers].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortColumn) {
                case 'id':
                    aValue = a._id;
                    bValue = b._id;
                    break;
                case 'name':
                    aValue = a.name;
                    bValue = b.name;
                    break;
                case 'storeName':
                    aValue = a.storeName;
                    bValue = b.storeName;
                    break;
                case 'balance':
                    aValue = a.balance;
                    bValue = b.balance;
                    break;
                case 'commission':
                    aValue = a.commission;
                    bValue = b.commission;
                    break;
                case 'status':
                    aValue = a.status;
                    bValue = b.status;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    const totalPages = Math.ceil(filteredSellers.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const displayedSellers = filteredSellers.slice(startIndex, endIndex);

    const handleExport = () => {
        const headers = ['Id', 'Name', 'Store Name', 'Contact', 'Balance', 'Commission', 'Status'];
        const csvContent = [
            headers.join(','),
            ...filteredSellers.map(seller => [
                seller.id,
                `"${seller.name}"`,
                `"${seller.storeName}"`,
                `"${seller.phone}, ${seller.email}"`,
                seller.balance,
                `${seller.commission}%`,
                seller.status
            ].join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `sellers_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleEdit = (id: number | string) => {
        const sellerId = typeof id === 'number' ? sellers.find(s => s.id === id)?._id : id;
        const seller = sellers.find(s => s._id === sellerId);
        if (seller) {
            setEditingSeller(seller);
            setEditForm({
                name: seller.name || seller.sellerName || '',
                sellerName: seller.sellerName || seller.name || '',
                storeName: seller.storeName || '',
                email: seller.email || '',
                phone: seller.phone || seller.mobile || '',
                mobile: seller.mobile || seller.phone || '',
                category: seller.category || '',
                commission: seller.commission || 0,
                status: seller.status || 'Pending',
                address: seller.address || '',
                city: seller.city || '',
                serviceableArea: seller.serviceableArea || '',
                searchLocation: seller.searchLocation || '',
                latitude: seller.latitude || '',
                longitude: seller.longitude || '',
                serviceRadiusKm: seller.serviceRadiusKm || 10,
                panCard: seller.panCard || '',
                taxName: seller.taxName || '',
                taxNumber: seller.taxNumber || '',
                accountName: seller.accountName || '',
                bankName: seller.bankName || '',
                branch: seller.branch || '',
                accountNumber: seller.accountNumber || '',
                ifsc: seller.ifsc || '',
                requireProductApproval: seller.requireProductApproval ?? false,
                viewCustomerDetails: seller.viewCustomerDetails ?? true,
                balance: seller.balance || 0,
            });
            setNewRadius(seller.serviceRadiusKm || 10);
            setEditError('');
            setIsEditModalOpen(true);
        }
    };

    const handleSaveSellerDetails = async () => {
        if (!editingSeller) return;

        try {
            setIsSavingSeller(true);
            setEditError('');

            const payload: Partial<Seller> = {
                sellerName: editForm.sellerName || editForm.name,
                storeName: editForm.storeName,
                email: editForm.email,
                mobile: editForm.mobile || editForm.phone,
                category: editForm.category,
                commission: Number(editForm.commission) || 0,
                status: editForm.status as 'Approved' | 'Pending' | 'Rejected',
                address: editForm.address,
                city: editForm.city,
                serviceableArea: editForm.serviceableArea,
                searchLocation: editForm.searchLocation,
                latitude: editForm.latitude,
                longitude: editForm.longitude,
                serviceRadiusKm: newRadius,
                panCard: editForm.panCard,
                taxName: editForm.taxName,
                taxNumber: editForm.taxNumber,
                accountName: editForm.accountName,
                bankName: editForm.bankName,
                branch: editForm.branch,
                accountNumber: editForm.accountNumber,
                ifsc: editForm.ifsc,
                requireProductApproval: editForm.requireProductApproval,
                viewCustomerDetails: editForm.viewCustomerDetails,
                balance: Number(editForm.balance) || 0,
            };

            const response = await updateSeller(editingSeller._id, payload);
            if (response.success && response.data) {
                const updatedSeller = mapSellerToFrontend(response.data);
                setSellers(prev => prev.map(s => s._id === editingSeller._id ? updatedSeller : s));
                setEditingSeller(updatedSeller);
                setSuccessMessage('Seller details updated successfully');
                setTimeout(() => setSuccessMessage(''), 3000);
                setIsEditModalOpen(false);
            } else {
                setEditError(response.message || 'Failed to update seller details');
            }
        } catch (err: any) {
            console.error('Error saving seller details:', err);
            setEditError(err.response?.data?.message || 'Failed to update seller details. Please try again.');
        } finally {
            setIsSavingSeller(false);
        }
    };

    const handleUpdateRadius = async () => {
        if (!editingSeller) return;

        try {
            setIsUpdatingRadius(true);
            const response = await updateSeller(editingSeller._id, { serviceRadiusKm: newRadius });
            if (response.success) {
                setEditingSeller({ ...editingSeller, serviceRadiusKm: newRadius });
                // Also update the seller in the main list
                setSellers(sellers.map(s => s._id === editingSeller._id ? { ...s, serviceRadiusKm: newRadius } : s));
                setSuccessMessage('Service radius updated successfully');
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error updating radius:', error);
            setError('Failed to update service radius');
            setTimeout(() => setError(''), 3000);
        } finally {
            setIsUpdatingRadius(false);
        }
    };

    const handleOpenCommissionModal = async (seller: Seller) => {
        setCommissionModalSeller(seller);
        setIsCommissionModalOpen(true);
        setCommissionSuccess('');

        // Fetch header categories
        try {
            const hcList = await getHeaderCategoriesAdmin();
            setHeaderCategories(hcList);

            // Initialize rates from seller's existing categoryCommissions
            const rates: Record<string, number> = {};
            hcList.forEach(hc => {
                const existing = seller.categoryCommissions?.find(
                    cc => cc.headerCategory === hc._id
                );
                rates[hc._id] = existing?.commissionRate ?? 0;
            });
            setCommissionRates(rates);
        } catch (err) {
            console.error('Error fetching header categories:', err);
            setHeaderCategories([]);
        }
    };

    const handleSaveCommissions = async () => {
        if (!commissionModalSeller) return;

        try {
            setIsSavingCommissions(true);
            const categoryCommissions = Object.entries(commissionRates).map(
                ([headerCategory, commissionRate]) => ({
                    headerCategory,
                    commissionRate,
                })
            );

            const response = await updateSellerCategoryCommissions(
                commissionModalSeller._id,
                categoryCommissions
            );

            if (response.success) {
                // Update local seller data
                setSellers(prev =>
                    prev.map(s =>
                        s._id === commissionModalSeller._id
                            ? { ...s, categoryCommissions }
                            : s
                    )
                );
                setCommissionModalSeller({
                    ...commissionModalSeller,
                    categoryCommissions,
                });
                setCommissionSuccess('Commissions saved successfully!');
                setTimeout(() => setCommissionSuccess(''), 3000);
            }
        } catch (err: any) {
            console.error('Error saving commissions:', err);
            setError(err.response?.data?.message || 'Failed to save commissions');
            setTimeout(() => setError(''), 3000);
        } finally {
            setIsSavingCommissions(false);
        }
    };

    const handleApprove = async (id: number | string) => {
        const sellerId = typeof id === 'number' ? sellers.find(s => s.id === id)?._id : id;
        if (!sellerId) return;

        try {
            const response = await updateSellerStatus(sellerId, 'Approved');
            if (response.success) {
                // Update local state
                setSellers(prevSellers =>
                    prevSellers.map(seller =>
                        seller._id === sellerId
                            ? { ...seller, status: 'Approved', needApproval: false }
                            : seller
                    )
                );
                setSuccessMessage('Seller has been approved.');
                setIsEditModalOpen(false);
                setEditingSeller(null);
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError('Failed to approve seller. Please try again.');
            }
        } catch (err: any) {
            console.error('Error approving seller:', err);
            setError(err.response?.data?.message || 'Failed to approve seller. Please try again.');
        }
    };

    const handleReject = async (id: number | string) => {
        const sellerId = typeof id === 'number' ? sellers.find(s => s.id === id)?._id : id;
        if (!sellerId) return;

        try {
            const response = await updateSellerStatus(sellerId, 'Rejected');
            if (response.success) {
                // Update local state
                setSellers(prevSellers =>
                    prevSellers.map(seller =>
                        seller._id === sellerId
                            ? { ...seller, status: 'Rejected', needApproval: false }
                            : seller
                    )
                );
                setSuccessMessage('Seller has been rejected.');
                setIsEditModalOpen(false);
                setEditingSeller(null);
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError('Failed to reject seller. Please try again.');
            }
        } catch (err: any) {
            console.error('Error rejecting seller:', err);
            setError(err.response?.data?.message || 'Failed to reject seller. Please try again.');
        }
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingSeller(null);
        setEditForm({});
        setEditError('');
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        const sellerId = deleteId;

        try {
            const response = await deleteSeller(sellerId);
            if (response.success) {
                // Remove from local state
                setSellers(prevSellers => prevSellers.filter(seller => seller._id !== sellerId));
                setSuccessMessage('Seller deleted successfully.');
                setDeleteId(null);
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError('Failed to delete seller. Please try again.');
                setDeleteId(null);
            }
        } catch (err: any) {
            console.error('Error deleting seller:', err);
            setError(err.response?.data?.message || 'Failed to delete seller. Please try again.');
            setDeleteId(null);
        }
    };

    const handleViewCategories = (seller: Seller) => {
        setSelectedSeller(seller);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedSeller(null);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Page Content */}
            <div className="flex-1 p-6">
                {/* Main Panel */}
                <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
                    {/* Header */}
                    <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
                        <h2 className="text-lg font-semibold">View Seller List</h2>
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

                    {/* Loading State */}
                    {loading && (
                        <div className="p-8 text-center">
                            <p className="text-neutral-600">Loading sellers...</p>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExport}
                                className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors"
                            >
                                Export
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">Search:</span>
                                <input
                                    type="text"
                                    className="pl-14 pr-3 py-1.5 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-teal-500 w-48"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    placeholder=""
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    {!loading && (
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
                                            onClick={() => handleSort('storeName')}
                                        >
                                            <div className="flex items-center">
                                                Store Name <SortIcon column="storeName" />
                                            </div>
                                        </th>
                                        <th className="p-4">
                                            Contact
                                        </th>
                                        <th className="p-4">
                                            Logo
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
                                            onClick={() => handleSort('commission')}
                                        >
                                            <div className="flex items-center">
                                                Commission <SortIcon column="commission" />
                                            </div>
                                        </th>
                                        <th className="p-4">
                                            Category
                                        </th>
                                        <th
                                            className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                            onClick={() => handleSort('status')}
                                        >
                                            <div className="flex items-center">
                                                Status <SortIcon column="status" />
                                            </div>
                                        </th>
                                        <th className="p-4">
                                            Need Approval?
                                        </th>
                                        <th className="p-4">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedSellers.map((seller) => (
                                        <tr key={seller._id} className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700 border-b border-neutral-200">
                                            <td className="p-4 align-middle">{seller.id || seller._id.slice(-6)}</td>
                                            <td className="p-4 align-middle">
                                                <button
                                                    onClick={() => handleOpenCommissionModal(seller)}
                                                    className="text-teal-700 hover:text-teal-900 font-medium hover:underline transition-colors text-left"
                                                    title="Click to manage category commissions"
                                                >
                                                    {seller.name}
                                                </button>
                                            </td>
                                            <td className="p-4 align-middle">{seller.storeName}</td>
                                            <td className="p-4 align-middle">
                                                <div className="text-xs">
                                                    <div>{seller.phone}</div>
                                                    <div className="text-neutral-500">{seller.email}</div>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <img
                                                    src={(seller.logo && seller.logo.trim() !== '') ? seller.logo : FALLBACK_LOGO}
                                                    alt={seller.storeName}
                                                    className="w-10 h-10 object-cover rounded"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        const img = e.currentTarget;
                                                        if (img.dataset.fallbackApplied === 'true') return;
                                                        img.dataset.fallbackApplied = 'true';
                                                        img.src = FALLBACK_LOGO;
                                                    }}
                                                />
                                            </td>
                                            <td className="p-4 align-middle">{seller.balance.toFixed(2)}</td>
                                            <td className="p-4 align-middle">{seller.commission.toFixed(2)}%</td>
                                            <td className="p-4 align-middle">
                                                <button
                                                    onClick={() => handleViewCategories(seller)}
                                                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                        <circle cx="12" cy="12" r="3"></circle>
                                                    </svg>
                                                    View ({seller.categories.length})
                                                </button>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${seller.status === 'Approved'
                                                    ? 'bg-green-100 text-green-800'
                                                    : seller.status === 'Pending'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {seller.status}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${seller.needApproval
                                                    ? 'bg-pink-100 text-pink-800'
                                                    : 'bg-pink-100 text-pink-800'
                                                    }`}>
                                                    {seller.needApproval ? 'Yes' : 'No'}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleEdit(seller._id)}
                                                        className="p-1.5 text-teal-600 hover:bg-teal-50 rounded transition-colors"
                                                        title="Edit"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteId(seller._id)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
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
                                    ))}
                                    {displayedSellers.length === 0 && (
                                        <tr>
                                            <td colSpan={11} className="p-8 text-center text-neutral-400">
                                                No sellers found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination Footer */}
                    {!loading && (
                        <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                            <div className="text-xs sm:text-sm text-neutral-700">
                                Showing {startIndex + 1} to {Math.min(endIndex, filteredSellers.length)} of {filteredSellers.length} entries
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
                                <button
                                    className="px-3 py-1.5 border border-teal-600 bg-teal-600 text-white rounded font-medium text-sm"
                                >
                                    {currentPage}
                                </button>
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
                    )}
                </div>
            </div>

            {/* Footer */}
            <footer className="text-center py-4 text-sm text-neutral-600 border-t border-neutral-200 bg-white">
                Copyright © 2025. Developed By{' '}
                <a href="#" className="text-blue-600 hover:underline">Olovely Total Suvidha</a>
            </footer>

            {/* Categories Modal */}
            {isModalOpen && selectedSeller && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={handleCloseModal}>
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">Categories</h3>
                                <p className="text-sm text-teal-100 mt-1">{selectedSeller.storeName} - {selectedSeller.name}</p>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="text-white hover:text-teal-200 transition-colors p-1"
                                aria-label="Close modal"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {selectedSeller.categories.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {selectedSeller.categories.map((category, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600 flex-shrink-0">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                            </svg>
                                            <span className="text-sm font-medium text-teal-900">{category}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-neutral-400">
                                    <p>No categories assigned to this seller.</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-neutral-200 flex justify-end">
                            <button
                                onClick={handleCloseModal}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Seller Modal */}
            {isEditModalOpen && editingSeller && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={handleCloseEditModal}>
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">Edit Seller - {editingSeller.name}</h3>
                                <p className="text-sm text-teal-100 mt-1">Manage seller details, location, bank & account settings</p>
                            </div>
                            <button
                                onClick={handleCloseEditModal}
                                className="text-white hover:text-teal-200 transition-colors p-1"
                                aria-label="Close modal"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                            <style>{`
                                .edit-seller-modal::-webkit-scrollbar {
                                    display: none;
                                }
                            `}</style>

                            {/* Error Banner */}
                            {editError && (
                                <div className="p-3 bg-red-100 border border-red-300 text-red-700 text-sm rounded-lg flex items-center justify-between">
                                    <span>{editError}</span>
                                    <button onClick={() => setEditError('')} className="text-red-700 hover:text-red-900 font-bold ml-2">×</button>
                                </div>
                            )}

                            {/* Status Section */}
                            <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">Account Status:</label>
                                    <select
                                        value={editForm.status || 'Pending'}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                                        className={`px-3 py-1.5 rounded-full text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer ${
                                            editForm.status === 'Approved'
                                                ? 'bg-green-100 text-green-800 border-green-300'
                                                : editForm.status === 'Pending'
                                                ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                                : 'bg-red-100 text-red-800 border-red-300'
                                        }`}
                                    >
                                        <option value="Approved">Approved</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Rejected">Rejected</option>
                                    </select>
                                </div>
                                {editingSeller.status === 'Pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleApprove(editingSeller._id)}
                                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleReject(editingSeller._id)}
                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </svg>
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Basic Information */}
                            <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                                <h4 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    Basic Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Seller Name</label>
                                        <input
                                            type="text"
                                            value={editForm.sellerName || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, sellerName: e.target.value, name: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Enter seller name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Store Name</label>
                                        <input
                                            type="text"
                                            value={editForm.storeName || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, storeName: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Enter store name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={editForm.email || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Enter email"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Phone / Mobile Number</label>
                                        <input
                                            type="text"
                                            value={editForm.mobile || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, mobile: e.target.value, phone: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Enter mobile number"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Category</label>
                                        <input
                                            type="text"
                                            value={editForm.category || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="e.g. Veg food, Electronics"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Commission Rate (%)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={editForm.commission ?? 0}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, commission: parseFloat(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Address Information */}
                            <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                                <h4 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    Address Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Full Address</label>
                                        <input
                                            type="text"
                                            value={editForm.address || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Enter full store address"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">City</label>
                                        <input
                                            type="text"
                                            value={editForm.city || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Enter city"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Serviceable Area</label>
                                        <input
                                            type="text"
                                            value={editForm.serviceableArea || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, serviceableArea: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Enter serviceable area"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Search Location / Landmark</label>
                                        <input
                                            type="text"
                                            value={editForm.searchLocation || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, searchLocation: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="e.g. Near City Center, Main Market"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Latitude</label>
                                        <input
                                            type="text"
                                            value={editForm.latitude || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, latitude: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="e.g. 23.926324"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Longitude</label>
                                        <input
                                            type="text"
                                            value={editForm.longitude || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, longitude: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="e.g. 76.899307"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Service Area Map */}
                            <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                                <h4 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                                    Service Area Visualization
                                </h4>
                                {editForm.latitude && editForm.longitude ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                            <div>
                                                <label className="text-xs font-medium text-neutral-600 mb-1 block">Service Radius (km)</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        min="0.1"
                                                        max="300"
                                                        step="0.1"
                                                        value={newRadius}
                                                        onChange={(e) => setNewRadius(parseFloat(e.target.value))}
                                                        className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleUpdateRadius}
                                                        disabled={isUpdatingRadius || newRadius === editingSeller.serviceRadiusKm}
                                                        className="px-4 py-2 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                                                    >
                                                        {isUpdatingRadius ? 'Updating...' : 'Update Radius'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-[300px] w-full">
                                            <SellerServiceMap
                                                latitude={parseFloat(editForm.latitude)}
                                                longitude={parseFloat(editForm.longitude)}
                                                radiusKm={newRadius}
                                                storeName={editForm.storeName || editingSeller.storeName}
                                            />
                                        </div>
                                        <p className="text-xs text-neutral-500 italic">
                                            * Adjust the radius above to see the service area change dynamically.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center border-2 border-dashed border-neutral-200 rounded-lg">
                                        <p className="text-sm text-neutral-500">No valid coordinates available for this seller.</p>
                                        <p className="text-xs text-neutral-400 mt-1">Please enter latitude and longitude above to view the service map.</p>
                                    </div>
                                )}
                            </div>

                            {/* Tax Information */}
                            <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                                <h4 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Tax Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">PAN Card Number</label>
                                        <input
                                            type="text"
                                            value={editForm.panCard || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, panCard: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Enter PAN number"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Tax Name / Type</label>
                                        <input
                                            type="text"
                                            value={editForm.taxName || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, taxName: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="e.g. GSTIN"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Tax Number / GSTIN</label>
                                        <input
                                            type="text"
                                            value={editForm.taxNumber || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, taxNumber: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Enter GST/Tax number"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Bank Information */}
                            <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                                <h4 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    Bank Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Account Holder Name</label>
                                        <input
                                            type="text"
                                            value={editForm.accountName || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, accountName: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Account holder name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Bank Name</label>
                                        <input
                                            type="text"
                                            value={editForm.bankName || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, bankName: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Bank name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Branch Name</label>
                                        <input
                                            type="text"
                                            value={editForm.branch || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, branch: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Branch name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Account Number</label>
                                        <input
                                            type="text"
                                            value={editForm.accountNumber || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="Bank account number"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">IFSC Code</label>
                                        <input
                                            type="text"
                                            value={editForm.ifsc || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, ifsc: e.target.value }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="IFSC code"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Settings */}
                            <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                                <h4 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                                    Seller Settings & Balance
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Require Product Approval</label>
                                        <select
                                            value={editForm.requireProductApproval ? 'true' : 'false'}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, requireProductApproval: e.target.value === 'true' }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                        >
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Show Seller Details in Customer App</label>
                                        <select
                                            value={editForm.viewCustomerDetails ? 'true' : 'false'}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, viewCustomerDetails: e.target.value === 'true' }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                        >
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Wallet Balance (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editForm.balance ?? 0}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, balance: parseFloat(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Categories */}
                            {editingSeller.categories && editingSeller.categories.length > 0 && (
                                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                                    <h4 className="text-sm font-semibold text-neutral-700 mb-3">Associated Categories</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {editingSeller.categories.map((cat, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800"
                                            >
                                                {cat}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-neutral-200 flex justify-end items-center gap-3 bg-gray-50 rounded-b-lg">
                            <button
                                type="button"
                                onClick={handleCloseEditModal}
                                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg text-sm font-medium transition-colors"
                                disabled={isSavingSeller}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveSellerDetails}
                                disabled={isSavingSeller}
                                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSavingSeller ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving Changes...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Commission Modal */}
            {isCommissionModalOpen && commissionModalSeller && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden my-8 transform transition-all">
                        {/* Header */}
                        <div className="bg-teal-600 px-6 py-4 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    Category Commissions
                                </h3>
                                <p className="text-xs text-teal-100">
                                    {commissionModalSeller.storeName} ({commissionModalSeller.name})
                                </p>
                            </div>
                            <button
                                onClick={() => setIsCommissionModalOpen(false)}
                                className="text-white hover:text-neutral-200 text-2xl font-bold transition-colors"
                            >
                                ×
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                            {commissionSuccess && (
                                <div className="p-3 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm rounded">
                                    {commissionSuccess}
                                </div>
                            )}

                            <p className="text-xs text-neutral-500">
                                Set custom commission rates (%) for each category. If a category is set to <strong>0%</strong>, the seller's global commission rate (<strong>{commissionModalSeller.commission}%</strong>) will apply.
                            </p>

                            {headerCategories.length === 0 ? (
                                <div className="py-8 text-center text-neutral-400 text-sm">
                                    No header categories found.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {headerCategories.map(hc => (
                                        <div
                                            key={hc._id}
                                            className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200 hover:border-teal-300 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">
                                                    {hc.name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="text-sm font-semibold text-neutral-800">
                                                        {hc.name}
                                                    </span>
                                                    <span className="text-xs text-neutral-400 block capitalize">
                                                        {hc.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="100"
                                                    value={commissionRates[hc._id] ?? 0}
                                                    onChange={e =>
                                                        setCommissionRates({
                                                            ...commissionRates,
                                                            [hc._id]: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)),
                                                        })
                                                    }
                                                    className="w-24 px-3 py-1.5 border border-neutral-300 rounded-md text-sm font-semibold text-right focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                                                />
                                                <span className="text-sm font-bold text-neutral-600">%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-neutral-50 px-6 py-4 flex justify-between items-center border-t border-neutral-200">
                            <button
                                onClick={() => setIsCommissionModalOpen(false)}
                                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCommissions}
                                disabled={isSavingCommissions || headerCategories.length === 0}
                                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSavingCommissions ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Commissions'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!deleteId}
                title="Delete Seller"
                message="Are you sure you want to delete this seller?"
                confirmText="Delete"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
}
