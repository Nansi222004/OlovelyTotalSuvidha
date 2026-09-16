import { Router } from 'express';
import { authenticate, requireUserType } from '../middleware/auth';
import {
  getBanners,
  createBanner,
  updateBanner,
  toggleBanner,
  deleteBanner,
} from '../modules/admin/controllers/adminBannerController';

const router = Router();

// All admin banner routes require Admin authentication
router.use(authenticate, requireUserType('Admin'));

router.get('/', getBanners);
router.post('/', createBanner);
router.put('/:id', updateBanner);
router.patch('/:id/toggle', toggleBanner);
router.delete('/:id', deleteBanner);

export default router;
