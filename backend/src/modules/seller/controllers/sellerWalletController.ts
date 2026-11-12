import { Request, Response } from 'express';
import {
    getWalletBalance,
    getWalletTransactions,
    createWithdrawalRequest,
    getWithdrawalRequests,
} from '../../../services/walletManagementService';
import { getCommissionSummary } from '../../../services/commissionService';

/**
 * Get seller wallet balance
 */
export const getBalance = async (req: Request, res: Response) => {
    try {
        const sellerId = (req as any).user!.userId;
        
        // Release THIS seller's expired escrow so the page is current (the scheduler handles all sellers)
        const { releaseExpiredEscrow } = await import('../../../services/commissionService');
        await releaseExpiredEscrow({ sellerId });

        const Seller = (await import('../../../models/Seller')).default;
        const Commission = (await import('../../../models/Commission')).default;
        const WithdrawRequest = (await import('../../../models/WithdrawRequest')).default;
        const mongoose = (await import('mongoose')).default;
        const sid = new mongoose.Types.ObjectId(sellerId);
        const seller = await Seller.findById(sellerId).select('balance onHoldBalance pendingWithdrawalAmount');
        const [pendingAgg] = await Commission.aggregate([
            { $match: { seller: sid, type: 'SELLER', status: 'Pending' } },
            { $group: { _id: null, total: { $sum: { $subtract: ['$orderAmount', '$commissionAmount'] } } } },
        ]);
        const [withdrawnAgg] = await WithdrawRequest.aggregate([
            { $match: { userId: sid, userType: 'SELLER', status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
        const balance = r2(seller?.balance || 0);
        const reserved = r2((seller as any)?.pendingWithdrawalAmount || 0);

        // B-5 buckets
        return res.status(200).json({
            success: true,
            data: {
                balance,                                    // available (return window over)
                onHoldBalance: r2(seller?.onHoldBalance || 0), // locked by return window
                pendingEarnings: r2(pendingAgg?.total || 0),   // money not yet received (COD cash / remittance / undelivered)
                pendingWithdrawal: reserved,                // reserved by open withdrawal requests
                withdrawableBalance: r2(Math.max(0, balance - reserved)),
                totalWithdrawn: r2(withdrawnAgg?.total || 0),
            },
        });
    } catch (error: any) {
        console.error('Error getting wallet balance:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get wallet balance',
        });
    }
};

/**
 * Get seller wallet transactions
 */
export const getTransactions = async (req: Request, res: Response) => {
    try {
        const sellerId = (req as any).user!.userId;
        const { page = 1, limit = 20 } = req.query;

        const result = await getWalletTransactions(
            sellerId,
            'SELLER',
            Number(page),
            Number(limit)
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error getting wallet transactions:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get wallet transactions',
        });
    }
};

/**
 * Request withdrawal
 */
export const requestWithdrawal = async (req: Request, res: Response) => {
    try {
        const sellerId = (req as any).user!.userId;
        const { amount, paymentMethod } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid withdrawal amount',
            });
        }

        if (!paymentMethod || !['Bank Transfer', 'UPI'].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment method',
            });
        }

        const result = await createWithdrawalRequest(
            sellerId,
            'SELLER',
            amount,
            paymentMethod
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json(result);
    } catch (error: any) {
        console.error('Error requesting withdrawal:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to request withdrawal',
        });
    }
};

/**
 * Get seller withdrawal requests
 */
export const getWithdrawals = async (req: Request, res: Response) => {
    try {
        const sellerId = (req as any).user!.userId;
        const { status } = req.query;

        const result = await getWithdrawalRequests(
            sellerId,
            'SELLER',
            status as string
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error getting withdrawal requests:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get withdrawal requests',
        });
    }
};

/**
 * Get seller commission earnings
 */
export const getCommissions = async (req: Request, res: Response) => {
    try {
        const sellerId = (req as any).user!.userId;

        const result = await getCommissionSummary(sellerId, 'SELLER');

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error getting commission earnings:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get commission earnings',
        });
    }
};
