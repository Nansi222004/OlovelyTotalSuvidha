import WalletTransaction from "../models/WalletTransaction";
import WithdrawRequest from "../models/WithdrawRequest";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import Customer from "../models/Customer";
import AppSettings from "../models/AppSettings";
import mongoose from "mongoose";

export type WalletUserType = "SELLER" | "DELIVERY_BOY" | "CUSTOMER";
export type WalletCategory = "COD_RETURN_REFUND" | "ORDER_CANCELLATION_REFUND" | "ORDER_PAYMENT" | "MANUAL_ADMIN_CREDIT" | "MANUAL_ADMIN_DEBIT";

/**
 * Credit wallet
 */
export const creditWallet = async (
  userId: string,
  userType: WalletUserType,
  amount: number,
  description: string,
  relatedOrderId?: string,
  relatedCommissionId?: string,
  session?: mongoose.ClientSession,
  customReference?: string,
  category?: WalletCategory,
  relatedReturnId?: string,
) => {
  try {
    const reference = customReference || `CR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Idempotency check: check if transaction with this reference or relatedOrder/return already exists
    const existingQuery: any = { userId, userType, type: "Credit" };
    if (customReference) {
      existingQuery.reference = customReference;
    } else if (relatedOrderId) {
      existingQuery.relatedOrder = relatedOrderId;
    }

    const existingTxn = session
      ? await WalletTransaction.findOne(existingQuery).session(session)
      : await WalletTransaction.findOne(existingQuery);

    if (existingTxn) {
      console.warn(
        `[Idempotency Warning] Credit wallet skipped: Transaction already exists for ${userType} ${userId} (Txn: ${existingTxn._id})`,
      );
      return {
        success: true,
        message: "Wallet already credited for this operation",
        data: {
          transactionId: existingTxn._id,
          newBalance: await getWalletBalance(userId, userType, session),
        },
      };
    }

    const currentBalance = await getWalletBalance(userId, userType, session);
    const balanceAfter = currentBalance + amount;

    // Create transaction record
    const transactionData: any = {
      userId,
      userType,
      category,
      amount,
      balanceBefore: currentBalance,
      balanceAfter,
      type: "Credit",
      description,
      status: "Completed",
      reference,
      relatedOrder: relatedOrderId,
      relatedCommission: relatedCommissionId,
      relatedReturn: relatedReturnId,
    };

    const transaction = new WalletTransaction(transactionData);
    if (session) {
      await transaction.save({ session });
    } else {
      await transaction.save();
    }

    // Update user balance
    if (userType === "CUSTOMER") {
      const updateQuery = { $inc: { walletAmount: amount } };
      if (session) {
        await Customer.findByIdAndUpdate(userId, updateQuery, { session });
      } else {
        await Customer.findByIdAndUpdate(userId, updateQuery);
      }
    } else {
      const Model: any = userType === "SELLER" ? Seller : Delivery;
      const updateQuery = { $inc: { balance: amount } };
      if (session) {
        await Model.findByIdAndUpdate(userId, updateQuery, { session });
      } else {
        await Model.findByIdAndUpdate(userId, updateQuery);
      }
    }

    return {
      success: true,
      message: "Wallet credited successfully",
      data: {
        transactionId: transaction._id,
        newBalance: balanceAfter,
      },
    };
  } catch (error: any) {
    console.error("Error crediting wallet:", error);
    return {
      success: false,
      message: error.message || "Failed to credit wallet",
    };
  }
};

/**
 * Debit wallet
 */
export const debitWallet = async (
  userId: string,
  userType: WalletUserType,
  amount: number,
  description: string,
  relatedOrderId?: string,
  session?: mongoose.ClientSession,
  customReference?: string,
  category?: WalletCategory,
) => {
  try {
    const reference = customReference || `DR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Idempotency check
    if (customReference) {
      const existingTxn = session
        ? await WalletTransaction.findOne({ reference }).session(session)
        : await WalletTransaction.findOne({ reference });

      if (existingTxn) {
        return {
          success: true,
          message: "Wallet already debited for this reference",
          data: {
            transactionId: existingTxn._id,
            newBalance: await getWalletBalance(userId, userType, session),
          },
        };
      }
    }

    const currentBalance = await getWalletBalance(userId, userType, session);
    if (currentBalance < amount) {
      throw new Error("Insufficient wallet balance");
    }

    const balanceAfter = currentBalance - amount;

    // Create transaction record
    const transactionData: any = {
      userId,
      userType,
      category,
      amount,
      balanceBefore: currentBalance,
      balanceAfter,
      type: "Debit",
      description,
      status: "Completed",
      reference,
      relatedOrder: relatedOrderId,
    };

    const transaction = new WalletTransaction(transactionData);
    if (session) {
      await transaction.save({ session });
    } else {
      await transaction.save();
    }

    // Atomic update user balance with $gte check to guarantee no negative balances under race conditions
    if (userType === "CUSTOMER") {
      const updatedCust = session
        ? await Customer.findOneAndUpdate(
            { _id: userId, walletAmount: { $gte: amount } },
            { $inc: { walletAmount: -amount } },
            { session, new: true }
          )
        : await Customer.findOneAndUpdate(
            { _id: userId, walletAmount: { $gte: amount } },
            { $inc: { walletAmount: -amount } },
            { new: true }
          );

      if (!updatedCust) {
        throw new Error("Insufficient wallet balance for debit");
      }
    } else {
      const Model: any = userType === "SELLER" ? Seller : Delivery;
      const updatedUser = session
        ? await Model.findOneAndUpdate(
            { _id: userId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { session, new: true }
          )
        : await Model.findOneAndUpdate(
            { _id: userId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
          );

      if (!updatedUser) {
        throw new Error("Insufficient wallet balance for debit");
      }
    }

    return {
      success: true,
      message: "Wallet debited successfully",
      data: {
        transactionId: transaction._id,
        newBalance: balanceAfter,
      },
    };
  } catch (error: any) {
    console.error("Error debiting wallet:", error);
    return {
      success: false,
      message: error.message || "Failed to debit wallet",
    };
  }
};

/**
 * Get wallet balance
 */
export const getWalletBalance = async (
  userId: string,
  userType: WalletUserType,
  session?: mongoose.ClientSession,
): Promise<number> => {
  try {
    if (userType === "CUSTOMER") {
      const customer = session
        ? await Customer.findById(userId).session(session)
        : await Customer.findById(userId);
      return customer?.walletAmount || 0;
    }

    const Model: any = userType === "SELLER" ? Seller : Delivery;
    const user = session
      ? await Model.findById(userId).session(session)
      : await Model.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    return user.balance || 0;
  } catch (error: any) {
    console.error("Error getting wallet balance:", error);
    return 0;
  }
};

/**
 * R-11: balance the user can still request (available balance − open withdrawal reservations).
 */
export const getWithdrawableBalance = async (
  userId: string,
  userType: "SELLER" | "DELIVERY_BOY",
  session?: mongoose.ClientSession,
): Promise<number> => {
  const Model: any = userType === "SELLER" ? Seller : Delivery;
  const user = await Model.findById(userId).select("balance pendingWithdrawalAmount").session(session || null);
  if (!user) return 0;
  return Math.max(0, Math.round(((user.balance || 0) - (user.pendingWithdrawalAmount || 0)) * 100) / 100);
};

/** R-11: release what a withdrawal request reserved (no-op for legacy requests). */
export const releaseWithdrawalReservation = async (request: any, session?: mongoose.ClientSession) => {
  const amt = Number(request?.reservedAmount) || 0;
  if (amt <= 0) return;
  const Model: any = request.userType === "SELLER" ? Seller : Delivery;
  await Model.updateOne(
    { _id: request.userId },
    [
      {
        $set: {
          pendingWithdrawalAmount: {
            $max: [0, { $subtract: [{ $ifNull: ["$pendingWithdrawalAmount", 0] }, amt] }],
          },
        },
      },
    ],
    { session },
  );
};

/**
 * Get wallet transactions
 */
export const getWalletTransactions = async (
  userId: string,
  userType: WalletUserType,
  page: number = 1,
  limit: number = 20,
) => {
  try {
    const skip = (page - 1) * limit;

    const transactions = await WalletTransaction.find({ userId, userType })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("relatedOrder", "orderNumber")
      .populate("relatedCommission", "commissionAmount");

    const total = await WalletTransaction.countDocuments({ userId, userType });

    return {
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };
  } catch (error: any) {
    console.error("Error getting wallet transactions:", error);
    return {
      success: false,
      message: error.message || "Failed to get wallet transactions",
    };
  }
};

/**
 * Validate withdrawal request
 */
export const validateWithdrawal = async (
  userId: string,
  userType: "SELLER" | "DELIVERY_BOY",
  amount: number,
  paymentMethod: "Bank Transfer" | "UPI" = "Bank Transfer",
) => {
  try {
    // Check minimum withdrawal amount
    const settings = await AppSettings.findOne();
    const minAmount = settings?.minimumWithdrawalAmount || 100;

    if (amount < minAmount) {
      return {
        success: false,
        message: `Minimum withdrawal amount is ₹${minAmount}`,
      };
    }

    // Check WITHDRAWABLE balance: available balance minus amounts already reserved by
    // open withdrawal requests (R-11). Escrow (onHoldBalance) is never part of balance (B-5).
    const withdrawable = await getWithdrawableBalance(userId, userType);
    if (withdrawable < amount) {
      return {
        success: false,
        message: `Insufficient withdrawable balance (available ₹${withdrawable})`,
      };
    }

    // Check for pending withdrawal requests
    const pendingRequests = await WithdrawRequest.countDocuments({
      userId,
      userType,
      status: { $in: ["Pending", "Approved"] },
    });

    if (pendingRequests > 0) {
      return {
        success: false,
        message:
          "You have a pending withdrawal request. Please wait for it to be processed.",
      };
    }

    // Check user profile details according to payment method
    const Model: any = userType === "SELLER" ? Seller : Delivery;
    const user = await Model.findById(userId);

    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    if (paymentMethod === "UPI") {
      const upiId = (user as any).upiId;
      if (!upiId || typeof upiId !== "string" || !upiId.trim()) {
        return {
          success: false,
          message: "Please complete your UPI details before requesting a UPI withdrawal.",
        };
      }
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiRegex.test(upiId.trim())) {
        return {
          success: false,
          message: "Invalid UPI ID format. Please update your UPI ID in Account Settings.",
        };
      }
    } else {
      const ifsc = (user as any).ifsc || (user as any).ifscCode;
      if (!user.accountNumber || !ifsc || !user.bankName) {
        return {
          success: false,
          message:
            "Please complete your bank account details before requesting withdrawal",
        };
      }
    }

    return {
      success: true,
      message: "Withdrawal request is valid",
    };
  } catch (error: any) {
    console.error("Error validating withdrawal:", error);
    return {
      success: false,
      message: error.message || "Failed to validate withdrawal",
    };
  }
};

/**
 * Create withdrawal request
 */
export const createWithdrawalRequest = async (
  userId: string,
  userType: "SELLER" | "DELIVERY_BOY",
  amount: number,
  paymentMethod: "Bank Transfer" | "UPI",
) => {
  try {
    // Validate withdrawal
    const validation = await validateWithdrawal(userId, userType, amount, paymentMethod);
    if (!validation.success) {
      return validation;
    }

    // Get user details
    const Model: any = userType === "SELLER" ? Seller : Delivery;
    const user = await Model.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    let accountDetails = "";
    let upiIdSnapshot: string | undefined = undefined;

    if (paymentMethod === "UPI") {
      upiIdSnapshot = (user as any).upiId?.trim();
      accountDetails = upiIdSnapshot || "";
    } else {
      const ifsc = user.ifsc || user.ifscCode || "";
      accountDetails = `${user.bankName || 'Bank'} - ${user.accountNumber || ''} (${ifsc})`;
    }

    // R-11: reserve the amount and create the request atomically. The conditional $inc only
    // matches while (balance − already reserved) ≥ amount, so two concurrent requests can never
    // spend the same funds, even though validateWithdrawal above ran without a lock.
    let withdrawRequest: any;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const reserved = await Model.findOneAndUpdate(
          {
            _id: userId,
            $expr: {
              $gte: [
                { $subtract: [{ $ifNull: ["$balance", 0] }, { $ifNull: ["$pendingWithdrawalAmount", 0] }] },
                amount,
              ],
            },
          },
          { $inc: { pendingWithdrawalAmount: amount } },
          { session, new: true },
        );
        if (!reserved) throw new Error("Insufficient withdrawable balance");
        const open = await WithdrawRequest.countDocuments({
          userId,
          userType,
          status: { $in: ["Pending", "Approved"] },
        }).session(session);
        if (open > 0) throw new Error("You have a pending withdrawal request. Please wait for it to be processed.");
        [withdrawRequest] = await WithdrawRequest.create(
          [
            {
              userId,
              userType,
              amount,
              reservedAmount: amount,
              status: "Pending",
              paymentMethod,
              accountDetails,
              upiId: upiIdSnapshot,
            },
          ],
          { session },
        );
      });
    } catch (e: any) {
      return { success: false, message: e?.message || "Failed to create withdrawal request" };
    } finally {
      await session.endSession();
    }

    // Notify Admin about new withdrawal request (wrapped safely in try/catch)
    try {
      const { sendBroadcastNotification } = await import("./notificationService");
      const userName = (user as any).sellerName || (user as any).name || (user as any).storeName || "Seller";
      const formattedAmount = `₹${amount.toLocaleString("en-IN")}`;
      const batchKey = `${withdrawRequest._id}_REQUESTED`;

      const Notification = (await import("../models/Notification")).default;
      const existingNotif = await Notification.findOne({ broadcastBatchId: batchKey });

      if (!existingNotif) {
        const title = userType === "DELIVERY_BOY" ? "New Delivery Withdrawal Request" : "New Withdrawal Request";
        await sendBroadcastNotification(
          "Admin",
          title,
          `${userName} has requested a withdrawal of ${formattedAmount} via ${paymentMethod}.`,
          {
            type: "Payment",
            link: "/admin/wallet",
            priority: "High",
            broadcastBatchId: batchKey,
            data: {
              withdrawalId: withdrawRequest._id.toString(),
              amount: amount.toString(),
              paymentMethod,
              userType,
            },
          }
        );
      }
    } catch (notifErr) {
      console.error("Warning: Failed to dispatch Admin withdrawal notification:", notifErr);
    }

    return {
      success: true,
      message: "Withdrawal request created successfully",
      data: withdrawRequest,
    };
  } catch (error: any) {
    console.error("Error creating withdrawal request:", error);
    return {
      success: false,
      message: error.message || "Failed to create withdrawal request",
    };
  }
};

/**
 * Get withdrawal requests
 */
export const getWithdrawalRequests = async (
  userId: string,
  userType: "SELLER" | "DELIVERY_BOY",
  status?: string,
) => {
  try {
    const query: any = { userId, userType };
    if (status) {
      query.status = status;
    }

    const requests = await WithdrawRequest.find(query)
      .sort({ createdAt: -1 })
      .populate("processedBy", "name email");

    return {
      success: true,
      data: requests,
    };
  } catch (error: any) {
    console.error("Error getting withdrawal requests:", error);
    return {
      success: false,
      message: error.message || "Failed to get withdrawal requests",
    };
  }
};
