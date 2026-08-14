import { Router } from "express";
import { createOrder, getMyOrders, getOrderById, refreshDeliveryOtp } from "../modules/customer/controllers/customerOrderController";
import { authenticate } from "../middleware/auth";

const router = Router();

console.log('customerOrderRoutes is being loaded');

// Protected routes (must be logged in)
router.use(authenticate);

router.post("/", createOrder);
router.get("/", getMyOrders);
router.get("/:id", getOrderById);
router.post("/:id/refresh-otp", refreshDeliveryOtp);

export default router;
