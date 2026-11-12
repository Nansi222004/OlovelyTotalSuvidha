import { Request, Response } from 'express';
import WithdrawRequest from '../../../models/WithdrawRequest';
import { debitWallet, releaseWithdrawalReservation } from '../../../services/walletManagementService';
import mongoose from 'mongoose';
import PlatformWallet from '../../../models/PlatformWallet';

/**
 * Get all withdrawal requests
 */
export const getAllWithdrawals = async (req: Request, res: Response) => {
    try {
        const { status, userType, page = 1, limit = 20 } = req.query;

        const query: any = {};
        if (status) query.status = status;
        if (userType) query.userType = userType;

        const skip = (Number(page) - 1) * Number(limit);

        const requests = await WithdrawRequest.find(query)
            .populate('userId', 'sellerName storeName name email mobile accountNumber bankName ifsc ifscCode upiId')
            .populate('processedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await WithdrawRequest.countDocuments(query);

        return res.status(200).json({
            success: true,
            data: {
                requests,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit)),
                },
            },
        });
    } catch (error: any) {
        console.error('Error getting withdrawal requests:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get withdrawal requests',
        });
    }
};

/**
 * Approve withdrawal request
 */
export const approveWithdrawal = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminId = (req as any).user!.userId;

        const request = await WithdrawRequest.findById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found',
            });
        }

        if (request.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot approve ${request.status.toLowerCase()} request`,
            });
        }

        // Atomic claim: two admins approving at once cannot both succeed
        const approved = await WithdrawRequest.findOneAndUpdate(
            { _id: request._id, status: 'Pending' },
            { $set: { status: 'Approved', processedBy: new mongoose.Types.ObjectId(adminId), processedAt: new Date() } },
            { new: true },
        );
        if (!approved) {
            return res.status(409).json({ success: false, message: 'Request was processed by someone else' });
        }
        request.status = 'Approved';

        // Notify Seller (safely wrapped in try/catch with idempotency check)
        try {
            const batchKey = `${request._id}_APPROVED`;
            const Notification = (await import('../../../models/Notification')).default;
            const existingNotif = await Notification.findOne({ broadcastBatchId: batchKey });

            if (!existingNotif) {
                const { sendNotification } = await import('../../../services/notificationService');
                const recipientType = request.userType === 'SELLER' ? 'Seller' : 'Delivery';
                const formattedAmount = `₹${request.amount.toLocaleString('en-IN')}`;

                await sendNotification(
                    recipientType,
                    request.userId.toString(),
                    'Withdrawal Approved',
                    `Your withdrawal request of ${formattedAmount} has been approved and is being processed.`,
                    {
                        type: 'Success',
                        link: recipientType === 'Seller' ? '/seller/wallet' : '/delivery/wallet',
                        priority: 'High',
                        broadcastBatchId: batchKey,
                        data: {
                            withdrawalId: request._id.toString(),
                            amount: request.amount.toString(),
                            paymentMethod: request.paymentMethod,
                            status: 'Approved',
                        },
                    }
                );
            }
        } catch (notifErr) {
            console.error('Warning: Failed to dispatch Approved withdrawal notification:', notifErr);
        }

        return res.status(200).json({
            success: true,
            message: 'Withdrawal request approved successfully',
            data: request,
        });
    } catch (error: any) {
        console.error('Error approving withdrawal:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to approve withdrawal',
        });
    }
};

/**
 * Reject withdrawal request
 */
export const rejectWithdrawal = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;
        const adminId = (req as any).user!.userId;

        const request = await WithdrawRequest.findById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found',
            });
        }

        if (request.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot reject ${request.status.toLowerCase()} request`,
            });
        }

        // Atomic claim + release of the reserved amount (R-11)
        const rjSession = await mongoose.startSession();
        let rejected: any = null;
        try {
            await rjSession.withTransaction(async () => {
                rejected = await WithdrawRequest.findOneAndUpdate(
                    { _id: request._id, status: 'Pending' },
                    {
                        $set: {
                            status: 'Rejected',
                            processedBy: new mongoose.Types.ObjectId(adminId),
                            processedAt: new Date(),
                            ...(remarks ? { remarks } : {}),
                        },
                    },
                    { new: true, session: rjSession },
                );
                if (rejected) await releaseWithdrawalReservation(rejected, rjSession);
            });
        } finally {
            await rjSession.endSession();
        }
        if (!rejected) {
            return res.status(409).json({ success: false, message: 'Request was processed by someone else' });
        }
        request.status = 'Rejected';

        // Notify Seller (safely wrapped in try/catch with idempotency check)
        try {
            const batchKey = `${request._id}_REJECTED`;
            const Notification = (await import('../../../models/Notification')).default;
            const existingNotif = await Notification.findOne({ broadcastBatchId: batchKey });

            if (!existingNotif) {
                const { sendNotification } = await import('../../../services/notificationService');
                const recipientType = request.userType === 'SELLER' ? 'Seller' : 'Delivery';
                const formattedAmount = `₹${request.amount.toLocaleString('en-IN')}`;
                let message = `Your withdrawal request of ${formattedAmount} has been rejected.`;
                if (remarks && remarks.trim()) {
                    message += ` Reason: ${remarks.trim()}`;
                }

                await sendNotification(
                    recipientType,
                    request.userId.toString(),
                    'Withdrawal Rejected',
                    message,
                    {
                        type: 'Warning',
                        link: recipientType === 'Seller' ? '/seller/wallet' : '/delivery/wallet',
                        priority: 'High',
                        broadcastBatchId: batchKey,
                        data: {
                            withdrawalId: request._id.toString(),
                            amount: request.amount.toString(),
                            paymentMethod: request.paymentMethod,
                            status: 'Rejected',
                            ...(remarks ? { remarks } : {}),
                        },
                    }
                );
            }
        } catch (notifErr) {
            console.error('Warning: Failed to dispatch Rejected withdrawal notification:', notifErr);
        }

        return res.status(200).json({
            success: true,
            message: 'Withdrawal request rejected successfully',
            data: request,
        });
    } catch (error: any) {
        console.error('Error rejecting withdrawal:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to reject withdrawal',
        });
    }
};

