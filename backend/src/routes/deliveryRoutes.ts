import { Router } from "express";
import * as deliveryDashboardController from "../modules/delivery/controllers/deliveryDashboardController";
import * as deliveryOrderController from "../modules/delivery/controllers/deliveryOrderController";
import * as deliveryEarningController from "../modules/delivery/controllers/deliveryEarningController";
import { getProfile } from "../modules/delivery/controllers/deliveryAuthController";

import * as deliveryProfileController from "../modules/delivery/controllers/deliveryProfileController";
import * as deliveryNotificationController from "../modules/delivery/controllers/deliveryNotificationController";

const router = Router();

// Profile & Status
router.get("/profile", getProfile);
router.put("/profile", deliveryProfileController.updateProfile);
router.put("/status", deliveryProfileController.updateStatus);
router.put("/settings", deliveryProfileController.updateSettings);

// Notifications
router.get("/notifications", deliveryNotificationController.getNotifications);
router.put("/notifications/:id/read", deliveryNotificationController.markNotificationRead);

// Dashboard Stats
router.get("/dashboard/stats", deliveryDashboardController.getDashboardStats);

// Help & Support
router.get("/help", deliveryDashboardController.getHelpSupport);

// Orders
router.get("/orders/history", deliveryOrderController.getAllOrdersHistory);
router.get("/orders/today", deliveryOrderController.getTodayOrders);
router.get("/orders/pending-alerts", deliveryOrderController.getPendingOrderAlerts);
router.get("/orders/pending", deliveryOrderController.getPendingOrders);
router.get("/orders/returns", deliveryOrderController.getReturnOrders);
router.get("/orders/:id", deliveryOrderController.getOrderDetails); // Specific order details
router.get("/orders/:id/seller-locations", deliveryOrderController.getSellerLocationsForOrder);
router.put("/orders/:id/status", deliveryOrderController.updateOrderStatus);
router.post("/orders/:id/send-delivery-otp", deliveryOrderController.sendDeliveryOtp);
router.post("/orders/:id/verify-delivery-otp", deliveryOrderController.verifyDeliveryOtpController);

// New proximity and pickup routes
router.post("/orders/:id/check-seller-proximity", deliveryOrderController.checkSellerProximity);
router.post("/orders/:id/confirm-seller-pickup", deliveryOrderController.confirmSellerPickup);
router.post("/orders/:id/check-customer-proximity", deliveryOrderController.checkCustomerProximity);

// Earnings
router.get("/earnings", deliveryEarningController.getEarningsHistory);
router.post("/withdraw", deliveryEarningController.requestWithdrawal);

export default router;
