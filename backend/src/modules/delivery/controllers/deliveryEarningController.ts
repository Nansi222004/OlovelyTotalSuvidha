import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";

import mongoose from "mongoose";
import WithdrawRequest from "../../../models/WithdrawRequest";
import Delivery from "../../../models/Delivery";
import AppSettings from "../../../models/AppSettings";
import { createWithdrawalRequest } from "../../../services/walletManagementService";

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
                // Same basis as the delivery dashboard (rider earnings are credited when created)
                status: { $ne: "Cancelled" }
            }
        },
        {
            $group: {
                _id: {
                    // IST business day (UTC grouping put 00:00–05:30 IST deliveries on the previous day)
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" }
                },
                amount: { $sum: '$commissionAmount' },
                deliveries: { $sum: 1 }
            }
        },
        { $sort: { _id: -1 } }, // Sort by date descending
        { $limit: 30 } // Last 30 days
    ]);

    // Labels use the same IST calendar day as the grouping above. Comparing against the server
    // clock (UTC) made today's earnings show as "1 days ago" between 00:00 and 05:30 IST.
    const istDayKey = (d: Date) =>
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    const dayNumber = (key: string) => Math.round(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86400000);
    const todayNumber = dayNumber(istDayKey(new Date()));

    const formattedEarnings = earnings.map(day => {
        // Humanize date labels like "Today", "Yesterday", "3 days ago"
        const diffDays = todayNumber - dayNumber(String(day._id));
        let dateLabel = day._id;
        if (diffDays === 0) dateLabel = "Today";
        else if (diffDays === 1) dateLabel = "Yesterday";
        else if (diffDays > 1 && diffDays <= 7) dateLabel = `${diffDays} days ago`;

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
    // Delegates to the shared withdrawal service used by /delivery/wallet/withdraw and sellers.
    // Previously this endpoint debited the balance at REQUEST time while admin "Complete" debits
    // again (double debit), and a rejected request was never refunded.
    const deliveryId = req.user?.userId as string;
    const deliveryBoy = await Delivery.findById(deliveryId).select("balance");
    if (!deliveryBoy) {
        return res.status(404).json({ success: false, message: "Delivery profile not found" });
    }

    // Amount defaults to the full available balance (existing behaviour of this endpoint)
    const raw = req.body?.amount;
    const withdrawalAmount = Math.round(Number(raw === undefined || raw === null || raw === "" ? deliveryBoy.balance : raw) * 100) / 100;
    if (!Number.isFinite(withdrawalAmount) || withdrawalAmount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid withdrawal amount" });
    }

    const result = await createWithdrawalRequest(deliveryId, "DELIVERY_BOY", withdrawalAmount, "Bank Transfer");
    if (!result.success) {
        return res.status(400).json(result);
    }
    return res.status(201).json({
        success: true,
        message: "Withdrawal request submitted successfully",
        data: (result as any).data,
    });
});
