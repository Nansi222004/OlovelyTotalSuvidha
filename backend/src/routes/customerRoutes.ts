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

// Get customer location (protected route)
router.get("/location", authenticate, customerController.getLocation);

export default router;
