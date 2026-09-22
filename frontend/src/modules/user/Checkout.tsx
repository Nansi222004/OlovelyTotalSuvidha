import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../../context/CartContext";
import { useOrders } from "../../hooks/useOrders";
import { useLocation as useLocationContext } from "../../hooks/useLocation";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useAppSettings } from "../../context/AppSettingsContext";

// import { products } from '../../data/products'; // Removed
import { OrderAddress, Order } from "../../types/order";
import PartyPopper from "./components/PartyPopper";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "../../components/ui/sheet";
import WishlistButton from "../../components/WishlistButton";
import { useWishlistContext } from "../../context/WishlistContext";

import {
  getCoupons,
  validateCoupon,
  Coupon as ApiCoupon,
} from "../../services/api/customerCouponService";
import { appConfig } from "../../services/configService";
import {
  getAddresses,
  updateAddress,
} from "../../services/api/customerAddressService";
import GoogleMapsLocationPicker from "../../components/GoogleMapsLocationPicker";
import { getProducts } from "../../services/api/customerProductService";
import { getProfile, updateProfile } from "../../services/api/customerService";
import { calculateProductPrice } from "../../utils/priceUtils";
import RazorpayCheckout from "../../components/RazorpayCheckout";
import { getCustomerWalletBalance } from "../../services/api/customerWalletService";

// const STORAGE_KEY = 'saved_address'; // Removed

// Similar products helper removed - using API

