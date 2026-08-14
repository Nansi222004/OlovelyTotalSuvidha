import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, startTransition } from "react";
import { CartProvider } from "./context/CartContext";
import { OrdersProvider } from "./context/OrdersContext";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LocationProvider } from "./context/LocationContext";
import { ToastProvider } from "./context/ToastContext";
import { WishlistProvider } from "./context/WishlistContext";
import { AppSettingsProvider } from "./context/AppSettingsContext";

import { LoadingProvider } from "./context/LoadingContext";
import { AxiosLoadingInterceptor } from "./context/AxiosLoadingInterceptor";
import IconLoader from "./components/loaders/IconLoader";
import RouteLoaderTrigger from "./components/loaders/RouteLoaderTrigger";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import LoadingSpinner from "./components/LoadingSpinner";
import ErrorBoundary from "./components/ErrorBoundary";
import RouteTransition from "./components/RouteTransition";
import { useEffect } from "react";
import lazyWithRetry from "./utils/lazyWithRetry";

// Critical routes - load immediately (Home, Cart)
import Home from "./modules/user/Home";
import Cart from "./modules/user/Cart";

// Lazy load large frontend sections
const Checkout = lazyWithRetry(() => import("./modules/user/Checkout"), "Checkout");
const CheckoutAddress = lazyWithRetry(() => import("./modules/user/CheckoutAddress"), "CheckoutAddress");
const ProductDetail = lazyWithRetry(() => import("./modules/user/ProductDetail"), "ProductDetail");

// Lazy load less critical routes for code splitting
const Search = lazyWithRetry(() => import("./modules/user/Search"), "Search");
const Orders = lazyWithRetry(() => import("./modules/user/Orders"), "Orders");
const OrderDetail = lazyWithRetry(() => import("./modules/user/OrderDetail"), "OrderDetail");
const OrderAgain = lazyWithRetry(() => import("./modules/user/OrderAgain"), "OrderAgain");
const Account = lazyWithRetry(() => import("./modules/user/Account"), "Account");
const Categories = lazyWithRetry(() => import("./modules/user/Categories"), "Categories");
const Category = lazyWithRetry(() => import("./modules/user/Category"), "Category");
const Invoice = lazyWithRetry(() => import("./modules/user/Invoice"), "Invoice");
const Login = lazyWithRetry(() => import("./modules/user/Login"), "Login");

const AboutUs = lazyWithRetry(() => import("./modules/user/AboutUs"), "AboutUs");
const FAQ = lazyWithRetry(() => import("./modules/user/FAQ"), "FAQ");
const Wishlist = lazyWithRetry(() => import("./modules/user/Wishlist"), "Wishlist");
const Addresses = lazyWithRetry(() => import("./modules/user/Addresses"), "Addresses");
const AddressBook = lazyWithRetry(() => import("./modules/user/AddressBook"), "AddressBook");
const UserNotifications = lazyWithRetry(() => import("./modules/user/Notifications"), "UserNotifications");
const SpiritualStore = lazyWithRetry(() => import("./modules/user/SpiritualStore"), "SpiritualStore");
const PharmaStore = lazyWithRetry(() => import("./modules/user/PharmaStore"), "PharmaStore");
const EGiftStore = lazyWithRetry(() => import("./modules/user/EGiftStore"), "EGiftStore");
const PetStore = lazyWithRetry(() => import("./modules/user/PetStore"), "PetStore");
const SportsStore = lazyWithRetry(() => import("./modules/user/SportsStore"), "SportsStore");
const FashionStore = lazyWithRetry(() => import("./modules/user/FashionStore"), "FashionStore");
const ToyStore = lazyWithRetry(() => import("./modules/user/ToyStore"), "ToyStore");
const HobbyStore = lazyWithRetry(() => import("./modules/user/HobbyStore"), "HobbyStore");
const StorePage = lazyWithRetry(() => import("./modules/user/StorePage"), "StorePage");

