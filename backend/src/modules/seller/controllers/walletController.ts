/**
 * Legacy seller wallet API (/seller/wallet/*).
 *
 * The seller panel uses /seller/wallet-new (sellerWalletController). These legacy endpoints are
 * kept for backward compatibility but now read the SAME authoritative sources, so any client
 * still calling them sees numbers consistent with the seller panel and admin panel:
 *  - balances: Seller.balance / Seller.onHoldBalance
 *  - ledger:   WalletTransaction { userId, userType: "SELLER" }
 *  - earnings: Commission records (order-time commission snapshot), never an assumed rate
 *
 * Previously every query filtered on a non-existent `sellerId` field (always empty results),
 * earnings used a hardcoded 15% commission, and withdrawal creation bypassed the shared
 * validation (minimum amount, one pending request, bank/UPI details).
 */
import { Request, Response } from 'express';
import Seller from '../../../models/Seller';
import WalletTransaction from '../../../models/WalletTransaction';
import WithdrawRequest from '../../../models/WithdrawRequest';
import Commission from '../../../models/Commission';
import { asyncHandler } from '../../../utils/asyncHandler';
import mongoose from 'mongoose';
import { createWithdrawalRequest as createWithdrawalRequestService } from '../../../services/walletManagementService';

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Get seller's wallet statistics
 */
export const getWalletStats = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);

    const seller = await Seller.findById(sellerId).select('balance onHoldBalance');
    if (!seller) {
        return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    // Earnings = net of non-cancelled seller commissions (same basis as credits/holds)
    const [earnings] = await Commission.aggregate([
        { $match: { seller: sellerObjectId, type: 'SELLER', status: { $ne: 'Cancelled' } } },
        {
            $group: {
                _id: null,
                total: { $sum: { $subtract: ['$orderAmount', '$commissionAmount'] } },
                pending: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'Pending'] }, { $subtract: ['$orderAmount', '$commissionAmount'] }, 0],
                    },
                },
            },
        },
    ]);

    const [withdrawn] = await WithdrawRequest.aggregate([
        { $match: { userId: sellerObjectId, userType: 'SELLER', status: 'Completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    return res.status(200).json({
        success: true,
        data: {
            availableBalance: round2(seller.balance || 0),
            onHoldBalance: round2(seller.onHoldBalance || 0),
            totalEarnings: round2(earnings?.total || 0),
            // Delivered COD orders awaiting rider remittance + orders not yet delivered
            pendingSettlement: round2(earnings?.pending || 0),
            totalWithdrawn: round2(withdrawn?.total || 0),
        },
    });
});

/**
 * Get wallet transactions
 */
export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { page = 1, limit = 10, type, status, searchQuery, fromDate, toDate } = req.query;

    const query: any = { userId: sellerId, userType: 'SELLER' };

    if (type) query.type = type;
    if (status) query.status = status;
    if (searchQuery) {
        const safe = escapeRegex(String(searchQuery));
        query.$or = [
            { description: { $regex: safe, $options: 'i' } },
            { reference: { $regex: safe, $options: 'i' } },
        ];
    }

    if (fromDate || toDate) {
        query.createdAt = {};
        if (fromDate) query.createdAt.$gte = new Date(fromDate as string);
        if (toDate) query.createdAt.$lte = new Date(toDate as string);
    }

    const transactions = await WalletTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

    const total = await WalletTransaction.countDocuments(query);

    return res.status(200).json({
        success: true,
        data: {
            transactions,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        },
    });
});

/**
 * Get withdrawal requests
 */
export const getWithdrawalRequests = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const query: any = { userId: sellerId, userType: 'SELLER' };
    if (status && status !== 'All') query.status = status;

    const requests = await WithdrawRequest.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

    const total = await WithdrawRequest.countDocuments(query);

    return res.status(200).json({
        success: true,
        data: {
            requests,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        },
    });
});

/**
 * Create withdrawal request — delegates to the shared service (same rules as /seller/wallet-new).
 * Balance is debited only when admin completes the withdrawal.
 */
export const createWithdrawalRequest = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const amount = round2(Number(req.body.amount));
    const paymentMethod = req.body.paymentMethod === 'UPI' ? 'UPI' : 'Bank Transfer';

    if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    const result = await createWithdrawalRequestService(sellerId, 'SELLER', amount, paymentMethod);
    if (!result.success) {
        return res.status(400).json(result);
    }
    return res.status(201).json(result);
});

/**
 * Get order earnings — per item, from commission records (actual rate, actual status).
 */
export const getOrderEarnings = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const query: any = { seller: sellerId, type: 'SELLER' };
    if (status && status !== 'All') {
        if (status === 'Settled') query.status = 'Paid';
        else if (status === 'OnHold') query.status = 'OnHold';
        else if (status === 'Cancelled') query.status = 'Cancelled';
        else query.status = 'Pending';
    }

    const commissions: any[] = await Commission.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('order', 'orderNumber')
        .populate('orderItem', 'productName')
        .lean();

    const total = await Commission.countDocuments(query);

    const statusLabel: Record<string, string> = { Paid: 'Settled', OnHold: 'OnHold', Pending: 'Pending', Cancelled: 'Cancelled' };
    const formattedEarnings = commissions.map((c) => ({
        id: c._id,
        orderId: c.order?._id || c.order,
        orderNumber: c.order?.orderNumber,
        source: c.orderItem?.productName,
        amount: round2(c.orderAmount),
        commissionRate: c.commissionRate,
        commission: round2(c.commissionAmount),
        netEarning: round2(c.orderAmount - c.commissionAmount),
        date: c.createdAt,
        status: statusLabel[c.status] || c.status,
    }));

    return res.status(200).json({
        success: true,
        data: {
            earnings: formattedEarnings,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        },
    });
});
