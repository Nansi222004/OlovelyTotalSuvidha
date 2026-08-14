
import { Router } from 'express';
import { getWishlist, addToWishlist, removeFromWishlist } from '../modules/customer/controllers/wishlistController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getWishlist);
router.post('/', addToWishlist);
router.delete('/:productId', removeFromWishlist);

export default router;
