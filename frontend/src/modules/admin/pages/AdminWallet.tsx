import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useToast } from "../../../context/ToastContext";
import {
  getFinancialDashboard,
  getWalletTransactions,
  getAdminEarnings,
  WalletStats,
  WalletTransaction,
  AdminEarning,
} from "../../../services/api/admin/adminWalletService";
import AdminWithdrawals from "./AdminWithdrawals";

// Icons
const WalletIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M20 7h-9a2 2 0 0 0-2 2v1m0 4v9a2 2 0 0 0 2 2h4" />
    <path d="M19 13h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1" />
    <path d="M6 7H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h15v4H6.5" />
  </svg>
);

const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const CreditCardIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const DollarSignIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const FilterIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const DownloadIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export default function AdminWallet() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<
    "transactions" | "earnings" | "withdrawals"
  >("transactions");
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Transactions State
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [trxLoading, setTrxLoading] = useState(false);
  const [trxFilter, setTrxFilter] = useState({ userType: "", type: "" });

  // Earnings State
  const [earnings, setEarnings] = useState<AdminEarning[]>([]);
  const [earnLoading, setEarnLoading] = useState(false);
  const [earnPage, setEarnPage] = useState(1);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === "transactions") {
      fetchTransactions();
    } else if (activeTab === "earnings") {
      fetchEarnings();
    }
  }, [activeTab, trxFilter]);

  const fetchStats = async () => {
    try {
      const response = await getFinancialDashboard();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchTransactions = async () => {
    setTrxLoading(true);
    try {
      const response = await getWalletTransactions({
        userType: trxFilter.userType || undefined,
        type: trxFilter.type || undefined,
      });
      if (response.success && response.data) {
        setTransactions(response.data);
      }
    } catch (error: any) {
      showToast("Failed to load transactions", "error");
    } finally {
      setTrxLoading(false);
    }
  };

  const fetchEarnings = async () => {
    setEarnLoading(true);
    try {
      const response = await getAdminEarnings({ page: earnPage });
      if (response.success && response.data) {
        setEarnings(response.data);
      }
    } catch (error: any) {
      showToast("Failed to load earnings", "error");
    } finally {
      setEarnLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Admin Wallet & Finance
          </h1>
          <p className="text-gray-500">
            Manage transactions, track earnings, and process withdrawals.
          </p>
        </div>
        {/* 
                <div className="flex gap-2">
                     <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-medium transition">
                        <DownloadIcon className="w-4 h-4" /> Export Report
                    </button>
                </div> 
                */}
      </div>

      {/* Stats Grid */}
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total Platform Earning"
          value={`₹${stats?.totalGMV?.toLocaleString("en-IN") || "0"}`}
          icon={TrendingUpIcon}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatsCard
          title="Current Platform Balance"
          value={`₹${stats?.currentAccountBalance?.toLocaleString("en-IN") || "0"}`}
          icon={WalletIcon}
          color="text-green-600"
          bg="bg-green-50"
        />
        <StatsCard
          title="Total Admin Earning"
          value={`₹${stats?.totalAdminEarnings?.toLocaleString("en-IN") || "0"}`}
          icon={DollarSignIcon}
          color="text-purple-600"
          bg="bg-purple-50"
        />
        <StatsCard
          title="Seller Pending Payouts"
          value={`₹${stats?.sellerPendingPayouts?.toLocaleString("en-IN") || "0"}`}
          icon={ClockIcon}
          color="text-orange-600"
          bg="bg-orange-50"
        />
        <StatsCard
          title="Delivery Boy Pending Payouts"
          value={`₹${stats?.deliveryPendingPayouts?.toLocaleString("en-IN") || "0"}`}
          icon={ClockIcon}
          color="text-red-600"
          bg="bg-red-50"
        />
        <StatsCard
          title="Pending from Delivery Boy (COD)"
          value={`₹${stats?.pendingAmountFromDeliveryBoy?.toLocaleString("en-IN") || "0"}`}
          icon={ClockIcon}
          color="text-amber-600"
          bg="bg-amber-50"
        />
      </div>

      {/* Tabs & Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          <TabButton
            active={activeTab === "transactions"}
            onClick={() => setActiveTab("transactions")}
            label="All Transactions"
            icon={CreditCardIcon}
          />
          <TabButton
            active={activeTab === "earnings"}
            onClick={() => setActiveTab("earnings")}
            label="Admin Earnings"
            icon={TrendingUpIcon}
          />
          <TabButton
            active={activeTab === "withdrawals"}
            onClick={() => setActiveTab("withdrawals")}
            label="Withdrawal Requests"
            icon={WalletIcon}
            badge={stats?.pendingWithdrawalsCount}
          />
        </div>

        <div className="p-6">
          {activeTab === "transactions" && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-4">
                <select
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={trxFilter.userType}
                  onChange={(e) =>
                    setTrxFilter({ ...trxFilter, userType: e.target.value })
                  }>
                  <option value="">All Users</option>
                  <option value="SELLER">Sellers</option>
                  <option value="DELIVERY_BOY">Delivery Partners</option>
                </select>
                <select
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={trxFilter.type}
                  onChange={(e) =>
                    setTrxFilter({ ...trxFilter, type: e.target.value })
                  }>
                  <option value="">All Types</option>
                  <option value="Credit">Credit</option>
                  <option value="Debit">Debit</option>
                </select>
              </div>

              {/* Transactions Table */}
              {trxLoading ? (
                <LoadingSpinner />
              ) : transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500 text-sm">
                        <th className="py-3 px-4 font-medium">Date & Time</th>
                        <th className="py-3 px-4 font-medium">User</th>
                        <th className="py-3 px-4 font-medium">Type</th>
                        <th className="py-3 px-4 font-medium">Description</th>
                        <th className="py-3 px-4 font-medium text-right">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((trx) => (
                        <tr
                          key={trx._id}
                          className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {new Date(trx.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">
                                {(trx as any).userName}
                              </span>
                              <span className="text-xs text-gray-500 capitalize">
                                {String(trx.userType || "").toLowerCase().replace("_", " ")}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                trx.type === "Credit"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}>
                              {trx.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {trx.description}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-medium ${
                              trx.type === "Credit"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}>
                            {trx.type === "Credit" ? "+" : "-"}₹
                            {trx.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No transactions found matching your filters." />
              )}
            </div>
          )}

          {activeTab === "earnings" && (
            <div className="space-y-4">
              {earnLoading ? (
                <LoadingSpinner />
              ) : earnings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500 text-sm">
                        <th className="py-3 px-4 font-medium">Date</th>
                        <th className="py-3 px-4 font-medium">Source</th>
                        <th className="py-3 px-4 font-medium">Description</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium text-right">
                          Commission
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {earnings.map((earning) => (
                        <tr
                          key={earning.id}
                          className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {new Date(earning.date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">
                            {earning.source}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {earning.description}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                earning.status === "Paid"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}>
                              {earning.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-green-600">
                            ₹{earning.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message="No earning records found." />
              )}
            </div>
          )}

          {activeTab === "withdrawals" && <AdminWithdrawals />}
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, color, bg, label }: any) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
      <div>
        <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        {label && <p className="text-xs text-gray-400 mt-1">{label}</p>}
      </div>
      <div className={`p-3 rounded-lg ${bg}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon: Icon, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition relative whitespace-nowrap ${
        active
          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      }`}>
      <Icon className="w-4 h-4" />
      {label}
      {badge > 0 && (
        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <FilterIcon className="w-12 h-12 mb-3 opacity-20" />
      <p>{message}</p>
    </div>
  );
}
