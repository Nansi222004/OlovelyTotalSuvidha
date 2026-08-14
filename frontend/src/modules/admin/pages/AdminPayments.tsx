import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../../../context/ToastContext';
import { getCommissionReport } from '../../../services/api/adminCommissionService';

export default function AdminPayments() {
    const { showToast } = useToast();
    const [payments, setPayments] = useState<any[]>([]);
    const [summary, setSummary] = useState({ total: 0, successful: 0, failed: 0, pending: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        try {
            setLoading(true);
            const response = await getCommissionReport();
            if (response.success) {
                // Mock payment data from commissions
                setPayments(response.data.commissions || []);
                setSummary({
                    total: response.data.summary?.totalCommissions || 0,
                    successful: response.data.summary?.totalCommissions || 0,
                    failed: 0,
                    pending: response.data.summary?.pendingCommissions || 0,
                });
            }
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to load payments', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Payment Analytics</h1>

            {/* Summary Cards */}
            <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-600 mb-1">Total Payments</p>
                    <p className="text-2xl font-bold text-gray-900">₹{summary.total.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-600 mb-1">Successful</p>
                    <p className="text-2xl font-bold text-green-600">₹{summary.successful.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-600 mb-1">Pending</p>
                    <p className="text-2xl font-bold text-orange-600">₹{summary.pending.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-600 mb-1">Failed</p>
                    <p className="text-2xl font-bold text-red-600">₹{summary.failed.toFixed(2)}</p>
                </div>
            </div>

            {/* Recent Payments */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
                <div className="space-y-3">
                    {payments.slice(0, 20).map((payment: any) => (
                        <motion.div
                            key={payment._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
                        >
                            <div>
                                <p className="font-medium">Commission Payment</p>
                                <p className="text-sm text-gray-600">
                                    {payment.type === 'SELLER' ? 'Seller' : 'Delivery Boy'} - Order #{payment.order?.orderNumber || 'N/A'}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {new Date(payment.createdAt).toLocaleString('en-IN')}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-green-600">₹{payment.commissionAmount.toFixed(2)}</p>
                                <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full mt-1">
                                    {payment.status || 'Paid'}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                    {payments.length === 0 && (
                        <p className="text-center text-gray-500 py-8">No payment transactions yet</p>
                    )}
                </div>
            </div>
        </div>
    );
}
