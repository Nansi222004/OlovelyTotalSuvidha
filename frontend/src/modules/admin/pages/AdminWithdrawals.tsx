import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../../../context/ToastContext';
import {
    getWithdrawalRequests,
    processWithdrawal,
    WithdrawalRequest
} from '../../../services/api/admin/adminWalletService';

export default function AdminWithdrawals() {
    const { showToast } = useToast();
    const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
    const [transactionRef, setTransactionRef] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        fetchWithdrawals();
    }, [filter]);

    const fetchWithdrawals = async () => {
        try {
            setLoading(true);
            const response = await getWithdrawalRequests({
                status: filter === 'all' ? undefined : filter,
            });
            if (response.success) {
                // Backend returns { data: { requests: [], pagination: {} } }
                // We handle both direct array (legacy) and nested object structure
                const data = response.data;
                if (Array.isArray(data)) {
                    setWithdrawals(data);
                } else if (data && typeof data === 'object' && 'requests' in data) {
                    setWithdrawals((data as any).requests || []);
                } else {
                    setWithdrawals([]);
                }
            }
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to load withdrawals', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            setIsProcessing(true);
            const response = await processWithdrawal({ requestId: id, action: 'Approve' });
            if (response.success) {
                showToast('Withdrawal approved successfully', 'success');
                fetchWithdrawals();
            }
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to approve withdrawal', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (id: string) => {
        const remarks = prompt('Enter rejection reason (optional):');
        if (remarks === null) return; // User cancelled

        try {
            setIsProcessing(true);
            const response = await processWithdrawal({ requestId: id, action: 'Reject', remark: remarks });
            if (response.success) {
                showToast('Withdrawal rejected', 'success');
                fetchWithdrawals();
            }
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to reject withdrawal', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleComplete = async () => {
        if (!selectedWithdrawal || !transactionRef) {
            showToast('Transaction reference is required', 'error');
            return;
        }

        try {
            setIsProcessing(true);
            const response = await processWithdrawal({
                requestId: selectedWithdrawal._id || selectedWithdrawal.id,
                action: 'Complete',
                transactionReference: transactionRef
            });
            if (response.success) {
                showToast('Withdrawal completed successfully', 'success');
                setShowCompleteModal(false);
                setSelectedWithdrawal(null);
                setTransactionRef('');
                fetchWithdrawals();
            }
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to complete withdrawal', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Filters */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {['all', 'Pending', 'Approved', 'Completed', 'Rejected'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${filter === status
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>

            {/* Withdrawals List */}
            <div className="space-y-4">
                {withdrawals.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
                        <p className="text-gray-500">No withdrawal requests found</p>
                    </div>
                ) : (
                    withdrawals.map((withdrawal: any) => (
                        <motion.div
                            key={withdrawal._id || withdrawal.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                        >
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-lg">
                                            {withdrawal.userType === 'SELLER' ? 'Seller' : 'Delivery Boy'} Withdrawal
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${withdrawal.userType === 'SELLER' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                            {withdrawal.userType}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 font-medium">
                                        {withdrawal.userId?.sellerName || withdrawal.userId?.storeName || withdrawal.userId?.name || withdrawal.userId?.firstName || 'N/A'}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Requested: {new Date(withdrawal.createdAt || withdrawal.requestDate).toLocaleString('en-IN')}
                                    </p>
                                </div>
                                <div className="text-left md:text-right w-full md:w-auto">
                                    <p className="text-2xl font-bold text-gray-900">₹{withdrawal.amount?.toFixed(2)}</p>
                                    <span
                                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-2 ${withdrawal.status === 'Completed'
                                            ? 'bg-green-100 text-green-700'
                                            : withdrawal.status === 'Approved'
                                                ? 'bg-blue-100 text-blue-700'
                                                : withdrawal.status === 'Rejected'
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                            }`}
                                    >
                                        {withdrawal.status}
                                    </span>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-lg">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Payment Method</p>
                                    <p className="font-medium text-sm">{withdrawal.paymentMethod}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bank Details</p>
                                    <p className="font-medium text-sm break-all">
                                        {withdrawal.accountDetails || (withdrawal.userId?.accountNumber ? `****${withdrawal.userId.accountNumber.slice(-4)}` : 'N/A')}
                                    </p>
                                </div>
                                {withdrawal.transactionReference && (
                                    <div className="col-span-2 border-t border-gray-200 pt-2 mt-2">
                                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Transaction Reference</p>
                                        <p className="font-mono text-sm">{withdrawal.transactionReference}</p>
                                    </div>
                                )}
                            </div>

                            {withdrawal.remarks && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                                    <p className="text-xs text-red-600 uppercase tracking-wide mb-1">Rejection Reason</p>
                                    <p className="text-sm text-red-800">{withdrawal.remarks}</p>
                                </div>
                            )}

                            {/* Actions */}
                            {withdrawal.status === 'Pending' && (
                                <div className="flex gap-3 mt-4 border-t pt-4">
                                    <button
                                        onClick={() => handleApprove(withdrawal._id || withdrawal.id)}
                                        disabled={isProcessing}
                                        className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(withdrawal._id || withdrawal.id)}
                                        disabled={isProcessing}
                                        className="flex-1 bg-white text-red-600 border border-red-200 py-2 rounded-lg font-medium hover:bg-red-50 transition disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                </div>
                            )}

                            {withdrawal.status === 'Approved' && (
                                <div className="mt-4 border-t pt-4">
                                    <button
                                        onClick={() => {
                                            setSelectedWithdrawal(withdrawal);
                                            setShowCompleteModal(true);
                                        }}
                                        disabled={isProcessing}
                                        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        Mark as Completed
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
            </div>

            {/* Complete Modal */}
            {showCompleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
                    >
                        <h2 className="text-xl font-bold mb-4">Complete Withdrawal</h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Transaction Reference ID
                            </label>
                            <input
                                type="text"
                                value={transactionRef}
                                onChange={(e) => setTransactionRef(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. UPI Ref No. or Bank TRN ID"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowCompleteModal(false);
                                    setSelectedWithdrawal(null);
                                    setTransactionRef('');
                                }}
                                className="flex-1 border border-gray-300 rounded-lg py-2 font-medium hover:bg-gray-50 text-gray-700"
                                disabled={isProcessing}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleComplete}
                                className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
                                disabled={isProcessing}
                            >
                                {isProcessing ? 'Processing...' : 'Complete Transfer'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
