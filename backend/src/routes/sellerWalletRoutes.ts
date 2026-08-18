import { Router } from 'express';
import { authenticate, requireUserType, requireApprovedUser } from '../middleware/auth';
import {
    getBalance,
    getTransactions,
    requestWithdrawal,
    getWithdrawals,
    getCommissions,
} from '../modules/seller/controllers/sellerWalletController';

const router = Router();

// All routes require seller authentication and operational approval
router.use(authenticate, requireUserType('Seller'), requireApprovedUser);

// Wallet balance
router.get('/balance', getBalance);

// Wallet transactions
router.get('/transactions', getTransactions);

// Withdrawal requests
router.post('/withdraw', requestWithdrawal);
router.get('/withdrawals', getWithdrawals);

// Commission earnings
router.get('/commissions', getCommissions);

export default router;