// Lazy load delivery routes
const DeliveryLayout = lazyWithRetry(
  () => import("./modules/delivery/components/DeliveryLayout"), "DeliveryLayout"
);
const DeliveryDashboard = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryDashboard"), "DeliveryDashboard"
);
const DeliveryOrders = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryOrders"), "DeliveryOrders"
);
const DeliveryOrderDetail = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryOrderDetail"), "DeliveryOrderDetail"
);
const DeliveryNotifications = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryNotifications"), "DeliveryNotifications"
);
const DeliveryMenu = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryMenu"), "DeliveryMenu"
);
const DeliveryPendingOrders = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryPendingOrders"), "DeliveryPendingOrders"
);
const DeliveryAllOrders = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryAllOrders"), "DeliveryAllOrders"
);
const DeliveryReturnOrders = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryReturnOrders"), "DeliveryReturnOrders"
);
const DeliveryProfile = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryProfile"), "DeliveryProfile"
);
const DeliveryEarnings = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryEarnings"), "DeliveryEarnings"
);
const DeliveryWallet = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryWallet"), "DeliveryWallet"
);
const DeliverySettings = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliverySettings"), "DeliverySettings"
);
const DeliveryHelp = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryHelp"), "DeliveryHelp"
);
const DeliveryAbout = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryAbout"), "DeliveryAbout"
);
const DeliverySellersInRange = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliverySellersInRange"), "DeliverySellersInRange"
);
const DeliveryLogin = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliveryLogin"), "DeliveryLogin"
);
const DeliverySignUp = lazyWithRetry(
  () => import("./modules/delivery/pages/DeliverySignUp"), "DeliverySignUp"
);

// Lazy load seller routes
const SellerLayout = lazyWithRetry(
  () => import("./modules/seller/components/SellerLayout"), "SellerLayout"
);
const SellerDashboard = lazyWithRetry(
  () => import("./modules/seller/pages/SellerDashboard"), "SellerDashboard"
);
const SellerOrders = lazyWithRetry(() => import("./modules/seller/pages/SellerOrders"), "SellerOrders");
const SellerNotifications = lazyWithRetry(() => import("./modules/seller/pages/SellerNotifications"), "SellerNotifications");
const SellerOrderDetail = lazyWithRetry(
  () => import("./modules/seller/pages/SellerOrderDetail"), "SellerOrderDetail"
);
const SellerSettlement = lazyWithRetry(
  () => import("./modules/seller/pages/SellerSettlement"), "SellerSettlement"
);
const SellerCategory = lazyWithRetry(
  () => import("./modules/seller/pages/SellerCategory"), "SellerCategory"
);
const SellerSubCategory = lazyWithRetry(
  () => import("./modules/seller/pages/SellerSubCategory"), "SellerSubCategory"
);
const SellerAddProduct = lazyWithRetry(
  () => import("./modules/seller/pages/SellerAddProduct"), "SellerAddProduct"
);
const SellerTaxes = lazyWithRetry(() => import("./modules/seller/pages/SellerTaxes"), "SellerTaxes");
const SellerProductList = lazyWithRetry(
  () => import("./modules/seller/pages/SellerProductList"), "SellerProductList"
);
const SellerStockManagement = lazyWithRetry(
  () => import("./modules/seller/pages/SellerStockManagement"), "SellerStockManagement"
);
const SellerWallet = lazyWithRetry(() => import("./modules/seller/pages/SellerWallet"), "SellerWallet");
const SellerSalesReport = lazyWithRetry(
  () => import("./modules/seller/pages/SellerSalesReport"), "SellerSalesReport"
);
const SellerReturnRequest = lazyWithRetry(
  () => import("./modules/seller/pages/SellerReturnRequest"), "SellerReturnRequest"
);
const SellerAccountSettings = lazyWithRetry(
  () => import("./modules/seller/pages/SellerAccountSettings"), "SellerAccountSettings"
);
const SellerDeliveryTracking = lazyWithRetry(
  () => import("./modules/seller/pages/SellerDeliveryTracking"), "SellerDeliveryTracking"
);
const SellerReviews = lazyWithRetry(
  () => import("./modules/seller/pages/SellerReviews"), "SellerReviews"
);
const SellerLogin = lazyWithRetry(() => import("./modules/seller/pages/SellerLogin"), "SellerLogin");
const SellerSignUp = lazyWithRetry(() => import("./modules/seller/pages/SellerSignUp"), "SellerSignUp");

