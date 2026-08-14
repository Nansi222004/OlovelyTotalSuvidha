import { Router } from "express";
import { getHomeContent, getStoreProducts, checkServiceability } from "../modules/customer/controllers/customerHomeController";

const router = Router();

// Public routes
router.get("/serviceability", checkServiceability);
router.get("/", getHomeContent);
router.get("/store/:storeId", getStoreProducts);

export default router;
