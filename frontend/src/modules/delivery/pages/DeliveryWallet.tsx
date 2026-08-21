import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "../../../context/ToastContext";
import {
  getDeliveryWalletBalance,
  getDeliveryWalletTransactions,
  requestDeliveryWithdrawal,
  getDeliveryWithdrawals,
  getDeliveryCommissions,
  createAdminPayoutOrder,
  verifyAdminPayout,
} from "../../../services/api/deliveryWalletService";
import { getDeliveryProfile } from "../../../services/api/delivery/deliveryService";

type Tab = "transactions" | "withdrawals" | "commissions";

export default function DeliveryWallet() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("transactions");
  const [balance, setBalance] = useState(0);
  const [pendingAdminPayout, setPendingAdminPayout] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any>({
    commissions: [],
    total: 0,
    paid: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Bank Transfer" | "UPI">(
    "Bank Transfer",
  );
  const [deliveryProfile, setDeliveryProfile] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchWalletData();
    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const [balanceRes, transactionsRes, withdrawalsRes, commissionsRes, profileRes] =
        await Promise.all([
          getDeliveryWalletBalance(),
          getDeliveryWalletTransactions(),
          getDeliveryWithdrawals(),
          getDeliveryCommissions(),
          getDeliveryProfile().catch(() => null),
        ]);

      if (balanceRes.success) {
        setBalance(balanceRes.data.balance);
        setPendingAdminPayout(balanceRes.data.pendingAdminPayout || 0);
      }
      if (transactionsRes.success)
        setTransactions(transactionsRes.data.transactions || []);
      if (withdrawalsRes.success) setWithdrawals(withdrawalsRes.data || []);
      if (commissionsRes.success) setCommissions(commissionsRes.data);
      if (profileRes) setDeliveryProfile(profileRes);
    } catch (error: any) {
      showToast(
        error.response?.data?.message || "Failed to load wallet data",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawRequest = async () => {
    try {
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        showToast("Please enter a valid amount", "error");
        return;
      }

      if (amount > balance) {
        showToast("Insufficient balance", "error");
        return;
      }

      setIsSubmitting(true);
      const response = await requestDeliveryWithdrawal(amount, paymentMethod);
      if (response.success) {
        showToast("Withdrawal request submitted successfully", "success");
        setShowWithdrawModal(false);
        setWithdrawAmount("");
        fetchWalletData();
      }
    } catch (error: any) {
      showToast(
        error.response?.data?.message || "Failed to request withdrawal",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayToAdmin = async () => {
    if (pendingAdminPayout <= 0) {
      showToast("No pending amount to pay", "info");
      return;
    }

    try {
      setIsSubmitting(true);
      const orderRes = await createAdminPayoutOrder(pendingAdminPayout);

      if (!orderRes.success) {
        showToast(orderRes.message || "Failed to create payout order", "error");
        return;
      }

      const { razorpayOrderId, razorpayKey, amount, currency } = orderRes.data;

      const options = {
        key: razorpayKey,
        amount: amount,
        currency: currency,
        name: "Olovely Total Suvidha",
        description: "Admin Payout for COD Collections",
        order_id: razorpayOrderId,
        handler: async (response: any) => {
          try {
            const verifyRes = await verifyAdminPayout({
              razorpayOrderId: razorpayOrderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              amount: pendingAdminPayout,
            });

            if (verifyRes.success) {
              showToast("Payment to admin successful", "success");
              fetchWalletData();
            } else {
              showToast(
                verifyRes.message || "Payment verification failed",
                "error",
              );
            }
          } catch (error: any) {
            showToast(error.message || "Verification failed", "error");
          }
        },
        prefill: {
          name: "Delivery Boy",
        },
        theme: {
          color: "#22c55e",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error: any) {
      showToast(error.message || "Payment initiation failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Wallet</h1>
        </div>
      </div>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="m-4 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-green-100 text-sm font-medium">
                Available Balance
              </p>
              <p className="text-xs text-green-200 mt-0.5">
                Your withdrawable delivery earnings
              </p>
            </div>
            <div className="bg-green-400/30 p-2 rounded-xl">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
          </div>
          <h1 className="text-5xl font-extrabold mb-6">
            ₹{balance.toFixed(2)}
          </h1>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="w-full bg-white text-green-700 py-3.5 rounded-xl font-bold hover:bg-green-50 transition-all shadow-md active:scale-[0.98]">
            Request Withdrawal
          </button>
        </div>
        {/* Decorative background circle */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-green-400/20 rounded-full blur-3xl"></div>
      </motion.div>

      {/* Admin Payout Card (COD Collection) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="m-4 bg-white border border-red-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-500 text-sm font-medium">
                Admin's Payout (COD)
              </p>
              <p className="text-xs text-red-500 font-medium mt-0.5">
                Cash collected from customers that is pending submission to Admin
              </p>
            </div>
            <div className="bg-red-50 p-2 rounded-xl text-red-600">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <polyline points="16 11 18 13 22 9" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold mb-6 text-gray-900">
            ₹{pendingAdminPayout.toFixed(2)}
          </h1>
          <button
            onClick={handlePayToAdmin}
            disabled={isSubmitting || pendingAdminPayout <= 0}
            className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-[0.98] flex items-center justify-center ${
              pendingAdminPayout > 0
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
            }`}>
            {isSubmitting ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Pay to Admin"
            )}
          </button>
        </div>
      </motion.div>

      {/* Commission Summary */}
      <div className="mx-4 mb-4 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-600 mb-1">Total Earned</p>
          <p className="text-lg font-bold text-gray-900">
            ₹{commissions.total?.toFixed(2) || "0.00"}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-600 mb-1">Paid</p>
          <p className="text-lg font-bold text-green-600">
            ₹{commissions.paid?.toFixed(2) || "0.00"}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-600 mb-1">Pending</p>
          <p className="text-lg font-bold text-orange-600">
            ₹{commissions.pending?.toFixed(2) || "0.00"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white mx-4 rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("transactions")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === "transactions"
                ? "text-green-600 border-b-2 border-green-600"
                : "text-gray-600"
            }`}>
            Transactions
          </button>
          <button
            onClick={() => setActiveTab("withdrawals")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === "withdrawals"
                ? "text-green-600 border-b-2 border-green-600"
                : "text-gray-600"
            }`}>
            Withdrawals
          </button>
          <button
            onClick={() => setActiveTab("commissions")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === "commissions"
                ? "text-green-600 border-b-2 border-green-600"
                : "text-gray-600"
            }`}>
            Commissions
          </button>
        </div>

        <div className="p-4">
          {/* Transactions Tab */}
          {activeTab === "transactions" && (
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No transactions yet
                </p>
              ) : (
                transactions.map((txn: any) => (
                  <div
                    key={txn._id}
                    className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {txn.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(txn.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <p
                      className={`font-bold text-lg ${txn.type === "Credit" ? "text-green-600" : "text-red-600"}`}>
                      {txn.type === "Credit" ? "+" : "-"}₹
                      {txn.amount.toFixed(2)}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Withdrawals Tab */}
          {activeTab === "withdrawals" && (
            <div className="space-y-3">
              {withdrawals.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No withdrawal requests yet
                </p>
              ) : (
                withdrawals.map((withdrawal: any) => (
                  <div
                    key={withdrawal._id}
                    className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-gray-900">
                          ₹{withdrawal.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-600">
                          {withdrawal.paymentMethod}
                        </p>
                        {withdrawal.paymentMethod === "UPI" && (
                          <p className="text-xs font-mono text-green-600 font-medium mt-0.5">
                            {withdrawal.accountDetails || withdrawal.upiId || "N/A"}
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          withdrawal.status === "Completed"
                            ? "bg-green-100 text-green-700"
                            : withdrawal.status === "Approved"
                              ? "bg-blue-100 text-blue-700"
                              : withdrawal.status === "Rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                        }`}>
                        {withdrawal.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(withdrawal.createdAt).toLocaleDateString(
                        "en-IN",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                    </p>
                    {withdrawal.remarks && (
                      <p className="text-xs text-gray-600 mt-2 italic">
                        {withdrawal.remarks}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Commissions Tab */}
          {activeTab === "commissions" && (
            <div className="space-y-3">
              {commissions.commissions?.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No commissions yet
                </p>
              ) : (
                commissions.commissions?.map((comm: any) => (
                  <div key={comm.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          Delivery Commission
                        </p>
                        <p className="text-xs text-gray-600">
                          Rate: {comm.rate}%
                        </p>
                      </div>
                      <p className="font-bold text-green-600">
                        ₹{comm.amount.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Order Amount: ₹{comm.orderAmount.toFixed(2)}</span>
                      <span>
                        {new Date(comm.createdAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Request Withdrawal</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  ₹
                </span>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Available: ₹{balance.toFixed(2)}
              </p>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent">
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
              </select>
            </div>

            {paymentMethod === "UPI" && (
              deliveryProfile?.upiId ? (
                <div className="mb-6 p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-sm">
                  <p className="text-xs text-blue-700 font-semibold uppercase tracking-wider mb-1">
                    Withdrawal will be sent to:
                  </p>
                  <p className="font-mono font-semibold text-blue-950">
                    {deliveryProfile.upiId}
                  </p>
                </div>
              ) : (
                <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                  <p className="font-bold text-amber-900 mb-1">UPI ID Missing</p>
                  <p className="text-xs text-amber-800 mb-2">
                    Please add your UPI ID in Account Settings before requesting a UPI withdrawal.
                  </p>
                  <a
                    href="/delivery/profile"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline">
                    Go to Account Settings &rarr;
                  </a>
                </div>
              )
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount("");
                }}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 font-semibold hover:bg-gray-50 transition"
                disabled={isSubmitting}>
                Cancel
              </button>
              <button
                onClick={handleWithdrawRequest}
                className="flex-1 bg-green-600 text-white rounded-lg py-2.5 font-semibold hover:bg-green-700 transition disabled:opacity-50"
                disabled={isSubmitting || (paymentMethod === "UPI" && !deliveryProfile?.upiId)}>
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