export default function Checkout() {
  const {
    cart,
    updateQuantity,
    clearCart,
    addToCart,
    removeFromCart,
    refreshCart,
    loading: cartLoading,
  } = useCart();
  const { addOrder } = useOrders();
  const { location: userLocation } = useLocationContext();
  const { showToast: showGlobalToast } = useToast();
  const { addWishlistProduct } = useWishlistContext();
  const { user, updateUser } = useAuth();
  const { settings: appSettings } = useAppSettings();
  const navigate = useNavigate();
  const [tipAmount, setTipAmount] = useState<number | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState<number>(0);
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);
  const [savedAddress, setSavedAddress] = useState<OrderAddress | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<OrderAddress | null>(
    null,
  );
  const [savedAddressesList, setSavedAddressesList] = useState<any[]>([]);
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [showCouponSheet, setShowCouponSheet] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<ApiCoupon | null>(null);
  const [showPartyPopper, setShowPartyPopper] = useState(false);
  const [hasAppliedCouponBefore, setHasAppliedCouponBefore] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);

  // Wallet State
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [useWallet, setUseWallet] = useState<boolean>(false);

  // Fulfillment-Aware Delivery Option State (Authoritatively Instant for QC, Courier for Ecom)
  const [deliverySelections, setDeliverySelections] = useState<{
    quickCommerce: "Instant";
    ecommerce: "Courier";
  }>({
    quickCommerce: "Instant",
    ecommerce: "Courier",
  });
  const hasSkippedInitialCartRefreshRef = useRef(false);

  // Refresh cart delivery fee when selected address changes
  useEffect(() => {
    if (selectedAddress?.latitude && selectedAddress?.longitude) {
      if (!hasSkippedInitialCartRefreshRef.current) {
        hasSkippedInitialCartRefreshRef.current = true;
        return;
      }

      refreshCart(
        selectedAddress.latitude,
        selectedAddress.longitude,
        "Instant",
        { preserveItems: true },
      );
    }
  }, [selectedAddress, refreshCart]);

  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<ApiCoupon[]>([]);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatedDiscount, setValidatedDiscount] = useState<number>(0);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);

  const [showCancellationPolicy, setShowCancellationPolicy] = useState(false);
  const [giftPackaging, setGiftPackaging] = useState<boolean>(false);

  // Profile completion modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    name: "",
    email: "",
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Map Picker State
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapLocation, setMapLocation] = useState<{
    lat: number;
    lng: number;
    address?: any;
  } | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isMapSelected, setIsMapSelected] = useState(false);

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState<"Online" | "COD">(
    "Online",
  );

  // Order Processing State
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  // Razorpay Payment State
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [showRazorpayCheckout, setShowRazorpayCheckout] = useState(false);

  // Cart item removal feedback state
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const handleRemoveItem = async (productId?: string, cartItemId?: string) => {
    if (!productId) return;
    const targetKey = cartItemId || productId;
    if (removingItemId) return;
    setRemovingItemId(targetKey);
    try {
      await removeFromCart(productId, cartItemId);
    } finally {
      setRemovingItemId(null);
    }
  };

  // Stock Conflict Modal State
  const [stockConflictModal, setStockConflictModal] = useState<{
    productId: string;
    cartItemId?: string;
    productName: string;
    variantId?: string;
    variantTitle?: string;
    requestedQuantity: number;
    availableStock: number;
    isSoldOut: boolean;
    isBelowMoq?: boolean;
    wholesaleMoq?: number;
    isWholesale?: boolean;
  } | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  // Check if any cart item has stock issues
  const hasStockIssues = useMemo(() => {
    return (cart?.items || []).some((item) => {
      const isOos =
        Boolean(item.isOutOfStock) ||
        (typeof item.availableStock === "number" && item.availableStock <= 0);
      const moq = item.wholesaleMinimumQuantity || (item.product as any)?.wholesaleMinimumQuantity || 1;
      const isBelowMoq = Boolean(item.isWholesale) && typeof item.availableStock === "number" && item.availableStock < moq;
      const isInsuff =
        !isOos &&
        typeof item.availableStock === "number" &&
        item.availableStock > 0 &&
        item.quantity > item.availableStock;
      return isOos || isInsuff || isBelowMoq || Boolean(item.isStockBelowMoq);
    });
  }, [cart?.items]);

  const handleResolveStockConflictAdjust = async () => {
    if (!stockConflictModal) return;
    setIsResolvingConflict(true);
    try {
      let targetCartItemId = stockConflictModal.cartItemId;
      if (!targetCartItemId) {
        const item = cart.items.find(
          (i) => (i.product?.id === stockConflictModal.productId || (i.product as any)?._id === stockConflictModal.productId)
        );
        targetCartItemId = item?.id;
      }

      if (stockConflictModal.availableStock > 0) {
        await updateQuantity(
          stockConflictModal.productId,
          stockConflictModal.availableStock,
          stockConflictModal.variantId,
          stockConflictModal.variantTitle,
          targetCartItemId,
        );
        showGlobalToast(`Quantity adjusted to ${stockConflictModal.availableStock}`, "success");
      } else {
        await removeFromCart(stockConflictModal.productId, targetCartItemId);
        showGlobalToast("Item removed from cart", "info");
      }
      setStockConflictModal(null);

      if (selectedAddress?.latitude && selectedAddress?.longitude) {
        refreshCart(
          selectedAddress.latitude,
          selectedAddress.longitude,
          "Instant",
          { preserveItems: true },
        );
      }
    } catch (err: any) {
      showGlobalToast(err.message || "Failed to update quantity", "error");
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleResolveStockConflictRemove = async () => {
    if (!stockConflictModal) return;
    setIsResolvingConflict(true);
    try {
      let targetCartItemId = stockConflictModal.cartItemId;
      if (!targetCartItemId) {
        const item = cart.items.find(
          (i) => (i.product?.id === stockConflictModal.productId || (i.product as any)?._id === stockConflictModal.productId)
        );
        targetCartItemId = item?.id;
      }
      await removeFromCart(stockConflictModal.productId, targetCartItemId);
      showGlobalToast("Item removed from cart", "info");
      setStockConflictModal(null);

      if (selectedAddress?.latitude && selectedAddress?.longitude) {
        refreshCart(
          selectedAddress.latitude,
          selectedAddress.longitude,
          "Instant",
          { preserveItems: true },
        );
      }
    } catch (err: any) {
      showGlobalToast(err.message || "Failed to remove item", "error");
    } finally {
      setIsResolvingConflict(false);
    }
  };

  // Check if customer profile name is incomplete
  // Email is optional for Phone+OTP customers; only a valid name is required.
  const isProfileIncomplete =
    !user?.name ||
    user.name.trim() === "" ||
    user.name.trim().toLowerCase() === "user";

  // Redirect logic removed to prevent auto-redirect on refresh issues
  // Instead we will show an Empty Cart UI
  /*
  useEffect(() => {
    if (!cartLoading && cart.items.length === 0 && !showOrderSuccess) {
      navigate("/");
    }
  }, [cart.items.length, cartLoading, navigate, showOrderSuccess]);
  */

  // Load addresses and coupons
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [addressResponse, couponResponse, profileResponse] = await Promise.all([
          getAddresses(),
          getCoupons(),
          getProfile().catch(() => null),
        ]);

        if (profileResponse && profileResponse.success && profileResponse.data) {
          const pData = profileResponse.data;
          if (pData.name && pData.name.trim().toLowerCase() !== "user" && user?.name !== pData.name) {
            const safeUser: any = {
              ...user,
              id: pData.id || (pData as any)._id || user?.id,
              name: pData.name,
              phone: pData.phone || user?.phone,
              email: pData.email !== undefined ? pData.email : user?.email,
              walletAmount: pData.walletAmount !== undefined ? pData.walletAmount : user?.walletAmount,
              refCode: pData.refCode || user?.refCode,
              status: pData.status || user?.status,
              userType: user?.userType || "Customer",
            };
            updateUser(safeUser);
          }
        }

        if (
          addressResponse.success &&
          Array.isArray(addressResponse.data) &&
          addressResponse.data.length > 0
        ) {
          setSavedAddressesList(addressResponse.data);
          const defaultAddr =
            addressResponse.data.find((a: any) => a.isDefault) ||
            addressResponse.data[0];

          let bestAddressText = defaultAddr.address || "";
          
          if (userLocation?.address && userLocation.address.trim() && defaultAddr.latitude && defaultAddr.longitude) {
            bestAddressText = userLocation.address;
          }

          let flatPart = "";
          let streetPart = bestAddressText;
          if (bestAddressText && bestAddressText.includes(",")) {
            const parts = bestAddressText.split(",");
            flatPart = parts[0]?.trim() || "";
            streetPart = parts.slice(1).join(",").trim() || parts[0]?.trim();
          }

          const mappedAddress: OrderAddress = {
            name: defaultAddr.fullName,
            phone: defaultAddr.phone,
            flat: flatPart,
            street: streetPart,
            address: bestAddressText,
            city: defaultAddr.city,
            state: defaultAddr.state,
            pincode: defaultAddr.pincode,
            landmark: defaultAddr.landmark || "",
            latitude: defaultAddr.latitude,
            longitude: defaultAddr.longitude,
            id: defaultAddr._id,
            _id: defaultAddr._id,
          };
          setSavedAddress(mappedAddress);
          setSelectedAddress(mappedAddress);

          if (defaultAddr.latitude && defaultAddr.longitude) {
            setIsMapSelected(true);
          }
        } else {
          setSavedAddressesList([]);
          setSelectedAddress(null);
          setSavedAddress(null);
          setIsMapSelected(false);
        }

        if (couponResponse.success) {
          setAvailableCoupons(couponResponse.data);
        }
      } catch (error) {
        console.error("Error loading checkout data:", error);
      }
    };

    const fetchWallet = async () => {
      try {
        const res = await getCustomerWalletBalance();
        if (res.success) {
          setWalletBalance(res.data.balance || 0);
        }
      } catch (err) {
        console.error("Failed to load wallet balance", err);
      }
    };

    fetchInitialData();
    fetchWallet();
  }, []);

  // Fetch similar products dynamically
  useEffect(() => {
    const fetchSimilar = async () => {
      const items = (cart?.items || []).filter((item) => item && item.product);
      if (items.length === 0) return;

      const cartItem = items[0];
      try {
        let response;
        if (cartItem && cartItem.product) {
          // Try to fetch by category of the first item
          let catId = "";
          const product = cartItem.product;

          if (product.categoryId) {
            catId =
              typeof product.categoryId === "string"
                ? product.categoryId
                : (product.categoryId as any)._id ||
                  (product.categoryId as any).id;
          }

          if (catId) {
            response = await getProducts({ category: catId, limit: 10 });
          } else {
            response = await getProducts({ limit: 10, sort: "popular" });
          }
        } else {
          response = await getProducts({ limit: 10, sort: "popular" });
        }

        if (response && response.data) {
          // Filter out items already in cart
          const itemsInCartIds = new Set(
            (cart?.items || [])
              .map((i) => i.product?.id || i.product?._id)
              .filter(Boolean),
          );
          const filtered = response.data
            .filter((p: any) => !itemsInCartIds.has(p.id || p._id))
            .map((p: any) => {
              const { displayPrice, mrp } = calculateProductPrice(p);
              return {
                ...p,
                id: p._id || p.id,
                name: p.productName || p.name || "Product",
                imageUrl: p.mainImage || p.imageUrl || p.mainImageUrl || "",
                price: displayPrice,
                mrp: mrp,
                pack:
                  p.pack ||
                  p.variations?.[0]?.title ||
                  p.variations?.[0]?.name ||
                  "Standard",
              };
            })
            .slice(0, 6);
          setSimilarProducts(filtered);
        }
      } catch (err) {
        console.error("Failed to fetch similar products", err);
      }
    };
    fetchSimilar();
  }, [cart?.items?.length]);

  if (cartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-medium text-neutral-600">
            Loading checkout...
          </p>
        </div>
      </div>
    );
  }

  // Show Empty Cart UI if no items and not successful order
  if (cart.items.length === 0 && !showOrderSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
        <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-neutral-400">
            <path
              d="M5 8V6C5 4.34315 6.34315 3 8 3H16C17.6569 3 19 4.34315 19 6V8H21C21.5523 8 22 8.44772 22 9V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V9C2 8.44772 2.44772 8 3 8H5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M7 8V6C7 5.44772 7.44772 5 8 5H16C16.5523 5 17 5.44772 17 6V8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">
          Your cart is empty
        </h2>
        <p className="text-neutral-500 text-center mb-8 max-w-xs">
          Looks like you haven't added anything to your cart yet.
        </p>
        <button
          onClick={() => navigate("/")}
          className="bg-green-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-green-700 transition-colors">
          Start Shopping
        </button>
      </div>
    );
  }

  const displayItems = (cart?.items || []).filter(
    (item) => item && item.product,
  );
  const displayCart = {
    ...cart,
    items: displayItems,
    itemCount: displayItems.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    ),
    total: displayItems.reduce((sum, item) => {
      const { displayPrice } = calculateProductPrice(
        item.product,
        item.variant,
        item.isWholesale,
        item.wholesalePrice,
      );
      return sum + displayPrice * (item.quantity || 0);
    }, 0),
  };

  const qcItems = displayItems.filter(
    (item) => !item.product?.productType || item.product?.productType === "QUICK_COMMERCE"
  );
  const ecomItems = displayItems.filter(
    (item) => item.product?.productType === "ECOMMERCE"
  );

  const freeDeliveryThreshold =
    cart.freeDeliveryThreshold ?? appConfig.freeDeliveryThreshold;
  const isEligibleForFreeDelivery =
    freeDeliveryThreshold > 0 && (displayCart.total || 0) >= freeDeliveryThreshold;
  const amountNeededForFreeDelivery = Math.max(
    0,
    freeDeliveryThreshold - (displayCart.total || 0),
  );
  const minimumOrderValue = cart.minimumOrderValue ?? 0;
  const meetsMinimumOrder =
    minimumOrderValue <= 0 || (displayCart.total || 0) >= minimumOrderValue;
  const amountNeededForMinimumOrder = Math.max(
    0,
    minimumOrderValue - (displayCart.total || 0),
  );
  const cartItem = displayItems[0];

  /* DEBUG: Display Backend Configuration */
  const dbgConfig = (cart as any).debug_config;

  const itemsTotal = displayItems.reduce((sum, item) => {
    if (!item?.product) return sum;
    const { mrp } = calculateProductPrice(
      item.product,
      item.variant,
      item.isWholesale,
      item.wholesalePrice,
    );
    return sum + mrp * (item.quantity || 0);
  }, 0);

  const discountedTotal = displayCart.total;
  const savedAmount = itemsTotal - discountedTotal;
  const handlingCharge = cart.platformFee ?? appConfig.platformFee;
  const deliveryCharge = isEligibleForFreeDelivery
    ? 0
    : (cart.estimatedDeliveryFee !== undefined ? cart.estimatedDeliveryFee : appConfig.deliveryFee);

  // Recalculate or use validated discount
  // If we have a selected coupon, we should re-validate if cart total changes,
  // but for simplicity, we'll re-calculate locally if possible or trust the previous validation if acceptable (better to re-validate)
  // BUSINESS RULE: Coupon applies strictly to PRODUCT SUBTOTAL (discountedTotal)
  // Delivery fee, handling/platform fee, tip, and gift packaging fees are NOT eligible for coupon discount.
  const productSubtotalForCoupon = discountedTotal;

  // Local calculation for immediate feedback, relying on backend validation on Apply
  let currentCouponDiscount = 0;
  if (selectedCoupon) {
    // Logic mirrors backend for UI update purposes
    if (
      selectedCoupon.minOrderValue &&
      productSubtotalForCoupon < selectedCoupon.minOrderValue
    ) {
      // Invalid now
    } else {
      if (selectedCoupon.discountType === "percentage") {
        currentCouponDiscount = Math.round(
          (productSubtotalForCoupon * selectedCoupon.discountValue) / 100,
        );
        if (
          selectedCoupon.maxDiscountAmount &&
          currentCouponDiscount > selectedCoupon.maxDiscountAmount
        ) {
          currentCouponDiscount = selectedCoupon.maxDiscountAmount;
        }
      } else {
        currentCouponDiscount = Math.min(
          selectedCoupon.discountValue,
          productSubtotalForCoupon,
        );
      }
    }
  }

  // Calculate tip amount (use custom tip if custom tip input is shown, otherwise use selected tip)
  const finalTipAmount = showCustomTipInput ? customTipAmount : tipAmount || 0;
  const giftPackagingPrice = (cart as any)?.giftPackagingFee ?? 30;
  const giftPackagingFee = giftPackaging ? giftPackagingPrice : 0;
  const grandTotal = Math.max(
    0,
    discountedTotal -
      currentCouponDiscount +
      handlingCharge +
      deliveryCharge +
      finalTipAmount +
      giftPackagingFee,
  );
  const walletDeduction = useWallet ? Math.min(walletBalance, grandTotal) : 0;
  const finalPayable = Math.max(0, grandTotal - walletDeduction);

  const handleApplyCoupon = async (coupon: ApiCoupon) => {
    setIsValidatingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(coupon.code, productSubtotalForCoupon);
      if (result.success && result.data?.isValid) {
        const isFirstTime = !hasAppliedCouponBefore;
        setSelectedCoupon(coupon);
        setValidatedDiscount(result.data.discountAmount);
        setShowCouponSheet(false);
        if (isFirstTime) {
          setHasAppliedCouponBefore(true);
          setShowPartyPopper(true);
        }
      } else {
        setCouponError(result.message || "Invalid coupon");
      }
    } catch (err: any) {
      setCouponError(err.response?.data?.message || "Failed to apply coupon");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setSelectedCoupon(null);
    setValidatedDiscount(0);
    setCouponError(null);
  };

  const handleMoveToWishlist = async (product: any) => {
    if (!product?.id && !product?._id) return;

    const productId = product.id || product._id;

    try {
      if (!userLocation?.latitude || !userLocation?.longitude) {
        showGlobalToast(
          "Location is required to move items to wishlist",
          "error",
        );
        return;
      }

      // Add to wishlist via context for synchronized state
      await addWishlistProduct(productId);
      // Remove from cart
      await removeFromCart(productId);
      // Show success message
      showGlobalToast("Item moved to wishlist");
    } catch (error: any) {
      console.error("Failed to move to wishlist:", error);
      const msg =
        error.response?.data?.message || "Failed to move item to wishlist";
      showGlobalToast(msg, "error");
    }
  };

  const handlePlaceOrder = async (arg?: any) => {
    // Only bypass if explicitly passed true (handles event objects from onClick)
    const bypassProfileCheck = arg === true;

    if (!selectedAddress || cart.items.length === 0) {
      return;
    }

    // Stock availability pre-check
    if (hasStockIssues) {
      const conflictItem = cart.items.find((item) => {
        const isOos =
          Boolean(item.isOutOfStock) ||
          (typeof item.availableStock === "number" && item.availableStock <= 0);
        const moq = item.wholesaleMinimumQuantity || (item.product as any)?.wholesaleMinimumQuantity || 1;
        const isBelowMoq = Boolean(item.isWholesale) && typeof item.availableStock === "number" && item.availableStock < moq;
        const isInsuff =
          !isOos &&
          typeof item.availableStock === "number" &&
          item.availableStock > 0 &&
          item.quantity > item.availableStock;
        return isOos || isInsuff || isBelowMoq || Boolean(item.isStockBelowMoq);
      });

      if (conflictItem) {
        const moq = conflictItem.wholesaleMinimumQuantity || (conflictItem.product as any)?.wholesaleMinimumQuantity || 1;
        const isItemWholesale = Boolean(conflictItem.isWholesale);
        const isBelowMoq = isItemWholesale && typeof conflictItem.availableStock === "number" && conflictItem.availableStock < moq;
        setStockConflictModal({
          productId: conflictItem.product?.id || (conflictItem.product as any)?._id || "",
          cartItemId: conflictItem.id,
          productName: conflictItem.product?.name || "Product",
          variantId: conflictItem.variant?.id || (conflictItem.product as any)?.variantId || (typeof conflictItem.variant === 'string' ? conflictItem.variant : undefined),
          variantTitle: conflictItem.variant?.title || conflictItem.variantTitle || (conflictItem.product as any)?.variantTitle,
          requestedQuantity: conflictItem.quantity,
          availableStock: conflictItem.availableStock ?? 0,
          isSoldOut: Boolean(conflictItem.isOutOfStock) || (conflictItem.availableStock ?? 0) <= 0,
          isBelowMoq: Boolean(isBelowMoq || conflictItem.isStockBelowMoq),
          wholesaleMoq: moq,
          isWholesale: isItemWholesale,
        });
      } else {
        showGlobalToast("Please resolve stock conflicts before placing your order.", "error");
      }
      return;
    }

    if (!meetsMinimumOrder) {
      showGlobalToast(
        `Minimum order value is ₹${minimumOrderValue}. Please add ₹${amountNeededForMinimumOrder.toLocaleString("en-IN")} more.`,
        "error",
      );
      return;
    }

    // Check if user needs to complete their profile name first
    if (!bypassProfileCheck && isProfileIncomplete) {
      const existingName =
        user?.name && user.name.trim().toLowerCase() !== "user"
          ? user.name
          : selectedAddress?.name && selectedAddress.name.trim().toLowerCase() !== "user"
            ? selectedAddress.name
            : "";

      const existingEmail =
        user?.email && !user.email.endsWith("@olovely.temp")
          ? user.email
          : "";

      setProfileFormData({
        name: existingName,
        email: existingEmail,
      });
      setProfileError(null);
      setShowProfileModal(true);
      return;
    }

    // Validate required address fields
    const hasValidAddress =
      selectedAddress &&
      selectedAddress.name?.trim() &&
      selectedAddress.phone?.trim() &&
      selectedAddress.city?.trim() &&
      selectedAddress.pincode?.trim() &&
      (selectedAddress.flat?.trim() || selectedAddress.address?.trim() || selectedAddress.street?.trim());

    if (!hasValidAddress) {
      console.error("Address is missing required fields");
      showGlobalToast("Please complete your delivery address before placing order.", "error");
      navigate("/checkout/address", { state: { editAddress: selectedAddress, returnTo: "/checkout" } });
      return;
    }

    // Use user's current location as fallback if address doesn't have coordinates
    const finalLatitude = selectedAddress.latitude ?? userLocation?.latitude;
    const finalLongitude = selectedAddress.longitude ?? userLocation?.longitude;

    const hasQcItems = cart.items.some(
      (i) => !i.product?.productType || i.product?.productType === "QUICK_COMMERCE"
    );

    // Validate that we have location data for Quick Commerce
    if (hasQcItems && (finalLatitude == null || finalLongitude == null)) {
      console.error(
        "Address is missing location data (latitude/longitude) and user location is not available",
      );
      showGlobalToast(
        "Location is required for Quick Commerce delivery. Please ensure your address has location data or enable location access.",
        "error"
      );
      return;
    }

    // Create address object with location data (use fallback if needed)
    const addressWithLocation: OrderAddress = {
      ...selectedAddress,
      latitude: finalLatitude,
      longitude: finalLongitude,
    };

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const order: Order = {
      id: orderId,
      items: cart.items,
      totalItems: cart.itemCount || 0,
      subtotal: discountedTotal,
      fees: {
        platformFee: handlingCharge,
        deliveryFee: deliveryCharge,
      },
      totalAmount: grandTotal,
      address: addressWithLocation,
      paymentMethod: walletDeduction === grandTotal ? "Wallet" : paymentMethod,
      status: (paymentMethod === "COD" || walletDeduction === grandTotal) ? "Received" : "Pending",
      createdAt: new Date().toISOString(),
      tipAmount: finalTipAmount,

      couponCode: selectedCoupon?.code || undefined,
      giftPackaging: giftPackaging,
      deliveryOption: qcItems.length > 0 ? "Instant" : "Courier",
      deliverySelections: {
        ...(qcItems.length > 0 ? { quickCommerce: "Instant" } : {}),
        ...(ecomItems.length > 0 ? { ecommerce: "Courier" } : {}),
      },
      useWallet: useWallet && walletDeduction > 0,
      walletAmountUsed: walletDeduction,
    };

    setIsProcessingOrder(true);
    try {
      // Create the order
      const placedId = await addOrder(order);
      if (placedId) {
        if (paymentMethod === "COD" || finalPayable === 0 || (useWallet && walletDeduction >= grandTotal)) {
          // For COD or 100% Wallet paid, proceed directly to success
          setPlacedOrderId(placedId);
          clearCart();
          setShowOrderSuccess(true);
          showGlobalToast("Order placed successfully!", "success");
        } else {
          // For Online with remaining payable, trigger Razorpay payment
          setPendingOrderId(placedId);
          setShowRazorpayCheckout(true);
        }
        // Note: For Online payment, the cart will be cleared and success shown only after successful payment
        // See the RazorpayCheckout onSuccess handler (lines 1840-1846)
      }
    } catch (error: any) {
      console.error("Order placement failed", error);
      let stockConflict = error.stockConflict || error.response?.data?.stockConflict;

      const isStockIssue =
        Boolean(stockConflict) ||
        error.errorCode === "INSUFFICIENT_STOCK" ||
        error.errorCode === "OUT_OF_STOCK" ||
        error.response?.data?.errorCode === "INSUFFICIENT_STOCK" ||
        error.response?.data?.errorCode === "OUT_OF_STOCK" ||
        (typeof error.message === "string" && (
          error.message.toLowerCase().includes("insufficient stock") ||
          error.message.toLowerCase().includes("out of stock") ||
          error.message.toLowerCase().includes("sold out") ||
          error.message.toLowerCase().includes("wholesale minimum order quantity") ||
          error.message.toLowerCase().includes("below wholesale minimum")
        ));

      if (isStockIssue) {
        const conflictProdId = (stockConflict?.productId || "").toString();
        const conflictVarId = (stockConflict?.variantId || stockConflict?.variationId || "").toString();
        const conflictVarTitle = (stockConflict?.variantTitle || "").toString().toLowerCase().trim();

        // 1. Try to find matching item in cart
        let matchingItem = cart.items.find((item) => {
          const itemProdId = (item.product?.id || (item.product as any)?._id || "").toString();
          if (conflictProdId && itemProdId !== conflictProdId) return false;

          if (!conflictVarId && !conflictVarTitle) return true;

          const itemVarId = (
            (typeof item.variant === "string" ? item.variant : item.variant?.id || (item.variant as any)?._id) ||
            (item as any).variationId ||
            (item as any).variation ||
            (item.product as any)?.variantId
          )?.toString();

          const itemVarTitle = (item.variantTitle || item.variant?.title || (item.product as any)?.variantTitle || "")
            ?.toString()
            .toLowerCase()
            .trim();

          if (conflictVarId && itemVarId && itemVarId === conflictVarId) return true;
          if (conflictVarTitle && itemVarTitle && (itemVarTitle.includes(conflictVarTitle) || conflictVarTitle.includes(itemVarTitle))) return true;

          return !conflictVarId && !conflictVarTitle;
        });

        // 2. Fallback: match by product ID alone
        if (!matchingItem && conflictProdId) {
          matchingItem = cart.items.find((item) => {
            const itemProdId = (item.product?.id || (item.product as any)?._id || "").toString();
            return itemProdId === conflictProdId;
          });
        }

        // 3. Fallback: match first item in cart with a known stock issue
        if (!matchingItem) {
          matchingItem = cart.items.find((item) => {
            const isOos = Boolean(item.isOutOfStock) || (typeof item.availableStock === "number" && item.availableStock <= 0);
            const moq = item.wholesaleMinimumQuantity || (item.product as any)?.wholesaleMinimumQuantity || 1;
            const isBelowMoq = Boolean(item.isWholesale) && typeof item.availableStock === "number" && item.availableStock < moq;
            const isInsuff = !isOos && typeof item.availableStock === "number" && item.availableStock > 0 && item.quantity > item.availableStock;
            return isOos || isInsuff || isBelowMoq || Boolean(item.isStockBelowMoq);
          });
        }

        const isItemWholesale = Boolean(
          matchingItem?.isWholesale ||
          stockConflict?.isWholesale ||
          stockConflict?.isBelowMoq ||
          Boolean(stockConflict?.wholesaleMoq)
        );

        const moq =
          stockConflict?.wholesaleMoq ||
          matchingItem?.wholesaleMinimumQuantity ||
          (matchingItem?.product as any)?.wholesaleMinimumQuantity ||
          1;

        const availableStock = typeof stockConflict?.availableStock === "number"
          ? stockConflict.availableStock
          : (typeof matchingItem?.availableStock === "number" ? matchingItem.availableStock : 0);

        const isBelowMoq = Boolean(
          stockConflict?.isBelowMoq ||
          (isItemWholesale && availableStock < moq)
        );

        setStockConflictModal({
          productId: stockConflict?.productId || matchingItem?.product?.id || (matchingItem?.product as any)?._id || "",
          cartItemId: matchingItem?.id,
          productName: stockConflict?.productName || matchingItem?.product?.name || "Product",
          variantId: stockConflict?.variantId || stockConflict?.variationId || matchingItem?.variant?.id || (matchingItem?.product as any)?.variantId,
          variantTitle: stockConflict?.variantTitle || matchingItem?.variantTitle || matchingItem?.variant?.title || (matchingItem?.product as any)?.variantTitle,
          requestedQuantity: stockConflict?.requestedQuantity || matchingItem?.quantity || 1,
          availableStock: availableStock,
          isSoldOut: Boolean(stockConflict?.isSoldOut) || availableStock <= 0,
          isBelowMoq: isBelowMoq,
          wholesaleMoq: moq,
          isWholesale: isItemWholesale,
        });

        if (selectedAddress?.latitude && selectedAddress?.longitude) {
          refreshCart(
            selectedAddress.latitude,
            selectedAddress.longitude,
            "Instant",
            { preserveItems: true },
          );
        }
        return;
      }

      // Show user-friendly error message for non-stock errors
      const errorMessage =
        error.message ||
        error.response?.data?.message ||
        "Failed to place order. Please try again.";
      showGlobalToast(errorMessage, "error");
    } finally {
      setIsProcessingOrder(false);
    }
  };

  const handleGoToOrders = () => {
    if (placedOrderId) {
      navigate(`/orders/${placedOrderId}`);
    } else {
      navigate("/orders");
    }
  };

  const handleUpdateLocation = async () => {
    if (!mapLocation) return;
    
    setIsUpdatingLocation(true);
    try {
      // Prepare update payload
      const updatePayload: any = {
        latitude: mapLocation.lat,
        longitude: mapLocation.lng,
      };

      // If address details are available from map, update them too
      if (mapLocation.address) {
        // Prefer full formattedAddress over just street component
        const bestAddress = (mapLocation.address as any).formattedAddress || mapLocation.address.street;
        if (bestAddress) updatePayload.address = bestAddress;
        if (mapLocation.address.city) updatePayload.city = mapLocation.address.city;
        if (mapLocation.address.state) updatePayload.state = mapLocation.address.state;
        if (mapLocation.address.pincode) updatePayload.pincode = mapLocation.address.pincode;
        if (mapLocation.address.landmark) updatePayload.landmark = mapLocation.address.landmark;
      }

      // If user has an existing address, update it
      if (selectedAddress?.id) {
        await updateAddress(selectedAddress.id, updatePayload);

        // Update local state
        const bestAddrText = (mapLocation.address as any)?.formattedAddress || mapLocation.address?.street || selectedAddress.street;
        const updated = {
          ...selectedAddress,
          latitude: mapLocation.lat,
          longitude: mapLocation.lng,
          street: bestAddrText,
          city: mapLocation.address?.city || selectedAddress.city,
          state: mapLocation.address?.state || selectedAddress.state,
          pincode: mapLocation.address?.pincode || selectedAddress.pincode,
          landmark: mapLocation.address?.landmark || selectedAddress.landmark,
        };
        setSelectedAddress(updated);
        setSavedAddress(updated); // Sync
      } else {
        // User does not have a saved address yet.
        // Close map picker and navigate to dedicated Add Delivery Address page
        // with the chosen location and geocoded address pre-filled!
        setShowMapPicker(false);
        setIsUpdatingLocation(false);
        const bestAddress = (mapLocation.address as any)?.formattedAddress || mapLocation.address?.street || "";
        navigate("/checkout/address", {
          state: {
            initialLocation: {
              latitude: mapLocation.lat,
              longitude: mapLocation.lng,
              street: bestAddress,
              city: mapLocation.address?.city || "",
              state: mapLocation.address?.state || "",
              pincode: mapLocation.address?.pincode || "",
              landmark: mapLocation.address?.landmark || "",
            },
            returnTo: "/checkout",
          },
        });
        return;
      }
      
      setShowMapPicker(false);
      setIsMapSelected(true); // Mark map as selected
      showGlobalToast("Location and address updated successfully!");
    } catch (err: any) {
      console.error(err);
      showGlobalToast(
        err.response?.data?.message || "Failed to update location",
        "error",
      );
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // Handle profile completion submission
  const handleProfileSubmit = async () => {
    const trimmedName = profileFormData.name.trim();
    const trimmedEmail = profileFormData.email.trim();

    if (!trimmedName) {
      setProfileError("Please enter your full name");
      return;
    }

    // Validate email format ONLY if customer provided an email
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setProfileError("Please enter a valid email address");
        return;
      }
    }

    setIsUpdatingProfile(true);
    setProfileError(null);

    try {
      const payload: { name: string; email?: string } = { name: trimmedName };
      if (trimmedEmail) {
        payload.email = trimmedEmail;
      }

      const response = await updateProfile(payload);

      if (response && response.success && response.data) {
        const pData = response.data;
        // Update local user data in AuthContext
        const safeUser: any = {
          ...user,
          id: pData.id || (pData as any)._id || user?.id,
          name: pData.name || trimmedName,
          phone: pData.phone || user?.phone,
          email: pData.email !== undefined ? pData.email : user?.email,
          walletAmount: pData.walletAmount !== undefined ? pData.walletAmount : user?.walletAmount,
          refCode: pData.refCode || user?.refCode,
          status: pData.status || user?.status,
          userType: user?.userType || "Customer",
        };
        updateUser(safeUser);

        setShowProfileModal(false);
        showGlobalToast("Profile updated successfully!");

        // Directly trigger order placement, bypassing the profile check
        handlePlaceOrder(true);
      } else {
        setProfileError(response?.message || "Failed to update profile");
      }
    } catch (error: any) {
      setProfileError(
        error.response?.data?.message ||
          error.message ||
          "Failed to update profile. Please try again.",
      );
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div className="bg-white min-h-screen flex flex-col pb-28 sm:pb-32">
      {/* Party Popper Animation */}
      <PartyPopper
        show={showPartyPopper}
        onComplete={() => setShowPartyPopper(false)}
      />

      {/* Stock Conflict Modal */}
      <AnimatePresence>
        {stockConflictModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => !isResolvingConflict && setStockConflictModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-neutral-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    stockConflictModal.isBelowMoq || stockConflictModal.availableStock <= 0 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 leading-tight">
                      {stockConflictModal.isBelowMoq
                        ? "Wholesale Stock Unavailable"
                        : stockConflictModal.availableStock <= 0
                        ? "Item Out of Stock"
                        : "Stock Quantity Limited"}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {stockConflictModal.isBelowMoq ? "Wholesale minimum quantity cannot be met" : "Inventory update required to continue"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isResolvingConflict}
                  onClick={() => setStockConflictModal(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-200/80 mb-4 space-y-1.5">
                <div className="font-semibold text-sm text-neutral-900 leading-snug">
                  {stockConflictModal.productName}
                </div>
                {stockConflictModal.variantTitle && (
                  <div className="inline-block text-[11px] font-semibold text-neutral-600 bg-white border border-neutral-200 px-2 py-0.5 rounded-md">
                    Variant: {stockConflictModal.variantTitle}
                  </div>
                )}
                <div className="text-xs text-neutral-600 flex items-center justify-between pt-1 border-t border-neutral-200/60 mt-1.5">
                  <span>Requested in cart: <strong className="text-neutral-900">{stockConflictModal.requestedQuantity}</strong></span>
                  <span>Available stock: <strong className={stockConflictModal.isBelowMoq || stockConflictModal.availableStock <= 0 ? "text-rose-600" : "text-amber-600"}>{stockConflictModal.availableStock}</strong></span>
                </div>
                {stockConflictModal.isBelowMoq && stockConflictModal.wholesaleMoq && (
                  <div className="text-xs text-purple-700 bg-purple-50 border border-purple-200 px-2 py-1 rounded font-semibold flex items-center justify-between">
                    <span>Wholesale MOQ:</span>
                    <span>{stockConflictModal.wholesaleMoq} units</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-neutral-600 mb-5 leading-relaxed">
                {stockConflictModal.isBelowMoq
                  ? `Only ${stockConflictModal.availableStock} units of ${stockConflictModal.productName}${stockConflictModal.variantTitle ? ` (${stockConflictModal.variantTitle})` : ''} are currently available, but the minimum wholesale order quantity is ${stockConflictModal.wholesaleMoq}. Please remove this item from your cart to continue.`
                  : stockConflictModal.availableStock > 0
                  ? `Only ${stockConflictModal.availableStock} unit(s) of ${stockConflictModal.productName}${stockConflictModal.variantTitle ? ` (${stockConflictModal.variantTitle})` : ''} are currently available. Would you like to adjust your cart quantity to ${stockConflictModal.availableStock}?`
                  : `This item is currently sold out and cannot be fulfilled. Please remove it from your cart to proceed with your remaining items.`}
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5">
                {stockConflictModal.availableStock > 0 && !stockConflictModal.isBelowMoq ? (
                  <>
                    <button
                      type="button"
                      disabled={isResolvingConflict}
                      onClick={handleResolveStockConflictAdjust}
                      className="flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-sm active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isResolvingConflict ? "Updating..." : `Adjust to ${stockConflictModal.availableStock} items`}
                    </button>
                    <button
                      type="button"
                      disabled={isResolvingConflict}
                      onClick={handleResolveStockConflictRemove}
                      className="py-2.5 px-3 text-xs sm:text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors active:scale-98 text-center cursor-pointer border border-rose-200"
                    >
                      Remove Item
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isResolvingConflict}
                    onClick={handleResolveStockConflictRemove}
                    className="flex-1 py-2.5 px-4 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-sm active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isResolvingConflict ? "Removing..." : "Remove Item from Cart"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={isResolvingConflict}
                  onClick={() => {
                    setStockConflictModal(null);
                    navigate("/cart");
                  }}
                  className="py-2.5 px-4 text-xs sm:text-sm font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors active:scale-98 text-center cursor-pointer"
                >
                  Review Cart
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Completion Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowProfileModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-neutral-900 mb-1">
                Complete Your Profile
              </h2>
              <p className="text-xs text-neutral-600 mb-4">
                Please provide your name to continue with your order.
              </p>

              <div className="space-y-3">
                {/* Registered Phone (Read-Only) */}
                {(user?.phone || selectedAddress?.phone) && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={user?.phone || selectedAddress?.phone || ""}
                        disabled
                        readOnly
                        className="w-full px-3 py-2 text-sm bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-500 font-medium cursor-not-allowed select-none"
                      />
                      <span className="absolute right-3 top-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Verified
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileFormData.name}
                    onChange={(e) =>
                      setProfileFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Enter your full name"
                    className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-green-500 transition-colors"
                    disabled={isUpdatingProfile}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Email Address <span className="text-neutral-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={profileFormData.email}
                    onChange={(e) =>
                      setProfileFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="Enter your email (optional)"
                    className="w-full px-3 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-green-500 transition-colors"
                    disabled={isUpdatingProfile}
                  />
                </div>

                {profileError && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    {profileError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="flex-1 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer"
                    disabled={isUpdatingProfile}>
                    Cancel
                  </button>
                  <button
                    onClick={handleProfileSubmit}
                    disabled={
                      isUpdatingProfile ||
                      !profileFormData.name.trim()
                    }
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                      isUpdatingProfile ||
                      !profileFormData.name.trim()
                        ? "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}>
                    {isUpdatingProfile ? "Saving..." : "Save & Continue"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Picker Modal */}
      <AnimatePresence>
        {showMapPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowMapPicker(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl overflow-hidden w-full max-w-lg shadow-xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-neutral-900">
                  Pin Delivery Location
                </h3>
                <button onClick={() => setShowMapPicker(false)}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <GoogleMapsLocationPicker
                initialLat={
                  mapLocation?.lat ||
                  userLocation?.latitude ||
                  selectedAddress?.latitude ||
                  0
                }
                initialLng={
                  mapLocation?.lng ||
                  userLocation?.longitude ||
                  selectedAddress?.longitude ||
                  0
                }
                onLocationSelect={(lat, lng, address) =>
                  setMapLocation({ lat, lng, address })
                }
                height="300px"
              />

              <div className="p-4 bg-white border-t">
                <p className="text-xs text-neutral-500 mb-3 text-center">
                  Move the map to set your exact delivery location
                </p>
                <button
                  onClick={handleUpdateLocation}
                  disabled={isUpdatingLocation}
                  className="w-full py-3 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-70 flex justify-center items-center gap-2">
                  {isUpdatingLocation ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Updating...
                    </>
                  ) : (
                    "Confirm Location"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Addresses Selection Sheet */}
      <AnimatePresence>
        {showAddressSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowAddressSheet(false)}>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b flex items-center justify-between bg-white">
                <div>
                  <h3 className="font-bold text-sm text-neutral-900">Select Delivery Address</h3>
                  <p className="text-[11px] text-neutral-500">Choose from your saved addresses</p>
                </div>
                <button
                  onClick={() => setShowAddressSheet(false)}
                  className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:bg-neutral-100 rounded-full font-bold">
                  ✕
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-3 flex-1">
                {savedAddressesList.map((addr) => {
                  const isSelected = (selectedAddress?.id || selectedAddress?._id) === (addr._id || addr.id);
                  let flatPart = "";
                  let streetPart = addr.address || "";
                  if (addr.address && addr.address.includes(",")) {
                    const parts = addr.address.split(",");
                    flatPart = parts[0]?.trim() || "";
                    streetPart = parts.slice(1).join(",").trim() || parts[0]?.trim();
                  }

                  return (
                    <div
                      key={addr._id || addr.id}
                      onClick={() => {
                        const mapped: OrderAddress = {
                          name: addr.fullName,
                          phone: addr.phone,
                          flat: flatPart,
                          street: streetPart,
                          address: addr.address,
                          city: addr.city,
                          state: addr.state,
                          pincode: addr.pincode,
                          landmark: addr.landmark || "",
                          latitude: addr.latitude,
                          longitude: addr.longitude,
                          id: addr._id,
                          _id: addr._id,
                        };
                        setSelectedAddress(mapped);
                        setSavedAddress(mapped);
                        if (addr.latitude && addr.longitude) {
                          setIsMapSelected(true);
                        }
                        setShowAddressSheet(false);
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-600"
                          : "border-neutral-200 hover:border-neutral-300 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={isSelected}
                            readOnly
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-xs font-bold text-neutral-900">{addr.fullName}</span>
                          <span className="text-[10px] font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded uppercase">
                            {addr.type || "Home"}
                          </span>
                        </div>
                        {addr.phone && (
                          <span className="text-[11px] text-neutral-500 font-medium">📱 {addr.phone}</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-600 mt-2 pl-6">
                        {addr.address}, {addr.city} - {addr.pincode}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t bg-neutral-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddressSheet(false);
                    navigate("/checkout/address", { state: { returnTo: "/checkout" } });
                  }}
                  className="w-full py-3 bg-white border border-emerald-600 text-emerald-700 font-bold rounded-xl text-xs hover:bg-emerald-50 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <span>➕ Add New Delivery Address</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Success Celebration Page */}
      {showOrderSuccess && (
        <div
          className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center h-screen w-screen overflow-hidden"
          style={{ animation: "fadeIn 0.3s ease-out" }}>
          {/* Confetti Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Animated confetti pieces */}
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  backgroundColor: [
                    "#22c55e",
                    "#3b82f6",
                    "#f59e0b",
                    "#ef4444",
                    "#8b5cf6",
                    "#ec4899",
                  ][Math.floor(Math.random() * 6)],
                  animation: `confettiFall ${2 + Math.random() * 2}s linear ${Math.random() * 2}s infinite`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>

          {/* Success Content */}
          <div className="relative z-10 flex flex-col items-center px-6">
            {/* Success Tick Circle */}
            <div
              className="relative mb-8"
              style={{
                animation:
                  "scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both",
              }}>
              {/* Outer ring animation */}
              <div
                className="absolute inset-0 w-32 h-32 rounded-full border-4 border-green-500"
                style={{
                  animation: "ringPulse 1.5s ease-out infinite",
                  opacity: 0.3,
                }}
              />
              {/* Main circle */}
              <div className="w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-2xl">
                <svg
                  className="w-16 h-16 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: "checkDraw 0.5s ease-out 0.5s both" }}>
                  <path d="M5 12l5 5L19 7" className="check-path" />
                </svg>
              </div>
              {/* Sparkles */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    top: "50%",
                    left: "50%",
                    animation: `sparkle 0.6s ease-out ${0.3 + i * 0.1}s both`,
                    transform: `rotate(${i * 60}deg) translateY(-80px)`,
                  }}
                />
              ))}
            </div>

            {/* Location Info */}
            <div
              className="text-center"
              style={{ animation: "slideUp 0.5s ease-out 0.6s both" }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-5 h-5 text-red-500">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedAddress?.city || "Your Location"}
                </h2>
              </div>
              <p className="text-gray-500 text-base">
                {selectedAddress
                  ? `${selectedAddress.street}, ${selectedAddress.city}`
                  : "Delivery Address"}
              </p>
            </div>

            {/* Order Placed Message */}
            <div
              className="mt-12 text-center"
              style={{ animation: "slideUp 0.5s ease-out 0.8s both" }}>
              <h3 className="text-3xl font-bold text-green-600 mb-2">
                Order Placed!
              </h3>
              <p className="text-gray-600">Your order is on the way</p>
            </div>

            {/* Action Button */}
            <button
              onClick={handleGoToOrders}
              className="mt-10 bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-12 rounded-xl shadow-lg transition-all hover:shadow-xl hover:scale-105"
              style={{ animation: "slideUp 0.5s ease-out 1s both" }}>
              Track Your Order
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-neutral-200">
        <div className="px-4 md:px-6 lg:px-8 py-2 md:py-3 flex items-center justify-between">
          {/* Back Arrow */}
          <button
            onClick={() => navigate(-1)}
            className="w-7 h-7 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
            aria-label="Go back">
            <svg
              width="18"
              height="18"
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

          {/* Title */}
          <h1 className="text-base font-bold text-neutral-900">Checkout</h1>

          {/* Spacer to maintain layout */}
          <div className="w-7 h-7"></div>
        </div>
      </div>

      {/* Saved Address Section */}
      <div className="px-4 md:px-6 lg:px-8 py-3 md:py-4 border-b border-neutral-200 bg-white">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base">📍</span>
            <div>
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                Delivery Address
              </h3>
              <p className="text-[10px] text-neutral-500">
                {selectedAddress ? "Delivering to your selected address" : "Add address with complete flat/house details"}
              </p>
            </div>
          </div>
          {savedAddressesList.length > 1 && (
            <button
              type="button"
              onClick={() => setShowAddressSheet(true)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              Change Address
            </button>
          )}
        </div>

        {selectedAddress ? (
          <div className="bg-neutral-50/80 rounded-2xl p-3.5 border border-neutral-200 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-neutral-900">
                    {selectedAddress.name || "Recipient"}
                  </span>
                  {selectedAddress.phone && (
                    <span className="text-[11px] font-medium text-neutral-600 bg-white px-2 py-0.5 rounded-md border border-neutral-200">
                      📱 +91 {selectedAddress.phone}
                    </span>
                  )}
                  <span className="text-[10px] font-bold bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded-md uppercase">
                    {(selectedAddress as any).type || "Home"}
                  </span>
                </div>
                <p className="text-xs text-neutral-700 leading-relaxed font-normal">
                  {selectedAddress.flat ? `${selectedAddress.flat}, ` : ""}
                  {selectedAddress.street}
                  {selectedAddress.landmark ? `, Landmark: ${selectedAddress.landmark}` : ""}
                  {selectedAddress.city ? `, ${selectedAddress.city}` : ""}
                  {selectedAddress.state ? `, ${selectedAddress.state}` : ""}
                  {selectedAddress.pincode ? ` - ${selectedAddress.pincode}` : ""}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    navigate("/checkout/address", {
                      state: { editAddress: selectedAddress, returnTo: "/checkout" },
                    })
                  }
                  className="px-2.5 py-1 text-[11px] font-bold text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>

            {/* Location pin status / update button */}
            <div className="pt-2 border-t border-neutral-200/80 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] text-neutral-600 font-medium">
                  {isMapSelected || (selectedAddress.latitude && selectedAddress.longitude)
                    ? "Precise delivery coordinates active"
                    : "Approximate location"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMapLocation({
                    lat: selectedAddress?.latitude || userLocation?.latitude || 0,
                    lng: selectedAddress?.longitude || userLocation?.longitude || 0,
                  });
                  setShowMapPicker(true);
                }}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
              >
                <span>🗺️ Adjust Pin on Map</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center text-lg">
              📍
            </div>
            <div>
              <h4 className="text-sm font-bold text-neutral-900">No Delivery Address Found</h4>
              <p className="text-xs text-neutral-600 max-w-sm mx-auto mt-0.5">
                Please add your complete delivery address with flat, building, and street details to proceed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/checkout/address", { state: { returnTo: "/checkout" } })}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-xs inline-flex items-center gap-2"
            >
              <span>➕ Add Delivery Address</span>
            </button>
          </div>
        )}
      </div>

      {/* Grouped Fulfillment Cards */}
      <div className="px-3.5 sm:px-4 md:px-6 lg:px-8 py-2.5 md:py-3 bg-white border-b border-neutral-200 space-y-3.5">
        {/* Multi-Shipment Order Notice */}
        {qcItems.length > 0 && ecomItems.length > 0 && (
          <div className="px-3.5 py-2 bg-neutral-50 border border-neutral-200/70 rounded-xl flex items-center gap-2 text-neutral-600">
            <span className="text-sm flex-shrink-0">📦</span>
            <span className="text-xs text-neutral-600">
              <strong className="font-medium text-neutral-800">Notice:</strong> Your items may arrive separately.
            </span>
          </div>
        )}

        {/* Quick Commerce Basket */}
        {qcItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-emerald-200/90 p-3 sm:p-3.5 shadow-2xs">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-emerald-100/80">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-xs flex-shrink-0">
                  ⚡
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                      ⚡ QUICK DELIVERY
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                      {cart.groups?.quickCommerce?.estimatedDeliveryTime || '10–15 mins'}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Local delivery
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full flex-shrink-0">
                {qcItems.length} {qcItems.length === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="space-y-3">
              {qcItems.map((item) => {
                const { displayPrice, mrp, hasDiscount } = calculateProductPrice(item.product, item.variant);
                const isItemWholesale = Boolean(item.isWholesale);
                const unitPrice = (isItemWholesale && item.wholesalePrice && item.wholesalePrice > 0)
                  ? item.wholesalePrice
                  : displayPrice;
                const lineTotal = unitPrice * (item.quantity || 1);
                const moq = item.wholesaleMinimumQuantity || item.product?.wholesaleMinimumQuantity || 1;
                const isItemStockBelowMoq =
                  Boolean(item.isStockBelowMoq) ||
                  (isItemWholesale && typeof item.availableStock === "number" && item.availableStock < moq);
                const isBelowMoq = isItemWholesale && item.quantity < moq;
                const isItemRemoving = removingItemId === (item.id || item.product?.id);
                const isItemOutOfStock =
                  Boolean(item.isOutOfStock) ||
                  (typeof item.availableStock === "number" && item.availableStock <= 0);
                const isItemInsufficient =
                  !isItemOutOfStock &&
                  !isItemStockBelowMoq &&
                  typeof item.availableStock === "number" &&
                  item.availableStock > 0 &&
                  item.quantity > item.availableStock;
                const effectiveVariantTitle =
                  item.variantTitle ||
                  item.variant?.title ||
                  (item.product as any)?.variantTitle;

                return (
                  <div
                    key={item.id || item.product?.id || Math.random()}
                    className={`p-3 rounded-xl border ${
                      isItemOutOfStock
                        ? "border-rose-300 bg-rose-50/20"
                        : isItemInsufficient
                          ? "border-amber-300 bg-amber-50/20"
                          : "border-neutral-200/80 bg-white"
                    } hover:border-neutral-300 transition-all flex gap-3 items-start ${
                      isItemRemoving ? "opacity-40 pointer-events-none" : ""
                    }`}
                  >
                    <div className="w-16 h-16 sm:w-18 sm:h-18 bg-neutral-50 rounded-xl border border-neutral-100/90 flex-shrink-0 overflow-hidden relative flex items-center justify-center p-1">
                      {item.product?.imageUrl ? (
                        <img
                          src={item.product?.imageUrl}
                          alt={item.product?.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full items-center justify-center text-neutral-400 font-bold text-base ${
                          item.product?.imageUrl ? 'hidden' : 'flex'
                        }`}
                      >
                        {(item.product?.name || "P").charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.2 rounded">
                              ⚡ Quick
                            </span>
                            {isItemWholesale && (
                              <span className="text-[9px] font-bold text-purple-800 bg-purple-50 border border-purple-200/70 px-1.5 py-0.2 rounded">
                                🏷️ Wholesale
                              </span>
                            )}
                            {effectiveVariantTitle && (
                              <span className="text-[10px] font-semibold text-neutral-700 bg-neutral-100 px-1.5 py-0.2 rounded border border-neutral-200">
                                {effectiveVariantTitle}
                              </span>
                            )}
                            {item.product?.pack && (
                              <span className="text-[11px] text-neutral-500 font-medium truncate">
                                {item.product.pack}
                              </span>
                            )}
                          </div>
                          <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 line-clamp-2 leading-snug">
                            {item.product?.name}
                          </h3>
                          <div className="text-[11px] font-medium text-neutral-600 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>₹{unitPrice.toLocaleString("en-IN")} <span className="text-neutral-400 font-normal">each</span></span>
                            {hasDiscount && !isItemWholesale && (
                              <span className="text-[10px] text-neutral-400 line-through">
                                ₹{mrp.toLocaleString("en-IN")}
                              </span>
                            )}
                            {isItemWholesale && (
                              <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-1 rounded">
                                MOQ: {moq}
                              </span>
                            )}
                            {isBelowMoq && (
                              <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                                ⚠️ Below MOQ ({moq})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 pl-1.5">
                          <div className="text-sm sm:text-base font-bold text-neutral-900">
                            ₹{lineTotal.toLocaleString("en-IN")}
                          </div>
                          {item.quantity > 1 ? (
                            <div className="text-[10px] font-medium text-neutral-500">
                              ₹{unitPrice.toLocaleString("en-IN")} × {item.quantity}
                            </div>
                          ) : (
                            <div className="text-[10px] text-neutral-400">
                              total
                            </div>
                          )}
                          {hasDiscount && !isItemWholesale && (
                            <div className="text-[10px] text-neutral-400 line-through">
                              ₹{(mrp * item.quantity).toLocaleString("en-IN")}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Out of stock warning banner */}
                      {isItemOutOfStock && (
                        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg mt-2 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 font-semibold">
                            <span>⚠️</span>
                            <span>Item is out of stock</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item.product?.id, item.id);
                            }}
                            className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {/* Wholesale stock below MOQ warning banner */}
                      {isItemStockBelowMoq && (
                        <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg mt-2 flex items-center justify-between gap-2 flex-wrap">
                          <span className="flex items-center gap-1 font-semibold">
                            <span>⚠️</span>
                            <span>Available stock ({item.availableStock}) is below wholesale MOQ ({moq}). Please remove this item.</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item.product?.id, item.id);
                            }}
                            className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {/* Insufficient stock warning banner */}
                      {isItemInsufficient && (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg mt-2 flex items-center justify-between gap-2 flex-wrap">
                          <span className="flex items-center gap-1 font-semibold">
                            <span>⚠️</span>
                            <span>Only {item.availableStock} available (in cart: {item.quantity})</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateQuantity(
                                item.product?.id,
                                item.availableStock!,
                                (item.product as any)?.variantId,
                                (item.product as any)?.variantTitle,
                                item.id,
                              );
                            }}
                            className="text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded border border-amber-300 cursor-pointer"
                          >
                            Adjust to {item.availableStock}
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-neutral-100">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            disabled={isItemRemoving}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item.product?.id, item.id);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors disabled:opacity-50 cursor-pointer"
                            title="Remove item from cart"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {isItemRemoving ? "Removing..." : "Remove"}
                          </button>
                          <span className="text-neutral-200">|</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveToWishlist(item.product);
                            }}
                            className="text-[11px] font-medium text-neutral-400 hover:text-emerald-700 transition-colors cursor-pointer"
                          >
                            Wishlist
                          </button>
                        </div>

                        {/* Connected Stepper Control */}
                        <div className="flex items-center bg-white border border-emerald-600 rounded-lg shadow-2xs overflow-hidden">
                          <button
                            type="button"
                            disabled={item.quantity <= 1}
                            onClick={() => updateQuantity(item.product?.id, item.quantity - 1, (item.product as any)?.variantId, (item.product as any)?.variantTitle, item.id)}
                            className={`w-7 h-7 flex items-center justify-center font-bold text-sm transition-all ${
                              item.quantity <= 1
                                ? "text-neutral-300 cursor-not-allowed bg-neutral-50"
                                : "text-emerald-700 hover:bg-emerald-50 active:scale-95 cursor-pointer"
                            }`}
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="text-sm font-bold text-emerald-950 min-w-[1.75rem] text-center select-none px-1">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={
                              isItemOutOfStock ||
                              (typeof item.availableStock === "number" &&
                                item.availableStock > 0 &&
                                item.quantity >= item.availableStock)
                            }
                            onClick={() => updateQuantity(item.product?.id, item.quantity + 1, (item.product as any)?.variantId, (item.product as any)?.variantTitle, item.id)}
                            className={`w-7 h-7 flex items-center justify-center font-bold text-sm transition-all ${
                              isItemOutOfStock ||
                              (typeof item.availableStock === "number" &&
                                item.availableStock > 0 &&
                                item.quantity >= item.availableStock)
                                ? "text-neutral-300 cursor-not-allowed bg-neutral-50"
                                : "text-emerald-700 hover:bg-emerald-50 active:scale-95 cursor-pointer"
                            }`}
                            aria-label="Increase quantity"
                            title={
                              typeof item.availableStock === "number" && item.quantity >= item.availableStock
                                ? `Only ${item.availableStock} available`
                                : "Increase quantity"
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ecommerce Basket */}
        {ecomItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-blue-200/90 p-3 sm:p-3.5 shadow-2xs">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-blue-100/80">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-xs flex-shrink-0">
                  📦
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                      📦 COURIER DELIVERY
                    </span>
                    <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full">
                      {cart.groups?.ecommerce?.estimatedDeliveryTime || '3–5 days'}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Courier shipping
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full flex-shrink-0">
                {ecomItems.length} {ecomItems.length === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="space-y-3">
              {ecomItems.map((item) => {
                const { displayPrice, mrp, hasDiscount } = calculateProductPrice(item.product, item.variant);
                const isItemWholesale = Boolean(item.isWholesale);
                const unitPrice = (isItemWholesale && item.wholesalePrice && item.wholesalePrice > 0)
                  ? item.wholesalePrice
                  : displayPrice;
                const lineTotal = unitPrice * (item.quantity || 1);
                const moq = item.wholesaleMinimumQuantity || item.product?.wholesaleMinimumQuantity || 1;
                const isItemStockBelowMoq =
                  Boolean(item.isStockBelowMoq) ||
                  (isItemWholesale && typeof item.availableStock === "number" && item.availableStock < moq);
                const isBelowMoq = isItemWholesale && item.quantity < moq;
                const isItemRemoving = removingItemId === (item.id || item.product?.id);
                const isItemOutOfStock =
                  Boolean(item.isOutOfStock) ||
                  (typeof item.availableStock === "number" && item.availableStock <= 0);
                const isItemInsufficient =
                  !isItemOutOfStock &&
                  !isItemStockBelowMoq &&
                  typeof item.availableStock === "number" &&
                  item.availableStock > 0 &&
                  item.quantity > item.availableStock;
                const effectiveVariantTitle =
                  item.variantTitle ||
                  item.variant?.title ||
                  (item.product as any)?.variantTitle;

                return (
                  <div
                    key={item.id || item.product?.id || Math.random()}
                    className={`p-3 rounded-xl border ${
                      isItemOutOfStock
                        ? "border-rose-300 bg-rose-50/20"
                        : isItemInsufficient
                          ? "border-amber-300 bg-amber-50/20"
                          : "border-neutral-200/80 bg-white"
                    } hover:border-neutral-300 transition-all flex gap-3 items-start ${
                      isItemRemoving ? "opacity-40 pointer-events-none" : ""
                    }`}
                  >
                    <div className="w-16 h-16 sm:w-18 sm:h-18 bg-neutral-50 rounded-xl border border-neutral-100/90 flex-shrink-0 overflow-hidden relative flex items-center justify-center p-1">
                      {item.product?.imageUrl ? (
                        <img
                          src={item.product?.imageUrl}
                          alt={item.product?.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full items-center justify-center text-neutral-400 font-bold text-base ${
                          item.product?.imageUrl ? 'hidden' : 'flex'
                        }`}
                      >
                        {(item.product?.name || "P").charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-[9px] font-bold text-blue-800 bg-blue-50 border border-blue-200/70 px-1.5 py-0.2 rounded">
                              📦 Courier
                            </span>
                            {isItemWholesale && (
                              <span className="text-[9px] font-bold text-purple-800 bg-purple-50 border border-purple-200/70 px-1.5 py-0.2 rounded">
                                🏷️ Wholesale
                              </span>
                            )}
                            {effectiveVariantTitle && (
                              <span className="text-[10px] font-semibold text-neutral-700 bg-neutral-100 px-1.5 py-0.2 rounded border border-neutral-200">
                                {effectiveVariantTitle}
                              </span>
                            )}
                            {item.product?.pack && (
                              <span className="text-[11px] text-neutral-500 font-medium truncate">
                                {item.product.pack}
                              </span>
                            )}
                          </div>
                          <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 line-clamp-2 leading-snug">
                            {item.product?.name}
                          </h3>
                          <div className="text-[11px] font-medium text-neutral-600 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>₹{unitPrice.toLocaleString("en-IN")} <span className="text-neutral-400 font-normal">each</span></span>
                            {hasDiscount && !isItemWholesale && (
                              <span className="text-[10px] text-neutral-400 line-through">
                                ₹{mrp.toLocaleString("en-IN")}
                              </span>
                            )}
                            {isItemWholesale && (
                              <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-1 rounded">
                                MOQ: {moq}
                              </span>
                            )}
                            {isBelowMoq && (
                              <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                                ⚠️ Below MOQ ({moq})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 pl-1.5">
                          <div className="text-sm sm:text-base font-bold text-neutral-900">
                            ₹{lineTotal.toLocaleString("en-IN")}
                          </div>
                          {item.quantity > 1 ? (
                            <div className="text-[10px] font-medium text-neutral-500">
                              ₹{unitPrice.toLocaleString("en-IN")} × {item.quantity}
                            </div>
                          ) : (
                            <div className="text-[10px] text-neutral-400">
                              total
                            </div>
                          )}
                          {hasDiscount && !isItemWholesale && (
                            <div className="text-[10px] text-neutral-400 line-through">
                              ₹{(mrp * item.quantity).toLocaleString("en-IN")}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Out of stock warning banner */}
                      {isItemOutOfStock && (
                        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg mt-2 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 font-semibold">
                            <span>⚠️</span>
                            <span>Item is out of stock</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item.product?.id, item.id);
                            }}
                            className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {/* Wholesale stock below MOQ warning banner */}
                      {isItemStockBelowMoq && (
                        <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg mt-2 flex items-center justify-between gap-2 flex-wrap">
                          <span className="flex items-center gap-1 font-semibold">
                            <span>⚠️</span>
                            <span>Available stock ({item.availableStock}) is below wholesale MOQ ({moq}). Please remove this item.</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item.product?.id, item.id);
                            }}
                            className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {/* Insufficient stock warning banner */}
                      {isItemInsufficient && (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg mt-2 flex items-center justify-between gap-2 flex-wrap">
                          <span className="flex items-center gap-1 font-semibold">
                            <span>⚠️</span>
                            <span>Only {item.availableStock} available (in cart: {item.quantity})</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateQuantity(
                                item.product?.id,
                                item.availableStock!,
                                (item.product as any)?.variantId,
                                (item.product as any)?.variantTitle,
                                item.id,
                              );
                            }}
                            className="text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded border border-amber-300 cursor-pointer"
                          >
                            Adjust to {item.availableStock}
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-neutral-100">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            disabled={isItemRemoving}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item.product?.id, item.id);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors disabled:opacity-50 cursor-pointer"
                            title="Remove item from cart"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {isItemRemoving ? "Removing..." : "Remove"}
                          </button>
                          <span className="text-neutral-200">|</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveToWishlist(item.product);
                            }}
                            className="text-[11px] font-medium text-neutral-400 hover:text-emerald-700 transition-colors cursor-pointer"
                          >
                            Wishlist
                          </button>
                        </div>

                        {/* Connected Stepper Control */}
                        <div className="flex items-center bg-white border border-emerald-600 rounded-lg shadow-2xs overflow-hidden">
                          <button
                            type="button"
                            disabled={item.quantity <= 1}
                            onClick={() => updateQuantity(item.product?.id, item.quantity - 1, (item.product as any)?.variantId, (item.product as any)?.variantTitle, item.id)}
                            className={`w-7 h-7 flex items-center justify-center font-bold text-sm transition-all ${
                              item.quantity <= 1
                                ? "text-neutral-300 cursor-not-allowed bg-neutral-50"
                                : "text-emerald-700 hover:bg-emerald-50 active:scale-95 cursor-pointer"
                            }`}
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="text-sm font-bold text-emerald-950 min-w-[1.75rem] text-center select-none px-1">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={
                              isItemOutOfStock ||
                              (typeof item.availableStock === "number" &&
                                item.availableStock > 0 &&
                                item.quantity >= item.availableStock)
                            }
                            onClick={() => updateQuantity(item.product?.id, item.quantity + 1, (item.product as any)?.variantId, (item.product as any)?.variantTitle, item.id)}
                            className={`w-7 h-7 flex items-center justify-center font-bold text-sm transition-all ${
                              isItemOutOfStock ||
                              (typeof item.availableStock === "number" &&
                                item.availableStock > 0 &&
                                item.quantity >= item.availableStock)
                                ? "text-neutral-300 cursor-not-allowed bg-neutral-50"
                                : "text-emerald-700 hover:bg-emerald-50 active:scale-95 cursor-pointer"
                            }`}
                            aria-label="Increase quantity"
                            title={
                              typeof item.availableStock === "number" && item.quantity >= item.availableStock
                                ? `Only ${item.availableStock} available`
                                : "Increase quantity"
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* You might also like */}
      <div className="px-4 md:px-6 lg:px-8 py-2.5 md:py-3 border-b border-neutral-200">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">
          You might also like
        </h2>
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-3"
          style={{ scrollSnapType: "x mandatory" }}>
          {similarProducts.map((product) => {
            // Get price details
            const { displayPrice, mrp, discount, hasDiscount } =
              calculateProductPrice(product);

            // Get quantity in cart
            const productId = product.id || product._id;
            const inCartItem = (cart?.items || []).find((item) => {
              const itemProductId = item.product?.id || item.product?._id;
              return itemProductId === productId;
            });
            const inCartQty = inCartItem?.quantity || 0;

            return (
              <div
                key={product.id}
                className="flex-shrink-0 w-[140px]"
                style={{ scrollSnapAlign: "start" }}>
                <div
                  className="bg-white rounded-lg overflow-hidden flex flex-col relative h-full"
                  style={{ boxShadow: "0 1px 1px rgba(0, 0, 0, 0.03)" }}>
                  {/* Product Image Area */}
                  <div
                    onClick={() =>
                      navigate(`/product/${product.id || product._id}`)
                    }
                    className="relative block cursor-pointer">
                    <div className="w-full h-28 bg-neutral-100 flex items-center justify-center overflow-hidden relative">
                      {product.imageUrl || product.mainImage ? (
                        <img
                          src={product.imageUrl || product.mainImage}
                          alt={product.name || product.productName || "Product"}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (
                              parent &&
                              !parent.querySelector(".fallback-icon")
                            ) {
                              const fallback = document.createElement("div");
                              fallback.className =
                                "w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl fallback-icon";
                              fallback.textContent = (
                                product.name ||
                                product.productName ||
                                "?"
                              )
                                .charAt(0)
                                .toUpperCase();
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl">
                          {(product.name || product.productName || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}

                      {/* Red Discount Badge - Top Left */}
                      {discount > 0 && (
                        <div className="absolute top-1 left-1 z-10 bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                          {discount}% OFF
                        </div>
                      )}

                      {/* Heart Icon - Top Right */}
                      <WishlistButton
                        productId={product.id || product._id}
                        size="sm"
                        className="top-1 right-1 shadow-sm"
                      />

                      {/* ADD Button or Quantity Stepper - Overlaid on bottom right of image */}
                      <div className="absolute bottom-1.5 right-1.5 z-10">
                        <AnimatePresence mode="wait">
                          {inCartQty === 0 ? (
                            <motion.button
                              key="add-button"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.2 }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addToCart(product, e.currentTarget);
                              }}
                              className="bg-white/95 backdrop-blur-sm text-green-600 border-2 border-green-600 text-[10px] font-semibold px-2 py-1 rounded shadow-md hover:bg-white transition-colors">
                              ADD
                            </motion.button>
                          ) : (
                            <motion.div
                              key="stepper"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.2 }}
                              className="flex items-center gap-1 bg-green-600 rounded px-1.5 py-1 shadow-md"
                              onClick={(e) => e.stopPropagation()}>
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updateQuantity(productId, inCartQty - 1);
                                }}
                                className="w-4 h-4 flex items-center justify-center text-white font-bold hover:bg-green-700 rounded transition-colors p-0 leading-none"
                                style={{ lineHeight: 1, fontSize: "14px" }}>
                                <span className="relative top-[-1px]">−</span>
                              </motion.button>
                              <motion.span
                                key={inCartQty}
                                initial={{ scale: 1.2, y: -2 }}
                                animate={{ scale: 1, y: 0 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 15,
                                }}
                                className="text-white font-bold min-w-[0.75rem] text-center"
                                style={{ fontSize: "12px" }}>
                                {inCartQty}
                              </motion.span>
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updateQuantity(productId, inCartQty + 1);
                                }}
                                className="w-4 h-4 flex items-center justify-center text-white font-bold hover:bg-green-700 rounded transition-colors p-0 leading-none"
                                style={{ lineHeight: 1, fontSize: "14px" }}>
                                <span className="relative top-[-1px]">+</span>
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="p-1.5 flex-1 flex flex-col bg-white">
                    {/* Light Grey Tags */}
                    <div className="flex gap-0.5 mb-0.5">
                      <div className="bg-neutral-200 text-neutral-700 text-[8px] font-medium px-1 py-0.5 rounded">
                        {product.pack || "1 unit"}
                      </div>
                      {product.pack &&
                        (product.pack.includes("g") ||
                          product.pack.includes("kg")) && (
                          <div className="bg-neutral-200 text-neutral-700 text-[8px] font-medium px-1 py-0.5 rounded">
                            {product.pack.replace(/[gk]/gi, "").trim()} GSM
                          </div>
                        )}
                    </div>

                    {/* Product Name */}
                    <div
                      onClick={() =>
                        navigate(`/product/${product.id || product._id}`)
                      }
                      className="mb-0.5 cursor-pointer">
                      <h3 className="text-[10px] font-bold text-neutral-900 line-clamp-2 leading-tight">
                        {product.name || product.productName || "Product"}
                      </h3>
                    </div>

                    {/* Rating and Reviews */}
                    <div className="flex items-center gap-0.5 mb-0.5">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            width="8"
                            height="8"
                            viewBox="0 0 24 24"
                            fill={i < 4 ? "#fbbf24" : "#e5e7eb"}
                            xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-[8px] text-neutral-500">(85)</span>
                    </div>

                    {/* Delivery Time */}
                    <div className="text-[9px] text-neutral-600 mb-0.5">
                      20 MINS
                    </div>

                    {/* Discount - Blue Text */}
                    {discount > 0 && (
                      <div className="text-[9px] text-blue-600 font-semibold mb-0.5">
                        {discount}% OFF
                      </div>
                    )}

                    {/* Price */}
                    <div className="mb-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[13px] font-bold text-neutral-900">
                          ₹{(displayPrice || 0).toLocaleString("en-IN")}
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] text-neutral-400 line-through">
                            ₹{(mrp || 0).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Link */}
                    <div
                      onClick={() =>
                        navigate(
                          `/category/${product.categoryId || product.category || "all"}`,
                        )
                      }
                      className="w-full bg-green-100 text-green-700 text-[8px] font-medium py-0.5 rounded-lg flex items-center justify-between px-1 hover:bg-green-200 transition-colors mt-auto cursor-pointer">
                      <span>See more like this</span>
                      <div className="flex items-center gap-0.5">
                        <div className="w-px h-2 bg-green-300"></div>
                        <svg
                          width="6"
                          height="6"
                          viewBox="0 0 8 8"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg">
                          <path d="M0 0L8 4L0 8Z" fill="#16a34a" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FREE Delivery Banner */}
      {isEligibleForFreeDelivery ? (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200/80">
          <div className="flex items-center gap-2">
            <span className="text-base flex-shrink-0">🎉</span>
            <div className="flex-1">
              <span className="text-xs font-bold text-emerald-800">
                You've unlocked FREE Delivery!
              </span>
              <p className="text-[10px] text-emerald-700 mt-0.5">
                Delivery charges waived across all options (Standard, Instant & Courier).
              </p>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
              Free Delivery
            </span>
          </div>
        </div>
      ) : deliveryCharge > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center gap-2 mb-1.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5 13h14M5 13l4-4m-4 4l4 4"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="18" cy="5" r="2" fill="#3b82f6" />
            </svg>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700">
                  Get FREE delivery
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M9 18l6-6-6-6"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-[10px] text-blue-600 mt-0.5">
                Add products worth ₹{amountNeededForFreeDelivery.toFixed(0)} more for FREE delivery
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{
                width: `${Math.min(100, freeDeliveryThreshold > 0 ? (((freeDeliveryThreshold - amountNeededForFreeDelivery) / freeDeliveryThreshold) * 100) : 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Coupon Section */}
      {selectedCoupon ? (
        <div className="px-4 py-1.5 border-b border-neutral-200">
          <div className="flex items-center justify-between bg-green-50 rounded-lg p-2 border border-green-200">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-green-700 truncate">
                  {selectedCoupon.code}
                </p>
                <p className="text-[10px] text-green-600 truncate">
                  {selectedCoupon.title}
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="text-xs text-green-600 font-medium ml-2 flex-shrink-0">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-1.5 flex justify-end border-b border-neutral-200">
          <button
            onClick={() => setShowCouponSheet(true)}
            className="text-xs text-neutral-600 flex items-center gap-1">
            See all coupons
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 18l6-6-6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Delivery Summary — Automatically Determined by Commerce Type */}
      <div className="px-4 md:px-6 lg:px-8 py-3.5 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-neutral-900">
            Delivery Summary
          </h2>
          <span className="text-[11px] font-medium text-neutral-500 bg-neutral-100 px-2.5 py-0.5 rounded-full">
            Auto-assigned by item type
          </span>
        </div>

        {/* Case 1: Quick Commerce Only */}
        {qcItems.length > 0 && ecomItems.length === 0 && (
          <div className="p-3.5 rounded-xl border border-emerald-200/90 bg-emerald-50/40 text-emerald-950 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm shadow-xs flex-shrink-0">
                  ⚡
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900 flex items-center gap-2 flex-wrap">
                    <span>Instant Delivery</span>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      Quick Commerce
                    </span>
                    <span className="text-[10px] text-neutral-500 font-normal">
                      ({qcItems.length} {qcItems.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>Expected in {cart.groups?.quickCommerce?.estimatedDeliveryTime || '10–15 mins'}</span>
                    <span className="text-neutral-300">•</span>
                    <span className="text-neutral-500 text-[10px]">Direct from local store via instant rider</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {isEligibleForFreeDelivery ? (
                  <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                    FREE
                  </span>
                ) : (
                  <span className="text-xs font-bold text-neutral-800 bg-neutral-100 px-2.5 py-0.5 rounded-full">
                    ₹{cart.qcDeliveryFee ?? 25}
                  </span>
                )}
                <span className="text-[9px] text-emerald-700 font-medium">Instant Fulfillment</span>
              </div>
            </div>
          </div>
        )}

        {/* Case 2: Ecommerce Only */}
        {ecomItems.length > 0 && qcItems.length === 0 && (
          <div className="p-3.5 rounded-xl border border-blue-200/90 bg-blue-50/40 text-blue-950 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm shadow-xs flex-shrink-0">
                  📦
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900 flex items-center gap-2 flex-wrap">
                    <span>Standard Courier Delivery</span>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200/60">
                      Shiprocket
                    </span>
                    <span className="text-[10px] text-neutral-500 font-normal">
                      ({ecomItems.length} {ecomItems.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>Expected in {cart.groups?.ecommerce?.estimatedDeliveryTime || '3–7 days'}</span>
                    <span className="text-neutral-300">•</span>
                    <span className="text-neutral-500 text-[10px]">Shipped via courier partner</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {isEligibleForFreeDelivery ? (
                  <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                    FREE
                  </span>
                ) : (
                  <span className="text-xs font-bold text-neutral-800 bg-neutral-100 px-2.5 py-0.5 rounded-full">
                    ₹{cart.ecomShippingFee ?? 40}
                  </span>
                )}
                <span className="text-[9px] text-blue-700 font-medium">Courier Shipment</span>
              </div>
            </div>
          </div>
        )}

        {/* Case 3: Mixed Cart (QC + Ecommerce) */}
        {qcItems.length > 0 && ecomItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/70 text-amber-950 text-[11px] leading-relaxed">
              <span className="text-amber-600 text-sm flex-shrink-0 mt-0.2">ℹ️</span>
              <p>
                <span className="font-semibold">Separate Deliveries:</span> Your basket contains both Quick Commerce and Courier items. They will be fulfilled independently and arrive in 2 separate shipments.
              </p>
            </div>

            {/* Quick Commerce Group Summary Card */}
            <div className="p-3.5 rounded-xl border border-emerald-200/90 bg-emerald-50/40 text-emerald-950 transition-all">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shadow-xs flex-shrink-0">
                    ⚡
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900 flex items-center gap-2 flex-wrap">
                      <span>Instant Delivery</span>
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        Quick Commerce
                      </span>
                      <span className="text-[10px] text-neutral-500 font-normal">
                        ({qcItems.length} {qcItems.length === 1 ? 'item' : 'items'})
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>Expected in {cart.groups?.quickCommerce?.estimatedDeliveryTime || '10–15 mins'}</span>
                      <span className="text-neutral-300">•</span>
                      <span className="text-neutral-500 text-[10px]">Local rider fulfillment</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {isEligibleForFreeDelivery ? (
                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                      FREE
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-neutral-800 bg-neutral-100 px-2.5 py-0.5 rounded-full">
                      ₹{cart.qcDeliveryFee ?? 25}
                    </span>
                  )}
                  <span className="text-[9px] text-emerald-700 font-medium">Instant Delivery</span>
                </div>
              </div>
            </div>

            {/* Ecommerce Group Summary Card */}
            <div className="p-3.5 rounded-xl border border-blue-200/90 bg-blue-50/40 text-blue-950 transition-all">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shadow-xs flex-shrink-0">
                    📦
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900 flex items-center gap-2 flex-wrap">
                      <span>Standard Courier Delivery</span>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200/60">
                        Shiprocket
                      </span>
                      <span className="text-[10px] text-neutral-500 font-normal">
                        ({ecomItems.length} {ecomItems.length === 1 ? 'item' : 'items'})
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>Expected in {cart.groups?.ecommerce?.estimatedDeliveryTime || '3–7 days'}</span>
                      <span className="text-neutral-300">•</span>
                      <span className="text-neutral-500 text-[10px]">Courier shipment</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {isEligibleForFreeDelivery ? (
                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                      FREE
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-neutral-800 bg-neutral-100 px-2.5 py-0.5 rounded-full">
                      ₹{cart.ecomShippingFee ?? 40}
                    </span>
                  )}
                  <span className="text-[9px] text-blue-700 font-medium">Courier Shipment</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wallet Balance Usage Toggle */}
      <div className="px-4 md:px-6 lg:px-8 py-3 border-b border-neutral-200 bg-emerald-50/40">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={useWallet}
              onChange={(e) => setUseWallet(e.target.checked)}
              disabled={walletBalance <= 0}
              className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-neutral-900">Use Wallet Balance</span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                  ₹{walletBalance.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {walletBalance > 0
                  ? useWallet
                    ? `₹${walletDeduction.toFixed(2)} applied from wallet balance`
                    : "Use wallet balance to pay for this order"
                  : "Available wallet balance is ₹0.00"}
              </p>
            </div>
          </div>
        </label>
      </div>

      {/* Payment Method Selection */}
      <div className="px-4 md:px-6 lg:px-8 py-3 border-b border-neutral-200">
        <h2 className="text-sm font-bold text-neutral-900 mb-3">
          Select Payment Method
        </h2>
        {useWallet && walletDeduction === grandTotal ? (
          <div className="bg-emerald-600 text-white rounded-xl p-4 text-center font-bold text-sm shadow-md">
            ✓ Order 100% Covered by Wallet (No additional payment needed)
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod("Online")}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                paymentMethod === "Online"
                  ? "border-green-600 bg-green-50 text-green-700"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
              }`}>
              <div
                className={`w-8 h-8 rounded-full mb-2 flex items-center justify-center ${paymentMethod === "Online" ? "bg-green-600" : "bg-neutral-100"}`}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={paymentMethod === "Online" ? "white" : "currentColor"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <span className="text-xs font-bold">Online Payment</span>
              <p className="text-[8px] mt-0.5 opacity-70">
                (Cards, UPI, NetBanking)
              </p>
            </button>

            <button
              onClick={() => setPaymentMethod("COD")}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                paymentMethod === "COD"
                  ? "border-green-600 bg-green-50 text-green-700"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
              }`}>
              <div
                className={`w-8 h-8 rounded-full mb-2 flex items-center justify-center ${paymentMethod === "COD" ? "bg-green-600" : "bg-neutral-100"}`}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={paymentMethod === "COD" ? "white" : "currentColor"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <span className="text-xs font-bold">Cash on Delivery</span>
              <p className="text-[8px] mt-0.5 opacity-70">
                (Pay when you receive)
              </p>
            </button>
          </div>
        )}
      </div>

      {/* Bill details / Order Summary */}
      <div className="px-4 md:px-6 lg:px-8 py-2.5 md:py-3 border-b border-neutral-200">
        <h2 className="text-base font-bold text-neutral-900 mb-2.5">
          Order summary
        </h2>

        <div className="space-y-2">
          {/* Subtotal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-700">Subtotal</span>
              {savedAmount > 0 && (
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                  Saved ₹{savedAmount.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {itemsTotal > discountedTotal && (
                <span className="text-xs text-neutral-500 line-through">
                  ₹{itemsTotal.toLocaleString("en-IN")}
                </span>
              )}
              <span className="text-xs font-semibold text-neutral-900">
                ₹{discountedTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Delivery */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <circle cx="5.5" cy="18.5" r="1.5" fill="currentColor" />
                <circle cx="18.5" cy="18.5" r="1.5" fill="currentColor" />
              </svg>
              <span className="text-xs text-neutral-700">Delivery</span>
            </div>
            <div className="flex flex-col items-end">
              <span
                className={`text-xs font-semibold ${deliveryCharge === 0 ? "text-green-600" : "text-neutral-900"}`}>
                {deliveryCharge === 0 ? "FREE" : `₹${deliveryCharge.toLocaleString("en-IN")}`}
              </span>
            </div>
          </div>

          {/* Handling */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
              <span className="text-xs text-neutral-700">Handling</span>
            </div>
            <span className="text-xs font-semibold text-neutral-900">
              ₹{handlingCharge.toLocaleString("en-IN")}
            </span>
          </div>

          {/* Discount / Savings */}
          {selectedCoupon && currentCouponDiscount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-xs text-neutral-700">
                  Discount
                </span>
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                  {selectedCoupon.code}
                </span>
              </div>
              <span className="text-xs font-semibold text-green-600">
                -₹{currentCouponDiscount.toLocaleString("en-IN")}
              </span>
            </div>
          )}

          {/* Tip amount */}
          {finalTipAmount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-xs text-neutral-700">
                  Tip to delivery partner
                </span>
              </div>
              <span className="text-xs font-medium text-neutral-900">
                ₹{finalTipAmount.toLocaleString("en-IN")}
              </span>
            </div>
          )}

          {/* Gift Packaging */}
          {giftPackaging && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
                <span className="text-xs text-neutral-700">Gift Packaging</span>
              </div>
              <span className="text-xs font-medium text-neutral-900">
                ₹{giftPackagingFee.toLocaleString("en-IN")}
              </span>
            </div>
          )}

          {/* Grand total */}
          <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
            <span className="text-sm font-bold text-neutral-900">
              Total
            </span>
            <span className="text-sm font-bold text-neutral-900">
              ₹{Math.max(0, grandTotal).toFixed(2)}
            </span>
          </div>

          {/* Wallet deduction */}
          {useWallet && walletDeduction > 0 && (
            <div className="flex items-center justify-between text-emerald-600 font-medium">
              <span className="text-xs">Wallet Balance Applied</span>
              <span className="text-xs font-bold">-₹{walletDeduction.toFixed(2)}</span>
            </div>
          )}

          {/* Final Payable total */}
          <div className="pt-2 border-t border-neutral-300 flex items-center justify-between">
            <span className="text-sm font-extrabold text-neutral-900">
              To Pay
            </span>
            <span className="text-sm font-extrabold text-emerald-600">
              ₹{finalPayable.toFixed(2)}
            </span>
          </div>
        </div>
      </div>



      {/* Tip your delivery partner */}
      <div className="px-4 py-2 border-b border-neutral-200">
        <h3 className="text-sm font-bold text-neutral-900 mb-0.5">
          Tip your delivery partner
        </h3>
        <p className="text-xs text-neutral-600 mb-2">
          Your kindness means a lot! 100% of your tip will go directly to your
          delivery partner.
        </p>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1.5">
          <button
            onClick={() => {
              setTipAmount(20);
              setShowCustomTipInput(false);
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 font-medium text-xs ${
              tipAmount === 20 && !showCustomTipInput
                ? "border-green-600 bg-green-50 text-green-700"
                : "border-neutral-300 bg-white text-neutral-700"
            }`}>
            😊 ₹20
          </button>
          <button
            onClick={() => {
              setTipAmount(30);
              setShowCustomTipInput(false);
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 font-medium text-xs ${
              tipAmount === 30 && !showCustomTipInput
                ? "border-green-600 bg-green-50 text-green-700"
                : "border-neutral-300 bg-white text-neutral-700"
            }`}>
            🤩 ₹30
          </button>
          <button
            onClick={() => {
              setTipAmount(50);
              setShowCustomTipInput(false);
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 font-medium text-xs ${
              tipAmount === 50 && !showCustomTipInput
                ? "border-green-600 bg-green-50 text-green-700"
                : "border-neutral-300 bg-white text-neutral-700"
            }`}>
            😍 ₹50
          </button>
          <button
            onClick={() => {
              setShowCustomTipInput(true);
              setTipAmount(null);
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 font-medium text-xs ${
              showCustomTipInput
                ? "border-green-600 bg-green-50 text-green-700"
                : "border-neutral-300 bg-white text-neutral-700"
            }`}>
            🎁 Custom
          </button>
        </div>

        {/* Custom Tip Input */}
        {showCustomTipInput && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              value={customTipAmount || ""}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 0) {
                  setCustomTipAmount(val);
                }
              }}
              onBlur={(e) => {
                const val = Number(e.target.value);
                if (val < 0) {
                  setCustomTipAmount(0);
                }
              }}
              placeholder="Enter custom tip amount"
              className="flex-1 px-3 py-1.5 bg-white border-2 border-green-600 rounded-lg text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-green-500"
              min="0"
              step="1"
            />
            <button
              onClick={() => {
                setShowCustomTipInput(false);
                setCustomTipAmount(0);
                setTipAmount(null);
              }}
              className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900">
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Gift Packaging */}
      <div className="px-4 py-2 border-b border-neutral-200">
        <button
          onClick={() => setGiftPackaging(!giftPackaging)}
          className={`w-full flex items-center justify-between rounded-lg p-2 transition-colors ${
            giftPackaging
              ? "bg-green-50 border-2 border-green-600"
              : "bg-neutral-50 border-2 border-transparent hover:bg-neutral-100"
          }`}>
          <div className="flex items-center gap-2">
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                giftPackaging
                  ? "border-green-600 bg-green-600"
                  : "border-neutral-400 bg-white"
              }`}>
              {giftPackaging && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
            </svg>
            <div className="text-left">
              <p
                className={`text-xs font-semibold ${giftPackaging ? "text-green-700" : "text-neutral-900"}`}>
                Gift Packaging
              </p>
              <p className="text-[10px] text-neutral-600">
                {giftPackaging
                  ? `Add ₹${giftPackagingPrice} for gift packaging`
                  : `Add ₹${giftPackagingPrice} for elegant gift packaging`}
              </p>
            </div>
          </div>
          {giftPackaging && (
            <span className="text-xs font-semibold text-green-600">₹{giftPackagingPrice}</span>
          )}
        </button>
      </div>

      {/* Cancellation Policy */}
      <div className="px-4 py-2">
        <button
          onClick={() => setShowCancellationPolicy(true)}
          className="text-xs text-neutral-700 hover:text-neutral-900 transition-colors">
          Cancellation Policy
        </button>
      </div>

      {/* Made with love by Olovely Total Suvidha */}
      <div className="px-4 py-2">
        <div className="w-full flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-neutral-500">
            <span className="text-[10px] font-medium">Made with</span>
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
              className="text-red-500 text-sm">
              ❤️
            </motion.span>
            <span className="text-[10px] font-medium">by</span>
            <span className="text-[10px] font-semibold text-green-600">
              Olovely Total Suvidha
            </span>
          </div>
        </div>
      </div>



      {/* Cancellation Policy Sheet Modal */}
      <Sheet
        open={showCancellationPolicy}
        onOpenChange={setShowCancellationPolicy}>
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between mb-2">
              <SheetTitle className="text-base font-bold text-neutral-900">
                Cancellation Policy
              </SheetTitle>
              <SheetClose onClick={() => setShowCancellationPolicy(false)}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="px-4 pb-4 overflow-y-auto max-h-[calc(85vh-80px)]">
            <div className="space-y-4 mt-4 text-sm text-neutral-700">
              <div>
                <h3 className="font-bold text-neutral-900 mb-2">
                  Order Cancellation
                </h3>
                <p className="mb-2">
                  You can cancel your order before it is confirmed by the
                  seller. Once confirmed, cancellation may not be possible.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-neutral-900 mb-2">
                  Refund Policy
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Refunds will be processed within 5-7 business days</li>
                  <li>
                    Refund amount will be credited to your original payment
                    method
                  </li>
                  <li>Delivery charges are non-refundable</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-neutral-900 mb-2">
                  Partial Cancellation
                </h3>
                <p>
                  Partial cancellation of items in an order is not allowed. You
                  can cancel the entire order or contact customer support for
                  assistance.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-neutral-900 mb-2">
                  Contact Support
                </h3>
                <p>
                  For any cancellation requests or queries, please contact our
                  customer support team at {appSettings?.supportEmail || appSettings?.contactEmail || 'OLOVELYTOTALSUVIDHA@GMAIL.COM'} or call
                  +91 {appSettings?.supportPhone || appSettings?.contactPhone || '9601715367'}
                </p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Coupon Sheet Modal */}
      <Sheet open={showCouponSheet} onOpenChange={setShowCouponSheet}>
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between mb-2">
              <SheetTitle className="text-base font-bold text-neutral-900">
                Available Coupons
              </SheetTitle>
              <SheetClose onClick={() => setShowCouponSheet(false)}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="px-4 pb-4 overflow-y-auto max-h-[calc(85vh-80px)]">
            {couponError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-600">
                {couponError}
              </div>
            )}
            <div className="space-y-2.5 mt-2">
              {availableCoupons.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <p>No coupons available at the moment.</p>
                </div>
              ) : (
                availableCoupons.map((coupon, index) => {
                  const subtotalForCoupon = discountedTotal;
                  const meetsMinOrder =
                    !coupon.minOrderValue ||
                    subtotalForCoupon >= coupon.minOrderValue;
                  const isApplied = selectedCoupon?.code === coupon.code;

                  return (
                    <div
                      key={coupon._id || index}
                      onClick={() =>
                        meetsMinOrder && !isValidatingCoupon && handleApplyCoupon(coupon)
                      }
                      className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
                        isApplied
                          ? "border-green-500 bg-green-50/30"
                          : meetsMinOrder
                          ? "border-neutral-200 bg-white"
                          : "border-neutral-200 bg-neutral-50 opacity-60 cursor-not-allowed"
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-green-600">
                              {coupon.code}
                            </span>
                            {coupon.title && coupon.title !== coupon.code && (
                              <span className="text-xs font-semibold text-neutral-900">
                                {coupon.title}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-neutral-600 mb-1">
                            {coupon.description}
                          </p>
                          {coupon.minOrderValue && (
                            <p className="text-[10px] text-neutral-500">
                              Min. order: ₹{coupon.minOrderValue}
                            </p>
                          )}
                        </div>
                        {isApplied ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg">
                              <path
                                d="M20 6L9 17l-5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span className="text-xs font-medium">Applied</span>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              meetsMinOrder && handleApplyCoupon(coupon)
                            }
                            disabled={!meetsMinOrder || isValidatingCoupon}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                              meetsMinOrder
                                ? "bg-green-600 text-white hover:bg-green-700"
                                : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                            }`}>
                            {isValidatingCoupon ? "..." : "Apply"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Bottom Sticky Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-[60] shadow-lg">
        {hasStockIssues && (
          <div className="px-4 py-2 text-xs text-center font-semibold text-rose-800 bg-rose-50 border-b border-rose-200 flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4 text-rose-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Some items have limited stock. Please adjust quantities to proceed.</span>
          </div>
        )}
        {!meetsMinimumOrder && !hasStockIssues && (
          <div className="px-4 py-2 text-xs text-center text-amber-800 bg-amber-50 border-b border-amber-100">
            Minimum order ₹{minimumOrderValue.toLocaleString("en-IN")}. Add ₹
            {amountNeededForMinimumOrder.toLocaleString("en-IN")} more to place
            order.
          </div>
        )}
        {selectedAddress ? (
          <button
            onClick={handlePlaceOrder}
            disabled={
              cart.items.length === 0 || isProcessingOrder || !meetsMinimumOrder || hasStockIssues
            }
            className={`w-full py-3 px-4 font-bold text-sm uppercase tracking-wide transition-colors ${
              cart.items.length > 0 && !isProcessingOrder && meetsMinimumOrder && !hasStockIssues
                ? "bg-green-600 text-white hover:bg-green-700 cursor-pointer"
                : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
            }`}>
            {isProcessingOrder
              ? "Processing..."
              : hasStockIssues
                ? "Adjust Stock to Place Order"
                : !meetsMinimumOrder
                  ? `Add ₹${amountNeededForMinimumOrder.toLocaleString("en-IN")} more`
                  : "Place Order"}
          </button>
        ) : (
          <button
            onClick={() => {
              navigate("/checkout/address", { state: { returnTo: "/checkout" } });
            }}
            className="w-full bg-emerald-600 text-white py-3.5 px-4 font-bold text-sm uppercase tracking-wide hover:bg-emerald-700 active:scale-98 transition-all flex items-center justify-center gap-2">
            <span>➕ Add Delivery Address to proceed</span>
          </button>
        )}
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes checkDraw {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
          }
        }

        @keyframes ringPulse {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.3);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }

        @keyframes sparkle {
          0% {
            transform: rotate(var(--rotation, 0deg)) translateY(0) scale(0);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--rotation, 0deg)) translateY(-80px) scale(1);
            opacity: 0;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes confettiFall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }

        .check-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 0;
        }
      `}</style>

      {/* Razorpay Checkout Modal */}
      {showRazorpayCheckout && pendingOrderId && user && (
        <RazorpayCheckout
          orderId={pendingOrderId}
          amount={finalPayable}
          customerDetails={{
            name: user.name || "Customer",
            email: user.email || "",
            phone: user.phone || "",
          }}
          onSuccess={(paymentId) => {
            setShowRazorpayCheckout(false);
            setPlacedOrderId(pendingOrderId);
            setPendingOrderId(null);
            clearCart();
            setShowOrderSuccess(true);
            showGlobalToast("Payment successful!", "success");
          }}
          onFailure={(error) => {
            setShowRazorpayCheckout(false);
            setPendingOrderId(null);
            showGlobalToast(
              error || "Payment failed. Please try again.",
              "error",
            );
          }}
        />
      )}
    </div>
  );
}
