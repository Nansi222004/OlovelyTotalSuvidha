import { Router } from 'express';
import { getActiveBanners } from '../modules/admin/controllers/adminBannerController';

const router = Router();

// Public — no authentication required
// GET /customer/banners?section=QUICK_COMMERCE
router.get('/', getActiveBanners);

export default router;
