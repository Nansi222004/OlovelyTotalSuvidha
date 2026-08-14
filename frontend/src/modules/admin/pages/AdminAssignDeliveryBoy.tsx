import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    getOrdersByStatus,
    type Order,
} from "../../../services/api/admin/adminOrderService";
import {
    getDeliveryBoys,
    type DeliveryBoy,
} from "../../../services/api/admin/adminDeliveryService";
import { useAuth } from "../../../context/AuthContext";
import AssignDeliveryBoyModal from "../components/AssignDeliveryBoyModal";

export default function AdminAssignDeliveryBoy() {
    const { isAuthenticated, token } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
    const [loading, setLoading] = useState(true);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<"All" | "Unassigned" | "Assigned">("Unassigned");
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch "Received" and "Accepted" orders as they usually need assignment
            const [receivedRes, acceptedRes, deliveryBoysRes] = await Promise.all([
                getOrdersByStatus("Received"),
                getOrdersByStatus("Accepted"),
                getDeliveryBoys({ status: "Active", available: "Available", isOnline: true }),
            ]);

            let combinedOrders: Order[] = [];
            if (receivedRes.success) combinedOrders = [...combinedOrders, ...receivedRes.data];
            if (acceptedRes.success) combinedOrders = [...combinedOrders, ...acceptedRes.data];

            // Filter out self-assigned orders; exclude Instant delivery (auto-assigned, never go to admin)
            combinedOrders = combinedOrders.filter(
                order => order.deliveryPreference !== "Self" && order.deliveryOption !== "Instant"
            );

            // Sort orders by date descending (newest first)
            combinedOrders.sort((a, b) => {
                const dateA = new Date(a.orderDate || a.createdAt || 0).getTime();
                const dateB = new Date(b.orderDate || b.createdAt || 0).getTime();
                return dateB - dateA;
            });

            setOrders(combinedOrders);

            if (deliveryBoysRes.success) {
                setDeliveryBoys(deliveryBoysRes.data);
            }
        } catch (err) {
            console.error("Error fetching assignment data:", err);
            setError("Failed to load data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isAuthenticated || !token) {
            setLoading(false);
            return;
        }

        fetchData();
    }, [isAuthenticated, token]);

    const filteredOrders = orders.filter((order) => {
        const q = String(searchQuery || "").toLowerCase();
        const matchesSearch =
            String(order.orderNumber || "").toLowerCase().includes(q) ||
            String(order.customerName || "").toLowerCase().includes(q);

        if (filter === "Unassigned") return matchesSearch && (!order.deliveryBoyStatus || (order.deliveryBoyStatus as string) === "Not Assigned");
        if (filter === "Assigned") return matchesSearch && order.deliveryBoyStatus === "Assigned";
        return matchesSearch;
    });

    const handleAssignClick = (order: Order) => {
        setSelectedOrder(order);
        setAssignModalOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white border-b border-neutral-200 -mx-6 -mt-6 px-6 py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">Manual Delivery Assignment</h1>
                        <p className="text-sm text-neutral-500 mt-1">Assign delivery partners to pending orders manually</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Link to="/admin" className="text-blue-600 hover:text-blue-700 font-medium">Dashboard</Link>
                        <span className="text-neutral-400">/</span>
                        <span className="text-neutral-700">Manual Assignment</span>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 -mx-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <svg className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-red-700">{error}</span>
                        </div>
                        <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Unassigned Orders</p>
                    <div className="mt-2 flex items-baseline justify-between">
                        <p className="text-2xl font-bold text-red-600">
                            {orders.filter(o => !o.deliveryBoyStatus || (o.deliveryBoyStatus as string) === "Not Assigned").length}
                        </p>
                        <span className="bg-red-50 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Action Needed</span>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Available Boys</p>
                    <div className="mt-2 flex items-baseline justify-between">
                        <p className="text-2xl font-bold text-green-600">{deliveryBoys.length}</p>
                        <span className="bg-green-50 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Online Now</span>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Assigned Today</p>
                    <div className="mt-2 flex items-baseline justify-between">
                        <p className="text-2xl font-bold text-blue-600">
                            {orders.filter(o => o.deliveryBoyStatus === "Assigned").length}
                        </p>
                        <span className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">In Progress</span>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Efficiency</p>
                    <div className="mt-2 flex items-baseline justify-between">
                        <p className="text-2xl font-bold text-neutral-900">94%</p>
                        <span className="bg-neutral-50 text-neutral-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Average</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column: Orders List */}
                <div className="xl:col-span-2 space-y-4">
                    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                        <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <h2 className="font-bold text-neutral-900 flex items-center gap-2">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6z"></path>
                                    <line x1="3" y1="6" x2="21" y2="6"></line>
                                    <path d="M16 10a4 4 0 0 1-8 0"></path>
                                </svg>
                                Orders Pending Assignment
                            </h2>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-64">
                                    <input
                                        type="text"
                                        placeholder="Search Order ID or Customer..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                                    />
                                    <svg className="absolute left-3 top-2.5 text-neutral-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                </div>
                                <div className="flex border border-neutral-200 rounded-lg overflow-hidden shrink-0">
                                    <button
                                        onClick={() => setFilter("Unassigned")}
                                        className={`px-3 py-2 text-xs font-medium transition-colors ${filter === "Unassigned" ? "bg-green-600 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                                        Unassigned
                                    </button>
                                    <button
                                        onClick={() => setFilter("Assigned")}
                                        className={`px-3 py-2 text-xs font-medium transition-colors ${filter === "Assigned" ? "bg-green-600 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                                        Assigned
                                    </button>
                                    <button
                                        onClick={() => setFilter("All")}
                                        className={`px-3 py-2 text-xs font-medium transition-colors ${filter === "All" ? "bg-green-600 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                                        All
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="divide-y divide-neutral-100 max-h-[700px] overflow-y-auto">
                            {loading ? (
                                <div className="p-12 text-center text-neutral-500">
                                    <div className="animate-spin w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                                    <p>Loading pending orders...</p>
                                </div>
                            ) : filteredOrders.length === 0 ? (
                                <div className="p-12 text-center text-neutral-500">
                                    <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="12" y1="8" x2="12" y2="12"></line>
                                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                        </svg>
                                    </div>
                                    <p className="font-medium text-neutral-900">No orders found</p>
                                    <p className="text-sm">Try adjusting your filters or search query.</p>
                                </div>
                            ) : (
                                filteredOrders.map((order) => (
                                    <div key={order._id} className="p-4 hover:bg-neutral-50 transition-colors group">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                                                        <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
                                                        <circle cx="5.5" cy="18.5" r="1.5" />
                                                        <circle cx="18.5" cy="18.5" r="1.5" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-neutral-900">#{order.orderNumber}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${order.status === "Received" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                                                            }`}>
                                                            {order.status}
                                                        </span>
                                                        {order.deliveryOption === "Instant" && (
                                                            <span className="bg-orange-50 text-orange-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                                                </svg>
                                                                Instant
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-neutral-900 font-medium mt-1">{order.customerName}</p>
                                                    <p className="text-xs text-neutral-500 truncate max-w-[250px]">{order.deliveryAddress?.address}</p>
                                                    {order.deliveryBoyStatus === "Assigned" && order.deliveryBoy && (
                                                        <div className="mt-1 flex items-center gap-1 text-xs text-green-700 bg-green-50 w-fit px-1.5 py-0.5 rounded">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                                <circle cx="12" cy="7" r="4"></circle>
                                                            </svg>
                                                            Assigned: <span className="font-bold">{(order.deliveryBoy as any).name || "Unknown"}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-1">
                                                <p className="text-sm font-bold text-neutral-900">₹{order.total?.toFixed(0)}</p>
                                                <p className="text-[10px] text-neutral-500">
                                                    {order.orderDate ? new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 md:ml-4">
                                                {/* Logic for Instant Order Broadcasting State */}
                                                {order.deliveryOption === "Instant" && order.status === "Accepted" && (!order.deliveryBoyStatus || (order.deliveryBoyStatus as string) === "Not Assigned") ? (
                                                    <button
                                                        onClick={() => handleAssignClick(order)}
                                                        className="flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 flex items-center gap-2"
                                                        title="System is broadcasting this order to partners. You can manually assign if needed.">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                                        </span>
                                                        Broadcasting...
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleAssignClick(order)}
                                                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${order.deliveryBoyStatus === "Assigned"
                                                            ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                                            : "bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-200"
                                                            }`}>
                                                        {order.deliveryBoyStatus === "Assigned" ? "Change Driver" : "Assign Now"}
                                                    </button>
                                                )}

                                                <Link
                                                    to={`/admin/orders/${order._id}`}
                                                    className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" />
                                                        <circle cx="12" cy="12" r="3" />
                                                    </svg>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Available Boys */}
                <div className="space-y-4">
                    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden sticky top-6">
                        <div className="p-4 border-b border-neutral-200 bg-neutral-50/50">
                            <h2 className="font-bold text-neutral-900 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                Active Partners ({deliveryBoys.length})
                            </h2>
                            <p className="text-[10px] text-neutral-500 mt-0.5 uppercase tracking-wider font-medium">Available for duty</p>
                        </div>

                        <div className="p-2 space-y-1 max-h-[600px] overflow-y-auto">
                            {deliveryBoys.map((boy) => (
                                <div key={boy._id} className="p-3 rounded-lg hover:bg-neutral-50 border border-transparent hover:border-neutral-100 transition-all cursor-pointer group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-100 overflow-hidden shrink-0">
                                            {boy.profileImage ? (
                                                <img src={boy.profileImage} alt={boy.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-neutral-400 font-bold bg-neutral-200">
                                                    {boy.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-neutral-900 truncate">{boy.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-neutral-500 font-medium">ID: {boy._id.slice(-6).toUpperCase()}</span>
                                                <div className="w-1 h-1 rounded-full bg-neutral-300"></div>
                                                <span className="text-[10px] text-green-600 font-bold">{boy.city || "Local"}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-neutral-900">4.8â˜…</div>
                                            <div className="text-[10px] text-neutral-500">1.2km away</div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {deliveryBoys.length === 0 && (
                                <div className="p-8 text-center text-neutral-500">
                                    <p className="text-sm">No active partners online</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-neutral-100 bg-neutral-50/30">
                            <button
                                onClick={() => fetchData()}
                                className="w-full py-2.5 rounded-lg border-2 border-dashed border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-300 transition-all text-xs font-bold">
                                Refresh Partner Status
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Assign Delivery Boy Modal */}
            {assignModalOpen && selectedOrder && (
                <AssignDeliveryBoyModal
                    isOpen={assignModalOpen}
                    onClose={() => {
                        setAssignModalOpen(false);
                        setSelectedOrder(null);
                    }}
                    orderId={selectedOrder._id}
                    orderNumber={selectedOrder.orderNumber}
                    currentDeliveryBoy={
                        typeof selectedOrder.deliveryBoy === "string"
                            ? selectedOrder.deliveryBoy
                            : selectedOrder.deliveryBoy && typeof selectedOrder.deliveryBoy === "object"
                                ? (selectedOrder.deliveryBoy as { _id?: string })._id || undefined
                                : undefined
                    }
                    onAssignSuccess={async () => {
                        await fetchData();
                        setAssignModalOpen(false);
                        setSelectedOrder(null);
                    }}
                />
            )}
        </div>
    );
}