// Lazy load admin routes
const AdminLayout = lazyWithRetry(
  () => import("./modules/admin/components/AdminLayout"), "AdminLayout"
);
const AdminDashboard = lazyWithRetry(
  () => import("./modules/admin/pages/AdminDashboard"), "AdminDashboard"
);
const AdminLogin = lazyWithRetry(() => import("./modules/admin/pages/AdminLogin"), "AdminLogin");
const AdminCategory = lazyWithRetry(() => import("./modules/admin/pages/AdminCategory"), "AdminCategory");
const AdminHeaderCategory = lazyWithRetry(
  () => import("./modules/admin/pages/AdminHeaderCategory"), "AdminHeaderCategory"
);
const AdminSubCategory = lazyWithRetry(
  () => import("./modules/admin/pages/AdminSubCategory"), "AdminSubCategory"
);
const AdminBrand = lazyWithRetry(() => import("./modules/admin/pages/AdminBrand"), "AdminBrand");
const AdminTaxes = lazyWithRetry(() => import("./modules/admin/pages/AdminTaxes"), "AdminTaxes");
const AdminSellerTransaction = lazyWithRetry(
  () => import("./modules/admin/pages/AdminSellerTransaction"), "AdminSellerTransaction"
);
const AdminStockManagement = lazyWithRetry(
  () => import("./modules/admin/pages/AdminStockManagement"), "AdminStockManagement"
);
const AdminSubcategoryOrder = lazyWithRetry(
  () => import("./modules/admin/pages/AdminSubcategoryOrder"), "AdminSubcategoryOrder"
);
const AdminManageSellerList = lazyWithRetry(
  () => import("./modules/admin/pages/AdminManageSellerList"), "AdminManageSellerList"
);
const AdminCoupon = lazyWithRetry(() => import("./modules/admin/pages/AdminCoupon"), "AdminCoupon");
const AdminNotification = lazyWithRetry(
  () => import("./modules/admin/pages/AdminNotification"), "AdminNotification"
);
const AdminSellerLocation = lazyWithRetry(
  () => import("./modules/admin/pages/AdminSellerLocation"), "AdminSellerLocation"
);

