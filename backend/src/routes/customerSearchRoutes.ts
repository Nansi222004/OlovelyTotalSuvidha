import { Router } from "express";
import { getSearchSuggestions } from "../modules/customer/controllers/customerSearchController";

const router = Router();

// Public route for lightweight search autocomplete suggestions
router.get("/suggestions", getSearchSuggestions);

export default router;
