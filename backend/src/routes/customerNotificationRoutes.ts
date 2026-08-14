import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import * as customerNotificationController from "../modules/customer/controllers/customerNotificationController";

const router = Router();

router.get(
  "/notifications",
  authenticate,
  requireUserType("Customer"),
  customerNotificationController.getNotifications
);

router.put(
  "/notifications/:id/read",
  authenticate,
  requireUserType("Customer"),
  customerNotificationController.markNotificationRead
);

export default router;

