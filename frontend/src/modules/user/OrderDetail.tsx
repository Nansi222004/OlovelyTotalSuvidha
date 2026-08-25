import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../components/ui/button";
import { useOrders } from "../../hooks/useOrders";
import { OrderStatus } from "../../types/order";
import GoogleMapsTracking from "../../components/GoogleMapsTracking";
import { useDeliveryTracking } from "../../hooks/useDeliveryTracking";
import DeliveryPartnerCard from "../../components/DeliveryPartnerCard";
import { cancelOrder, updateOrderNotes, getSellerLocationsForOrder, refreshDeliveryOtp, requestCustomerReturn } from "../../services/api/customerOrderService";
import {
  addReview,
  getMyReviewForOrderProduct,
} from "../../services/api/customerReviewService";
import StarRating from "../../components/ui/StarRating";
import RazorpayCheckout from "../../components/RazorpayCheckout";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { formatDeliveryAddress } from "../../utils/addressUtils";
import SupportModal from "../../components/SupportModal";

// Icon Components
const ArrowLeftIcon = ({ className }: { className?: string }) => (
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
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const Share2Icon = ({ className }: { className?: string }) => (
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
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const RefreshCwIcon = ({ className }: { className?: string }) => (
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
    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.48L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const PhoneIcon = ({ className }: { className?: string }) => (
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
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
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
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
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
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const HomeIcon = ({ className }: { className?: string }) => (
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
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const MessageSquareIcon = ({ className }: { className?: string }) => (
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
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const HelpCircleIcon = ({ className }: { className?: string }) => (
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
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
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
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ChefHatIcon = ({ className }: { className?: string }) => (
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
    <path d="M6 13h12M6 13c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2M6 13v5c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-5" />
    <path d="M9 9V7a3 3 0 0 1 6 0v2" />
  </svg>
);

const ReceiptIcon = ({ className }: { className?: string }) => (
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
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="16" y2="11" />
    <line x1="8" y1="15" x2="16" y2="15" />
  </svg>
);

const CircleSlashIcon = ({ className }: { className?: string }) => (
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
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

// Animated checkmark component
const AnimatedCheckmark = ({ delay = 0 }) => (
  <motion.svg
    width="80"
    height="80"
    viewBox="0 0 80 80"
    initial="hidden"
    animate="visible"
    className="mx-auto">
    <motion.circle
      cx="40"
      cy="40"
      r="36"
      fill="none"
      stroke="#22c55e"
      strokeWidth="4"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    />
    <motion.path
      d="M24 40 L35 51 L56 30"
      fill="none"
      stroke="#22c55e"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay: delay + 0.4, ease: "easeOut" }}
    />
  </motion.svg>
);

// Promotional banner carousel
const PromoCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const promos = [
    {
      bank: "HDFC BANK",
      offer: "10% cashback on all orders",
      subtext: "Extraordinary Rewards | Zero Joining Fee | T&C apply",
      color: "from-blue-50 to-indigo-50",
    },
    {
      bank: "ICICI BANK",
      offer: "15% instant discount",
      subtext: "Valid on orders above ₹299 | Use code ICICI15",
      color: "from-orange-50 to-red-50",
    },
    {
      bank: "SBI CARD",
      offer: "Flat ₹75 off",
      subtext: "On all orders | No minimum order value",
      color: "from-purple-50 to-pink-50",
    },
    {
      bank: "AXIS BANK",
      offer: "20% cashback up to ₹100",
      subtext: "Valid on first order | T&C apply",
      color: "from-teal-50 to-cyan-50",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % promos.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      className="bg-white rounded-xl p-4 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}>
      <div className="overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className={`flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r ${promos[currentSlide].color}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold bg-blue-900 text-white px-2 py-0.5 rounded">
                  {promos[currentSlide].bank}
                </span>
              </div>
              <p className="font-semibold text-gray-900">
                {promos[currentSlide].offer}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {promos[currentSlide].subtext}
              </p>
              <button className="text-green-700 font-medium text-sm mt-2 flex items-center gap-1">
                Apply now <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-2xl">💳</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center gap-2 mt-3">
        {promos.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentSlide ? "bg-green-600 w-4" : "bg-gray-300"
              }`}
          />
        ))}
      </div>
    </motion.div>
  );
};

// Tip selection component
const TipSection = () => {
  const [selectedTip, setSelectedTip] = useState<number | "other" | null>(null);
  const [customTip, setCustomTip] = useState("");
  const tips = [20, 30, 50];

  return (
    <motion.div
      className="bg-white rounded-xl p-4 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}>
      <p className="text-gray-700 text-sm mb-3">
        Make their day by leaving a tip. 100% of the amount will go to them
        after delivery
      </p>
      <div className="flex gap-3">
        {tips.map((tip) => (
          <motion.button
            key={tip}
            onClick={() => {
              setSelectedTip(tip);
              setCustomTip("");
            }}
            className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${selectedTip === tip
              ? "border-green-600 bg-green-50 text-green-700"
              : "border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            whileTap={{ scale: 0.95 }}>
            ₹{tip}
          </motion.button>
        ))}
        <motion.button
          onClick={() => {
            setSelectedTip("other");
          }}
          className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${selectedTip === "other"
            ? "border-green-600 bg-green-50 text-green-700"
            : "border-gray-200 text-gray-700 hover:border-gray-300"
            }`}
          whileTap={{ scale: 0.95 }}>
          Other
        </motion.button>
      </div>

      <AnimatePresence>
        {selectedTip === "other" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <input
              type="number"
              placeholder="Enter custom amount"
              value={customTip}
              onChange={(e) => setCustomTip(e.target.value)}
              className="mt-3 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Section item component
const SectionItem = ({
  icon: Icon,
  title,
  subtitle,
  onClick,
  showArrow = true,
  rightContent,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  showArrow?: boolean;
  rightContent?: React.ReactNode;
}) => (
  <motion.button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b border-dashed border-gray-200 last:border-0"
    whileTap={{ scale: 0.99 }}>
    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-gray-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-gray-900 truncate">{title}</p>
      {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
    </div>
    {rightContent ||
      (showArrow && <ChevronRightIcon className="w-5 h-5 text-gray-400" />)}
  </motion.button>
);

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const confirmed = searchParams.get("confirmed") === "true";
  const { getOrderById, fetchOrderById, loading: contextLoading } = useOrders();
  const { showToast } = useToast();
  const [order, setOrder] = useState<any>(id ? getOrderById(id) : undefined);
  const [loading, setLoading] = useState(!order);

  const [showConfirmation, setShowConfirmation] = useState(confirmed);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(
    order?.status || "Received"
  );
  const [estimatedTime, setEstimatedTime] = useState(29);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
    durationValue: number;
    distanceValue: number;
  } | null>(null);
  const { user } = useAuth();
  const [showRazorpayCheckout, setShowRazorpayCheckout] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showSpecialRequestsModal, setShowSpecialRequestsModal] =
    useState(false);

  // Form states
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [selectedTip, setSelectedTip] = useState<number | "other" | null>(null);
  const [customTip, setCustomTip] = useState("");

  // Review states (delivered orders)
  const [reviewStatusByProduct, setReviewStatusByProduct] = useState<
    Record<string, { reviewed: boolean; rating?: number }>
  >({});
  const [activeReviewProductId, setActiveReviewProductId] = useState<
    string | null
  >(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  // Return Modal states
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedReturnItem, setSelectedReturnItem] = useState<any>(null);
  const [returnReason, setReturnReason] = useState<string>("Damaged product");
  const [customReturnReason, setCustomReturnReason] = useState<string>("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Customer & Delivery Address & Support Modal states
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showDeliveryAddressModal, setShowDeliveryAddressModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Real-time delivery tracking via WebSocket (disabled for loading, delivered, completed, or cancelled orders)
  const activeOrderStatus = order?.status || (orderStatus !== "Received" ? orderStatus : "");
  const isTerminalOrDelivered = Boolean(
    activeOrderStatus && ["Delivered", "Completed", "Cancelled", "Returned"].includes(activeOrderStatus)
  );
  const isLiveTrackingEnabled = Boolean(order && activeOrderStatus && !isTerminalOrDelivered);


  const {
    deliveryLocation,
    eta,
    distance,
    status: trackingStatus,
    orderStatus: socketOrderStatus, // Real-time order status from socket
    isConnected,
    lastUpdate,
    error: trackingError,
    reconnectAttempts,
    reconnect,
  } = useDeliveryTracking(id, isLiveTrackingEnabled);


  // Seller locations for the order
  const [sellerLocations, setSellerLocations] = useState<any[]>([]);
  const [loadingSellerLocations, setLoadingSellerLocations] = useState(false);

  // Fetch order if not in context
  useEffect(() => {
    const loadOrder = async () => {
      if (!id) return;

      const existingOrder = getOrderById(id);
      if (existingOrder) {
        setOrder(existingOrder);
        setOrderStatus(existingOrder.status);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const fetchedOrder = await fetchOrderById(id);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
        setOrderStatus(fetchedOrder.status);
      }
      setLoading(false);
    };

    loadOrder();
  }, [id]);

  // Fetch seller locations when order is loaded
  useEffect(() => {
    const fetchSellerLocations = async () => {
      if (!id || !order) return;

      // Only fetch if order has delivery boy assigned and status is before "Picked up" or "Out for Delivery"
      const shouldFetch = order.status &&
        order.status !== 'Delivered' &&
        order.status !== 'Cancelled' &&
        order.status !== 'Picked up' &&
        order.status !== 'Out for Delivery';

      if (shouldFetch) {
        try {
          setLoadingSellerLocations(true);
          const response = await getSellerLocationsForOrder(id);
          if (response.success && response.data) {
            setSellerLocations(response.data || []);
          }
        } catch (err) {
          console.error('Failed to fetch seller locations:', err);
        } finally {
          setLoadingSellerLocations(false);
        }
      }
    };

    fetchSellerLocations();
  }, [id, order?.status]);

  // Update orderStatus when order state changes
  useEffect(() => {
    if (order) {
      setOrderStatus(order.status);
    }
  }, [order]);

  // Load existing review status for delivered order items
  useEffect(() => {
    const loadReviewStatuses = async () => {
      if (!order || order.status !== "Delivered" || !id) return;
      const items = order.items || [];
      const statusMap: Record<string, { reviewed: boolean; rating?: number }> =
        {};

      await Promise.all(
        items.map(async (item: any) => {
          const productId =
            item.product?._id ||
            item.product?.id ||
            (typeof item.product === "string" ? item.product : null);
          if (!productId) return;
          try {
            const res = await getMyReviewForOrderProduct(
              String(productId),
              id
            );
            if (res.data) {
              statusMap[String(productId)] = {
                reviewed: true,
                rating: res.data.rating,
              };
            } else {
              statusMap[String(productId)] = { reviewed: false };
            }
          } catch {
            statusMap[String(productId)] = { reviewed: false };
          }
        })
      );

      setReviewStatusByProduct(statusMap);
    };

    loadReviewStatuses();
  }, [order?.status, order?.items, id]);

  const getItemProductId = (item: any): string | null => {
    const productId =
      item.product?._id ||
      item.product?.id ||
      (typeof item.product === "string" ? item.product : null);
    return productId ? String(productId) : null;
  };

  const handleOpenReview = (productId: string) => {
    setActiveReviewProductId(productId);
    setReviewRating(5);
    setReviewTitle("");
    setReviewComment("");
    setReviewError(null);
    setReviewSuccess(null);
  };

  const handleSubmitReview = async () => {
    if (!id || !activeReviewProductId) return;
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError("Please select a rating");
      return;
    }

    setReviewSubmitting(true);
    setReviewError(null);
    setReviewSuccess(null);
    try {
      const res = await addReview({
        productId: activeReviewProductId,
        orderId: id,
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        comment: reviewComment.trim() || undefined,
      });
      if (res.success) {
        setReviewStatusByProduct((prev) => ({
          ...prev,
          [activeReviewProductId]: {
            reviewed: true,
            rating: reviewRating,
          },
        }));
        setReviewSuccess("Thanks for your review!");
        setActiveReviewProductId(null);
        setReviewTitle("");
        setReviewComment("");
      } else {
        setReviewError(res.message || "Failed to submit review");
      }
    } catch (err: any) {
      setReviewError(
        err.response?.data?.message ||
          err.message ||
          "Failed to submit review"
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Real-time order status updates from socket
  useEffect(() => {
    if (socketOrderStatus && socketOrderStatus !== orderStatus) {
      console.log('🔄 Real-time status update:', socketOrderStatus);
      setOrderStatus(socketOrderStatus as OrderStatus);

      // Re-fetch order to get complete updated data
      if (id) {
        fetchOrderById(id).then((fetchedOrder) => {
          if (fetchedOrder) {
            setOrder(fetchedOrder);
          }
        });
      }
    }
  }, [socketOrderStatus, orderStatus, id, fetchOrderById]);

  // Simulate order status progression
  useEffect(() => {
    if (confirmed && order) {
      const timer1 = setTimeout(() => {
        setShowConfirmation(false);
        setOrderStatus("Accepted");
      }, 3000);
      return () => clearTimeout(timer1);
    }
  }, [confirmed, order]);

  // Countdown timer
  useEffect(() => {
    if (orderStatus === "Accepted" || orderStatus === "On the way") {
      const timer = setInterval(() => {
        setEstimatedTime((prev) => Math.max(0, prev - 1));
      }, 60000);
      return () => clearInterval(timer);
    }
  }, [orderStatus]);

  // Handler functions
  const handleRefresh = async () => {
    if (!id) return;
    setIsRefreshing(true);
    const fetchedOrder = await fetchOrderById(id);
    if (fetchedOrder) {
      setOrder(fetchedOrder);
      setOrderStatus(fetchedOrder.status);
    }
    // Add a small delay for the animation
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRefreshOtp = async () => {
    if (!id || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshDeliveryOtp(id);
      // Re-fetch order to get updated OTP and expiry
      const fetchedOrder = await fetchOrderById(id);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
        setOrderStatus(fetchedOrder.status);
      }
    } catch (error) {
      console.error("Failed to refresh OTP:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Order #${order?.id?.split("-").slice(-1)[0]}`,
      text: `Track my Olovely order: Order #${order?.id?.split("-").slice(-1)[0]
        }`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy link to clipboard
        await navigator.clipboard.writeText(window.location.href);
        showToast("Link copied to clipboard!", "info");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleCallStore = () => {
    // Default store number, should be from order/seller data
    const storeNumber = order?.seller?.phone || "1234567890";
    window.location.href = `tel:${storeNumber}`;
  };

  const handleCancelOrder = async () => {
    if (!cancellationReason.trim()) {
      showToast("Please provide a cancellation reason", "error");
      return;
    }

    if (!id) return;

    try {
      // TODO: Call backend API to cancel order
      await cancelOrder(id, cancellationReason);
      setOrderStatus("Cancelled" as any);
      setShowCancelModal(false);
      showToast("Order cancelled successfully", "success");
      // Refresh order to get updated status
      handleRefresh();
    } catch (error) {
      console.error("Error cancelling order:", error);
      showToast("Failed to cancel order", "error");
    }
  };

  const handleSaveInstructions = async () => {
    try {
      if (!id) return;
      await updateOrderNotes(id, { deliveryInstructions });
      setShowInstructionsModal(false);
      showToast("Delivery instructions saved!", "success");
      handleRefresh();
    } catch (error) {
      console.error("Failed to save instructions:", error);
      showToast("Failed to save instructions", "error");
    }
  };

  const handleSaveSpecialRequests = async () => {
    try {
      if (!id) return;
      await updateOrderNotes(id, { specialRequests });
      setShowSpecialRequestsModal(false);
      showToast("Special requests saved!", "success");
      handleRefresh();
    } catch (error) {
      console.error("Failed to save special requests:", error);
      showToast("Failed to save special requests", "error");
    }
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <p className="text-sm text-neutral-500">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4">
            Order Not Found
          </h1>
          <Link to="/orders">
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig: Record<
    string,
    { title: string; subtitle: string; color: string }
  > = {
    Received: {
      title: "Order received",
      subtitle: "Order will reach you shortly",
      color: "bg-emerald-700",
    },
    Accepted: {
      title: "Preparing your order",
      subtitle: `Arriving in ${estimatedTime} mins`,
      color: "bg-emerald-700",
    },
    "On the way": {
      title: "Out for delivery",
      subtitle: `Arriving in ${estimatedTime} mins`,
      color: "bg-emerald-700",
    },
    Delivered: {
      title: "Order delivered",
      subtitle: "Thank you for shopping with us!",
      color: "bg-emerald-600",
    },
    Completed: {
      title: "Order delivered",
      subtitle: "Thank you for shopping with us!",
      color: "bg-emerald-600",
    },
    // Backend status mappings
    Pending: {
      title: "Order pending",
      subtitle: "Waiting for confirmation",
      color: "bg-amber-600",
    },
    Processed: {
      title: "Order processed",
      subtitle: "Preparing for delivery",
      color: "bg-emerald-700",
    },
    Shipped: {
      title: "Order shipped",
      subtitle: "On the way to you",
      color: "bg-blue-600",
    },
    "Out for Delivery": {
      title: "Out for delivery",
      subtitle: `Arriving in ${estimatedTime} mins`,
      color: "bg-emerald-700",
    },
    Cancelled: {
      title: "Order cancelled",
      subtitle: "This order has been cancelled",
      color: "bg-rose-600",
    },
    Returned: {
      title: "Order returned",
      subtitle: "This order has been returned",
      color: "bg-slate-600",
    },
  };

  const currentStatus = statusConfig[orderStatus] || statusConfig["Received"];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Order Confirmed Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-center px-8">
              <AnimatedCheckmark delay={0.3} />
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="text-2xl font-bold text-gray-900 mt-6">
                Order Confirmed!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="text-gray-600 mt-2">
                Your order has been placed successfully
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="mt-8">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-3">
                  Loading order details...
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Green Header */}
      <motion.div
        className={`${currentStatus.color} text-white sticky top-0 z-40`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}>
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/orders">
            <motion.button
              className="w-10 h-10 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}>
              <ArrowLeftIcon className="w-6 h-6" />
            </motion.button>
          </Link>
          <h2 className="font-semibold text-lg">Olovely</h2>
          <motion.button
            className="w-10 h-10 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
            onClick={handleShare}>
            <Share2Icon className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Status section */}
        <div className="px-4 pb-4 text-center">
          <motion.h1
            className="text-2xl font-bold mb-3"
            key={currentStatus.title}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}>
            {currentStatus.title}
          </motion.h1>

          {/* Status pill */}
          <motion.div
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}>
            <span className="text-sm">{currentStatus.subtitle}</span>
            {(orderStatus === "Accepted" || orderStatus === "On the way") && (
              <>
                <span className="w-1 h-1 rounded-full bg-white" />
                <span className="text-sm text-green-200">On time</span>
              </>
            )}
            <motion.button
              onClick={handleRefresh}
              className="ml-1"
              animate={{ rotate: isRefreshing ? 360 : 0 }}
              transition={{ duration: 0.5 }}>
              <RefreshCwIcon className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      {/* Map Section */}
      {!showConfirmation && !['Delivered', 'Cancelled', 'Returned'].includes(order?.status) && (
        <GoogleMapsTracking
          sellerLocations={sellerLocations.map(s => ({
            lat: s.latitude,
            lng: s.longitude,
            name: s.storeName
          }))}
          customerLocation={{
            lat: order?.deliveryAddress?.latitude || order?.address?.latitude || 0,
            lng: order?.deliveryAddress?.longitude || order?.address?.longitude || 0,
          }}
          deliveryLocation={deliveryLocation || undefined}
          isTracking={isConnected && !!deliveryLocation}
          showRoute={
            isConnected &&
            !!deliveryLocation &&
            order?.status !== 'Delivered' &&
            order?.status !== 'Cancelled' &&
            order?.status !== 'Returned'
          }
          routeOrigin={deliveryLocation || undefined}
          routeDestination={{
            lat: order?.deliveryAddress?.latitude || order?.address?.latitude || 0,
            lng: order?.deliveryAddress?.longitude || order?.address?.longitude || 0,
          }}
          routeWaypoints={
            order?.status === 'Picked up' || order?.status === 'Out for Delivery'
              ? []
              : sellerLocations.map(s => ({
                lat: s.latitude,
                lng: s.longitude,
              }))
          }
          destinationName={
            order?.status === 'Picked up' || order?.status === 'Out for Delivery'
              ? order?.deliveryAddress?.address?.split(',')[0] || order?.address?.split(',')[0] || "Delivery Address"
              : sellerLocations.length > 0
                ? "Sellers & Delivery Address"
                : "Delivery Address"
          }
          onRouteInfoUpdate={setRouteInfo}
          lastUpdate={lastUpdate}
        />
      )}

      {/* Tracking Error Display — only during active delivery */}
      {isLiveTrackingEnabled && trackingError && (
        <div className="mx-4 mt-2 px-4 py-2 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 flex items-center gap-2">
          <span>⚠️</span>
          <span>{trackingError}</span>
        </div>
      )}

      {/* Delivery Partner Card — hide OTP and card after delivery */}
      {!["Delivered", "Completed", "Cancelled"].includes(orderStatus) && (order?.deliveryPartner || order?.deliveryOtp) && (
        <DeliveryPartnerCard
          partner={{
            name: order?.deliveryPartner?.name || "Delivery Partner",
            phone: order?.deliveryPartner?.phone,
            profileImage: order?.deliveryPartner?.profileImage,
            vehicleNumber: order?.deliveryPartner?.vehicleNumber,
          }}
          eta={routeInfo ? Math.ceil(routeInfo.durationValue / 60) : eta}
          distance={routeInfo ? routeInfo.distanceValue : distance}
          isTracking={isConnected && !!deliveryLocation}
          deliveryOtp={order?.deliveryOtp}
          onCall={() => {
            const phone = order?.deliveryPartner?.phone || "1234567890";
            window.location.href = `tel:${phone}`;
          }}
        />
      )}

      {/* Scrollable Content */}
      <div className="px-4 py-4 space-y-4 pb-24">
        {/* Payment Pending */}
        {order?.paymentStatus !== "Paid" && order?.paymentStatus !== "Completed" && order?.paymentStatus !== "Refunded" && (
          <motion.div
            className="bg-white rounded-xl p-4 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  Payment of ₹{order.totalAmount?.toFixed(0) || order.total?.toFixed(0) || "0"} pending
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Pay now, or pay to the delivery partner using Cash/UPI
                </p>
              </div>
              <Button
                onClick={() => setShowRazorpayCheckout(true)}
                className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-6">
                Pay now <ChevronRightIcon className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Promo Carousel - Only for active orders */}
        {!["Delivered", "Completed", "Cancelled", "Returned"].includes(orderStatus) && (
          <PromoCarousel />
        )}

        {/* Delivery Partner Assignment - Only show if no partner assigned yet during active delivery */}
        {!order?.deliveryPartner && !["Delivered", "Completed", "Cancelled", "Returned"].includes(orderStatus) && (
          <motion.div
            className="bg-white rounded-xl p-4 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-2xl">📦</span>
              </div>
              <p className="font-semibold text-gray-900">
                {order?.status === 'Received' || order?.status === 'Accepted'
                  ? "Assigning delivery partner shortly"
                  : "Preparing your order"}
              </p>
            </div>
          </motion.div>
        )}

        {/* Tip Section - Only for active orders */}
        {!["Delivered", "Completed", "Cancelled", "Returned"].includes(orderStatus) && (
          <TipSection />
        )}

        {/* Delivery Partner Safety - Only for active orders */}
        {!["Delivered", "Completed", "Cancelled", "Returned"].includes(orderStatus) && (
          <motion.button
            className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileTap={{ scale: 0.99 }}>
            <ShieldIcon className="w-6 h-6 text-gray-600" />
            <span className="flex-1 text-left font-medium text-gray-900">
              Learn about delivery partner safety
            </span>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </motion.button>
        )}

        {/* Delivery Details Banner */}
        <motion.div
          className="bg-yellow-50 rounded-xl p-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}>
          <p className="text-yellow-800 font-medium">
            All your delivery details in one place 👇
          </p>
        </motion.div>

        {/* Contact & Address Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}>
          <SectionItem
            icon={PhoneIcon}
            title={`${order.customerName || order.address?.name || "Customer"}, ${order.customerPhone || order.address?.phone || "Phone Not Available"}`}
            subtitle="Click to view customer details"
            onClick={() => setShowCustomerModal(true)}
          />
          <SectionItem
            icon={HomeIcon}
            title="Delivery Address"
            subtitle={
              (order.deliveryAddress || order.address)
                ? formatDeliveryAddress(order.deliveryAddress || order.address).formatted
                : "Add delivery address"
            }
            onClick={() => setShowDeliveryAddressModal(true)}
          />
          <SectionItem
            icon={() => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            )}
            title="Delivery Option"
            subtitle={`${order.deliveryOption || 'Standard'} Delivery`}
            showArrow={false}
          />
          <SectionItem
            icon={() => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            )}
            title="Payment Method"
            subtitle={`${order.paymentMethod || 'COD'}`}
            showArrow={false}
          />
          {!["Delivered", "Completed", "Cancelled", "Returned"].includes(orderStatus) ? (
            <SectionItem
              icon={MessageSquareIcon}
              title="Add delivery instructions"
              subtitle={order.deliveryInstructions || order.instructions || ""}
              onClick={() => setShowInstructionsModal(true)}
            />
          ) : (order.deliveryInstructions || order.instructions) ? (
            <SectionItem
              icon={MessageSquareIcon}
              title="Delivery Instructions"
              subtitle={order.deliveryInstructions || order.instructions}
              showArrow={false}
            />
          ) : null}
        </motion.div>

        {/* Store Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}>
          <div className="flex items-center gap-3 p-4 border-b border-dashed border-gray-200">
            <div className="w-12 h-12 rounded-full bg-orange-100 overflow-hidden flex items-center justify-center">
              <span className="text-2xl">🛒</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Olovely Store</p>
              <p className="text-sm text-gray-500">
                {order.address?.city || "Local Area"}
              </p>
            </div>
            <motion.button
              className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
              onClick={handleCallStore}>
              <PhoneIcon className="w-5 h-5 text-green-700" />
            </motion.button>
          </div>

          {/* Order Items */}
          <div
            className="p-4 border-b border-dashed border-gray-200"
            onClick={() => setShowItemsModal(true)}
            style={{ cursor: "pointer" }}>
            <div className="flex items-start gap-3">
              <ReceiptIcon className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  Order #{order.id.split("-").slice(-1)[0]}
                </p>
                <div className="mt-2 space-y-1">
                  {order.items?.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-4 h-4 rounded border border-green-600 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-green-600" />
                      </span>
                      <span>
                        {item.quantity} x{" "}
                        {item.product?.name || item.productName || "Product"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          {!["Delivered", "Completed", "Cancelled", "Returned"].includes(orderStatus) ? (
            <SectionItem
              icon={ChefHatIcon}
              title="Add special requests"
              subtitle={order.specialRequests || ""}
              onClick={() => setShowSpecialRequestsModal(true)}
            />
          ) : order.specialRequests ? (
            <SectionItem
              icon={ChefHatIcon}
              title="Special Requests"
              subtitle={order.specialRequests}
              showArrow={false}
            />
          ) : null}
        </motion.div>

        {/* Rate & Review — only for delivered orders */}
        {order?.status === "Delivered" && (
          <motion.div
            className="bg-white rounded-xl shadow-sm overflow-hidden p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.78 }}>
            <h3 className="font-semibold text-gray-900 mb-1">
              Rate & Review
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Share your experience with the products you ordered
            </p>

            {reviewSuccess && (
              <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3">
                {reviewSuccess}
              </p>
            )}

            <div className="space-y-3">
              {order.items?.map((item: any, index: number) => {
                const productId = getItemProductId(item);
                if (!productId) return null;
                const status = reviewStatusByProduct[productId];
                const name =
                  item.product?.productName ||
                  item.product?.name ||
                  item.productName ||
                  "Product";
                const isActive = activeReviewProductId === productId;

                return (
                  <div
                    key={productId + index}
                    className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {(item.product?.mainImage || item.productImage) ? (
                          <img
                            src={item.product?.mainImage || item.productImage}
                            alt={name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg">
                            📦
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {name}
                        </p>
                        {status?.reviewed ? (
                          <div className="mt-1 flex items-center gap-2">
                            <StarRating
                              rating={status.rating || 0}
                              showCount={false}
                              size="sm"
                            />
                            <span className="text-xs text-green-700 font-medium">
                              Reviewed
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenReview(productId)}
                            className="mt-1.5 text-sm font-medium text-green-700 hover:text-green-800">
                            {isActive ? "Writing review…" : "Rate & Review"}
                          </button>
                        )}
                      </div>
                    </div>

                    {isActive && !status?.reviewed && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">
                            Your rating
                          </p>
                          <StarRating
                            rating={reviewRating}
                            interactive
                            onChange={setReviewRating}
                            size="lg"
                            showCount={false}
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Title (optional)"
                          value={reviewTitle}
                          onChange={(e) => setReviewTitle(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          maxLength={100}
                        />
                        <textarea
                          placeholder="Share your experience (optional)"
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          rows={3}
                          maxLength={500}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        {reviewError && (
                          <p className="text-sm text-red-600">{reviewError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setActiveReviewProductId(null);
                              setReviewError(null);
                            }}
                            disabled={reviewSubmitting}>
                            Cancel
                          </Button>
                          <Button
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleSubmitReview}
                            disabled={reviewSubmitting}>
                            {reviewSubmitting ? "Submitting…" : "Submit"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Help Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}>
          <div
            className="flex items-center gap-3 p-4 border-b border-dashed border-gray-200"
            onClick={() => setShowSupportModal(true)}
            style={{ cursor: "pointer" }}>
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <HelpCircleIcon className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">
                Need help with your order?
              </p>
              <p className="text-sm text-gray-500">Get help & support</p>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </div>

          {/* Cancel Order — ONLY shown if in cancellable state */}
          {["Pending", "Received", "Accepted", "Processed", "Shipped"].includes(orderStatus) && (
            <SectionItem
              icon={CircleSlashIcon}
              title="Cancel order"
              subtitle=""
              onClick={() => setShowCancelModal(true)}
            />
          )}
        </motion.div>

        {/* Return & Replacement Options — shown for delivered returnable items */}
        {["Delivered", "Completed"].includes(orderStatus) && order.items && order.items.length > 0 && (
          <motion.div
            className="bg-white rounded-xl shadow-sm p-4 space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.82 }}>
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <span>↩</span> Return & Replacement Options
            </h3>
            {order.items.map((item: any, idx: number) => {
              const productName = item.product?.productName || item.product?.name || item.productName || "Product";
              const isReturnable = item.isReturnable ?? true;
              const isReturnWindowActive = item.isReturnWindowActive ?? true;
              const activeReturnStatus = item.activeReturnStatus;
              const expiryDate = item.returnExpiryDate
                ? new Date(item.returnExpiryDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                : null;

              return (
                <div key={item._id || idx} className="p-3 border border-gray-100 rounded-xl bg-neutral-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{productName}</p>
                    <p className="text-xs text-gray-500">Qty: {item.quantity} | Amount: ₹{(item.total || (item.unitPrice * item.quantity) || 0).toFixed(2)}</p>
                    {activeReturnStatus ? (
                      activeReturnStatus === 'Rejected' ? (
                        <div className="mt-1 space-y-1">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                            Return Rejected
                          </span>
                          {item.activeReturnRejectionReason && (
                            <p className="text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-200 mt-1">
                              <span className="font-bold">Reason:</span> {item.activeReturnRejectionReason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Return Requested: {activeReturnStatus}
                        </span>
                      )
                    ) : isReturnable && isReturnWindowActive ? (

                      <p className="text-xs text-green-700 font-medium mt-0.5">
                        Return available until {expiryDate}
                      </p>
                    ) : isReturnable && !isReturnWindowActive ? (
                      <p className="text-xs text-red-600 font-medium mt-0.5">
                        Return window expired
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 font-medium mt-0.5">
                        Non-returnable product
                      </p>
                    )}
                  </div>
                  {isReturnable && isReturnWindowActive && !activeReturnStatus && (
                    <button
                      type="button"
                      id={`btn-return-item-${item._id || idx}`}
                      onClick={() => {
                        setSelectedReturnItem(item);
                        setReturnReason("Damaged product");
                        setCustomReturnReason("");
                        setReturnError(null);
                        setShowReturnModal(true);
                      }}
                      className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all shrink-0 flex items-center gap-1.5 border border-green-600"
                    >
                      <span>↩</span> Return Product
                    </button>
                  )}

                </div>
              );
            })}
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          className="flex gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}>
          {order?.invoiceEnabled ? (
            <Link to={`/orders/${id}/invoice`} className="flex-1">
              <Button className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white">
                View Invoice
              </Button>
            </Link>
          ) : (
            <div className="flex-1">
              <Button
                className="w-full bg-gray-400 cursor-not-allowed text-white"
                disabled
                title="Invoice will be available after delivery is completed">
                Invoice Unavailable
              </Button>
            </div>
          )}
          <Link to="/orders" className="flex-1">
            <Button variant="outline" className="w-full border-gray-300">
              All Orders
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Cancel Order Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowCancelModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Cancel Order
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to cancel this order? Please provide a
                reason:
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                placeholder="Enter cancellation reason..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCancelModal(false)}>
                  Keep Order
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleCancelOrder}>
                  Cancel Order
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery Instructions Modal */}
      <AnimatePresence>
        {showInstructionsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowInstructionsModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Add Delivery Instructions
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Share details to help the delivery partner find you
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={4}
                maxLength={200}
                placeholder="e.g., Ring the bell, Leave at door, etc."
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
              />
              <p className="text-xs text-gray-500 mb-4">
                {deliveryInstructions.length}/200
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowInstructionsModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleSaveInstructions}>
                  Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Items Detail Modal */}
      <AnimatePresence>
        {showItemsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowItemsModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Order Items
              </h2>
              <div className="space-y-4">
                {order?.items?.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="flex gap-3 border-b border-gray-200 pb-4 last:border-0">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      {item.product?.mainImage ? (
                        <img
                          src={item.product.mainImage}
                          alt={
                            item.product?.name || item.productName || "Product"
                          }
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {item.product?.name || item.productName}
                      </p>
                      <p className="text-sm text-gray-500">
                        Qty: {item.quantity}
                      </p>
                      {item.variant && (
                        <p className="text-xs text-gray-500">{item.variant}</p>
                      )}
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        ₹
                        {item.total?.toFixed(0) ||
                          (item.unitPrice * item.quantity).toFixed(0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowItemsModal(false)}>
                Close
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Special Requests Modal */}
      <AnimatePresence>
        {showSpecialRequestsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowSpecialRequestsModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Add Special Requests
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Let the store know if you have any special preferences
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={4}
                maxLength={200}
                placeholder="e.g., No onions, Extra napkins, etc."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
              />
              <p className="text-xs text-gray-500 mb-4">
                {specialRequests.length}/200
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSpecialRequestsModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleSaveSpecialRequests}>
                  Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Razorpay Checkout Modal */}
      {showRazorpayCheckout && order && (
        <RazorpayCheckout
          orderId={order._id || order.id || id!}
          amount={order.totalAmount || order.total || 0}
          customerDetails={{
            name: user?.name || order.customerName || order.address?.name || "Customer",
            email: user?.email || order.customerEmail || "customer@olovely.com",
            phone: user?.phone || order.customerPhone || order.address?.phone || "9999999999",
          }}
          onSuccess={(paymentId) => {
            console.log("Payment successful:", paymentId);
            setShowRazorpayCheckout(false);
            handleRefresh();
          }}
          onFailure={(error) => {
            console.error("Payment failed:", error);
            setShowRazorpayCheckout(false);
            if (error !== "Payment cancelled by user") {
              showToast(`Payment note: ${error}`, "info");
            }
          }}
        />
      )}

      {/* Return Request Modal */}
      <AnimatePresence>
        {showReturnModal && selectedReturnItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowReturnModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>↩</span> Request Return
                </h2>
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold">
                  ✕
                </button>
              </div>

              {/* Selected Item Summary */}
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center shrink-0">
                  {selectedReturnItem.product?.mainImage ? (
                    <img src={selectedReturnItem.product.mainImage} alt="Product" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span className="text-xl">📦</span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">
                    {selectedReturnItem.product?.productName || selectedReturnItem.product?.name || selectedReturnItem.productName || "Product"}
                  </p>
                  <p className="text-xs text-gray-500">Qty: {selectedReturnItem.quantity} | Amount: ₹{(selectedReturnItem.total || (selectedReturnItem.unitPrice * selectedReturnItem.quantity) || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Reason Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Select Reason</label>
                <div className="space-y-2">
                  {[
                    "Damaged product",
                    "Wrong product received",
                    "Product not as described",
                    "Quality issue",
                    "Size / fit issue",
                    "Other",
                  ].map((reason) => (
                    <label
                      key={reason}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-sm cursor-pointer transition-colors ${
                        returnReason === reason ? "border-neutral-900 bg-neutral-50 font-medium text-neutral-900" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}>
                      <input
                        type="radio"
                        name="returnReason"
                        checked={returnReason === reason}
                        onChange={() => setReturnReason(reason)}
                        className="w-4 h-4 accent-neutral-900"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom reason text input if Other */}
              {returnReason === "Other" && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Details</label>
                  <textarea
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    rows={3}
                    placeholder="Describe the issue with this item..."
                    value={customReturnReason}
                    onChange={(e) => setCustomReturnReason(e.target.value)}
                  />
                </div>
              )}

              {/* Refund Summary Preview */}
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <span>💰</span> Expected Refund Amount: ₹{(selectedReturnItem.total || (selectedReturnItem.unitPrice * selectedReturnItem.quantity) || 0).toFixed(2)}
                </p>
                <p className="text-amber-800">
                  Refund will be settled after physical return pickup and seller receipt verification.
                </p>
              </div>

              {/* Error Banner */}
              {returnError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                  {returnError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 text-sm font-semibold border-gray-300"
                  onClick={() => setShowReturnModal(false)}
                  disabled={submittingReturn}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold"
                  disabled={submittingReturn}
                  onClick={async () => {
                    if (returnReason === "Other" && !customReturnReason.trim()) {
                      setReturnError("Please specify the reason in details field");
                      return;
                    }
                    try {
                      setSubmittingReturn(true);
                      setReturnError(null);
                      const res = await requestCustomerReturn(id!, {
                        orderItemId: selectedReturnItem._id || selectedReturnItem.id,
                        reason: returnReason === "Other" ? `Other: ${customReturnReason}` : returnReason,
                        description: customReturnReason,
                        quantity: selectedReturnItem.quantity || 1,
                      });

                      if (res.success) {
                        setShowReturnModal(false);
                        handleRefresh();
                      } else {
                        setReturnError(res.message || "Failed to submit return request");
                      }
                    } catch (err: any) {
                      setReturnError(err.response?.data?.message || err.message || "Error submitting return request");
                    } finally {
                      setSubmittingReturn(false);
                    }
                  }}>
                  {submittingReturn ? "Submitting..." : "Submit Return Request"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Details Modal */}
      <AnimatePresence>
        {showCustomerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowCustomerModal(false)}>
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 sm:pb-6 max-w-md w-full shadow-2xl space-y-4">
              
              {/* Drag Handle Indicator for Mobile */}
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <PhoneIcon className="w-4 h-4" />
                  </div>
                  <span>Contact Information</span>
                </h3>
                <button
                  onClick={() => setShowCustomerModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors font-bold text-sm">
                  ✕
                </button>
              </div>

              <div className="bg-emerald-50/50 rounded-2xl p-4 space-y-3.5 border border-emerald-100/80">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Recipient Name</span>
                  <p className="font-semibold text-gray-900 text-base mt-0.5">
                    {order.customerName || order.address?.name || "Customer"}
                  </p>
                </div>
                <div className="pt-2 border-t border-emerald-100/60">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Contact Phone Number</span>
                  <p className="font-semibold text-gray-900 text-base mt-0.5">
                    {order.customerPhone || order.address?.phone || "Not Available"}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-xs text-gray-600 flex items-start gap-2 leading-relaxed">
                <span className="text-sm">ℹ️</span>
                <p>Your delivery partner and store will use this phone number for order updates, arrival calls, and delivery OTP verification.</p>
              </div>

              <button
                onClick={() => setShowCustomerModal(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all text-center">
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery Address Modal */}
      <AnimatePresence>
        {showDeliveryAddressModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowDeliveryAddressModal(false)}>
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 sm:pb-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              
              {/* Drag Handle Indicator for Mobile */}
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <HomeIcon className="w-4 h-4" />
                  </div>
                  <span>Delivery Address</span>
                </h3>
                <button
                  onClick={() => setShowDeliveryAddressModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors font-bold text-sm">
                  ✕
                </button>
              </div>

              {(() => {
                const da = order.deliveryAddress || order.address || {};
                const formatted = formatDeliveryAddress(da);
                const lat = da.latitude;
                const lng = da.longitude;
                const mapsUrl = (lat && lng) ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null;

                return (
                  <div className="space-y-4">
                    <div className="bg-blue-50/40 rounded-2xl p-4 space-y-3 border border-blue-100/80 text-sm">
                      <div>
                        <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Complete Address</span>
                        <p className="font-semibold text-gray-900 text-sm mt-1 leading-relaxed">
                          {formatted.formatted || da.address || da.street}
                        </p>
                      </div>
                      {da.landmark && (
                        <div className="pt-2 border-t border-blue-100/60">
                          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Landmark</span>
                          <p className="font-medium text-gray-800 text-sm mt-0.5">{da.landmark}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-100/60">
                        <div>
                          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">City</span>
                          <p className="font-semibold text-gray-900">{da.city || "-"}</p>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">State</span>
                          <p className="font-semibold text-gray-900">{da.state || "-"}</p>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Pincode</span>
                          <p className="font-semibold text-gray-900">{da.pincode || "-"}</p>
                        </div>
                      </div>
                      {(lat && lng) && (
                        <div className="pt-2 border-t border-blue-100/60">
                          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Coordinates (Snapshot)</span>
                          <p className="font-mono text-xs text-gray-700 mt-0.5 font-medium">{lat}, {lng}</p>
                        </div>
                      )}
                    </div>

                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all text-center text-sm">
                        <span>📍</span> Open in Google Maps
                      </a>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Support Modal */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        orderId={id}
      />
    </div>
  );
}