const AdminManageDeliveryBoy = lazyWithRetry(
  () => import("./modules/admin/pages/AdminManageDeliveryBoy"), "AdminManageDeliveryBoy"
);
const AdminAssignDeliveryBoy = lazyWithRetry(
  () => import("./modules/admin/pages/AdminAssignDeliveryBoy"), "AdminAssignDeliveryBoy"
);
const AdminDeliveryTracking = lazyWithRetry(
  () => import("./modules/admin/pages/AdminDeliveryTracking"), "AdminDeliveryTracking"
);
const AdminFundTransfer = lazyWithRetry(
  () => import("./modules/admin/pages/AdminFundTransfer"), "AdminFundTransfer"
);
const AdminCashCollection = lazyWithRetry(
  () => import("./modules/admin/pages/AdminCashCollection"), "AdminCashCollection"
);
const AdminReturnRequest = lazyWithRetry(
  () => import("./modules/admin/pages/AdminReturnRequest"), "AdminReturnRequest"
);
const AdminPaymentList = lazyWithRetry(
  () => import("./modules/admin/pages/AdminPaymentList"), "AdminPaymentList"
);
const AdminSmsGateway = lazyWithRetry(
  () => import("./modules/admin/pages/AdminSmsGateway"), "AdminSmsGateway"
);
const AdminSystemUser = lazyWithRetry(
  () => import("./modules/admin/pages/AdminSystemUser"), "AdminSystemUser"
);
const AdminUsers = lazyWithRetry(() => import("./modules/admin/pages/AdminUsers"), "AdminUsers");
const AdminFAQ = lazyWithRetry(() => import("./modules/admin/pages/AdminFAQ"), "AdminFAQ");
const AdminHomeSection = lazyWithRetry(
  () => import("./modules/admin/pages/AdminHomeSection"), "AdminHomeSection"
);
const AdminBestsellerCards = lazyWithRetry(
  () => import("./modules/admin/pages/AdminBestsellerCards"), "AdminBestsellerCards"
);
const AdminPromoStrip = lazyWithRetry(
  () => import("./modules/admin/pages/AdminPromoStrip"), "AdminPromoStrip"
);
const AdminLowestPrices = lazyWithRetry(
  () => import("./modules/admin/pages/AdminLowestPrices"), "AdminLowestPrices"
);
const AdminShopByStore = lazyWithRetry(
  () => import("./modules/admin/pages/AdminShopByStore"), "AdminShopByStore"
);
const AdminAllOrders = lazyWithRetry(
  () => import("./modules/admin/pages/AdminAllOrders"), "AdminAllOrders"
);
const AdminPendingOrders = lazyWithRetry(
  () => import("./modules/admin/pages/AdminPendingOrders"), "AdminPendingOrders"
);
const AdminReceivedOrders = lazyWithRetry(
  () => import("./modules/admin/pages/AdminReceivedOrders"), "AdminReceivedOrders"
);
const AdminProcessedOrders = lazyWithRetry(
  () => import("./modules/admin/pages/AdminProcessedOrders"), "AdminProcessedOrders"
);
const AdminShippedOrders = lazyWithRetry(
  () => import("./modules/admin/pages/AdminShippedOrders"), "AdminShippedOrders"
);
const AdminOutForDeliveryOrders = lazyWithRetry(
  () => import("./modules/admin/pages/AdminOutForDeliveryOrders"), "AdminOutForDeliveryOrders"
);
const AdminDeliveredOrders = lazyWithRetry(
  () => import("./modules/admin/pages/AdminDeliveredOrders"), "AdminDeliveredOrders"
);
const AdminCancelledOrders = lazyWithRetry(
  () => import("./modules/admin/pages/AdminCancelledOrders"), "AdminCancelledOrders"
);
const AdminCustomerAppPolicy = lazyWithRetry(
  () => import("./modules/admin/pages/AdminCustomerAppPolicy"), "AdminCustomerAppPolicy"
);
const AdminDeliveryAppPolicy = lazyWithRetry(
  () => import("./modules/admin/pages/AdminDeliveryAppPolicy"), "AdminDeliveryAppPolicy"
);
const AdminOrders = lazyWithRetry(() => import("./modules/admin/pages/AdminOrders"), "AdminOrders");
const AdminOrderDetail = lazyWithRetry(
  () => import("./modules/admin/pages/AdminOrderDetail"), "AdminOrderDetail"
);
const AdminSettlement = lazyWithRetry(
  () => import("./modules/admin/pages/AdminSettlement"), "AdminSettlement"
);
const AdminManageCustomer = lazyWithRetry(
  () => import("./modules/admin/pages/AdminManageCustomer"), "AdminManageCustomer"
);
const AdminProfile = lazyWithRetry(() => import("./modules/admin/pages/AdminProfile"), "AdminProfile");

const AdminWithdrawals = lazyWithRetry(
  () => import("./modules/admin/pages/AdminWithdrawals"), "AdminWithdrawals"
);
const AdminPayments = lazyWithRetry(() => import("./modules/admin/pages/AdminPayments"), "AdminPayments");
const AdminWallet = lazyWithRetry(() => import("./modules/admin/pages/AdminWallet"), "AdminWallet");
const AdminBillingSettings = lazyWithRetry(
  () => import("./modules/admin/pages/AdminBillingSettings"), "AdminBillingSettings"
);
const AdminAppSettings = lazyWithRetry(
  () => import("./modules/admin/pages/AdminAppSettings"), "AdminAppSettings"
);

