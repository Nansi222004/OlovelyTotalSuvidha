import { Router } from "express";
import { getPublicLanguages, getPublicUITranslations } from "../modules/admin/controllers/adminLanguageController";

const router = Router();

// Public language endpoints (no auth required for language selector and UI translations)
router.get("/", getPublicLanguages);
router.get("/ui-translations", getPublicUITranslations);

export default router;
