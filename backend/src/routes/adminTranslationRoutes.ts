import { Router } from "express";
import { translateSingleText, batchTranslateFields } from "../controllers/adminTranslationController";
import { authenticate, requireUserType } from "../middleware/auth";

const router = Router();

// Protect all admin translation routes
router.use(authenticate);
router.use(requireUserType("Admin"));

// POST /api/v1/admin/translation/translate
router.post("/translate", translateSingleText);

// POST /api/v1/admin/translation/batch
router.post("/batch", batchTranslateFields);

export default router;