function App() {
  useEffect(() => {
    // Clear global chunk reload attempt flags when app successfully mounts
    try {
      sessionStorage.removeItem('global_chunk_reload_attempted');
      sessionStorage.removeItem('vite_preload_reloaded');
    } catch {
      // Ignore
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleCallbackId: number | null = null;
    let unsubscribeForegroundHandler: (() => void) | void;

    const bootstrapPushNotifications = async () => {
      try {
        const {
          initializePushNotifications,
          setupForegroundNotificationHandler,
        } = await import("./services/pushNotificationService");

        if (cancelled) {
          return;
        }

        await initializePushNotifications();

        if (cancelled) {
          return;
        }

        unsubscribeForegroundHandler = await setupForegroundNotificationHandler(
          (payload) => {
            console.log("Notification received in app:", payload);
          },
        );
      } catch (error) {
        console.error("Failed to bootstrap push notifications:", error);
      }
    };

    const scheduleBootstrap = () => {
      if ("requestIdleCallback" in window) {
        idleCallbackId = window.requestIdleCallback(() => {
          void bootstrapPushNotifications();
        });
        return;
      }

      timeoutId = setTimeout(() => {
        void bootstrapPushNotifications();
      }, 0);
    };

    scheduleBootstrap();

    return () => {
      cancelled = true;
      if (idleCallbackId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (typeof unsubscribeForegroundHandler === "function") {
        unsubscribeForegroundHandler();
      }
    };
  }, []);

  return (
    <ErrorBoundary>
      <LoadingProvider>
        <AxiosLoadingInterceptor>
          <IconLoader />
          <AuthProvider>
            <AppSettingsProvider>
              <ThemeProvider>
                <LocationProvider>
                  <ToastProvider>
                    <WishlistProvider>
                      <CartProvider>
                        <OrdersProvider>
                          <BrowserRouter
                            future={{
                              v7_startTransition: true,
                              v7_relativeSplatPath: true,
                            }}>
                            <RouteLoaderTrigger />
                            <Routes>
                          {/* Public Routes */}
                          <Route
                            path="/login"
                            element={
                              <PublicRoute userType="Customer">
                                <Suspense fallback={<IconLoader forceShow />}>
                                  <Login />
                                </Suspense>
                              </PublicRoute>
                            }
                          />

                          <Route
                            path="/seller/login"
                            element={
                              <PublicRoute userType="Seller">
                                <Suspense fallback={<IconLoader forceShow />}>
                                  <SellerLogin />
                                </Suspense>
                              </PublicRoute>
                            }
                          />
                          <Route
                            path="/seller/signup"
                            element={
                              <PublicRoute userType="Seller">
                                <Suspense fallback={<IconLoader forceShow />}>
                                  <SellerSignUp />
                                </Suspense>
                              </PublicRoute>
                            }
                          />
                          <Route
                            path="/delivery/login"
                            element={
                              <PublicRoute userType="Delivery">
                                <Suspense fallback={<IconLoader forceShow />}>
                                  <DeliveryLogin />
                                </Suspense>
                              </PublicRoute>
                            }
                          />
                          <Route
                            path="/delivery/signup"
                            element={
                              <PublicRoute userType="Delivery">
                                <Suspense fallback={<IconLoader forceShow />}>
                                  <DeliverySignUp />
                                </Suspense>
                              </PublicRoute>
                            }
                          />
                          <Route
                            path="/admin/login"
                            element={
                              <PublicRoute userType="Admin">
                                <Suspense fallback={<IconLoader forceShow />}>
                                  <AdminLogin />
                                </Suspense>
                              </PublicRoute>
                            }
                          />

                          {/* Delivery App Routes */}
                          <Route
                            path="/delivery/*"
                            element={
                              <ProtectedRoute
                                requiredUserType="Delivery"
                                redirectTo="/delivery/login">
                                <Suspense fallback={<IconLoader forceShow />}>
                                  <DeliveryLayout>
                                    <Routes>
                                      <Route
                                        path=""
                                        element={<DeliveryDashboard />}
                                      />
                                      <Route
                                        path="orders"
                                        element={<DeliveryOrders />}
                                      />
                                      <Route
                                        path="orders/:id"
                                        element={<DeliveryOrderDetail />}
                                      />
                                      <Route
                                        path="orders/pending"
                                        element={<DeliveryPendingOrders />}
                                      />
                                      <Route
                                        path="orders/all"
                                        element={<DeliveryAllOrders />}
                                      />
                                      <Route
                                        path="orders/return"
                                        element={<DeliveryReturnOrders />}
                                      />
                                      <Route
                                        path="notifications"
                                        element={<DeliveryNotifications />}
                                      />
                                      <Route
                                        path="menu"
                                        element={<DeliveryMenu />}
                                      />
                                      <Route
                                        path="profile"
                                        element={<DeliveryProfile />}
                                      />
                                      <Route
                                        path="earnings"
                                        element={<DeliveryEarnings />}
                                      />
                                      <Route
                                        path="wallet"
                                        element={<DeliveryWallet />}
                                      />
                                      <Route
                                        path="settings"
                                        element={<DeliverySettings />}
                                      />
                                      <Route
                                        path="help"
                                        element={<DeliveryHelp />}
                                      />
                                      <Route
                                        path="about"
                                        element={<DeliveryAbout />}
                                      />
                                      <Route
                                        path="sellers-in-range"
                                        element={<DeliverySellersInRange />}
                                      />
                                    </Routes>
                                  </DeliveryLayout>
                                </Suspense>
                              </ProtectedRoute>
                            }
                          />

                          {/* Seller App Routes */}
                          <Route
                            path="/seller/*"
                            element={
                              <ProtectedRoute
                                requiredUserType="Seller"
                                redirectTo="/seller/login">
                                <Suspense fallback={<IconLoader forceShow />}>
                                  <SellerLayout>
                                    <Routes>
                                      <Route
                                        path=""
                                        element={<SellerDashboard />}
                                      />
                                      <Route
                                        path="orders"
                                        element={<SellerOrders />}
                                      />
                                      <Route
                                        path="notifications"
                                        element={<SellerNotifications />}
                                      />
                                      <Route
                                        path="settlement"
                                        element={<SellerSettlement />}
                                      />
                                      <Route
                                        path="delivery-tracking"
                                        element={<SellerDeliveryTracking />}
                                      />
                                      <Route
                                        path="orders/:id"
                                        element={<SellerOrderDetail />}
                                      />
                                      <Route
                                        path="reviews"
                                        element={<SellerReviews />}
                                      />
                                      <Route
                                        path="category"
                                        element={<SellerCategory />}
                                      />
                                      <Route
                                        path="subcategory"
                                        element={<SellerSubCategory />}
                                      />
                                      <Route
                                        path="product/add"
                                        element={<SellerAddProduct />}
                                      />
                                      <Route
                                        path="product/edit/:id"
                                        element={<SellerAddProduct />}
                                      />
                                      <Route
                                        path="product/taxes"
                                        element={<SellerTaxes />}
                                      />
                                      <Route
                                        path="product/list"
                                        element={<SellerProductList />}
                                      />
                                      <Route
                                        path="product/stock"
                                        element={<SellerStockManagement />}
                                      />
                                      <Route
                                        path="return"
                                        element={<SellerReturnRequest />}
                                      />
                                      <Route
                                        path="return-order"
                                        element={<SellerReturnRequest />}
                                      />
                                      <Route
                                        path="wallet"
                                        element={<SellerWallet />}
                                      />
                                      <Route
                                        path="reports/sales"
                                        element={<SellerSalesReport />}
                                      />
                                      <Route
                                        path="account-settings"
                                        element={<SellerAccountSettings />}
                                      />
                                    </Routes>
                                  </SellerLayout>
                                </Suspense>
                              </ProtectedRoute>
                            }
                          />

                          {/* Admin App Routes */}
                          <Route
                            path="/admin/*"
                            element={
                              <ProtectedRoute
                                requiredUserType="Admin"
                                redirectTo="/admin/login">
                                <Suspense fallback={<IconLoader forceShow />}>
                                  <AdminLayout>
                                    <Routes>
                                      <Route
                                        path=""
                                        element={<AdminDashboard />}
                                      />
                                      <Route
                                        path="profile"
                                        element={<AdminProfile />}
                                      />
                                      <Route
                                        path="category"
                                        element={<AdminCategory />}
                                      />
                                      <Route
                                        path="category/header"
                                        element={<AdminHeaderCategory />}
                                      />
                                      <Route
                                        path="subcategory"
                                        element={<AdminSubCategory />}
                                      />
                                      <Route
                                        path="subcategory-order"
                                        element={<AdminSubcategoryOrder />}
                                      />
                                      <Route
                                        path="brand"
                                        element={<AdminBrand />}
                                      />
                                      <Route
                                        path="product/taxes"
                                        element={<AdminTaxes />}
                                      />
                                      <Route
                                        path="product/list"
                                        element={<AdminStockManagement />}
                                      />
                                      <Route
                                        path="manage-seller/list"
                                        element={<AdminManageSellerList />}
                                      />
                                      <Route
                                        path="manage-seller/transaction"
                                        element={<AdminSellerTransaction />}
                                      />
                                      <Route
                                        path="delivery-boy/manage"
                                        element={<AdminManageDeliveryBoy />}
                                      />
                                      <Route
                                        path="delivery-boy/manual-assign"
                                        element={<AdminAssignDeliveryBoy />}
                                      />
                                      <Route
                                        path="delivery-boy/fund-transfer"
                                        element={<AdminFundTransfer />}
                                      />
                                      <Route
                                        path="delivery-boy/cash-collection"
                                        element={<AdminCashCollection />}
                                      />
                                      <Route
                                        path="manage-location/seller-location"
                                        element={<AdminSellerLocation />}
                                      />

                                      <Route
                                        path="coupon"
                                        element={<AdminCoupon />}
                                      />
                                      <Route
                                        path="return"
                                        element={<AdminReturnRequest />}
                                      />
                                      <Route
                                        path="notification"
                                        element={<AdminNotification />}
                                      />
                                      <Route
                                        path="orders"
                                        element={<AdminOrders />}
                                      />
                                      <Route
                                        path="customers"
                                        element={<AdminManageCustomer />}
                                      />
                                      <Route
                                        path="collect-cash"
                                        element={<AdminCashCollection />}
                                      />
                                      <Route
                                        path="payment-list"
                                        element={<AdminPaymentList />}
                                      />
                                      <Route
                                        path="sms-gateway"
                                        element={<AdminSmsGateway />}
                                      />
                                      <Route
                                        path="system-user"
                                        element={<AdminSystemUser />}
                                      />
                                      <Route
                                        path="customer-app-policy"
                                        element={<AdminCustomerAppPolicy />}
                                      />
                                      <Route
                                        path="delivery-app-policy"
                                        element={<AdminDeliveryAppPolicy />}
                                      />
                                      <Route
                                        path="users"
                                        element={<AdminUsers />}
                                      />
                                      <Route
                                        path="faq"
                                        element={<AdminFAQ />}
                                      />
                                      <Route
                                        path="home-section"
                                        element={<AdminHomeSection />}
                                      />
                                      <Route
                                        path="bestseller-cards"
                                        element={<AdminBestsellerCards />}
                                      />
                                      <Route
                                        path="promo-strip"
                                        element={<AdminPromoStrip />}
                                      />
                                      <Route
                                        path="lowest-prices"
                                        element={<AdminLowestPrices />}
                                      />
                                      <Route
                                        path="shop-by-store"
                                        element={<AdminShopByStore />}
                                      />
                                      <Route
                                        path="delivery-tracking"
                                        element={<AdminDeliveryTracking />}
                                      />
                                      <Route
                                        path="settlement"
                                        element={<AdminSettlement />}
                                      />
                                      <Route
                                        path="orders/all"
                                        element={<AdminAllOrders />}
                                      />
                                      <Route
                                        path="orders/pending"
                                        element={<AdminPendingOrders />}
                                      />
                                      <Route
                                        path="orders/received"
                                        element={<AdminReceivedOrders />}
                                      />
                                      <Route
                                        path="orders/processed"
                                        element={<AdminProcessedOrders />}
                                      />
                                      <Route
                                        path="orders/shipped"
                                        element={<AdminShippedOrders />}
                                      />
                                      <Route
                                        path="orders/out-for-delivery"
                                        element={<AdminOutForDeliveryOrders />}
                                      />
                                      <Route
                                        path="orders/delivered"
                                        element={<AdminDeliveredOrders />}
                                      />
                                      <Route
                                        path="orders/cancelled"
                                        element={<AdminCancelledOrders />}
                                      />
                                      <Route
                                        path="orders/:id"
                                        element={<AdminOrderDetail />}
                                      />

                                      <Route
                                        path="withdrawals"
                                        element={<AdminWithdrawals />}
                                      />
                                      <Route
                                        path="payments"
                                        element={<AdminPayments />}
                                      />
                                      <Route
                                        path="wallet"
                                        element={<AdminWallet />}
                                      />
                                      <Route
                                        path="billing-settings"
                                        element={<AdminBillingSettings />}
                                      />
                                      <Route
                                        path="app-settings"
                                        element={<AdminAppSettings />}
                                      />
                                      <Route
                                        path="settings"
                                        element={<AdminAppSettings />}
                                      />
                                    </Routes>
                                  </AdminLayout>
                                </Suspense>
                              </ProtectedRoute>
                            }
                          />

                          {/* Main App Routes */}
                          <Route
                            path="/*"
                            element={
                              <AppLayout>
                                <Suspense fallback={<IconLoader forceShow />}>
                                  <Routes>
                                    <Route
                                      path="/"
                                      element={
                                        <ProtectedRoute
                                          requiredUserType="Customer"
                                          redirectTo="/login">
                                          <Home />
                                        </ProtectedRoute>
                                      }
                                    />
                                    <Route
                                      path="/user/home"
                                      element={<Home />}
                                    />
                                    <Route
                                      path="/search"
                                      element={<Search />}
                                    />
                                    <Route
                                      path="/orders"
                                      element={<Orders />}
                                    />
                                    <Route
                                      path="/orders/:id"
                                      element={<OrderDetail />}
                                    />
                                    <Route
                                      path="/order-again"
                                      element={<OrderAgain />}
                                    />
                                    <Route
                                      path="/account"
                                      element={<Account />}
                                    />
                                    <Route
                                      path="/notifications"
                                      element={<UserNotifications />}
                                    />
                                    <Route
                                      path="/about-us"
                                      element={<AboutUs />}
                                    />
                                    <Route path="/faq" element={<FAQ />} />
                                    <Route
                                      path="/wishlist"
                                      element={<Wishlist />}
                                    />
                                    <Route
                                      path="/categories"
                                      element={<Categories />}
                                    />
                                    <Route
                                      path="/category/:id"
                                      element={<Category />}
                                    />
                                    <Route
                                      path="/address-book"
                                      element={<AddressBook />}
                                    />
                                    <Route
                                      path="/checkout"
                                      element={<Checkout />}
                                    />
                                    <Route
                                      path="/checkout/address"
                                      element={<CheckoutAddress />}
                                    />
                                    <Route
                                      path="/product/:id"
                                      element={<ProductDetail />}
                                    />
                                    <Route
                                      path="/invoice/:id"
                                      element={<Invoice />}
                                    />
                                    <Route path="/cart" element={<Cart />} />
                                    <Route
                                      path="/addresses"
                                      element={<Addresses />}
                                    />
                                    <Route
                                      path="/store/:slug"
                                      element={<StorePage />}
                                    />
                                    <Route
                                      path="/store/spiritual"
                                      element={<SpiritualStore />}
                                    />
                                    <Route
                                      path="/store/pharma"
                                      element={<PharmaStore />}
                                    />
                                    <Route
                                      path="/store/e-gifts"
                                      element={<EGiftStore />}
                                    />
                                    <Route
                                      path="/store/pet"
                                      element={<PetStore />}
                                    />
                                    <Route
                                      path="/store/sports"
                                      element={<SportsStore />}
                                    />
                                    <Route
                                      path="/store/fashion-basics"
                                      element={<FashionStore />}
                                    />
                                    <Route
                                      path="/store/toy"
                                      element={<ToyStore />}
                                    />
                                    <Route
                                      path="/store/hobby"
                                      element={<HobbyStore />}
                                    />
                                  </Routes>
                                </Suspense>
                              </AppLayout>
                            }
                          />
                          </Routes>
                        </BrowserRouter>
                      </OrdersProvider>
                    </CartProvider>
                  </WishlistProvider>
                </ToastProvider>
              </LocationProvider>
            </ThemeProvider>
          </AppSettingsProvider>
        </AuthProvider>
        </AxiosLoadingInterceptor>
      </LoadingProvider>
    </ErrorBoundary>
  );
}

export default App;
