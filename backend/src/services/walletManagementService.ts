import WalletTransaction from "../models/WalletTransaction";
import WithdrawRequest from "../models/WithdrawRequest";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import AppSettings from "../models/AppSettings";
import mongoose from "mongoose";

/**
 * Credit wallet
 */
export const creditWallet = async (
  userId: string,
  userType: "SELLER" | "DELIVERY_BOY",
  amount: number,
  description: string,
  relatedOrderId?: string,
  relatedCommissionId?: string,
  session?: mongoose.ClientSession,
) => {
  try {
    // Generate unique reference
    const reference = `CR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create transaction record
    const transaction = new WalletTransaction({
      userId,
      userType,
      amount,
      type: "Credit",
      description,
      status: "Completed",
      reference,
      relatedOrder: relatedOrderId,
      relatedCommission: relatedCommissionId,
    });

    if (session) {
      await transaction.save({ session });
    } else {
      await transaction.save();
    }

    // Update user balance
    const Model: any = userType === "SELLER" ? Seller : Delivery;
    const updateQuery = { $inc: { balance: amount } };

    if (session) {
      await Model.findByIdAndUpdate(userId, updateQuery, { session });
    } else {
      await Model.findByIdAndUpdate(userId, updateQuery);
    }

    return {
      success: true,
      message: "Wallet credited successfully",
      data: {
        transactionId: transaction._id,
        newBalance: await getWalletBalance(userId, userType),
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
  userType: "SELLER" | "DELIVERY_BOY",
  amount: number,
  description: string,
  relatedOrderId?: string,
  session?: mongoose.ClientSession,
) => {
  try {
    // Check balance
    const currentBalance = await getWalletBalance(userId, userType);
    if (currentBalance < amount) {
      throw new Error("Insufficient wallet balance");
    }

    // Generate unique reference
    const reference = `DR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create transaction record
    const transaction = new WalletTransaction({
      userId,
      userType,
      amount,
      type: "Debit",
      description,
      status: "Completed",
      reference,
      relatedOrder: relatedOrderId,
    });

    if (session) {
      await transaction.save({ session });
    } else {
      await transaction.save();
    }

    // Update user balance
    const Model: any = userType === "SELLER" ? Seller : Delivery;
    const updateQuery = { $inc: { balance: -amount } };

    if (session) {
      await Model.findByIdAndUpdate(userId, updateQuery, { session });
    } else {
      await Model.findByIdAndUpdate(userId, updateQuery);
    }

    return {
      success: true,
      message: "Wallet debited successfully",
      data: {
        transactionId: transaction._id,
        newBalance: await getWalletBalance(userId, userType),
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
  userType: "SELLER" | "DELIVERY_BOY",
): Promise<number> => {
  try {
    const Model: any = userType === "SELLER" ? Seller : Delivery;
    const user = await Model.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    return user.balance || 0;
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    return 0;
  }
};

/**
 * Get wallet transactions
 */
export const getWalletTransactions = async (
  userId: string,
  userType: "SELLER" | "DELIVERY_BOY",
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

    // Check balance
    const balance = await getWalletBalance(userId, userType);
    if (balance < amount) {
      return {
        success: false,
        message: "Insufficient wallet balance",
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

    // Check bank details
    const Model: any = userType === "SELLER" ? Seller : Delivery;
    const user = await Model.findById(userId);

    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const ifsc = (user as any).ifsc || (user as any).ifscCode;
    if (!user.accountNumber || !ifsc || !user.bankName) {
      return {
        success: false,
        message:
          "Please complete your bank account details before requesting withdrawal",
      };
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
    const validation = await validateWithdrawal(userId, userType, amount);
    if (!validation.success) {
      return validation;
    }

    // Get user details
    const Model: any = userType === "SELLER" ? Seller : Delivery;
    const user = await Model.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Create account details string
    const accountDetails = `${user.bankName} - ${user.accountNumber} (${user.ifscCode})`;

    // Create withdrawal request
    const withdrawRequest = new WithdrawRequest({
      userId,
      userType,
      amount,
      status: "Pending",
      paymentMethod,
      accountDetails,
    });

    await withdrawRequest.save();

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
