import { Router } from "express";
import * as customerController from "../modules/customer/controllers/customerController";
import { authenticate } from "../middleware/auth";
import AppSettings from "../models/AppSettings";

const router = Router();

// Get public app settings (app name, logo, delivery time, etc.)
router.get("/app-settings", async (_req, res) => {
  try {
    let settings = await AppSettings.findOne();
    if (!settings) {
      settings = await AppSettings.create({
        appName: "Olovely Total Suvidha",
        appLogo: "/assets/olovelylogo_transparent.png",
        estimatedDeliveryTime: "12-15 mins",
        contactEmail: "contact@olovely.com",
        contactPhone: "9876543210",
      });
    }
    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// Get customer profile (protected route)
router.get("/profile", authenticate, customerController.getProfile);

// Update customer profile (protected route)
router.put("/profile", authenticate, customerController.updateProfile);

// Update customer location (protected route)
router.post("/location", authenticate, customerController.updateLocation);

import * as walletController from "../modules/customer/controllers/customerWalletController";
import * as supportController from "../modules/customer/controllers/customerSupportController";

// Customer Wallet routes (protected)
router.get("/wallet/balance", authenticate, walletController.getCustomerWalletBalance);
router.get("/wallet/transactions", authenticate, walletController.getCustomerWalletTransactions);

// Customer Support Contact route (optional authentication)
const optionalAuthenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next();
  return authenticate(req, res, next);
};

router.post("/support/contact", optionalAuthenticate, supportController.submitCustomerSupport);

import FAQ from "../models/FAQ";
import Policy from "../models/Policy";

// Get active FAQs for customer app
router.get("/faqs", async (_req, res) => {
  try {
    const faqs = await FAQ.find({ status: "Active" }).sort({ order: 1, createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: faqs,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// Get active Customer App Policy
router.get("/policy", async (_req, res) => {
  try {
    const policy = await Policy.findOne({ type: "customer", isActive: true }).sort({ createdAt: -1 });
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

export default router;

