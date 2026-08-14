
import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '../modules/customer/controllers/customerCartController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getCart);
router.post('/add', addToCart);
router.put('/item/:itemId', updateCartItem);
router.delete('/item/:itemId', removeFromCart);
router.delete('/', clearCart);

export default router;