/**
 * Complete withdrawal request
 */
export const completeWithdrawal = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { transactionReference } = req.body;
        const adminId = (req as any).user!.userId;

        if (!transactionReference) {
            return res.status(400).json({
                success: false,
                message: 'Transaction reference is required',
            });
        }

        const request = await WithdrawRequest.findById(id).session(session);
        if (!request) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found',
            });
        }

        if (request.status !== 'Approved') {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Only approved requests can be completed',
            });
        }

        // Atomic claim Approved → Completed inside this transaction
        const claimed = await WithdrawRequest.findOneAndUpdate(
            { _id: request._id, status: 'Approved' },
            { $set: { status: 'Completed' } },
            { session, new: true },
        );
        if (!claimed) {
            await session.abortTransaction();
            return res.status(409).json({ success: false, message: 'Request was processed by someone else' });
        }

        // Debit from wallet (unique reference: a request can only ever be paid once)
        const debitResult = await debitWallet(
            request.userId.toString(),
            request.userType,
            request.amount,
            `Withdrawal completed - ${transactionReference}`,
            undefined,
            session,
            `WITHDRAWAL_${request._id.toString()}`
        );

        if (!debitResult.success) {
            await session.abortTransaction();
            return res.status(400).json(debitResult);
        }

        // Update Platform Wallet balance
        const platformWallet = await PlatformWallet.getWallet();
        platformWallet.currentPlatformBalance = Math.max(0, platformWallet.currentPlatformBalance - request.amount);
        // Also update the aggregate counters to keep them in sync if used
        if (request.userType === 'SELLER') {
            platformWallet.sellerPendingPayouts = Math.max(0, platformWallet.sellerPendingPayouts - request.amount);
        } else {
            platformWallet.deliveryBoyPendingPayouts = Math.max(0, platformWallet.deliveryBoyPendingPayouts - request.amount);
        }
        await platformWallet.save({ session });

        await releaseWithdrawalReservation(request, session);

        // Update request
        request.status = 'Completed';
        request.transactionReference = transactionReference;
        request.processedBy = new mongoose.Types.ObjectId(adminId);
        request.processedAt = new Date();
        await request.save({ session });

        await session.commitTransaction();

        // Notify Seller after transaction is committed (safely wrapped in try/catch)
        try {
            const batchKey = `${request._id}_COMPLETED`;
            const Notification = (await import('../../../models/Notification')).default;
            const existingNotif = await Notification.findOne({ broadcastBatchId: batchKey });

            if (!existingNotif) {
                const { sendNotification } = await import('../../../services/notificationService');
                const recipientType = request.userType === 'SELLER' ? 'Seller' : 'Delivery';
                const formattedAmount = `₹${request.amount.toLocaleString('en-IN')}`;

                let destinationText = 'your bank account.';
                if (request.paymentMethod === 'UPI') {
                    destinationText = 'your UPI ID.';
                }

                let message = `Your withdrawal of ${formattedAmount} has been successfully transferred to ${destinationText}`;
                if (transactionReference && transactionReference.trim()) {
                    message += ` Transaction Reference: ${transactionReference.trim()}`;
                }

                await sendNotification(
                    recipientType,
                    request.userId.toString(),
                    'Withdrawal Completed',
                    message,
                    {
                        type: 'Success',
                        link: recipientType === 'Seller' ? '/seller/wallet' : '/delivery/wallet',
                        priority: 'High',
                        broadcastBatchId: batchKey,
                        data: {
                            withdrawalId: request._id.toString(),
                            amount: request.amount.toString(),
                            paymentMethod: request.paymentMethod,
                            status: 'Completed',
                            ...(transactionReference ? { transactionReference } : {}),
                        },
                    }
                );
            }
        } catch (notifErr) {
            console.error('Warning: Failed to dispatch Completed withdrawal notification:', notifErr);
        }

        return res.status(200).json({
            success: true,
            message: 'Withdrawal completed successfully',
            data: request,
        });
    } catch (error: any) {
        await session.abortTransaction();
        console.error('Error completing withdrawal:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to complete withdrawal',
        });
    } finally {
        session.endSession();
    }
};
