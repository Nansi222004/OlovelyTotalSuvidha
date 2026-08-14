import { Router } from 'express';
import * as walletController from '../modules/seller/controllers/walletController';
import { authenticate, requireUserType } from '../middleware/auth';

const router = Router();

// All wallet routes require seller authentication
router.use(authenticate);
router.use(requireUserType('Seller'));

router.get('/stats', walletController.getWalletStats);
router.get('/transactions', walletController.getTransactions);
router.get('/withdrawals', walletController.getWithdrawalRequests);
router.post('/withdrawals', walletController.createWithdrawalRequest);
router.get('/earnings', walletController.getOrderEarnings);

export default router;
