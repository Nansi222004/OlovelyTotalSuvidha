import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import DeliveryHeader from "../components/DeliveryHeader";
import SummaryBar from "../components/SummaryBar";
import DashboardCard from "../components/DashboardCard";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import { getDashboardStats } from "../../../services/api/delivery/deliveryService";
import { useDeliveryStatus } from "../context/DeliveryStatusContext";

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const { isOnline, sellersInRangeCount, locationError } = useDeliveryStatus();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Icons for dashboard cards (Keep existing SVGs)
  const pendingOrderIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 17H4L5 12H19L20 17H22M2 17C2 18.1046 2.89543 19 4 19C5.10457 19 6 18.1046 6 17M2 17C2 15.8954 2.89543 15 4 15C5.10457 15 6 15.8954 6 17M22 17C22 18.1046 21.1046 19 20 19C18.8954 19 18 18.1046 18 17M22 17C22 15.8954 21.1046 15 20 15C18.8954 15 18 15.8954 18 17M6 17H18M5 12L4 7H2M20 12L21 7H22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M8 10H10M12 10H14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );

  const allOrderIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 17H4L5 12H19L20 17H22M2 17C2 18.1046 2.89543 19 4 19C5.10457 19 6 18.1046 6 17M2 17C2 15.8954 2.89543 15 4 15C5.10457 15 6 15.8954 6 17M22 17C22 18.1046 21.1046 19 20 19C18.8954 19 18 18.1046 18 17M22 17C22 15.8954 21.1046 15 20 15C18.8954 15 18 15.8954 18 17M6 17H18M5 12L4 7H2M20 12L21 7H22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect
        x="7"
        y="5"
        width="10"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <rect
        x="8"
        y="3"
        width="8"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );

  const returnOrderIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );

  const returnItemIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 12L7 8M3 12L7 16M3 12H21M21 12L17 8M21 12L17 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );

  const dailyCollectionIcon = (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <rect
        x="2"
        y="6"
        width="20"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M6 10H18M6 14H14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9 17L11 19L15 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );

  const cashBalanceIcon = (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <rect
        x="2"
        y="6"
        width="20"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M6 10H18M6 14H14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle
        cx="16"
        cy="12"
        r="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );

  const earningIcon = (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <rect
        x="2"
        y="6"
        width="20"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M6 10H18M6 14H14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 12H20M18 10V14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center pb-20">
        <p className="text-neutral-500">Loading dashboard...</p>
        <DeliveryBottomNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center pb-20">
        <p className="text-red-500">{error}</p>
        <DeliveryBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      {/* Header */}
      <DeliveryHeader />

      <div className="px-4 py-4 space-y-4">
        {/* Daily Collection & Cash Balance Bar */}
        <SummaryBar
          leftIcon={dailyCollectionIcon}
          leftLabel="Daily Collection"
          leftValue={`₹ ${stats?.dailyCollection?.toLocaleString("en-IN") || "0"}`}
          rightIcon={cashBalanceIcon}
          rightLabel="Cash Balance"
          rightValue={`₹ ${stats?.cashBalance?.toFixed(2) || "0.00"}`}
          accentColor="#FFC94A"
        />

        {/* Wallet Balance Card */}
        <div
          onClick={() => navigate("/delivery/wallet")}
          className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl p-4 text-white shadow-md cursor-pointer active:scale-[0.98] transition-transform">
          <div className="flex items-center justify-between mb-1">
            <p className="text-green-100 text-xs">Available Wallet Balance</p>
            <div className="bg-green-400/30 p-1.5 rounded-lg">
              <svg
                width="18"
                height="18"
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
          <div className="flex items-end justify-between">
            <p className="text-2xl font-bold">
              ₹ {stats?.walletBalance?.toFixed(2) || "0.00"}
            </p>
            <p className="text-green-100 text-[10px] flex items-center gap-1">
              View Details
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </p>
          </div>
        </div>

        {/* Real-time Seller Radius Indicator */}
        <div
          onClick={() => isOnline && navigate("/delivery/sellers-in-range")}
          className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-95 ${isOnline ? "bg-teal-50 border-teal-100 hover:bg-teal-100" : "bg-neutral-50 border-neutral-200"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-full ${isOnline ? "bg-teal-100 text-teal-600" : "bg-neutral-200 text-neutral-400"}`}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div>
                <h3
                  className={`text-sm font-semibold ${isOnline ? "text-teal-900" : "text-neutral-500"}`}>
                  {isOnline ? "Active Service Areas" : "Offline"}
                </h3>
                <p className="text-xs text-neutral-500">
                  {isOnline
                    ? `You are currently in ${sellersInRangeCount} seller radius`
                    : "Go online to track service areas"}
                </p>
              </div>
            </div>
            {isOnline && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                </span>
                <span className="text-xl font-bold text-teal-600">
                  {sellersInRangeCount}
                </span>
              </div>
            )}
          </div>
          {locationError && isOnline && (
            <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-600 flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {locationError}
            </div>
          )}
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-2 gap-4">
          <DashboardCard
            icon={pendingOrderIcon}
            title="Today's Pending Order"
            value={stats?.pendingOrders || 0}
            accentColor="#16a34a"
            onClick={() => navigate("/delivery/orders/pending")}
          />
          <DashboardCard
            icon={allOrderIcon}
            title="Today's All Order"
            value={stats?.allOrders || 0}
            accentColor="#ef4444"
            onClick={() => navigate("/delivery/orders/all")}
          />
          <DashboardCard
            icon={returnOrderIcon}
            title="Today's Return Order"
            value={stats?.returnOrders || 0}
            accentColor="#f97316"
            onClick={() => navigate("/delivery/orders/return")}
          />
          <DashboardCard
            icon={returnItemIcon}
            title="Total return item have"
            value={stats?.returnItems || 0}
            accentColor="#3b82f6"
          />
        </div>

        {/* Today's Earning & Total Earning Bar */}
        <SummaryBar
          leftIcon={earningIcon}
          leftLabel="Today's Earning"
          leftValue={`₹ ${stats?.todayEarning || 0}`}
          rightIcon={cashBalanceIcon}
          rightLabel="Total Earning"
          rightValue={`₹ ${stats?.totalEarning?.toFixed(2) || "0.00"}`}
          accentColor="#16a34a"
        />

        {/* Today's Pending Order Section */}
        <div className="mt-6">
          <h2 className="text-neutral-900 text-lg font-semibold mb-4">
            Todays Pending Order
          </h2>
          {stats?.pendingOrdersList && stats.pendingOrdersList.length > 0 ? (
            <div className="space-y-3">
              {stats.pendingOrdersList.map((order: any) => (
                <div
                  key={order.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200 cursor-pointer"
                  onClick={() => navigate(`/delivery/orders/${order.id}`)}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-neutral-900 font-semibold text-sm">
                        {order.orderId}
                      </p>
                      <p className="text-neutral-600 text-xs mt-1">
                        {order.customerName}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === "Ready for pickup"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-neutral-600 text-xs mb-2">
                    {order.address}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-neutral-900 font-bold">
                      ₹ {order.totalAmount}
                    </p>
                    {order.estimatedDeliveryTime && (
                      <p className="text-neutral-500 text-xs">
                        ETA: {order.estimatedDeliveryTime}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 min-h-[200px] flex items-center justify-center shadow-sm border border-neutral-200">
              <p className="text-neutral-500 text-sm">No pending orders</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <DeliveryBottomNav />
    </div>
  );
}
