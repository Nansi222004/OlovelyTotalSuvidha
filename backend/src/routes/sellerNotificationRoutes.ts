import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import * as sellerNotificationController from "../modules/seller/controllers/sellerNotificationController";

const router = Router();

router.get(
  "/notifications",
  authenticate,
  requireUserType("Seller"),
  sellerNotificationController.getNotifications
);

router.put(
  "/notifications/:id/read",
  authenticate,
  requireUserType("Seller"),
  sellerNotificationController.markNotificationRead
);

export default router;

