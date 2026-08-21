import { Router } from "express";
import * as deliveryDashboardController from "../modules/delivery/controllers/deliveryDashboardController";
import * as deliveryOrderController from "../modules/delivery/controllers/deliveryOrderController";
import * as deliveryEarningController from "../modules/delivery/controllers/deliveryEarningController";
import { getProfile } from "../modules/delivery/controllers/deliveryAuthController";
import { requireApprovedUser } from "../middleware/auth";
import * as deliveryReturnController from "../modules/delivery/controllers/deliveryReturnController";

import * as deliveryProfileController from "../modules/delivery/controllers/deliveryProfileController";
import * as deliveryNotificationController from "../modules/delivery/controllers/deliveryNotificationController";

const router = Router();

// Profile & Non-Operational Status (accessible to unapproved/pending delivery partners)
router.get("/profile", getProfile);
router.put("/profile", deliveryProfileController.updateProfile);
router.put("/settings", deliveryProfileController.updateSettings);

// Help & Support
router.get("/help", deliveryDashboardController.getHelpSupport);

import Policy from "../models/Policy";
import AppSettings from "../models/AppSettings";

router.get("/policy", async (req, res) => {
  try {
    const docType = (req.query.type || req.query.docType || "").toString().toLowerCase();
    let query: any = { type: "delivery", isActive: true };
    if (docType === "privacy") {
      query.title = { $regex: /privacy/i };
    } else if (docType === "terms") {
      query.title = { $regex: /terms|condition/i };
    }

    let policy = await Policy.findOne(query).sort({ createdAt: -1 });
    if (!policy && docType) {
      policy = await Policy.findOne({ type: "delivery", isActive: true }).sort({ createdAt: -1 });
    }

    return res.status(200).json({
      success: true,
      data: policy,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get("/app-info", async (_req, res) => {
  try {
    const settings = await AppSettings.findOne();
    return res.status(200).json({
      success: true,
      data: {
        appName: settings?.appName || "Olovely Total Suvidha Delivery",
        appLogo: settings?.appLogo || "",
        version: "1.0.0",
        contactEmail: settings?.supportEmail || settings?.contactEmail || "support@dhakadsnazzy.com",
        contactPhone: settings?.supportPhone || settings?.contactPhone || "+91 7846940429",
        address: `${settings?.companyAddress || 'Jaipur'}, ${settings?.companyCity || 'Jaipur'}`,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

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

// ==================== Return Pickup Routes ====================
// All return routes require approval — DP must be verified and active
router.get("/returns", requireApprovedUser, deliveryReturnController.getAssignedReturns);
router.get("/returns/:id", requireApprovedUser, deliveryReturnController.getReturnDetails);
router.post("/returns/:id/accept", requireApprovedUser, deliveryReturnController.acceptReturnAssignment);
router.post("/returns/:id/generate-pickup-otp", requireApprovedUser, deliveryReturnController.generateReturnPickupOtpController);
router.post("/returns/:id/verify-pickup-otp", requireApprovedUser, deliveryReturnController.verifyReturnPickupOtpController);
router.patch("/returns/:id/mark-in-transit", requireApprovedUser, deliveryReturnController.markReturnInTransit);
router.patch("/returns/:id/mark-handed-to-seller", requireApprovedUser, deliveryReturnController.markHandedToSeller);

export default router;
