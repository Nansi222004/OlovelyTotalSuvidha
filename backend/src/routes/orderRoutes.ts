import { Router } from "express";
import {
  getOrders,
  getOrderById,
  getOrderCODBreakdown,
  getOrderEarningBreakdownSeller,
  getSettlementOrders,
  markOrderCODPaidSeller,
  updateOrderStatus,
  getPendingOrderAlerts,
} from "../modules/seller/controllers/orderController";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// All routes require authentication and seller user type
router.use(authenticate);
router.use(requireUserType("Seller"));

// Get seller's orders with filters
router.get("/", getOrders);
// Pending actionable order alerts (must be before /:id)
router.get("/pending-alerts", getPendingOrderAlerts);
// Settlement page (must be before /:id)
router.get("/settlement", getSettlementOrders);

// Get order by ID
router.get("/:id", getOrderById);
// COD breakdown (admin commission, your earning, Self Assign note)
router.get("/:id/cod-breakdown", getOrderCODBreakdown);
// Earning breakdown for any order (COD or Online): your earning, delivery (Self / delivery partner)
router.get("/:id/earning-breakdown", getOrderEarningBreakdownSeller);

// Seller marks COD as paid to admin (order leaves pending settlement list)
router.patch("/:id/mark-cod-paid", markOrderCODPaidSeller);

// Update order status
router.patch("/:id/status", updateOrderStatus);

export default router;
