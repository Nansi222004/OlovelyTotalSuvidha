import { Router } from 'express';
import { authenticate, requireUserType } from '../middleware/auth';
import {
    getAllWithdrawals,
    approveWithdrawal,
    rejectWithdrawal,
    completeWithdrawal,
} from '../modules/admin/controllers/adminWithdrawalController';

const router = Router();

// All routes require admin authentication
router.use(authenticate, requireUserType('Admin'));

// Get all withdrawal requests
router.get('/', getAllWithdrawals);

// Approve withdrawal
router.put('/:id/approve', approveWithdrawal);

// Reject withdrawal
router.put('/:id/reject', rejectWithdrawal);

// Complete withdrawal
router.put('/:id/complete', completeWithdrawal);

export default router;
