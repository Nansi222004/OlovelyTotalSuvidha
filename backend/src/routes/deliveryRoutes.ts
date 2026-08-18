import { Router } from "express";
import * as deliveryDashboardController from "../modules/delivery/controllers/deliveryDashboardController";
import * as deliveryOrderController from "../modules/delivery/controllers/deliveryOrderController";
import * as deliveryEarningController from "../modules/delivery/controllers/deliveryEarningController";
import { getProfile } from "../modules/delivery/controllers/deliveryAuthController";
import { requireApprovedUser } from "../middleware/auth";

import * as deliveryProfileController from "../modules/delivery/controllers/deliveryProfileController";
import * as deliveryNotificationController from "../modules/delivery/controllers/deliveryNotificationController";

const router = Router();

// Profile & Non-Operational Status (accessible to unapproved/pending delivery partners)
router.get("/profile", getProfile);
router.put("/profile", deliveryProfileController.updateProfile);
router.put("/settings", deliveryProfileController.updateSettings);

// Help & Support
router.get("/help", deliveryDashboardController.getHelpSupport);

// Notifications
router.get("/notifications", deliveryNotificationController.getNotifications);
router.put("/notifications/:id/read", deliveryNotificationController.markNotificationRead);

// Operational Status (Going Online/Offline requires approval)
router.put("/status", requireApprovedUser, deliveryProfileController.updateStatus);

// Dashboard Stats (requires approval)
router.get("/dashboard/stats", requireApprovedUser, deliveryDashboardController.getDashboardStats);

// Orders (all operational routes require approval)
router.get("/orders/history", requireApprovedUser, deliveryOrderController.getAllOrdersHistory);
router.get("/orders/today", requireApprovedUser, deliveryOrderController.getTodayOrders);
router.get("/orders/pending-alerts", requireApprovedUser, deliveryOrderController.getPendingOrderAlerts);
router.get("/orders/pending", requireApprovedUser, deliveryOrderController.getPendingOrders);
router.get("/orders/returns", requireApprovedUser, deliveryOrderController.getReturnOrders);
router.get("/orders/:id", requireApprovedUser, deliveryOrderController.getOrderDetails); // Specific order details
router.get("/orders/:id/seller-locations", requireApprovedUser, deliveryOrderController.getSellerLocationsForOrder);
router.put("/orders/:id/status", requireApprovedUser, deliveryOrderController.updateOrderStatus);
router.post("/orders/:id/send-delivery-otp", requireApprovedUser, deliveryOrderController.sendDeliveryOtp);
router.post("/orders/:id/verify-delivery-otp", requireApprovedUser, deliveryOrderController.verifyDeliveryOtpController);
router.post("/orders/:id/accept", requireApprovedUser, deliveryOrderController.acceptOrderController);
router.post("/orders/:id/reject", requireApprovedUser, deliveryOrderController.rejectOrderController);

// Proximity and pickup routes (require approval)
router.post("/orders/:id/check-seller-proximity", requireApprovedUser, deliveryOrderController.checkSellerProximity);
router.post("/orders/:id/confirm-seller-pickup", requireApprovedUser, deliveryOrderController.confirmSellerPickup);
router.post("/orders/:id/check-customer-proximity", requireApprovedUser, deliveryOrderController.checkCustomerProximity);

// Earnings & Withdrawals (require approval)
router.get("/earnings", requireApprovedUser, deliveryEarningController.getEarningsHistory);
router.post("/withdraw", requireApprovedUser, deliveryEarningController.requestWithdrawal);

export default router;
