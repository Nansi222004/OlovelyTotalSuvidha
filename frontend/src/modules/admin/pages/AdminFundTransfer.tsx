import { useState, useEffect } from 'react';
import {
  getWalletTransactions,
  getWalletSummary,
  createManualTransfer,
  type WalletTransaction,
  type WalletSummaryUser
} from '../../../services/api/admin/adminWalletService';
import { useAuth } from '../../../context/AuthContext';

export default function AdminFundTransfer() {
  const { isAuthenticated, token } = useAuth();

  // States
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [summary, setSummary] = useState<WalletSummaryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedUserType, setSelectedUserType] = useState('DELIVERY_BOY');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    userId: '',
    userType: 'DELIVERY_BOY' as 'DELIVERY_BOY' | 'SELLER',
    amount: 0,
    type: 'Debit' as 'Credit' | 'Debit',
    description: ''
  });

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchData();
    }
  }, [isAuthenticated, token, currentPage, entriesPerPage, selectedUserType, fromDate, toDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Summary (Who we owe)
      const summaryRes = await getWalletSummary();
      if (summaryRes.success) {
        setSummary(summaryRes.data);
      }

      // Fetch Transaction History
      const params: any = {
        page: currentPage,
        limit: entriesPerPage,
        userType: selectedUserType === 'all' ? undefined : selectedUserType,
      };

      const transRes = await getWalletTransactions(params);
      if (transRes.success) {
        setTransactions(transRes.data);
        if ((transRes as any).pagination?.total) {
          setTotalEntries((transRes as any).pagination.total);
        }
      }

    } catch (err: any) {
      console.error(err);
      setError('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.userId || !addForm.amount || !addForm.description) {
      alert('Please fill all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createManualTransfer(addForm);
      if (res.success) {
        setShowAddModal(false);
        setAddForm({ userId: '', userType: 'DELIVERY_BOY', amount: 0, type: 'Debit', description: '' });
        fetchData(); // Refresh both summary and history
        alert('Transfer processed successfully');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to process transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearDate = () => {
    setFromDate('');
    setToDate('');
  };

  const startIndex = (currentPage - 1) * entriesPerPage;
  const totalPages = Math.ceil(totalEntries / entriesPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-teal-600 px-6 py-4 rounded-t-lg flex items-center justify-between">
        <h1 className="text-white text-xl font-semibold">Fund Transfer Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-white text-teal-700 hover:bg-neutral-100 px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add New Transfer
        </button>
      </div>

      {/* Summary Section - Who Admin Owes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-3">
          <h2 className="text-lg font-semibold text-neutral-800 mb-3">Amount Owed to Delivery Boys (Wallet Balances)</h2>
        </div>
        {summary.length === 0 ? (
          <div className="col-span-3 bg-white p-6 rounded-lg border text-center text-neutral-500">No active balances found</div>
        ) : (
          summary.slice(0, 6).map(user => (
            <div key={user._id} className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm flex justify-between items-center">
              <div>
                <p className="font-medium text-neutral-900">{user.name}</p>
                <p className="text-xs text-neutral-500">{user.mobile}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-teal-600">₹{user.balance.toFixed(2)}</p>
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Admin Owes</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Transaction History Card */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
        <div className="p-6 border-b flex flex-wrap gap-4 items-center justify-between">
          <h2 className="font-semibold text-neutral-800">Transfer History</h2>
          <div className="flex gap-3">
            <select
              value={selectedUserType}
              onChange={(e) => setSelectedUserType(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm outline-none"
            >
              <option value="DELIVERY_BOY">Delivery Boys</option>
              <option value="SELLER">Sellers</option>
              <option value="all">All</option>
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-neutral-600 uppercase">User</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-600 uppercase">Type</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-600 uppercase">Amount</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-600 uppercase">Ref ID</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-600 uppercase">Description</th>
                <th className="px-6 py-3 text-left font-semibold text-neutral-600 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-neutral-400">Loading history...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-neutral-400">No transactions found</td></tr>
              ) : (
                transactions.map(t => (
                  <tr key={t._id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <span className="font-medium text-neutral-900">{t.userName || 'N/A'}</span>
                      <br />
                      <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1 rounded">{t.userType}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'Credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold">₹{t.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs font-mono">{t.reference}</td>
                    <td className="px-6 py-4 text-neutral-600">{t.description}</td>
                    <td className="px-6 py-4 text-neutral-500">{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Simple Pagination */}
        <div className="p-4 border-t flex items-center justify-between text-xs text-neutral-500">
          <span>Showing {startIndex + 1} to {startIndex + transactions.length} of {totalEntries}</span>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 border rounded disabled:opacity-50">Prev</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {/* Add Transfer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-teal-600 px-6 py-4">
              <h2 className="text-white font-semibold">Process Fund Transfer</h2>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Transfer Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="Debit" checked={addForm.type === 'Debit'} onChange={() => setAddForm({ ...addForm, type: 'Debit' })} />
                    <span className="text-sm">Paid to User (Debit)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="Credit" checked={addForm.type === 'Credit'} onChange={() => setAddForm({ ...addForm, type: 'Credit' })} />
                    <span className="text-sm">Grant (Credit)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Select Delivery Boy</label>
                <select
                  className="w-full border rounded p-2 text-sm"
                  value={addForm.userId}
                  onChange={e => setAddForm({ ...addForm, userId: e.target.value })}
                  required
                >
                  <option value="">-- Select --</option>
                  {summary.map(user => (
                    <option key={user._id} value={user._id}>
                      {user.name} (Balance: ₹{user.balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  className="w-full border rounded p-2 text-sm"
                  value={addForm.amount || ''}
                  onChange={e => setAddForm({ ...addForm, amount: parseFloat(e.target.value) || 0 })}
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Description / Remark</label>
                <textarea
                  className="w-full border rounded p-2 text-sm"
                  value={addForm.description}
                  onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="e.g. Paid via Cash / UPI"
                  required
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-neutral-600">Cancel</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-teal-600 text-white px-6 py-2 rounded text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Process Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
