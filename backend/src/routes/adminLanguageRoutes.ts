import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import {
  getAdminLanguages,
  createLanguage,
  updateLanguage,
  toggleLanguageStatus,
  setDefaultLanguage,
  deleteLanguage,
  generateUITranslations,
  getLanguageUITranslations,
  updateSingleUITranslation,
} from "../modules/admin/controllers/adminLanguageController";

const router = Router();

// Protect all admin language routes
router.use(authenticate, requireUserType("Admin"));

router.get("/", getAdminLanguages);
router.post("/", createLanguage);
router.put("/:id", updateLanguage);
router.patch("/:id/status", toggleLanguageStatus);
router.patch("/:id/default", setDefaultLanguage);
router.delete("/:id", deleteLanguage);

router.post("/:code/generate-ui-translations", generateUITranslations);
router.get("/:code/ui-translations", getLanguageUITranslations);
router.put("/:code/ui-translations/:keyId", updateSingleUITranslation);

export default router;
