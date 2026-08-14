import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";

import mongoose from "mongoose";
import WithdrawRequest from "../../../models/WithdrawRequest";
import Delivery from "../../../models/Delivery";
import AppSettings from "../../../models/AppSettings";
import { debitWallet } from "../../../services/walletManagementService";

/**
 * Get Earnings History
 */
export const getEarningsHistory = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const objectId = new mongoose.Types.ObjectId(deliveryId);

    const { default: Commission } = await import("../../../models/Commission");

    // Aggregation to group earnings by day
    // Use Commission Model
    const earnings = await Commission.aggregate([
        {
            $match: {
                deliveryBoy: objectId,
                type: "DELIVERY_BOY",
                status: "Paid" // Only count paid commissions? Or all? Usually Paid.
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                },
                amount: { $sum: '$commissionAmount' },
                deliveries: { $sum: 1 }
            }
        },
        { $sort: { _id: -1 } }, // Sort by date descending
        { $limit: 30 } // Last 30 days
    ]);

    const formattedEarnings = earnings.map(day => {
        // Humanize date labels like "Today", "Yesterday"
        const date = new Date(day._id);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateLabel = day._id;
        if (date.toDateString() === today.toDateString()) dateLabel = "Today";
        else if (date.toDateString() === yesterday.toDateString()) dateLabel = "Yesterday";
        else {
            // Calculate "X days ago" if needed or leave date string
            const diffTime = Math.abs(today.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) dateLabel = `${diffDays} days ago`;
        }

        return {
            date: dateLabel,
            rawDate: day._id, // Keep raw date for sorting/logic if needed
            amount: day.amount,
            deliveries: day.deliveries
        };
    });

    return res.status(200).json({
        success: true,
        data: formattedEarnings
    });
});

/**
 * Request Withdrawal
 */
export const requestWithdrawal = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const { amount } = req.body;

    // 1. Get Delivery Profile & Balance
    const deliveryBoy = await Delivery.findById(deliveryId);
    if (!deliveryBoy) {
        return res.status(404).json({ success: false, message: "Delivery profile not found" });
    }

    if (deliveryBoy.balance <= 0) {
        return res.status(400).json({ success: false, message: "Insufficient balance for withdrawal" });
    }

    // Amount Validation
    let withdrawalAmount = deliveryBoy.balance; // Default to full balance

    if (amount) {
        withdrawalAmount = Number(amount);
        if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid withdrawal amount" });
        }

        if (withdrawalAmount > deliveryBoy.balance) {
            return res.status(400).json({ success: false, message: "Insufficient balance" });
        }
    }

    // 2. Check Bank Details
    if (!deliveryBoy.accountName || !deliveryBoy.accountNumber || !deliveryBoy.ifscCode) {
        return res.status(400).json({
            success: false,
            message: "Please update your bank details in profile before withdrawing"
        });
    }

    // 3. Check Minimum Withdrawal Amount from Settings
    const settings = await AppSettings.findOne();
    const minAmount = settings?.minimumWithdrawalAmount || 100;

    if (withdrawalAmount < minAmount) {
        return res.status(400).json({
            success: false,
            message: `Minimum withdrawal amount is ₹${minAmount}`
        });
    }

    // 4. Check for existing pending request
    const existingRequest = await WithdrawRequest.findOne({
        userId: deliveryBoy._id,
        status: "Pending"
    });

    if (existingRequest) {
        return res.status(400).json({
            success: false,
            message: "You already have a pending withdrawal request"
        });
    }

    // 5. Deduct Balance Immediately
    const debitResult = await debitWallet(
        deliveryBoy._id.toString(),
        "DELIVERY_BOY",
        withdrawalAmount,
        "Withdrawal Request"
    );

    if (!debitResult.success) {
        return res.status(400).json({
            success: false,
            message: debitResult.message || "Failed to process withdrawal deduction"
        });
    }

    // 6. Create Withdrawal Request
    const accountDetails = `${deliveryBoy.bankName} - ${deliveryBoy.accountNumber} (${deliveryBoy.ifscCode})`;

    const withdrawRequest = await WithdrawRequest.create({
        userId: deliveryBoy._id,
        userType: "DELIVERY_BOY",
        amount: withdrawalAmount,
        status: "Pending",
        paymentMethod: "Bank Transfer",
        accountDetails: accountDetails
    });

    return res.status(201).json({
        success: true,
        message: "Withdrawal request submitted successfully",
        data: withdrawRequest
    });
});
